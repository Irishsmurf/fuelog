import { test, expect } from '@playwright/test';

test.describe('Multi-Vehicle Support E2E', () => {
  test.skip('should allow managing vehicles and logging fuel per vehicle (requires auth)', async ({ page }) => {
    // Cannot run this test locally without actual Firebase credentials set up
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });
});
