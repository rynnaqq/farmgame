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
    // 1. Set specific game state: coins = 350, plant carrot at an exact point,
    //    water it, own the golden watering can.
    await page.evaluate(async () => {
      window.__addCoins?.(250); // 100 + 250 = 350
      const planted = window.__plantCropAt?.(
        { bedId: 'north-east', localX: 1.25, localZ: -0.75 },
        'carrot'
      );
      if (planted?.ok) {
        window.__waterCrop?.(planted.value.slotId);
      }
      window.__useGameStore?.getState().setGoldenWateringCan(true);
      await window.__saveGame?.();
    });

    const stateBeforeReload = await page.evaluate(() => window.__getGameState?.());
    expect(stateBeforeReload?.player.coins).toBe(350);
    expect(stateBeforeReload?.farm.gridSize).toBe(8);
    expect(stateBeforeReload?.farm.goldenWateringCanOwned).toBe(true);

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
    expect(stateAfterReload?.farm.gridSize).toBe(8);
    expect(stateAfterReload?.farm.goldenWateringCanOwned).toBe(true);

    const plantedPlot = stateAfterReload?.farm.plots.find((p) => p.crop !== null);
    expect(plantedPlot?.crop?.cropId).toBe('carrot');
    // Placement survives the reload exactly, to three decimals.
    expect(plantedPlot?.crop?.placement).toEqual({
      bedId: 'north-east',
      localX: 1.25,
      localZ: -0.75,
    });
    expect('tilled' in (plantedPlot as object)).toBe(false);
  });

  test('offline progression calculates crop maturity and displays OfflineSummary modal', async ({
    page,
  }) => {
    // 1. Plant a carrot at an exact point and water it
    await page.evaluate(() => {
      const planted = window.__plantCropAt?.(
        { bedId: 'north-west', localX: 0, localZ: 0 },
        'carrot'
      );
      if (planted?.ok) {
        window.__waterCrop?.(planted.value.slotId);
      }
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

    // 5. Verify the planted crop is now mature (45s progress) at the same placement
    const plotState = await page.evaluate(() => {
      const plots = window.__getGameState?.().farm.plots;
      return plots?.find((p) => p.crop !== null);
    });
    expect(plotState?.crop?.growthProgressSec).toBe(45);
    expect(plotState?.crop?.placement).toEqual({
      bedId: 'north-west',
      localX: 0,
      localZ: 0,
    });
  });

  test('offline simulation idempotency: immediate reload produces 0s and does not re-open modal', async ({
    page,
  }) => {
    await page.evaluate(async () => {
      const planted = window.__plantCropAt?.(
        { bedId: 'south-west', localX: 0.5, localZ: 0.5 },
        'carrot'
      );
      if (planted?.ok) {
        window.__waterCrop?.(planted.value.slotId);
      }
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
