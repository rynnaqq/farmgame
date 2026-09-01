import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SaveService } from './saveService';
import { createDefaultSaveEnvelope } from './saveSchema';
import type { SaveEnvelope } from '../state/storeTypes';
import { GardenIslandDB } from './database';

describe('SaveService', () => {
  let saveService: SaveService;
  let mockDb: GardenIslandDB;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();

    // Create fresh in-memory or fallback database instance for testing
    mockDb = new GardenIslandDB(`TestGardenIslandDB_${Date.now()}_${Math.random()}`);
    saveService = new SaveService({ db: mockDb });
  });

  afterEach(async () => {
    saveService.dispose();
    vi.clearAllTimers();
    vi.useRealTimers();
    localStorage.clear();
    try {
      await mockDb.delete();
    } catch {
      // Ignore if in environments without delete support
    }
  });

  describe('Save / Load Roundtrips & Storage Fallback', () => {
    it('saves and loads envelope successfully using fallback/storage', async () => {
      const envelope = createDefaultSaveEnvelope(1700000000000, 100);
      envelope.player.coins = 777;

      const saveResult = await saveService.save(envelope);
      expect(saveResult).toBe(true);

      const loadResult = await saveService.load();
      expect(loadResult.status).toBe('loaded');
      expect(loadResult.envelope.player.coins).toBe(777);
      expect(loadResult.envelope.rngState).toBe(100);
    });

    it('returns empty_default when loading without any saved data', async () => {
      const loadResult = await saveService.load();
      expect(loadResult.status).toBe('empty_default');
      expect(loadResult.envelope.schemaVersion).toBe(1);
      expect(loadResult.envelope.player.coins).toBe(100);
    });

    it('falls back to localStorage when IndexedDB operations throw', async () => {
      // Mock db.saves.put and db.saves.get to throw
      const failingDb = new GardenIslandDB('FailingDB');
      vi.spyOn(failingDb.saves, 'put').mockRejectedValue(new Error('IndexedDB quota error'));
      vi.spyOn(failingDb.saves, 'get').mockRejectedValue(new Error('IndexedDB read error'));

      const fallbackService = new SaveService({ db: failingDb });
      const envelope = createDefaultSaveEnvelope();
      envelope.player.coins = 999;

      const saved = await fallbackService.save(envelope);
      expect(saved).toBe(true);

      // Verify it was stored in localStorage
      const localStored = localStorage.getItem('garden_island_save');
      expect(localStored).not.toBeNull();
      expect(JSON.parse(localStored!).player.coins).toBe(999);

      const loaded = await fallbackService.load();
      expect(loaded.status).toBe('loaded');
      expect(loaded.envelope.player.coins).toBe(999);

      fallbackService.dispose();
    });
  });

  describe('Save Queue Serialization and Write Coalescing', () => {
    it('serializes and coalesces multiple concurrent save calls without out-of-order writes', async () => {
      const saveCallOrder: number[] = [];

      vi.spyOn(
        saveService as unknown as { persistToStorage: (e: SaveEnvelope) => Promise<boolean> },
        'persistToStorage'
      ).mockImplementation(async (env: SaveEnvelope) => {
        // Add artificial delay to simulate async I/O
        await new Promise((resolve) => setTimeout(resolve, 50));
        saveCallOrder.push(env.player.coins);
        return true;
      });

      const env1 = createDefaultSaveEnvelope();
      env1.player.coins = 100;

      const env2 = createDefaultSaveEnvelope();
      env2.player.coins = 200;

      const env3 = createDefaultSaveEnvelope();
      env3.player.coins = 300;

      const env4 = createDefaultSaveEnvelope();
      env4.player.coins = 400;

      // Dispatch 4 saves concurrently while env1 is in flight
      const p1 = saveService.save(env1);
      const p2 = saveService.save(env2);
      const p3 = saveService.save(env3);
      const p4 = saveService.save(env4);

      // Advance timers to resolve all async writes
      await vi.advanceTimersByTimeAsync(200);

      const results = await Promise.all([p1, p2, p3, p4]);
      expect(results).toEqual([true, true, true, true]);

      // Because env2, env3, env4 were queued while env1 was saving, they should coalesce to env4!
      // Thus persistToStorage should have been called for env1 (100) and env4 (400), skipping stale env2 and env3.
      expect(saveCallOrder).toEqual([100, 400]);
    });
  });

  describe('Dirty Tracking and Autosave', () => {
    it('tracks dirty status correctly', async () => {
      expect(saveService.isDirty()).toBe(false);

      saveService.markDirty();
      expect(saveService.isDirty()).toBe(true);

      saveService.clearDirty();
      expect(saveService.isDirty()).toBe(false);

      saveService.markDirty();
      const envelope = createDefaultSaveEnvelope();
      await saveService.save(envelope);
      expect(saveService.isDirty()).toBe(false);
    });

    it('autosaves on interval only when dirty', async () => {
      let currentCoins = 100;
      const getEnvelope = () => {
        const env = createDefaultSaveEnvelope();
        env.player.coins = currentCoins;
        return env;
      };

      const saveSpy = vi.spyOn(saveService, 'save');

      saveService.startAutosave(10000, getEnvelope);

      // 1. Clean state -> interval triggers -> should not save
      await vi.advanceTimersByTimeAsync(10000);
      expect(saveSpy).not.toHaveBeenCalled();

      // 2. Mark dirty -> advance 10s -> should save current state
      saveService.markDirty();
      currentCoins = 250;

      await vi.advanceTimersByTimeAsync(10000);
      expect(saveSpy).toHaveBeenCalledTimes(1);

      // Verify loaded data has updated coins
      const loaded = await saveService.load();
      expect(loaded.envelope.player.coins).toBe(250);

      // 3. Stop autosave -> advance time -> should not trigger again
      saveService.stopAutosave();
      saveService.markDirty();
      await vi.advanceTimersByTimeAsync(20000);
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it('performs immediate save on saveImmediate call', async () => {
      const envelope = createDefaultSaveEnvelope();
      envelope.player.coins = 555;
      saveService.markDirty();

      const result = await saveService.saveImmediate(envelope);
      expect(result).toBe(true);
      expect(saveService.isDirty()).toBe(false);

      const loaded = await saveService.load();
      expect(loaded.envelope.player.coins).toBe(555);
    });
  });

  describe('Corrupt Save Backup and Recovery', () => {
    it('recovers from corrupt storage data by creating backup and fresh valid save', async () => {
      // Put completely corrupt data in localStorage and DB
      localStorage.setItem(
        'garden_island_save',
        JSON.stringify({ corrupt: true, coins: 'not-a-number' })
      );

      const loadResult = await saveService.load();
      expect(loadResult.status).toBe('corrupt_reset');
      expect(loadResult.envelope.schemaVersion).toBe(1);
      expect(loadResult.envelope.player.coins).toBe(100);

      // Corrupt backup should exist in backups
      const backups = await saveService.getBackups();
      expect(backups.length).toBeGreaterThanOrEqual(1);
      expect(backups[0].reason).toMatch(/validation|corrupt|invalid/i);

      // Next load should be clean and valid
      const nextLoad = await saveService.load();
      expect(nextLoad.status).toBe('loaded');
      expect(nextLoad.envelope.schemaVersion).toBe(1);
    });

    it('backs up corrupt raw JSON string in localStorage', async () => {
      localStorage.setItem('garden_island_save', '{ bad-json-syntax }');

      const loadResult = await saveService.load();
      expect(loadResult.status).toBe('corrupt_reset');
      expect(loadResult.envelope.schemaVersion).toBe(1);
    });
  });

  describe('Lifecycle Listeners (pagehide & visibilitychange)', () => {
    it('triggers immediate save on pagehide and visibilitychange when hidden', async () => {
      let coins = 300;
      const getEnvelope = () => {
        const env = createDefaultSaveEnvelope();
        env.player.coins = coins;
        return env;
      };

      const saveImmediateSpy = vi.spyOn(saveService, 'saveImmediate');
      const cleanup = saveService.setupLifecycleListeners(getEnvelope);

      // Trigger visibilitychange to 'visible' -> should NOT save
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(saveImmediateSpy).not.toHaveBeenCalled();

      // Trigger visibilitychange to 'hidden' -> should save
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(saveImmediateSpy).toHaveBeenCalledTimes(1);

      // Trigger pagehide -> should save
      coins = 400;
      window.dispatchEvent(new Event('pagehide'));
      expect(saveImmediateSpy).toHaveBeenCalledTimes(2);

      // Cleanup removes listeners
      cleanup();
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pagehide'));
      expect(saveImmediateSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('JSON Export and Import', () => {
    it('exports save envelope to JSON string and imports valid JSON', async () => {
      const env = createDefaultSaveEnvelope();
      env.player.coins = 888;
      await saveService.save(env);

      const jsonStr = await saveService.exportSaveJson();
      expect(typeof jsonStr).toBe('string');
      expect(jsonStr).toContain('"coins": 888');

      // Test importing back into a clean service
      const newService = new SaveService({ db: mockDb });
      const importResult = await newService.importSaveJson(jsonStr);
      expect(importResult.success).toBe(true);
      expect(importResult.envelope?.player.coins).toBe(888);

      const loaded = await newService.load();
      expect(loaded.envelope.player.coins).toBe(888);
      newService.dispose();
    });

    it('rejects importing invalid or corrupt JSON', async () => {
      const result1 = await saveService.importSaveJson('{ broken json');
      expect(result1.success).toBe(false);
      expect(result1.error).toBeDefined();

      const result2 = await saveService.importSaveJson(JSON.stringify({ player: { coins: -50 } }));
      expect(result2.success).toBe(false);
      expect(result2.error).toBeDefined();
    });
  });
});
