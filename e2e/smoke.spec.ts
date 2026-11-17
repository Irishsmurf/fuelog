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

  test('is an installable PWA with an active service worker @smoke', async ({ page }) => {
    await page.goto('/');

    // Manifest is linked, parses, and carries what install prompts need.
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href, 'no <link rel="manifest">').toBeTruthy();
    const res = await page.request.get(new URL(href!, page.url()).toString());
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect((manifest.icons ?? []).length).toBeGreaterThan(0);

    // The page's theme-color matches the manifest, so the installed app and
    // the browser tab are tinted the same.
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', manifest.theme_color);

    // The service worker registers and activates (offline support).
    const state = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'unsupported';
      const timeout = new Promise<string>((r) => setTimeout(() => r('timeout'), 15_000));
      // ready resolves once a worker is active, possibly still 'activating'.
      const ready = navigator.serviceWorker.ready.then((reg) => new Promise<string>((r) => {
        const sw = reg.active;
        if (!sw) return r('none');
        if (sw.state === 'activated') return r(sw.state);
        sw.addEventListener('statechange', () => sw.state === 'activated' && r(sw.state));
      }));
      return Promise.race([ready, timeout]);
    });
    expect(state).toBe('activated');
  });

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
