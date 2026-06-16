import { test, expect } from '@playwright/test';

test.describe('Responsive UX Smoke Tests', () => {
  test('should load the app correctly @smoke', async ({ page }) => {
    // Tests might fail locally because of missing environment variables for Firebase,
    // but in production, we expect the app to load and return a 200 status code.
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });
});
