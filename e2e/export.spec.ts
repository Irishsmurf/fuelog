import { test, expect } from '@playwright/test';
import { historyRow, logFillUp, signInWithNewUser } from './helpers';

test.describe('History export @e2e', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('exports the logs as a PDF report', async ({ page, context }) => {
    await context.clearPermissions();
    await signInWithNewUser(page);
    await logFillUp(page, { brand: 'Export Fuel', cost: '42', distance: '300', litres: '28' });

    await page.goto('/history');
    await expect(historyRow(page, 'Export Fuel')).toBeVisible({ timeout: 20_000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export PDF/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^fuelog_report_\d{4}-\d{2}-\d{2}\.pdf$/);

    // A real PDF, not an empty or error file.
    const path = await download.path();
    const { readFileSync } = await import('node:fs');
    const bytes = readFileSync(path);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
