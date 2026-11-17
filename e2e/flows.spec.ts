import { test, expect } from '@playwright/test';
import { historyRow, logFillUp, signInWithNewUser } from './helpers';

test.describe('Fuel log lifecycle @e2e', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('log a fill-up, see it in History, edit it and delete it', async ({ page, context }) => {
    await context.clearPermissions(); // no geolocation -> saves without a location
    await signInWithNewUser(page);

    await logFillUp(page, { brand: 'E2E Fuel', cost: '60', distance: '500', litres: '40' });

    // --- History ---
    await page.goto('/history');
    const row = historyRow(page, 'E2E Fuel');
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toContainText('60.00');

    // --- Edit ---
    await row.getByTitle('Edit Log').click();
    await page.locator('#edit-cost').fill('66');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(historyRow(page, 'E2E Fuel')).toContainText('66.00', { timeout: 20_000 });

    // --- Delete ---
    page.once('dialog', d => d.accept());
    await historyRow(page, 'E2E Fuel').getByTitle('Delete Log').click();
    await expect(historyRow(page, 'E2E Fuel')).toHaveCount(0, { timeout: 20_000 });
  });
});
