import { test, expect } from '@playwright/test';
import '../../src/test/testClock';

test.describe('Persistence and Offline Simulation E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__testClockReady === true);
    await page.evaluate(() => {
      window.__resetGame?.(12345);
    });
  });

  test('exact state restoration across page reloads', async ({ page }) => {
    // 1. Set specific game state: coins = 350, plant carrot, water plot, golden watering can
    await page.evaluate(async () => {
      window.__addCoins?.(250); // 100 + 250 = 350
      window.__plantCropAt?.(1, 1, 'carrot');
      const plots = window.__getGameState?.().farm.plots ?? [];
      const plotId = plots[0]?.id;
      if (plotId) window.__waterPlot?.(plotId);
      window.__useGameStore?.getState().setGoldenWateringCan(true);
      await window.__saveGame?.();
    });

    const stateBeforeReload = await page.evaluate(() => window.__getGameState?.());
    expect(stateBeforeReload?.player.coins).toBe(350);
    expect(stateBeforeReload?.farm.goldenWateringCanOwned).toBe(true);
    const plotIdBefore = stateBeforeReload?.farm.plots[0]?.id;
    expect(plotIdBefore).toBeDefined();

    // 2. Reload page
    await page.reload();
    await page.waitForFunction(() => window.__testClockReady === true);

    // Allow Dexie load promise to complete
    await page.waitForFunction(() => {
      const state = window.__getGameState?.();
      return state?.player.coins === 350;
    });

    const stateAfterReload = await page.evaluate(() => window.__getGameState?.());
    expect(stateAfterReload?.player.coins).toBe(350);
    expect(stateAfterReload?.farm.goldenWateringCanOwned).toBe(true);

    const plot11 = stateAfterReload?.farm.plots.find((p) => p.id === plotIdBefore);
    expect(plot11?.crop?.cropId).toBe('carrot');
  });

  test('offline progression calculates crop maturity and displays OfflineSummary modal', async ({
    page,
  }) => {
    // 1. Plant carrot and water plot (no till step)
    const plotId = await page.evaluate(() => {
      const res = window.__plantCropAt?.(0, 0, 'carrot');
      if (!res || !res.ok) throw new Error('planting failed');
      window.__waterPlot?.(res.value.plotId);
      return res.value.plotId;
    });

    // 2. Simulate offline elapsed time with modal trigger (60s offline > 45s carrot growth)
    await page.evaluate(() => {
      window.__advanceGameTime?.(60_000, true);
    });

    // 3. Verify OfflineSummary modal appears
    const offlineModal = page.locator('[data-testid="offline-summary-modal"]');
    await expect(offlineModal).toBeVisible();

    const title = page.locator('[data-testid="offline-summary-title"]');
    await expect(title).toHaveText(/Welcome Back!/i);

    const maturedSection = page.locator('[data-testid="offline-matured-section"]');
    await expect(maturedSection).toBeVisible();

    // 4. Dismiss / Claim offline summary
    const dismissBtn = page.locator('[data-testid="offline-summary-dismiss-button"]');
    await expect(dismissBtn).toBeVisible();
    await dismissBtn.click();

    await expect(offlineModal).not.toBeVisible();

    // 5. Verify crop is now mature (45s progress)
    const plotState = await page.evaluate((id) => {
      const plots = window.__getGameState?.().farm.plots;
      return plots?.find((p) => p.id === id);
    }, plotId);
    expect(plotState?.crop?.growthProgressSec).toBe(45);
  });

  test('offline simulation idempotency: immediate reload produces 0s and does not re-open modal', async ({
    page,
  }) => {
    await page.evaluate(async () => {
      const res = window.__plantCropAt?.(0, 0, 'carrot');
      if (res?.ok) window.__waterPlot?.(res.value.plotId);
      window.__advanceGameTime?.(50_000, false); // Mature the crop without opening modal
      await window.__saveGame?.();
    });

    // Reload immediately
    await page.reload();
    await page.waitForFunction(() => window.__testClockReady === true);

    const modal = page.locator('[data-testid="offline-summary-modal"]');
    await expect(modal).not.toBeVisible();
  });
});
