import { AUTOSAVE_INTERVAL_MS } from '../game/core/constants';
import type { SaveEnvelope } from '../state/storeTypes';
import { db as defaultDb, GardenIslandDB, type BackupRecord } from './database';
import { createDefaultSaveEnvelope } from './saveSchema';
import { runSaveMigrations } from './migrations';

export const LOCAL_STORAGE_SAVE_KEY = 'garden_island_save';
export const LOCAL_STORAGE_BACKUP_PREFIX = 'garden_island_backup_corrupt';
export const CURRENT_SAVE_RECORD_ID = 'current_save';

export type LoadStatus = 'loaded' | 'migrated' | 'corrupt_reset' | 'empty_default';

export interface LoadSaveResult {
  envelope: SaveEnvelope;
  status: LoadStatus;
  backupId?: string;
  error?: string;
}

export interface SaveServiceOptions {
  db?: GardenIslandDB;
  storageKey?: string;
  backupKeyPrefix?: string;
  storageRecordId?: string;
  onCorruptRecovery?: (backupId: string, error: string) => void;
}

export class SaveService {
  private db: GardenIslandDB;
  private storageKey: string;
  private backupKeyPrefix: string;
  private storageRecordId: string;
  private isSaving = false;
  private pendingEnvelope: SaveEnvelope | null = null;
  private pendingResolvers: Array<(res: boolean) => void> = [];
  private pendingRejecters: Array<(err: unknown) => void> = [];
  private _isDirty = false;
  private autosaveTimer: ReturnType<typeof setInterval> | null = null;
  private lifecycleCleanup: (() => void) | null = null;
  private onCorruptRecovery?: (backupId: string, error: string) => void;

  constructor(options: SaveServiceOptions = {}) {
    this.db = options.db ?? defaultDb;
    this.storageKey = options.storageKey ?? LOCAL_STORAGE_SAVE_KEY;
    this.backupKeyPrefix = options.backupKeyPrefix ?? LOCAL_STORAGE_BACKUP_PREFIX;
    this.storageRecordId = options.storageRecordId ?? CURRENT_SAVE_RECORD_ID;
    this.onCorruptRecovery = options.onCorruptRecovery;
  }

  public isDirty(): boolean {
    return this._isDirty;
  }

  public markDirty(): void {
    this._isDirty = true;
  }

  public clearDirty(): void {
    this._isDirty = false;
  }

  public markClean(): void {
    this._isDirty = false;
  }

  /**
   * Serialized asynchronous save with write coalescing.
   * If a save is already in progress, subsequent save requests are coalesced so that
   * only the latest requested state is written next, preventing stale out-of-order writes.
   */
  public async save(envelope: SaveEnvelope): Promise<boolean> {
    if (this.isSaving) {
      this.pendingEnvelope = envelope;
      return new Promise<boolean>((resolve, reject) => {
        this.pendingResolvers.push(resolve);
        this.pendingRejecters.push(reject);
      });
    }

    this.isSaving = true;
    try {
      const success = await this.persistToStorage(envelope);
      this._isDirty = false;
      return success;
    } finally {
      this.isSaving = false;
      if (this.pendingEnvelope) {
        const nextEnvelope = this.pendingEnvelope;
        const resolvers = [...this.pendingResolvers];
        const rejecters = [...this.pendingRejecters];
        this.pendingEnvelope = null;
        this.pendingResolvers = [];
        this.pendingRejecters = [];

        this.save(nextEnvelope)
          .then((res) => resolvers.forEach((r) => r(res)))
          .catch((err) => rejecters.forEach((r) => r(err)));
      }
    }
  }

  /**
   * Immediately saves the provided envelope and clears dirty state.
   */
  public async saveImmediate(envelope: SaveEnvelope): Promise<boolean> {
    return this.save(envelope);
  }

  /**
   * Persists save envelope to IndexedDB with automatic localStorage fallback.
   */
  protected async persistToStorage(envelope: SaveEnvelope): Promise<boolean> {
    const serialized = JSON.stringify(envelope);

    // 1. Mirror to localStorage first (or fallback)
    try {
      localStorage.setItem(this.storageKey, serialized);
    } catch {
      // Ignore if localStorage quota exceeded or unavailable
    }

    // 2. Primary write to Dexie IndexedDB
    try {
      await this.db.saves.put({
        id: this.storageRecordId,
        envelope,
        savedAtUtcMs: envelope.savedAtUtcMs,
        schemaVersion: envelope.schemaVersion,
      });
    } catch {
      // If IndexedDB fails, localStorage is already updated
    }

    return true;
  }

  /**
   * Loads save envelope with fallback, migration, and corrupt data recovery.
   */
  public async load(): Promise<LoadSaveResult> {
    let rawData: unknown = null;

    // 1. Attempt to read from IndexedDB
    try {
      const record = await this.db.saves.get(this.storageRecordId);
      if (record && record.envelope) {
        rawData = record.envelope;
      }
    } catch {
      // IndexedDB unavailable or failed, proceed to localStorage fallback
    }

    // 2. Fall back to localStorage if not found in IndexedDB
    if (!rawData) {
      try {
        const json = localStorage.getItem(this.storageKey);
        if (json) {
          try {
            rawData = JSON.parse(json);
          } catch (jsonErr) {
            const errorMsg = jsonErr instanceof Error ? jsonErr.message : 'Invalid JSON';
            const backupId = await this.backupCorruptSave(json, `Corrupt JSON in storage: ${errorMsg}`);
            const defaultEnv = createDefaultSaveEnvelope();
            await this.persistToStorage(defaultEnv);
            this.onCorruptRecovery?.(backupId, errorMsg);
            return {
              envelope: defaultEnv,
              status: 'corrupt_reset',
              backupId,
              error: errorMsg,
            };
          }
        }
      } catch {
        // localStorage read error
      }
    }

    // 3. If no save exists anywhere, return clean default
    if (!rawData) {
      return {
        envelope: createDefaultSaveEnvelope(),
        status: 'empty_default',
      };
    }

    // 4. Validate and run migrations
    try {
      const migrationResult = runSaveMigrations(rawData);
      return {
        envelope: migrationResult.envelope,
        status: migrationResult.migrated ? 'migrated' : 'loaded',
      };
    } catch (validationErr) {
      const errorMsg =
        validationErr instanceof Error ? validationErr.message : String(validationErr);
      const backupId = await this.backupCorruptSave(
        rawData,
        `Save validation/migration failed: ${errorMsg}`
      );
      const defaultEnv = createDefaultSaveEnvelope();
      await this.persistToStorage(defaultEnv);
      this.onCorruptRecovery?.(backupId, errorMsg);

      return {
        envelope: defaultEnv,
        status: 'corrupt_reset',
        backupId,
        error: errorMsg,
      };
    }
  }

