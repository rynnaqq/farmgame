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

  test('full farming cycle: till, plant carrot, water, mature via test clock, harvest, and sell for coins', async ({
    page,
  }) => {
    // Verify initial coins and carrot seed count
    const initialCoins = await page.evaluate(() => window.__getGameState?.().player.coins);
    expect(initialCoins).toBe(100);

    const initialSeeds = await page.evaluate(
      () => window.__getGameState?.().inventory.seeds.carrot
    );
    expect(initialSeeds).toBe(5);

    // 1. Select Trowel tool
    const trowelBtn = page.locator('[data-testid="tool-trowel"]');
    await trowelBtn.click();
    await expect(trowelBtn).toHaveAttribute('aria-pressed', 'true');

    // 2. Till plot-0-0
    await page.evaluate(() => {
      window.__tillPlot?.('plot-0-0');
    });

    let plotState = await page.evaluate(() => {
      const plots = window.__getGameState?.().farm.plots;
      return plots?.find((p) => p.id === 'plot-0-0');
    });
    expect(plotState?.tilled).toBe(true);

    // 3. Select Seed Bag tool
    const seedBagBtn = page.locator('[data-testid="tool-seed_bag"]');
    await seedBagBtn.click();
    await expect(seedBagBtn).toHaveAttribute('aria-pressed', 'true');

    // 4. Plant Carrot on plot-0-0
    await page.evaluate(() => {
      window.__plantCrop?.('plot-0-0', 'carrot');
    });

    plotState = await page.evaluate(() => {
      const plots = window.__getGameState?.().farm.plots;
      return plots?.find((p) => p.id === 'plot-0-0');
    });
    expect(plotState?.crop?.cropId).toBe('carrot');
    expect(plotState?.crop?.growthProgressSec).toBe(0);

    const seedsAfterPlanting = await page.evaluate(
      () => window.__getGameState?.().inventory.seeds.carrot
    );
    expect(seedsAfterPlanting).toBe(4);

    // 5. Select Watering Can tool
    const wateringBtn = page.locator('[data-testid="tool-watering_can"]');
    await wateringBtn.click();
    await expect(wateringBtn).toHaveAttribute('aria-pressed', 'true');

    // 6. Water plot-0-0
    await page.evaluate(() => {
      window.__waterPlot?.('plot-0-0');
    });

    plotState = await page.evaluate(() => {
      const plots = window.__getGameState?.().farm.plots;
      return plots?.find((p) => p.id === 'plot-0-0');
    });
    expect(plotState?.hydratedUntilUtcMs).toBeGreaterThan(Date.now());

    // 7. Fast forward clock by 45 seconds to mature the carrot
    await page.evaluate(() => {
      window.__advanceGameTime?.(45_000);
    });

    plotState = await page.evaluate(() => {
      const plots = window.__getGameState?.().farm.plots;
      return plots?.find((p) => p.id === 'plot-0-0');
    });
    expect(plotState?.crop?.growthProgressSec).toBe(45);

    // 8. Select Hand/Scythe tool
    const handBtn = page.locator('[data-testid="tool-hand"]');
    await handBtn.click();
    await expect(handBtn).toHaveAttribute('aria-pressed', 'true');

    // 9. Harvest carrot from plot-0-0
    await page.evaluate(() => {
      window.__harvestCrop?.('plot-0-0');
    });

    plotState = await page.evaluate(() => {
      const plots = window.__getGameState?.().farm.plots;
      return plots?.find((p) => p.id === 'plot-0-0');
    });
    expect(plotState?.crop).toBeNull();

    const produce = await page.evaluate(() => window.__getGameState?.().inventory.produce);
    expect(produce?.length).toBe(1);
    expect(produce?.[0].cropId).toBe('carrot');
    expect(produce?.[0].quantity).toBe(1);

    // 10. Open Shop Modal
    await page.evaluate(() => {
      window.__openModal?.('shop');
    });
    const shopModal = page.locator('[data-testid="shop-modal"]');
    await expect(shopModal).toBeVisible();

    // 11. Navigate to Sell Produce tab
    const sellTab = page.locator('[data-testid="tab-sell"]');
    await sellTab.click();
    await expect(page.locator('[data-testid="pane-sell"]')).toBeVisible();

    // 12. Verify carrot produce item and sell it
    const carrotStack = page.locator('[data-testid^="produce-stack-carrot-"]');
    await expect(carrotStack).toBeVisible();

    const sellAllBtn = page.locator('[data-testid="sell-all-button"]');
    await expect(sellAllBtn).toBeEnabled();
    await sellAllBtn.click();

    // 13. Verify coin balance increased by 12 coins (100 -> 112)
    const finalCoins = await page.evaluate(() => window.__getGameState?.().player.coins);
    expect(finalCoins).toBe(112);

    const produceAfterSell = await page.evaluate(() => window.__getGameState?.().inventory.produce);
    expect(produceAfterSell?.length).toBe(0);
  });
});
