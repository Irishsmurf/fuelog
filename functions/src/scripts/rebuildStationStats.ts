// functions/src/scripts/rebuildStationStats.ts
//
// One-off rebuild of server-owned station price stats (stations.priceStats).
//
// Station stats used to be maintained by the browser: one global `avgPrice`
// that mixed every user's home currency and was never reduced when a log was
// edited or deleted. The updateStationStats trigger now maintains per-currency
// stats for new writes; this script recomputes them from scratch for every
// station so existing data matches what the trigger would have produced.
//
// It is safe to re-run: it replaces priceStats wholesale. Legacy fields
// (avgPrice, logCount, lastPrice) are left untouched.
//
// Usage (from the functions/ directory):
//   npm run rebuild-station-stats -- --dry-run        # report only (default if no flag)
//   npm run rebuild-station-stats -- --apply          # write priceStats
//   npm run rebuild-station-stats -- --project=<id>   # target a specific project
//
// Run it right AFTER the updateStationStats trigger is deployed: logs written
// between the rebuild and the deploy would otherwise be missed.

import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { rebuildAllStationStats } from '../stationStats';

const APPLY = process.argv.includes('--apply');
const PROJECT_ARG = process.argv.find((a) => a.startsWith('--project='));
const PROJECT_ID =
  (PROJECT_ARG ? PROJECT_ARG.slice('--project='.length) : undefined) ??
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT ??
  'fuelog-paddez';

async function main() {
  if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  console.log(`Project: ${PROJECT_ID}  Mode: ${APPLY ? 'APPLY' : 'dry run'}`);
  const written = await rebuildAllStationStats(getFirestore(), APPLY, console.log);
  console.log(APPLY ? `Wrote priceStats to ${written} stations.` : 'Dry run — nothing written. Re-run with --apply.');
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
