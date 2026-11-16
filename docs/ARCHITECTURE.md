# Fuelog Architecture

Fuelog is a React single-page app (Vite, TypeScript) backed by Firebase, with a
few Vercel serverless functions. Domain terms are defined in
[`CONTEXT.md`](../CONTEXT.md); the reasons behind the structure are in
[`docs/adr/`](adr/); the rebuild in progress is in [`REWRITE_PLAN.md`](REWRITE_PLAN.md).

## Repository layout

| Path | What it is |
| :--- | :--- |
| `src/` | The SPA (React 19, Tailwind CSS 4). |
| `packages/core/` | `@fuelog/core` npm workspace: zod document schemas, efficiency/unit/monthly maths, odometer rules, `localizeStation`. No Firebase SDK. |
| `api/` | Vercel functions: `rest.ts` (REST API), `mcp.ts` (MCP server), `extract-receipt.ts` (Gemini receipt extraction). They share `src/mcp/` and import core by relative path ([ADR 0002](adr/0002-shared-core-package.md)). |
| `functions/` | Firebase Cloud Functions v2 (separate npm project, Node 22). |
| `firebase/` | Firestore rules and indexes, Storage rules. |

## Frontend

- **Pages** in `src/pages/`, components in `src/components/`.
- **Contexts:** `AuthContext` (user and profile), `ThemeContext`,
  `ApiTokenContext`. There are no feature flags.
- **Data layer:** `src/data/` holds plain Firestore queries (e.g. `fetchLogsPage`,
  full-query exports), read through TanStack Query (`src/data/queryClient.ts`).
  History uses it; other pages still call `src/firebase/firestoreService.ts`
  directly ([ADR 0005](adr/0005-tanstack-query-data-layer.md)).
- **Validated reads:** every Firestore read goes through
  `src/firebase/converters.ts`, which parses it with the core schemas and
  reports invalid documents to Sentry once instead of dropping them.
- **Writes:** the browser writes logs, vehicles, profiles, API tokens and FCM
  tokens directly; the rules enforce ownership and shape
  ([ADR 0004](adr/0004-client-direct-writes-with-rules.md)).
- **Offline:** Firestore `persistentLocalCache` with `persistentSingleTabManager`.
  QuickLog treats a queued write as saved when offline. The PWA (vite-plugin-pwa,
  Workbox) precaches the app shell.
- **Maps:** Leaflet / react-leaflet with MapLibre GL vector basemaps via
  `@maplibre/maplibre-gl-leaflet`.
- **Calculations:** the maths lives in `@fuelog/core`; `src/utils/calculations.ts`
  only formats results for display.

## Backend

- **Firestore collections:** see [FIREBASE.md](FIREBASE.md#firestore-schema).
- **Cloud Functions:** see [FIREBASE.md](FIREBASE.md#cloud-functions). Derived
  data that the server owns (station price stats) is maintained by idempotent
  triggers and one-shot migrations
  ([ADR 0003](adr/0003-server-owned-derived-data.md)).
- **REST and MCP:** authenticated with hashed API tokens; see
  [REST_API.md](REST_API.md) and [MCP.md](MCP.md).
- **Receipt extraction:** `POST /api/extract-receipt` with a Firebase ID token;
  Gemini key is server-side (`GEMINI_API_KEY`); limited per user per UTC day by
  `usageQuotas` (`RECEIPT_DAILY_LIMIT`, default 50).

## Deployment

- **SPA and `api/`:** Vercel, deployed from GitHub Actions on push to `main`,
  then smoke-tested on the production domain and rolled back on failure.
- **Rules, indexes and Functions:** the Firebase Deploy workflow on push to `main`.
- **Analytics:** `@vercel/analytics`; errors to Sentry.

See [ADR 0006](adr/0006-deploy-pipeline.md).
