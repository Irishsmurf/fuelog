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
