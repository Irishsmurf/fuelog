# Fuelog: rebuild plan and target design

Status: proposal, 2026-11-16. Based on four parallel audits: frontend, backend and data, tooling and CI, and features and domain.

## 1. Verdict: rebuild the core in place, not a big-bang rewrite

The fragility is real, but it comes from a few clear causes, not from everything:

| Root cause | Symptoms |
|---|---|
| **No single write path or domain layer** | Logs are written from 4 pages, REST, MCP and scripts, each with different rules. Calculations are copied in 3 places. Derived data (station stats, odometer to distance) is computed in the browser and drifts, so backfill scripts are needed to repair it. |
| **Three deployables in one npm package** | Server SDKs (`firebase-admin`, `@google/genai`, MCP SDK) sit in the SPA manifest. This needs the `jose`/`uuid` overrides and `legacy-peer-deps`, and caused ERR_REQUIRE_ESM twice. The backend is split across Vercel `api/` and Firebase `functions/`, and the two use different firebase-admin major versions. |
| **CI gives false confidence** | `tsc --noEmit` checks nothing, `api/` has 37 type errors, the E2E smoke test only checks for HTTP 200, functions and rules tests are not in CI, and every Dependabot PR fails on `validate-env`. 17 of 55 commits are fixes, mostly for production-only bundling failures that CI could not see. |
| **God pages with no data layer** | QuickLog has 847 lines and about 25 `useState`s; History has 740. Firestore is called directly, nothing is cached, reads are unvalidated `as` casts, and effects race. |

Worth keeping:
- The stack: React 19, Vite, Tailwind v4, Firebase.
- The Nocturne design tokens, i18n with its parity test, and 346 passing unit tests.
- `calculations.ts`, `budgetAlerts.ts` (the best code in the repo), the token hashing, the MCP tool structure, the backfill scripts and the PWA setup.

A from-scratch rewrite would throw these away, along with the edge-case fixes built into QuickLog (back-dating, manual pins, non-fatal warnings). So the plan is to **rebuild the foundations (repo layout, domain package, data model, single backend, data layer), then rewrite the large pages on top of them one at a time.** The app keeps shipping throughout.

## 2. Phase 0: fix urgent problems (do this now, separately from the rest)

1. **Fix the critical security bug: account takeover via `apiTokens`.** The update rule checks only `resource.data.userId`, not the new value (`firebase/firestore.rules:40`). A user can re-point their own token at another user's uid and get full REST and MCP access to that user's data. The same gap exists on `fuelLogs` and `vehicles`. Fix:
   - `userId` can never change on any update.
   - `apiTokens` updates may only set `isRevoked: true`.
   - `stations` becomes server-write-only.
   - Add field type checks.
   - Add `@firebase/rules-unit-testing` tests against the emulator, run in CI.
2. **Fix CI:**
   - Switch to `tsc -b`, add `api/` and `functions/` to type-checking, and fix the errors.
   - Remove `validate-env` from PR builds.
   - Add a `functions` job and a Dependabot entry for `functions/`.
   - Gate deploys on CI.
3. **Replace the smoke test** with one that runs `vite preview`, visits `/`, `/history` and `/map`, and asserts that no `pageerror` or console errors occur. This would have caught #189, #190 and #247.
4. **Triage the 3 critical and the direct high `npm audit` advisories.**
5. **Fix the REST API:** an allowlist of updatable fields with zod validation, a cap on `limit`, and a per-user rate limit on `extract-receipt`.

## 3. Target architecture

```
fuelog/                      npm workspaces
├─ packages/core/            pure TS, ESM, no Firebase SDK
│   ├─ schema/               zod: FuelLog, Vehicle, Station, UserProfile, ApiToken
│   ├─ calc/                 efficiency, cost, monthly totals, currency
│   └─ rules/                invariants: odometer chain, distance derivation, partial fills
├─ apps/web/                 Vite SPA (browser deps only)
│   ├─ data/                 Firestore converters (core schemas) + TanStack Query hooks
│   ├─ features/<area>/      quick-log, history, dashboard, vehicles, stations, map, settings
│   └─ ui/                   Nocturne components
└─ apps/functions/           Firebase Functions v2, europe-west1 (next to eur3 Firestore)
    ├─ http/rest, http/mcp   moved from api/ + src/mcp
    ├─ http/extractReceipt   Gemini structured output; key in Secret Manager
    ├─ triggers/onLogWrite   derived data (see §4)
    └─ scheduled/            budget alerts, token cleanup
```

**Decisions:**

1. **Single backend: Firebase Functions v2.** Firestore triggers have to run on Firebase anyway, so REST, MCP and receipt extraction move there too. That gives one firebase-admin version, one region and one deploy pipeline. The `jose`/`uuid` overrides go away because the SPA no longer depends on server SDKs. The SPA can stay on Vercel as static hosting (previews are useful), or move to Firebase Hosting with rewrites; that is your call, see §7.
2. **`packages/core` is the single source of truth** for shapes and maths. The web app, REST, MCP, triggers and scripts all import it. Firestore reads go through `withConverter` plus a zod parse, and unknown or legacy documents fail loudly instead of being cast.
3. **The browser keeps direct Firestore writes** so the app keeps working offline, but:
   - rules enforce the schema;
   - the client writes only *user-entered* fields;
   - **all derived data is computed on the server** by an idempotent trigger.
