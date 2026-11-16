import { test, expect, type Page } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Smoke tests for a production build. They run against `vite preview` in CI
 * and against the fresh deployment in the Vercel workflow (BASE_URL).
 *
 * A plain "status is 200" check is not enough: the SPA rewrite returns 200 for
 * every path, and past production breakages (#189 "L is not defined", #247
 * maplibre worker) only surfaced as runtime errors in the browser.
 */

// Noise that is expected without real Firebase credentials / network access.
const IGNORED_ERRORS = [
  /auth\/(invalid-api-key|network-request-failed|api-key-not-valid)/i,
  /Failed to load resource/i,
  /net::ERR_/i,
  /Remote Config/i,
  /installations\//i,
  /analytics/i,
  /ERR_BLOCKED_BY_CLIENT/i,
];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  const keep = (msg: string) => !IGNORED_ERRORS.some((re) => re.test(msg)) && errors.push(msg);
  page.on('pageerror', (err) => keep(`pageerror: ${err.message}`));
  // Console errors are only enforced against the local build. A live
  // deployment talks to real Firebase/CDNs and a noisy console must not
  // trigger an automatic rollback; uncaught page errors still do.
  if (!process.env.BASE_URL) {
    page.on('console', (msg) => {
      if (msg.type() === 'error') keep(`console: ${msg.text()}`);
    });
  }
  return errors;
}

test.describe('Production build smoke tests', () => {
  for (const path of ['/', '/history', '/map']) {
    test(`renders ${path} without runtime errors @smoke`, async ({ page }) => {
      const errors = collectErrors(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      // A redirect elsewhere (e.g. a hosting login wall) also answers 200;
      // make sure we are actually looking at the app.
      const expectedHost = new URL(process.env.BASE_URL || 'http://localhost:4173').host;
      expect(new URL(page.url()).host, `Landed on ${page.url()} ("${await page.title()}") instead of the app`).toBe(expectedHost);
      // React mounted something (login screen or app shell), not a blank page.
      await expect(
        page.locator('#root > *').first(),
        `App root stayed empty at ${page.url()} ("${await page.title()}")`,
      ).toBeVisible({ timeout: 20_000 });
      await page.waitForLoadState('networkidle').catch(() => {});
      expect(errors, errors.join('\n')).toEqual([]);
    });
  }

  test('every lazy JS chunk evaluates without throwing @smoke', async ({ page }) => {
    // Only possible when the build output is on disk (vite preview in CI).
    const assetsDir = resolve(process.cwd(), 'dist/assets');
    test.skip(!existsSync(assetsDir) || !!process.env.BASE_URL, 'No local build output');

    const chunks = readdirSync(assetsDir)
      .filter((f) => f.endsWith('.js'))
      // Web worker bundles expect a worker global scope.
      .filter((f) => !/worker/i.test(f));
    expect(chunks.length).toBeGreaterThan(0);

    await page.goto('/');
    const failures = await page.evaluate(async (files) => {
      const out: string[] = [];
      for (const f of files) {
        try {
          await import(/* @vite-ignore */ `/assets/${f}`);
        } catch (e) {
          out.push(`${f}: ${(e as Error).message}`);
        }
      }
      return out;
    }, chunks);
    expect(failures, failures.join('\n')).toEqual([]);
  });
});
