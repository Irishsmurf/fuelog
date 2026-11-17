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
- `onLogWrite` (#264) now derives log fields on the server: the odometer
  `distanceKm` (and the next log's), `stationId`, `pricePerLitre`, `kmPerLitre`,
  and a missing home-currency `cost`. The app still writes `cost`,
  `exchangeRate`, `distanceKm` and, when it finds one, `stationId` itself for
  its offline UX; the trigger agrees with or corrects them. Its markers are
  `triggerEvents/logDerived_{eventId}`. `derivedLogFields_v1` backfills
  existing logs (run by hand after a reviewed dry run, not scheduled, since it
  bulk-rewrites user data) and replaced the hand-run backfill scripts and the in-app
  "Identify Stations" action. A migration that cannot finish in one run saves a
  `state` and resumes on the next.
