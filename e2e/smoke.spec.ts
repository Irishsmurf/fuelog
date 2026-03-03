import { test, expect } from '@playwright/test';

test.describe('Responsive UX Smoke Tests', () => {
  test('should show correct navigation', async ({ page, isMobile }) => {
    await page.goto('/');
    
    if (isMobile) {
      // Mobile specific checks
      const bottomNav = page.locator('nav.fixed.bottom-0');
      await expect(bottomNav).toBeVisible();
      await expect(bottomNav.locator('text=Log')).toBeVisible();
      await expect(bottomNav.locator('text=History')).toBeVisible();

      // Header desktop links should be hidden
      const desktopLinks = page.locator('header .hidden.sm\\:flex');
      await expect(desktopLinks).toBeHidden();
    } else {
      // Desktop specific checks
      const header = page.locator('header');
      const desktopLinks = header.locator('.hidden.sm\\:flex');
      await expect(desktopLinks).toBeVisible();
      
      // Bottom nav should be hidden
      const bottomNav = page.locator('nav.fixed.bottom-0');
      await expect(bottomNav).toBeHidden();
    }
  });

  test('header should be visible on all devices', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header');
    await expect(header).toBeVisible();
    await expect(header.locator('text=fuelog')).toBeVisible();
  });
});