4. **Frontend data layer: TanStack Query** wrapping Firestore:
   - hooks such as `useVehicles`, `useLogs(filter)` and `useSaveLog`;
   - optimistic writes (do not wait for the server to acknowledge `addDoc`, so the app works offline);
   - one cache, cancelled requests and de-duplication.
   - Pages become thin compositions of a form hook plus sections.
5. **One map stack: MapLibre GL on its own** (via `react-map-gl/maplibre`), using its built-in clustering and heatmap layers. Drop Leaflet, react-leaflet, leaflet.heat, the markercluster release candidate and the Leaflet-to-MapLibre bridge. This removes the `window.L` and worker-URL hacks behind several production incidents. Log-card thumbnails become a static image, or are removed.
6. **Remove Remote Config feature flags.** Core features such as the odometer and lifetime totals become standard. If you still want flags, use a small typed static config. Without it, the theme no longer waits on a network fetch.

## 4. Data model v2

Keep top-level collections, which leaves room for shared vehicles later. Add `schemaVersion` to every document.

**`fuelLogs`**. The user enters:
- `userId`, `vehicleId` (now **required**), `filledAt`
- `odometerKm` (primary input) **or** `distanceKm`, `fuelAmountLiters`
- `originalCost` and `currency`
- `fillType: 'full' | 'partial'` and `missedPrevious: boolean`. Efficiency is only correct between two full fills, and these fields make anomaly detection and forecasts possible.
- `brand`, `location {lat, lng, accuracy}`, `receiptPath` (a storage path, not a download URL)
- `source: 'app' | 'import' | 'api' | 'mcp'`, which leaves room for later integrations

**Server-derived**, written by `onLogWrite`:
- `distanceKm` when the odometer was given, and recalculated for the next log when a log is edited, back-dated or deleted.
- `cost` in home currency plus `exchangeRate`, with the rate date taken from the user's local date.
- `stationId`, found through an Overpass lookup on the server.
- `pricePerLitre` and `efficiency`.

**`stations`**:
- Server-write-only.
- Stats are kept **per currency** and updated with increments and decrements on create, update and delete. Mixing currencies across users is a current bug.

**`userProfiles`**:
- Unchanged apart from `units` (distance and volume) and `locale`.
- The currency symbol and units come from settings everywhere, including the PDF and `formatCostPerMile`.

**Migration:**
- A one-off, dry-run-capable script built from the existing `backfillOdometer` and `assignStationsToLogs` patterns.
- After it runs, the client-side migration in ProfilePage and the backfill scripts are deleted.

## 5. Feature scope for the rebuild

| Keep (rebuild on new core) | Simplify | Drop |
|---|---|---|
| Quick log, vehicles, history (edit/delete), dashboard and efficiency, multi-currency, home currency, budgets and budget alerts, geolocation and station lookup, PWA and offline, i18n, dark mode, import/export, API tokens, REST, MCP, receipt AI | Export becomes server-side or full-query CSV/PDF (fixes the "only the loaded page" bug). Import accepts CSV and TSV and reads odometer and currency. Push notifications keep only budget alerts. Map uses a single engine. | Admin console and test-notification callable, receipt thumbnail function (never read), Remote Config flags, Toyota integration, duplicate Firebase Analytics (keep Vercel Analytics), `@sentry/node`, unused CLIs |

Leave room for, but do not build: the maintenance tracker (per-vehicle service events), shared vehicles (vehicle membership), EV energy units.

## 6. Delivery sequence (each step ships on its own)

| # | Step | Exit criteria |
|---|---|---|
| 0 | Urgent fixes (§2) | Rules tests green in CI; takeover closed; real smoke test |
| 1 | Workspaces: move `api/` + `src/mcp` → `apps/functions`, SPA → `apps/web`, create `packages/core` | `tsc -b` across all; per-package lint and test; overrides removed |
| 2 | `packages/core` schemas, calculations and invariants; remove duplicates | One copy of the efficiency maths; property tests on the odometer chain |
| 3 | `onLogWrite` trigger and server-only stations; migration script; Functions deploy pipeline (OIDC) | Station stats correct after edit/delete; backfill scripts retired |
| 4 | Data layer (TanStack Query + converters), then rewrite pages: **QuickLog → History → Profile/Vehicles → Dashboard** | Each page under about 250 lines, no direct Firestore calls; works offline; existing tests ported |
| 5 | Switch to MapLibre only; remove flags; lazy-load locales; precache budget (exclude the map, PDF and canvas chunks) | Precache well below the current 5.6 MB; bundle budget enforced in CI |
| 6 | Re-enable Playwright with the Auth emulator: log, edit and delete; offline save; map renders | E2E gate on deploy |
| 7 | Bring the docs up to date: a `CONTEXT.md` glossary, ADRs for each decision in §3, and removal of stale docs (ISSUES.md, Toyota plan) | Docs match the code |

## 7. Decisions needed from you

1. **SPA hosting:** stay on Vercel (static only, recommended for previews) or move to Firebase Hosting (one platform).
2. **Drop list in §5:** confirm the admin console, Toyota, weekly digest and monthly-summary notifications, and log-card map thumbnails.
3. **Home-currency change:** keep historic costs as recorded (recommended; show the original currency), or recompute them.
4. **Languages:** keep all 10, or cut to those with real users.
