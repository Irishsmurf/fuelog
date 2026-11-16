#!/usr/bin/env node
// Fails the build when the service-worker precache (what every install
// downloads up front) grows past the budget. Run after `npm run build`.
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = process.argv[2] ?? 'dist';
const BUDGET_KIB = Number(process.env.PRECACHE_BUDGET_KIB ?? 4200);

const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
// vite-plugin-pwa inlines the manifest as {url:"...",revision:...} entries.
const urls = [...sw.matchAll(/url:\s*"([^"]+)"/g)].map(m => m[1]);
if (urls.length === 0) {
  console.error('No precache manifest entries found in sw.js');
  process.exit(1);
}
let total = 0;
for (const u of urls) {
  const file = join(DIST, u);
  if (existsSync(file)) total += statSync(file).size;
}
const kib = total / 1024;
console.log(`Precache: ${urls.length} entries, ${kib.toFixed(0)} KiB (budget ${BUDGET_KIB} KiB)`);
if (kib > BUDGET_KIB) {
  console.error(`Precache exceeds budget by ${(kib - BUDGET_KIB).toFixed(0)} KiB`);
  process.exit(1);
}
