# 3. Server-owned derived data: idempotent triggers and one-shot migrations

Status: accepted (#284)

## Context

Station stats were computed in the browser: one `avgPrice` that mixed every
user's currency, was never reduced on edit or delete, and could be written by
any client. Repairs needed hand-run backfill scripts.

## Decision

- Derived data is written only by Cloud Functions (Admin SDK). The first case
  is `updateStationStats` (`onDocumentWritten('fuelLogs/{logId}')`). On create,
  update and delete it moves a log's price-per-litre contribution between
  `stations.priceStats.<CUR>` buckets, keyed by the owner's home currency.
- Triggers can be redelivered, so each event is applied at most once: the
  handler writes `triggerEvents/stationStats_{eventId}` in the same transaction.
- Data rebuilds ship as **one-shot migrations**. `runMigrations` (scheduled
  every 60 minutes) runs each entry in `MIGRATIONS` that has no
  `migrations/{id}` record, then writes the record. `stationPriceStats_v1`
  rebuilt all `priceStats` after deploy.
- Rules forbid client station updates. Clients may only create a station with
  zeroed legacy stats and no `priceStats`.

## Consequences

- Stats stay correct after edits and deletes, per currency.
- The legacy `avgPrice`/`lastPrice`/`logCount` fields remain on old documents;
  readers go through `localizeStation`.
- Pure planners (`applyContribution`, `planStationStats`) are unit-tested. The
  same rebuild is available as `npm run rebuild-station-stats` in `functions/`
  (dry run by default).
- Still derived in the client: `distanceKm` from the odometer, `cost` and
  `exchangeRate`, and `stationId`. Moving these into an `onLogWrite` trigger is
  outstanding.
