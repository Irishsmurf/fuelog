# Fuelog Utility Scripts

This directory contains utility scripts for development and testing.

## mock-data-generator.js
Generates random fuel log data in TSV format for testing the **Import** feature.

### Usage
Run the script using Node.js and redirect the output to a file:
```bash
node scripts/mock-data-generator.js > mock_logs.tsv
```
Then, you can open `mock_logs.tsv` in a text editor, copy its content, and paste it into the **Import** page of the Fuelog app.

### Configuration
You can edit the `numEntries`, `brands`, and date range variables directly at the top of the script to customize the generated data.

## Derived log fields (odometer distances, stations)

Older logs predate server-side derivation. The `derivedLogFields_v1` backfill
(run by hand: dry run first, then `--apply`; it is not scheduled) rebuilds
missing odometer readings from distance chains, re-derives `distanceKm` from the
readings, fills `pricePerLitre`/`kmPerLitre`, and links logs that have
coordinates but no `stationId` to the nearest OpenStreetMap station. It replaced
the `backfill-odometer` and `assign-stations` scripts and the in-app
"Identify Stations" action. Logic: `functions/src/derivedLogFieldsMigration.ts`.

Run it from `functions/` (a dry run unless `--apply` is given):

```bash
cd functions
GOOGLE_APPLICATION_CREDENTIALS=../service-account.json npm run derived-log-fields                  # dry run
GOOGLE_APPLICATION_CREDENTIALS=../service-account.json npm run derived-log-fields -- --no-stations # dry run, no Overpass calls
```

Flags: `--user=<uid>`, `--project=<id>` (defaults to `fuelog-paddez`),
`--no-stations`, `--apply`. Set `OVERPASS_URL` to use an Overpass mirror (e.g.
`https://overpass.kumi.systems/api/interpreter`) if the main instance answers 406.

## Re-compressing legacy receipt images

PR #211 added client-side compression so newly uploaded receipts are resized to a
max of 1600px and re-encoded as JPEG at 80% quality. Receipts uploaded before that
change are still stored at full size. The one-off backfill job at
[`functions/src/scripts/recompressReceipts.ts`](../functions/src/scripts/recompressReceipts.ts)
applies the same optimisation to existing files in Cloud Storage.

Each original is re-encoded **in place**, preserving its storage path and Firebase
download token, so `fuelLogs.receiptUrl` values keep resolving and thumbnails are
regenerated automatically. Files that would not get smaller are skipped, so the job
is safe to re-run.

### Usage
Run from the `functions/` directory with application default credentials:

```bash
cd functions
GOOGLE_APPLICATION_CREDENTIALS=../service-account.json npm run recompress-receipts -- --dry-run  # preview savings
GOOGLE_APPLICATION_CREDENTIALS=../service-account.json npm run recompress-receipts               # apply
```

Override the target bucket with the `STORAGE_BUCKET` environment variable if needed.
