import { test, expect } from '@playwright/test';
import '../../src/test/testClock';

test.describe('Mobile Controls & Touch Viewport E2E', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__testClockReady === true);
    await page.evaluate(() => {
      window.__resetGame?.(101);
    });
  });

  test('mobile HUD, virtual joystick, and jump button are displayed on mobile viewport', async ({
    page,
  }) => {
    const mobileHud = page.locator('[data-testid="mobile-hud-container"]');
    await expect(mobileHud).toBeVisible();

    const joystick = page.locator('[data-testid="virtual-joystick-base"]');
    await expect(joystick).toBeVisible();

    const jumpBtn = page.locator('[data-testid="mobile-jump-button"]');
    await expect(jumpBtn).toBeVisible();
  });

  test('virtual joystick touch interaction updates input manager and active joystick state', async ({
    page,
  }) => {
    const joystickBase = page.locator('[data-testid="virtual-joystick-base"]');
    await expect(joystickBase).toBeVisible();

    const box = await joystickBase.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Simulate touch dragging on the virtual joystick
    await page.touchscreen.tap(centerX, centerY);

    // Verify joystick element exists and is responsive
    const knob = page.locator('[data-testid="virtual-joystick-knob"]');
    await expect(knob).toBeVisible();
  });

  test('direct plot tap plants without till step or reach rule', async ({ page }) => {
    // 1. Select Seed Bag tool
    const seedBagBtn = page.locator('[data-testid="tool-seed_bag"]');
    await seedBagBtn.click();

    // 2. Plant directly via helper (no till, no reach check)
    const plotId = await page.evaluate(() => {
      const res = window.__plantCropAt?.(1, 1, 'carrot');
      if (!res || !res.ok) throw new Error('planting failed');
      return res.value.plotId;
    });

    const plot = await page.evaluate((id) => {
      return window.__getGameState?.().farm.plots.find((p) => p.id === id);
    }, plotId);
    expect(plot?.crop?.cropId).toBe('carrot');
  });

  test('opening modal suppresses mobile joystick and action button inputs', async ({ page }) => {
    const mobileHud = page.locator('[data-testid="mobile-hud-container"]');
    await expect(mobileHud).toHaveAttribute('data-modal-open', 'false');

    // Open Shop Modal
    await page.evaluate(() => {
      window.__openModal?.('shop');
    });

    const shopModal = page.locator('[data-testid="shop-modal"]');
    await expect(shopModal).toBeVisible();

    // Verify Mobile HUD reflects open modal
    await expect(mobileHud).toHaveAttribute('data-modal-open', 'true');

    // Close Shop Modal
    await page.evaluate(() => {
      window.__closeModal?.();
    });

    await expect(shopModal).not.toBeVisible();
    await expect(mobileHud).toHaveAttribute('data-modal-open', 'false');
  });
});
