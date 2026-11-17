// functions/src/scripts/derivedLogFields.ts
//
// Entry point for the `derivedLogFields_v1` backfill (see
// ../derivedLogFieldsMigration.ts). It is not scheduled: run a dry run, review
// the report, then re-run with --apply. A dry run by default.
//
// Usage (from the functions/ directory):
//   npm run derived-log-fields                          # dry run: report only
//   npm run derived-log-fields -- --no-stations         # dry run without Overpass calls
//   npm run derived-log-fields -- --user=<uid>          # limit to one user
//   npm run derived-log-fields -- --project=<id>        # target a specific project
//   npm run derived-log-fields -- --apply               # write, after reviewing a dry run
//
// Station lookups go to OVERPASS_URL when set (e.g. a mirror such as
// https://overpass.kumi.systems/api/interpreter if the main instance answers 406).
// Credentials come from application default credentials, e.g.
//   GOOGLE_APPLICATION_CREDENTIALS=../service-account.json npm run derived-log-fields

import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { migrateDerivedLogFields } from '../derivedLogFieldsMigration';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const APPLY = process.argv.includes('--apply');
const SKIP_STATIONS = process.argv.includes('--no-stations');
const ONLY_USER = arg('user');
const PROJECT_ID = arg('project') ?? process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT ?? 'fuelog-paddez';

async function main() {
  if (getApps().length === 0) initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  console.log(`Project: ${PROJECT_ID}  Mode: ${APPLY ? 'APPLY' : 'dry run'}${ONLY_USER ? `  User: ${ONLY_USER}` : ''}`);
  const result = await migrateDerivedLogFields(getFirestore(), {
    apply: APPLY,
    userId: ONLY_USER,
    skipStations: SKIP_STATIONS,
    log: console.log,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!APPLY) console.log('Dry run: nothing written. Re-run with --apply to write.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
