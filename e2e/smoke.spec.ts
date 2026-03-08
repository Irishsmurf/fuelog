import { test, expect } from '@playwright/test';

test.describe('Responsive UX Smoke Tests', () => {
  test('should show correct navigation', async ({ page, isMobile }) => {
    await page.goto('/');

    // In CI (dummy Firebase) the app renders the Login page instead of the
    // authenticated shell. Detect by presence of the sign-in button.
    const isLoginPage = await page.locator('button:has-text("Get Started with Google")').isVisible({ timeout: 5000 }).catch(() => false);
    if (isLoginPage) {
      // Login page has no app-shell nav — just verify the brand is visible.
      await expect(page.locator('text=fuelog').first()).toBeVisible();
      return;
    }

    if (isMobile) {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      await expect(bottomNav).toBeVisible();
      await expect(bottomNav.locator('text=Log')).toBeVisible();
      await expect(bottomNav.locator('text=History')).toBeVisible();

      const desktopLinks = page.locator('header .hidden.sm\\:flex');
      await expect(desktopLinks).toBeHidden();
    } else {
      const header = page.locator('header');
      const desktopLinks = header.locator('.hidden.sm\\:flex');
      await expect(desktopLinks).toBeVisible();

      const bottomNav = page.locator('nav.fixed.bottom-0');
      await expect(bottomNav).toBeHidden();
    }
  });

  test('header should be visible on all devices', async ({ page }) => {
    await page.goto('/');
    // "fuelog" is rendered on both the Login page (h1) and the authenticated
    // app header — visible in either case.
    await expect(page.locator('text=fuelog').first()).toBeVisible();
  });
});