  /**
   * Backs up corrupt payload to Dexie backups table and localStorage.
   */
  public async backupCorruptSave(payload: unknown, reason: string): Promise<string> {
    const timestamp = Date.now();
    const backupId = `corrupt_${timestamp}_${Math.random().toString(36).substring(2, 8)}`;
    const backupRecord: BackupRecord = {
      id: backupId,
      payload,
      reason,
      createdAtUtcMs: timestamp,
    };

    // Save to Dexie backups table
    try {
      await this.db.backups.add(backupRecord);
    } catch {
      // Dexie backup error ignored
    }

    // Save structured backup record to localStorage backup key
    try {
      localStorage.setItem(`${this.backupKeyPrefix}_${timestamp}`, JSON.stringify(backupRecord));
    } catch {
      // localStorage backup error ignored
    }

    return backupId;
  }

  /**
   * Retrieves all backed-up corrupt/historical save records.
   */
  public async getBackups(): Promise<BackupRecord[]> {
    const backups: BackupRecord[] = [];

    try {
      const dbBackups = await this.db.backups.toArray();
      backups.push(...dbBackups);
    } catch {
      // IndexedDB error ignored
    }

    // Also harvest any localStorage backup items
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.backupKeyPrefix)) {
          const raw = localStorage.getItem(key);
          if (raw && !backups.some((b) => b.id === key)) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === 'object' && 'reason' in parsed && 'payload' in parsed) {
                backups.push({
                  id: (parsed.id as string) || key,
                  payload: parsed.payload,
                  reason: (parsed.reason as string) || 'Corrupt backup in storage',
                  createdAtUtcMs: (parsed.createdAtUtcMs as number) || Date.now(),
                });
              } else {
                backups.push({
                  id: key,
                  payload: parsed,
                  reason: 'Corrupt save data in storage',
                  createdAtUtcMs: Date.now(),
                });
              }
            } catch {
              backups.push({
                id: key,
                payload: raw,
                reason: 'Corrupt unparseable save in storage',
                createdAtUtcMs: Date.now(),
              });
            }
          }
        }
      }
    } catch {
      // localStorage error ignored
    }

    return backups;
  }

  /**
   * Clears saved game data from all storage layers.
   */
  public async clearSave(): Promise<void> {
    try {
      await this.db.saves.delete(this.storageRecordId);
    } catch {
      // IndexedDB delete error ignored
    }

    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // localStorage remove error ignored
    }
  }

  /**
   * Starts periodic autosave loop.
   */
  public startAutosave(
    intervalMs: number = AUTOSAVE_INTERVAL_MS,
    getEnvelope?: () => SaveEnvelope
  ): void {
    this.stopAutosave();
    this.autosaveTimer = setInterval(async () => {
      if (this.isDirty() && getEnvelope) {
        await this.save(getEnvelope());
      }
    }, intervalMs);
  }

  /**
   * Stops periodic autosave loop.
   */
  public stopAutosave(): void {
    if (this.autosaveTimer !== null) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  /**
   * Sets up lifecycle listeners for pagehide and visibilitychange (hidden).
   */
  public setupLifecycleListeners(getEnvelope: () => SaveEnvelope): () => void {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        this.saveImmediate(getEnvelope());
      }
    };

    const handlePageHide = () => {
      this.saveImmediate(getEnvelope());
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', handlePageHide);
    }

    const cleanup = () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', handlePageHide);
      }
      this.stopAutosave();
    };

    this.lifecycleCleanup = cleanup;
    return cleanup;
  }

  /**
   * Exports save data as a formatted JSON string.
   */
  public async exportSaveJson(envelope?: SaveEnvelope): Promise<string> {
    if (envelope) {
      return JSON.stringify(envelope, null, 2);
    }
    const loaded = await this.load();
    return JSON.stringify(loaded.envelope, null, 2);
  }

  /**
   * Validates and imports a save from a JSON string.
   */
  public async importSaveJson(
    jsonStr: string
  ): Promise<{ success: boolean; envelope?: SaveEnvelope; error?: string }> {
    try {
      const parsed = JSON.parse(jsonStr);
      const migrated = runSaveMigrations(parsed);
      await this.save(migrated.envelope);
      return { success: true, envelope: migrated.envelope };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Cleans up all active timers and listeners.
   */
  public dispose(): void {
    this.stopAutosave();
    if (this.lifecycleCleanup) {
      this.lifecycleCleanup();
      this.lifecycleCleanup = null;
    }
    this.pendingEnvelope = null;
    this.pendingResolvers = [];
    this.pendingRejecters = [];
  }
}

export const saveService = new SaveService();
