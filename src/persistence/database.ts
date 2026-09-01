import Dexie, { type Table } from 'dexie';
import type { SaveEnvelope } from '../state/storeTypes';
import { DB_NAME, CURRENT_SCHEMA_VERSION } from '../game/core/constants';

export interface SaveRecord {
  id: string;
  envelope: SaveEnvelope;
  savedAtUtcMs: number;
  schemaVersion: number;
}

export interface BackupRecord {
  id: string;
  payload: unknown;
  reason: string;
  createdAtUtcMs: number;
}

export class GardenIslandDB extends Dexie {
  saves!: Table<SaveRecord, string>;
  backups!: Table<BackupRecord, string>;

  constructor(
    dbName: string = DB_NAME,
    options?: { indexedDB?: IDBFactory; IDBKeyRange?: typeof IDBKeyRange }
  ) {
    super(dbName, options);
    this.version(CURRENT_SCHEMA_VERSION).stores({
      saves: 'id, savedAtUtcMs, schemaVersion',
      backups: 'id, createdAtUtcMs, reason',
    });
  }
}

export const db = new GardenIslandDB();

export function isIndexedDBSupported(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}
