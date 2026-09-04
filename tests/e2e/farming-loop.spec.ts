import { test, expect } from '@playwright/test';
import '../../src/test/testClock';

test.describe('Farming Loop E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__testClockReady === true);
    await page.evaluate(() => {
      window.__resetGame?.(42);
    });
  });

  test('full farming cycle: plant carrot, water, mature via test clock, harvest, and sell for coins', async ({
    page,
  }) => {
    // Verify initial coins and carrot seed count
    const initialCoins = await page.evaluate(() => window.__getGameState?.().player.coins);
    expect(initialCoins).toBe(100);

    const initialSeeds = await page.evaluate(
      () => window.__getGameState?.().inventory.seeds.carrot
    );
    expect(initialSeeds).toBe(5);

    // 1. Select Seed Bag tool and plant directly at a free soil point (no till step)
    const seedBagBtn = page.locator('[data-testid="tool-seed_bag"]');
    await seedBagBtn.click();
    await expect(seedBagBtn).toHaveAttribute('aria-pressed', 'true');

    // 2. Plant Carrot at (0, 0)
    const plotId = await page.evaluate(() => {
      const res = window.__plantCropAt?.(0, 0, 'carrot');
      if (!res || !res.ok) throw new Error('planting failed');
      return res.value.plotId;
    });

    let plotState = await page.evaluate((id) => {
      const plots = window.__getGameState?.().farm.plots;
      return plots?.find((p) => p.id === id);
    }, plotId);
    expect(plotState?.crop?.cropId).toBe('carrot');
    expect(plotState?.crop?.growthProgressSec).toBe(0);

    const seedsAfterPlanting = await page.evaluate(
      () => window.__getGameState?.().inventory.seeds.carrot
    );
    expect(seedsAfterPlanting).toBe(4);

    // 3. Select Watering Can tool
    const wateringBtn = page.locator('[data-testid="tool-watering_can"]');
    await wateringBtn.click();
    await expect(wateringBtn).toHaveAttribute('aria-pressed', 'true');

    // 4. Water the crop
    await page.evaluate((id) => {
      window.__waterPlot?.(id);
    }, plotId);

    plotState = await page.evaluate((id) => {
      const plots = window.__getGameState?.().farm.plots;
      return plots?.find((p) => p.id === id);
    }, plotId);
    expect(plotState?.hydratedUntilUtcMs).toBeGreaterThan(Date.now());

    // 5. Fast forward clock by 45 seconds to mature the carrot
    await page.evaluate(() => {
      window.__advanceGameTime?.(45_000);
    });

    plotState = await page.evaluate((id) => {
      const plots = window.__getGameState?.().farm.plots;
      return plots?.find((p) => p.id === id);
    }, plotId);
    expect(plotState?.crop?.growthProgressSec).toBe(45);

    // 6. Select Hand/Scythe tool
    const handBtn = page.locator('[data-testid="tool-hand"]');
    await handBtn.click();
    await expect(handBtn).toHaveAttribute('aria-pressed', 'true');

    // 7. Harvest carrot (plot is removed, freeing the soil)
    await page.evaluate((id) => {
      window.__harvestCrop?.(id);
    }, plotId);

    const plotsAfter = await page.evaluate(() => window.__getGameState?.().farm.plots);
    expect(plotsAfter?.find((p) => p.id === plotId)).toBeUndefined();

    const produce = await page.evaluate(() => window.__getGameState?.().inventory.produce);
    expect(produce?.length).toBe(1);
    expect(produce?.[0].cropId).toBe('carrot');
    expect(produce?.[0].quantity).toBe(1);

    // 8. Open Shop Modal
    await page.evaluate(() => {
      window.__openModal?.('shop');
    });
    const shopModal = page.locator('[data-testid="shop-modal"]');
    await expect(shopModal).toBeVisible();

    // 9. Navigate to Sell Produce tab
    const sellTab = page.locator('[data-testid="tab-sell"]');
    await sellTab.click();
    await expect(page.locator('[data-testid="pane-sell"]')).toBeVisible();

    // 10. Verify carrot produce item and sell it
    const carrotStack = page.locator('[data-testid^="produce-stack-carrot-"]');
    await expect(carrotStack).toBeVisible();

    const sellAllBtn = page.locator('[data-testid="sell-all-button"]');
    await expect(sellAllBtn).toBeEnabled();
    await sellAllBtn.click();

    // 11. Verify coin balance increased by 12 coins (100 -> 112)
    const finalCoins = await page.evaluate(() => window.__getGameState?.().player.coins);
    expect(finalCoins).toBe(112);

    const produceAfterSell = await page.evaluate(() => window.__getGameState?.().inventory.produce);
    expect(produceAfterSell?.length).toBe(0);
  });

  test('real-canvas click path: clicking the 3D canvas does not crash and HUD stays live', async ({
    page,
  }) => {
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    // Real mouse click through the raycast path (not a __* hook).
    await canvas.click({ position: { x: 100, y: 100 } });

    await expect(page.locator('[data-testid="hud-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="garden-island-app"]')).toBeVisible();
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
});
