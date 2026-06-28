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

## Assigning stations to coordinate-only logs

Logs that have coordinates but no `stationId` — including fuel station locations
pinned retroactively by hand — have nothing to group on, so the map renders them
as loose "unassigned" clusters. The one-off job at
[`functions/src/scripts/assignStationsToLogs.ts`](../functions/src/scripts/assignStationsToLogs.ts)
resolves each of these to a station the same way live logging does: it looks up
the nearest `amenity=fuel` via the OpenStreetMap Overpass API, gets-or-creates
the matching `stations` document, writes its id back onto the log, and folds the
log's price into the station's running average. It is the batch, server-side
equivalent of the in-app **Profile → Maintenance → Identify Stations** action.

Existing stations are never overwritten and logs that already have a `stationId`
are skipped, so the job is safe to re-run.

### Usage
Run from the `functions/` directory with application default credentials:

```bash
cd functions
GOOGLE_APPLICATION_CREDENTIALS=../service-account.json npm run assign-stations -- --dry-run   # preview
GOOGLE_APPLICATION_CREDENTIALS=../service-account.json npm run assign-stations                # apply
```

Flags: `--dry-run` (report only), `--user=<uid>` (one user), `--project=<id>`
(target project, defaults to `fuelog-paddez`), `--radius=<m>` (search radius,
default 150), `--delay=<ms>` (spacing between Overpass calls, default 1100),
`--overpass-url=<url>` (use a different Overpass instance, or set `OVERPASS_URL`),
and `--verbose` (print each log as it resolves). Overpass enforces fair-use
limits, so a large backlog is processed slowly and retried with backoff on rate
limits.

The default instance (`overpass-api.de`) increasingly rejects programmatic
requests with **HTTP 406** when it is overloaded. The script identifies itself
with a `User-Agent` to avoid this where possible, but if you still hit 406, point
it at a mirror:

```bash
GOOGLE_APPLICATION_CREDENTIALS=../service-account.json \
  npm run assign-stations -- --overpass-url=https://overpass.kumi.systems/api/interpreter
```

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
