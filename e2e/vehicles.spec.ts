import { test, expect } from '@playwright/test';
import { historyRow, logFillUp, signInWithNewUser } from './helpers';

test.describe('Multiple vehicles @e2e', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('logs a fill-up per vehicle and filters History by vehicle', async ({ page, context }) => {
    await context.clearPermissions();
    await signInWithNewUser(page, ['Car One', 'Car Two']);

    await logFillUp(page, { vehicle: 'Car One', brand: 'Brand One', cost: '50', distance: '400', litres: '35' });
    await logFillUp(page, { vehicle: 'Car Two', brand: 'Brand Two', cost: '70', distance: '600', litres: '45' });

    await page.goto('/history');
    await expect(historyRow(page, 'Brand One')).toContainText('Car One', { timeout: 20_000 });
    await expect(historyRow(page, 'Brand Two')).toContainText('Car Two');

    await page.locator('#filterVehicle').selectOption({ label: 'Car Two' });
    await expect(historyRow(page, 'Brand Two')).toBeVisible({ timeout: 20_000 });
    await expect(historyRow(page, 'Brand One')).toHaveCount(0);

    await page.locator('#filterVehicle').selectOption({ value: '' });
    await expect(historyRow(page, 'Brand One')).toBeVisible({ timeout: 20_000 });
  });
});
