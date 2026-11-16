# Fuelog domain context

Glossary and invariants for the fuel-logging domain. Schemas live in
`packages/core/src/schema.ts` (zod); rules in `firebase/firestore.rules`.
Decisions are in [`docs/adr/`](docs/adr/).

## Terms

**Fuel log** (`fuelLogs`): one fill-up. Owned by `userId`; never changes owner.
- `timestamp`: when the fill-up happened (the user can back-date it), not when it was saved.
- `cost`: total paid, **in the owner's home currency** at the time of saving. All
  totals, budgets, analytics and station stats use `cost`.
- `originalCost` + `currency`: what was actually paid, in the currency on the receipt.
  Present only when it differed from the home currency.
- `exchangeRate`: 1 unit of `currency` = `exchangeRate` units of home currency, so
  `cost = originalCost × exchangeRate`. The rate is for the fill-up's *local* date
  (Frankfurter API). Historic costs are not recomputed when the home currency changes.
- `fuelAmountLiters`: litres added.
- `odometerKm`: the vehicle's odometer reading at the fill-up (optional).
- `distanceKm`: distance driven since the previous fill-up. Entered directly, or
  derived from the odometer (see invariants).
- `vehicleId`: the vehicle filled (optional on legacy logs).
- `brand`, `latitude`/`longitude`/`locationAccuracy`, `stationId`: where.
- `receiptUrl`: Storage download URL of the receipt image.
- **v2 fields** (in the schema, optional, not yet written by any client):
  - `fillType: 'full' | 'partial'`: efficiency is only exact between two full fills.
  - `missedPrevious: boolean`: a fill-up before this one was not logged.
  - `source: 'app' | 'import' | 'api' | 'mcp'`: which writer created the log.
  - `schemaVersion`: current version is `2`. Absent means legacy (v1).

**Vehicle** (`vehicles`): `name`, `make`, `model`, `year` (stored as a string),
`fuelType` (`Petrol | Diesel | Hybrid | Electric`), `isDefault`, `isArchived`.
At most one default per user. The app refuses to delete a vehicle that has logs
(archive it instead); the REST API does not yet check this.

**Station** (`stations`): a filling station shared by all users. Document id is
the OpenStreetMap id with `/` replaced by `_` (e.g. `node_123`). Fields: `osmId`,
`name`, `brand`, `latitude`, `longitude`, `address`.
- **`priceStats.<CUR>`**: server-maintained price-per-litre stats per currency
  (`count`, `total`, `avgPrice`, `lastPrice`, `lastAt`). A log contributes to the
  bucket of its owner's home currency.
- **Legacy `avgPrice` / `lastPrice` / `logCount`**: old client-maintained aggregates
  that mixed currencies. Superseded by `priceStats`; `localizeStation` shows only
  the viewer's currency bucket when `priceStats` exists.

**User profile** (`userProfiles/{uid}`): `homeCurrency` (default `EUR`),
`monthlyBudget`, `notificationsEnabled`, `hasSeenImportOnboarding`, `tester_group`.

**API token** (`apiTokens`): a personal token for the REST API and MCP server.
Only the SHA-256 `tokenHash` and a display `tokenPrefix` are stored. `scopes` ⊆
`read:logs`, `write:logs`, `read:vehicles`, `write:vehicles`. `expiresAt`
(optional), `lastUsedAt` (server-written), `isRevoked`.

**Usage quota** (`usageQuotas/{uid}_{kind}_{YYYY-MM-DD}`): per-user, per-UTC-day
counter (e.g. receipt scans, limit `RECEIPT_DAILY_LIMIT`, default 50). Server-only.

**Trigger event** (`triggerEvents/stationStats_{eventId}`): marker that a
Firestore trigger event was already applied, so redelivery is a no-op. Has
`expireAt` (7 days) for a TTL policy.

**Migration** (`migrations/{id}`): completion record of a one-shot server data
migration run by `runMigrations`. Present means done; never runs again.

Other server-only collections: `budgetAlerts/{uid}_{YYYY-MM}` (thresholds already
alerted this month), `testNotifications` (dev tool audit), `mail` (Trigger Email
extension). `fcmTokens/{token}` holds a user's web push tokens.

## Invariants

- **Ownership**: `userId` is set on create and can never change (enforced by rules).
- **Home currency**: `cost` is always home currency; anything comparing prices
  across users must group by currency.
- **Odometer order**: per vehicle, odometer readings increase with `timestamp`
  (`findOdometerViolations` reports breaks; not yet enforced on write).
- **Closest earlier reading**: a log's distance is measured from the reading of
  the same vehicle with the closest *earlier* `timestamp`, not the most recently
  *entered* log (`previousReading`). This keeps back-dated logs correct; editing,
  back-dating or deleting a log changes the next log's derived distance
  (`deriveDistances`).
- **Server-owned derived data**: clients cannot update stations; `priceStats`,
  token `lastUsedAt`, quotas, budget alerts and migrations are written only by
  the Admin SDK.
- **Legacy tolerance**: reads are validated against the core schemas; a document
  that fails is reported to Sentry once and still shown, never dropped.
