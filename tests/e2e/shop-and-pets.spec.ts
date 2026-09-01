import { test, expect } from '@playwright/test';
import '../../src/test/testClock';

test.describe('Shop Economy, Upgrades, and Companion Pets E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__testClockReady === true);
    await page.evaluate(() => {
      window.__resetGame?.(777);
    });
  });

  test('shop seed purchasing verifies coin deduction and seed inventory increments', async ({ page }) => {
    // 1. Open Shop Modal
    await page.evaluate(() => {
      window.__openModal?.('shop');
    });

    const shopModal = page.locator('[data-testid="shop-modal"]');
    await expect(shopModal).toBeVisible();

    const coinBadge = page.locator('[data-testid="shop-player-coins"]');
    await expect(coinBadge).toContainText('100');

    // 2. Buy 1 Carrot Seed (Cost: 5c)
    const buy1Carrot = page.locator('[data-testid="buy-seed-1-carrot"]');
    await expect(buy1Carrot).toBeEnabled();
    await buy1Carrot.click();

    // Verify coins = 95
    await expect(coinBadge).toContainText('95');
    const ownedCarrots = page.locator('[data-testid="seed-owned-carrot"]');
    await expect(ownedCarrots).toContainText('Owned: 6');

    // 3. Buy 5 Tomato Seeds requires 100c, player has 95c -> button should be disabled
    const buy5Tomato = page.locator('[data-testid="buy-seed-5-tomato"]');
    await expect(buy5Tomato).toBeDisabled();

    // 4. Buy 1 Tomato Seed (Cost: 20c) -> player has 95c
    const buy1Tomato = page.locator('[data-testid="buy-seed-1-tomato"]');
    await expect(buy1Tomato).toBeEnabled();
    await buy1Tomato.click();

    await expect(coinBadge).toContainText('75');
    const ownedTomatoes = page.locator('[data-testid="seed-owned-tomato"]');
    await expect(ownedTomatoes).toContainText('Owned: 1');

    // Close Shop
    const closeBtn = page.locator('[data-testid="shop-close-button"]');
    await closeBtn.click();
    await expect(shopModal).not.toBeVisible();
  });

  test('upgrades tab: purchasing Golden Watering Can and Farm Expansion', async ({ page }) => {
    // 1. Credit player with coins for upgrades
    await page.evaluate(() => {
      window.__addCoins?.(3000); // 100 + 3000 = 3100
      window.__openModal?.('shop');
    });

    const shopModal = page.locator('[data-testid="shop-modal"]');
    await expect(shopModal).toBeVisible();

    // 2. Navigate to Upgrades tab
    const upgradesTab = page.locator('[data-testid="tab-upgrades"]');
    await upgradesTab.click();
    await expect(page.locator('[data-testid="pane-upgrades"]')).toBeVisible();

    // 3. Buy Golden Watering Can (Cost: 1200c)
    const buyGoldenCanBtn = page.locator('[data-testid="upgrade-buy-golden_can"]');
    await expect(buyGoldenCanBtn).toBeEnabled();
    await buyGoldenCanBtn.click();

    // Verify upgrade is now active / disabled
    await expect(buyGoldenCanBtn).toHaveText(/Owned/i);
    await expect(buyGoldenCanBtn).toBeDisabled();

    const state = await page.evaluate(() => window.__getGameState?.());
    expect(state?.farm.goldenWateringCanOwned).toBe(true);
    expect(state?.player.coins).toBe(1900); // 3100 - 1200

    // 4. Buy 6x6 Grid Expansion (Cost: 750c)
    const buyExpansionBtn = page.locator('[data-testid="upgrade-buy-expansion_6x6"]');
    await expect(buyExpansionBtn).toBeEnabled();
    await buyExpansionBtn.click();

    const stateAfterExpansion = await page.evaluate(() => window.__getGameState?.());
    expect(stateAfterExpansion?.farm.gridSize).toBe(6);
    expect(stateAfterExpansion?.player.coins).toBe(1150); // 1900 - 750
  });

  test('companion eggs: purchase common egg, incubate, fast-forward, hatch and verify pet equipped', async ({ page }) => {
    // 1. Credit player and open shop
    await page.evaluate(() => {
      window.__addCoins?.(1000);
      window.__openModal?.('shop');
    });

    // 2. Navigate to Companion Eggs tab
    const eggsTab = page.locator('[data-testid="tab-eggs"]');
    await eggsTab.click();
    await expect(page.locator('[data-testid="pane-eggs"]')).toBeVisible();

    // 3. Buy Common Egg (Cost: 250c)
    const buyCommonEggBtn = page.locator('[data-testid="buy-egg-common"]');
    await expect(buyCommonEggBtn).toBeEnabled();
    await buyCommonEggBtn.click();

    // Close shop
    await page.locator('[data-testid="shop-close-button"]').click();

    // Verify egg in inventory
    const eggs = await page.evaluate(() => window.__getGameState?.().inventory.eggs);
    expect(eggs?.length).toBe(1);
    const eggId = eggs?.[0].id;
    expect(eggId).toBeDefined();

    if (eggId) {
      // 4. Start incubation
      await page.evaluate((id) => {
        window.__incubateEgg?.(id);
      }, eggId);

      // 5. Fast-forward clock by 90 seconds (incubation threshold)
      await page.evaluate(() => {
        window.__advanceGameTime?.(90_000);
      });

      // 6. Hatch egg
      await page.evaluate((id) => {
        window.__hatchEgg?.(id);
      }, eggId);

      // 7. Verify pet is added and equipped
      const finalState = await page.evaluate(() => window.__getGameState?.());
      expect(finalState?.inventory.pets.length).toBe(1);
      expect(finalState?.inventory.equippedPetId).toBe(finalState?.inventory.pets[0].id);

      // Verify HUD displays pet chip
      const petChip = page.locator('[data-testid="hud-pet-chip"]');
      await expect(petChip).toBeVisible();
    }
  });
});
