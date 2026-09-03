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

  test('full farming cycle: plant carrot at an exact point, water, mature via test clock, harvest, and sell for coins', async ({
    page,
  }) => {
    // Verify initial coins and carrot seed count
    const initialCoins = await page.evaluate(() => window.__getGameState?.().player.coins);
    expect(initialCoins).toBe(100);

    const initialSeeds = await page.evaluate(
      () => window.__getGameState?.().inventory.seeds.carrot
    );
    expect(initialSeeds).toBe(5);

    // 1. Seeds is the default tool (no trowel anymore)
    const seedBagBtn = page.locator('[data-testid="tool-seed_bag"]');
    await expect(seedBagBtn).toHaveAttribute('aria-pressed', 'true');

    // 2. Plant a carrot directly at an exact free position
    const placement = { bedId: 'north-west', localX: 0.321, localZ: -0.654 } as const;
    const plantedSlot = await page.evaluate((point) => {
      const result = window.__plantCropAt?.(point, 'carrot');
      return result?.ok ? result.value.slotId : null;
    }, placement);
    expect(plantedSlot).not.toBeNull();
    const slotId = plantedSlot as string;

    let plotState = await page.evaluate((slotId) => {
      const plots = window.__getGameState?.().farm.plots;
      return plots?.find((p) => p.id === slotId);
    }, slotId);
    expect(plotState?.crop?.cropId).toBe('carrot');
    expect(plotState?.crop?.growthProgressSec).toBe(0);
    expect(plotState?.crop?.placement).toEqual(placement);
    expect('tilled' in (plotState as object)).toBe(false);

    const seedsAfterPlanting = await page.evaluate(
      () => window.__getGameState?.().inventory.seeds.carrot
    );
    expect(seedsAfterPlanting).toBe(4);

    // 3. Select Watering Can tool
    const wateringBtn = page.locator('[data-testid="tool-watering_can"]');
    await wateringBtn.click();
    await expect(wateringBtn).toHaveAttribute('aria-pressed', 'true');

    // 4. Water the planted crop
    await page.evaluate((slotId) => {
      window.__waterCrop?.(slotId);
    }, slotId);

    plotState = await page.evaluate((slotId) => {
      const plots = window.__getGameState?.().farm.plots;
      return plots?.find((p) => p.id === slotId);
    }, slotId);
    expect(plotState?.hydratedUntilUtcMs).toBeGreaterThan(Date.now());

    // 5. Fast forward clock by 45 seconds to mature the carrot
    await page.evaluate(() => {
      window.__advanceGameTime?.(45_000);
    });

    plotState = await page.evaluate((slotId) => {
      const plots = window.__getGameState?.().farm.plots;
      return plots?.find((p) => p.id === slotId);
    }, slotId);
    expect(plotState?.crop?.growthProgressSec).toBe(45);

    // 6. Select Harvest tool
    const handBtn = page.locator('[data-testid="tool-hand"]');
    await handBtn.click();
    await expect(handBtn).toHaveAttribute('aria-pressed', 'true');

    // 7. Harvest the carrot
    await page.evaluate((slotId) => {
      window.__harvestCrop?.(slotId);
    }, slotId);

    plotState = await page.evaluate((slotId) => {
      const plots = window.__getGameState?.().farm.plots;
      return plots?.find((p) => p.id === slotId);
    }, slotId);
    expect(plotState?.crop).toBeNull();
    expect(plotState?.hydratedUntilUtcMs).toBe(0);

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

  test('plants directly and rejects a second crop at the same point', async ({ page }) => {
    const placement = { bedId: 'north-west', localX: 0.321, localZ: -0.654 } as const;
    const first = await page.evaluate(
      ({ placement }) => window.__plantCropAt?.(placement, 'carrot'),
      { placement }
    );
    const second = await page.evaluate(
      ({ placement }) => window.__plantCropAt?.(placement, 'carrot'),
      { placement }
    );
    expect(first?.ok).toBe(true);
    expect(second).toEqual({
      ok: false,
      reason: 'occupied_position',
      message: 'Terlalu dekat dengan tanaman lain',
    });
    const state = await page.evaluate(() => window.__getGameState?.());
    expect(state?.inventory.seeds.carrot).toBe(4);
    expect(state?.farm.plots.filter((plot) => plot.crop !== null)).toHaveLength(1);
  });
});
