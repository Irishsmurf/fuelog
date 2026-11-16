# Firebase Configuration & Security

## Services Used
- **Authentication:** Google Sign-In.
- **Firestore:** document database (`eur3` multi-region).
- **Storage:** receipt images.
- **Cloud Functions (v2, Node 22):** triggers and schedules in `functions/`.
- **Cloud Messaging (FCM):** web push for budget alerts and digests.
- **Trigger Email extension** (`firestore-send-email`): sends documents written to `mail`.

Field meanings and invariants are in [`CONTEXT.md`](../CONTEXT.md). The
authoritative shapes are the zod schemas in `packages/core/src/schema.ts`.

## Firestore schema

| Collection | Doc id | Written by | Contents |
| :--- | :--- | :--- | :--- |
| `fuelLogs` | auto | client, REST, MCP | One fill-up (fields below). |
| `vehicles` | auto | client, REST, MCP | `userId`, `name`, `make`, `model`, `year` (string), `fuelType`, `isDefault`, `isArchived`. |
| `userProfiles` | uid | client | `homeCurrency`, `monthlyBudget`, `notificationsEnabled`, `hasSeenImportOnboarding`, `tester_group`. |
| `stations` | OSM id, `/`→`_` | client creates; server updates | `osmId`, `name`, `brand`, `latitude`, `longitude`, `address`, `priceStats.<CUR>` (server), legacy `avgPrice`/`lastPrice`/`logCount`, `statsUpdatedAt`. |
| `apiTokens` | auto | client creates/revokes; server sets `lastUsedAt` | `userId`, `name`, `tokenPrefix`, `tokenHash` (SHA-256 hex), `scopes`, `createdAt`, `lastUsedAt`, `expiresAt`, `isRevoked`. |
| `fcmTokens` | the FCM token | client | `userId`, `token`, `platform: 'web'`, `createdAt`, `updatedAt`. |
| `budgetAlerts` | `{uid}_{YYYY-MM}` | `checkBudgetAlert` | `userId`, `monthKey`, `thresholds` (80/100 already alerted), `updatedAt`. |
| `usageQuotas` | `{uid}_{kind}_{YYYY-MM-DD}` | `api/extract-receipt` | `uid`, `kind`, `day` (UTC), `count`, `updatedAt`. |
| `triggerEvents` | `stationStats_{eventId}` | `updateStationStats` | `createdAt`, `expireAt` (7 days; for a TTL policy). |
| `migrations` | migration id | `runMigrations` | `completedAt` plus the migration's result. |
| `testNotifications` | auto | `sendTestNotification` | Audit trail of dev test pushes. |
| `mail` | auto | `sendMonthlySummary` | Picked up by the Trigger Email extension. |

### `fuelLogs` fields

| Field | Type | Description |
| :--- | :--- | :--- |
| `userId` | string | Owner's UID. Immutable. |
| `timestamp` | Timestamp | When the fill-up happened (can be back-dated). |
| `cost` | number | Total cost in the owner's **home currency**. |
| `distanceKm` | number | Distance since the previous fill-up. |
| `fuelAmountLiters` | number | Litres added. |
| `brand` | string? | Station brand. |
| `odometerKm` | number? | Odometer reading. |
| `currency`, `originalCost`, `exchangeRate` | string?, number?, number? | Amount paid in the receipt's currency; `cost = originalCost × exchangeRate`. |
| `vehicleId` | string? | Vehicle filled. |
| `stationId` | string? | Linked `stations` doc. |
| `latitude`, `longitude`, `locationAccuracy` | number? | Where the fill-up happened. |
| `receiptUrl` | string? | Storage download URL of the receipt. |
| `fillType`, `missedPrevious`, `source`, `schemaVersion` | v2, optional | Defined in the schema; not yet written. |

## Security rules

`firebase/firestore.rules` is the source of truth; it is tested against the
emulator in CI (`npm run test:rules`). In summary:
- `fuelLogs`, `vehicles`: owner-only; `userId` can never change. Fuel-log fields
  are type-checked on every write, and `cost`, `distanceKm`, `fuelAmountLiters`
  and `timestamp` are required on create.
- `userProfiles/{uid}`: owner-only.
- `apiTokens`: owner-only. Create needs `isRevoked == false`, a 64-char
  `tokenHash`, scopes from `read:logs`, `write:logs`, `read:vehicles`,
  `write:vehicles`, and a null or Timestamp `expiresAt`. The only allowed update
  is `isRevoked: true`.
- `stations`: any signed-in user can read, and create one with zeroed legacy
  stats and no `priceStats`/`lastPrice`. Updates are denied (server only).
- `fcmTokens`: owner-only, `platform == 'web'`.
- `budgetAlerts`, `testNotifications`, `usageQuotas`: no client access.
  `triggerEvents`, `migrations` and `mail` have no rule, so clients are denied.

Storage (`firebase/storage.rules`): `receipts/{uid}/{file}` is owner-only;
uploads must be images of at most 10 MB.

## Cloud Functions

Exported from `functions/src/index.ts`; deployed by the Firebase Deploy workflow.

| Function | Trigger | Region | Purpose |
| :--- | :--- | :--- | :--- |
| `updateStationStats` | `fuelLogs/{logId}` written | europe-west1 | Maintains `stations.priceStats.<CUR>`; idempotent via `triggerEvents`. |
| `checkBudgetAlert` | `fuelLogs/{logId}` written | not set in code | Push at 80% / 100% of `monthlyBudget`; state in `budgetAlerts`. |
| `runMigrations` | every 60 minutes | us-central1 (default) | Runs pending one-shot migrations (`migrations/{id}`). |
| `cleanupExpiredTokens` | every 24 hours | us-central1 (default) | Revokes expired API tokens. |
| `sendWeeklyDigest` | Mondays 08:00 (`every monday 08:00`) | us-central1 (default) | Weekly spend push. |
| `sendMonthlySummary` | 1st of month 08:00 (`0 8 1 * *`) | us-central1 (default) | Monthly summary email via `mail`. |
| `processReceipt` | Storage object finalized | us-central1 | Writes a `thumb_` copy of receipt images. |
| `checkDeveloperAccess`, `sendTestNotification` | callable | us-central1 (default) | Dev test-push tool, restricted to `DEV_NOTIFICATION_UIDS`. |

No function sets a global region. Firestore-triggered functions are placed by
the Firebase CLI; `updateStationStats` was deployed to `europe-west1`, next to
the `eur3` database (#295).

Functions param: `DEV_NOTIFICATION_UIDS` (comma-separated UIDs; CI writes it
from the repo variable of the same name, default `none`).

## Remote Config

Not used. The app had feature flags in Remote Config; they were removed and the
flagged features (odometer, receipt AI, totals, extra dashboard charts, dark
mode) are always on ([ADR 0007](adr/0007-proposed-single-backend-maplibre-no-flags.md)).
The old parameters in the Firebase console can be deleted.
