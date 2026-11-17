import { expect, type Page } from '@playwright/test';

/**
 * Helpers for the authenticated @e2e specs. They run against the Firebase
 * Auth + Firestore emulators (with the real security rules) and need a build
 * made with VITE_USE_EMULATORS=true; see `npm run test:e2e:emulators`.
 */

/** Signs in as a fresh email/password user and seeds the given vehicles. */
export async function signInWithNewUser(page: Page, vehicles: string[] = ['E2E Car']): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__fuelogE2E, undefined, { timeout: 20_000 });
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.evaluate(async ({ e, names }) => {
    await window.__fuelogE2E!.signIn(e);
    for (const name of names) await window.__fuelogE2E!.addVehicle(name);
  }, { e: email, names: vehicles });
  await page.reload();
}

export interface FillUp {
  brand: string;
  cost: string;
  distance: string;
  litres: string;
  /** Vehicle to pick in Quick Log; defaults to the preselected one. */
  vehicle?: string;
}

/** Logs a fill-up through the Quick Log form and waits for the success message. */
export async function logFillUp(page: Page, f: FillUp): Promise<void> {
  if (!page.url().endsWith('/')) await page.goto('/');
  await expect(page.locator('#cost')).toBeVisible({ timeout: 20_000 });
  if (f.vehicle) {
    // Up to three vehicles render as a segmented radio group, more as a <select>.
    const picker = page.locator('[role="radiogroup"], select#vehicle').first();
    await picker.waitFor({ timeout: 20_000 });
    if (await picker.evaluate((el) => el.tagName === 'SELECT')) {
      // Options read "Name (Make)"; the e2e hook seeds make "Test".
      await page.locator('#vehicle').selectOption({ label: `${f.vehicle} (Test)` });
    } else {
      // The radio input itself is visually hidden; click its visible label.
      await picker.locator('label', { hasText: f.vehicle }).click();
      await expect(page.getByRole('radio', { name: f.vehicle, exact: true })).toBeChecked();
    }
  }
  await page.locator('#brand').fill(f.brand);
  await page.locator('#cost').fill(f.cost);
  await page.locator('#distance').fill(f.distance);
  await page.locator('#fuelAmount').fill(f.litres);
  await page.getByRole('button', { name: /Save Fuel Log/ }).click();
  await expect(page.getByText(/Log saved successfully/)).toBeVisible({ timeout: 20_000 });
}

/** The History table row for a log, found by its brand. */
export const historyRow = (page: Page, brand: string) => page.getByRole('row').filter({ hasText: brand });
