import { test, expect, type Page } from '@playwright/test';

/**
 * Authenticated end-to-end flows against the Firebase Auth + Firestore
 * emulators (with the real security rules). Requires a build made with
 * VITE_USE_EMULATORS=true; see `npm run test:e2e:emulators`.
 */

async function signInWithNewUser(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__fuelogE2E, undefined, { timeout: 20_000 });
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.evaluate(async (e) => {
    await window.__fuelogE2E!.signIn(e);
    await window.__fuelogE2E!.addVehicle('E2E Car');
  }, email);
  await page.reload();
}

test.describe('Fuel log lifecycle @e2e', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('log a fill-up, see it in History, edit it and delete it', async ({ page, context }) => {
    await context.clearPermissions(); // no geolocation -> saves without a location
    await signInWithNewUser(page);

    // --- Log ---
    await expect(page.locator('#cost')).toBeVisible({ timeout: 20_000 });
    await page.locator('#brand').fill('E2E Fuel');
    await page.locator('#cost').fill('60');
    await page.locator('#distance').fill('500');
    await page.locator('#fuelAmount').fill('40');
    await page.getByRole('button', { name: /Save Fuel Log/ }).click();
    await expect(page.getByText(/Log saved successfully/)).toBeVisible({ timeout: 20_000 });

    // --- History ---
    await page.goto('/history');
    const row = page.getByRole('row').filter({ hasText: 'E2E Fuel' });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText('60.00');

    // --- Edit ---
    await row.getByTitle('Edit Log').click();
    const cost = page.locator('#edit-cost');
    await cost.fill('66');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'E2E Fuel' })).toContainText('66.00', { timeout: 20_000 });

    // --- Delete ---
    page.once('dialog', d => d.accept());
    await page.getByRole('row').filter({ hasText: 'E2E Fuel' }).getByTitle('Delete Log').click();
    await expect(page.getByRole('row').filter({ hasText: 'E2E Fuel' })).toHaveCount(0, { timeout: 20_000 });
  });
});
