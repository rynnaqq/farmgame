# Free-Placement Farm Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti grid visual lama dengan empat bed 2x2 yang tidak bertabrakan dengan pagar, serta menanam maksimal 64 crop tepat pada titik klik/tap tanpa Till dan tanpa penumpukan.

**Architecture:** Modul murni farmLayout menjadi satu-satunya sumber koordinat untuk renderer, collider, interaksi, migrasi, mobile, dan pet. Enam puluh empat PlotData dipertahankan sebagai slot logis deterministik; posisi visual hidup pada CropData. Perubahan dilakukan test-first dari geometri dan aturan placement, lalu domain/persistence, renderer/UI, dan kontrak Supabase.

**Tech Stack:** TypeScript, React 19, React Three Fiber/Three.js, Zustand, Zod, Vitest, Testing Library, Vite, Playwright, PostgreSQL/Supabase.

**Spec:** `docs/superpowers/specs/2026-09-02-free-placement-farm-redesign-design.md`

## Global Constraints

- Bentuk kebun wajib empat bed 2x2 dengan koridor silang, bukan 64 tile visual.
- Ukuran luar tiap bed adalah 6.0 x 5.4 world unit; pusat bed berada pada X -3.8/+3.8 dan Z -3.5/+3.5.
- Inset tanam adalah 0.45; batas lokal sah X [-2.55, 2.55] dan Z [-2.25, 2.25].
- Collider pagar barat/timur berpusat pada X -7.95/+7.95, utara/selatan pada Z -7.35/+7.35, dengan tebal 0.24.
- Clearance sisi dalam collider pagar terhadap frame bed adalah 1.03 world unit dan tidak boleh kurang dari 0.9.
- Gerbang depan selebar 2.2 world unit dan tepat segaris dengan koridor vertikal.
- Penanaman menyimpan titik sah yang diketuk/diklik, dibulatkan hanya saat persist ke tiga desimal; error render maksimum 0.01 world unit.
- Jarak pusat crop kurang dari 1.1 ditolak; jarak tepat 1.1 atau lebih diterima tanpa auto-shift.
- Validasi plant berurutan: placement valid, masih di area tanam, slot tersedia, tidak overlap, lalu benih tersedia.
- Kegagalan plant tidak boleh mengurangi benih atau memodifikasi farm.
- Maksimum crop aktif tetap 64 dan semua 64 slot tersedia sejak awal.
- Till/trowel dan upgrade grid 6x6/8x8 harus hilang dari runtime, UI, shortcut, tutorial, shop, audio, save v2, dan RPC publik.
- Save v1 dan data SQL lama harus dimigrasikan tanpa kehilangan crop, waktu tanam, progres, mutasi, hidrasi, koin, inventory, pet, atau weather.
- Water, Harvest, cuaca, offline growth, mutation, Golden Watering Can, mobile targeting, dan dog auto-harvest harus memakai placement aktual.
- Tidak menambah dependency produksi baru.
- Pertahankan perubahan pengguna yang tidak terkait: penghapusan .env.example dan bugfixes&update.md serta kedua screenshot referensi yang untracked.

## File Responsibility Map

### Modul baru

- **src/game/world/farmLayout.ts** — tipe placement, semua konstanta footprint, konversi world/local, legacy mapping, pagar, dan stud exclusion.
- **src/game/world/farmLayout.test.ts** — kontrak numerik geometri, clearance, round-trip, bounds, dan legacy mapping.
- **src/game/farming/plantPlacement.ts** — validasi collision, pemilihan slot kosong, jarak, dan urutan crop terdekat.
- **src/game/farming/plantPlacement.test.ts** — batas 1.1, limit 64, determinisme, dan spatial ordering.
- **src/game/world/FarmBeds.tsx** — empat permukaan tanah kontinu, frame, furrow, pointer click/tap, dan drag guard.
- **src/game/world/FarmBeds.test.tsx** — exact-point forwarding dan toleransi drag 6 CSS pixel.
- **src/game/world/PlacedCrop.tsx** — render satu crop berdasarkan CropData.placement dan klik crop.
- **src/game/world/PlacedCrop.test.tsx** — koordinat render dan penerusan slotId.
- **src/game/multiplayer/farmPatchProtocol.ts** — parser/mapper placement pada farm patch dan snapshot.
- **src/game/multiplayer/farmPatchProtocol.test.ts** — kontrak payload backend dan penolakan placement rusak.
- **src/test/farmFixtures.ts** — factory PlotData/CropData placement-aware untuk test lintas modul.
- **supabase/migrations/0007_free_placement_farm.sql** — kolom placement, backfill, RPC plant langsung, patch, harvest cleanup, dan revoke Till.

### Modul yang diubah

- **src/state/storeTypes.ts** — CropPlacement pada CropData, final PlotData tanpa tilled, failure reason baru, dan ToolType tanpa trowel.
- **src/state/gameStore.ts** — selalu membuat 64 slot, serialisasi v2, dan menghapus setGridSize.
- **src/state/uiStore.ts** — tool awal menjadi seed_bag dan tidak pernah menyimpan trowel.
- **src/game/core/constants.ts** — schema version 2, kapasitas 64, dan penghapusan konstanta grid visual usang.
- **src/persistence/saveSchema.ts** — parser v1 terpisah dan schema v2 wajib-placement.
- **src/persistence/migrations.ts** — migrasi 1 ke 2 yang idempotent dan lossless.
- **src/persistence/offlineSimulation.ts** — pertumbuhan crop tidak bergantung pada tilled.
- **src/game/farming/farmingCommands.ts** — plantCropAt, water/harvest berbasis crop, dan command dispatcher terpisah.
- **src/game/farming/plotMachine.ts** — state empty/planted/watered/harvestable.
- **src/game/farming/growthSystem.ts** — iterasi crop tanpa guard tilled.
- **src/game/weather/weatherSystem.ts** — rain/hydration hanya pada crop aktif.
- **src/game/world/GardenIsland.tsx** — fence/collider/stud exclusion membaca farmLayout.
- **src/game/GameRuntime.tsx** — komposisi FarmBeds dan PlacedCrop tanpa matematika koordinat.
- **src/app/App.tsx** — onPlantAt terpisah dari onCropInteract dan pemetaan toast.
- **src/ui/mobile/targetPlotFinder.ts** — target crop berdasarkan placement aktual.
- **src/ui/mobile/MobileHUD.tsx** dan **src/ui/mobile/MobileActionButton.tsx** — Seeds menampilkan Tap Soil; Water/Harvest menarget crop.
- **src/game/pets/petSystem.ts** dan **src/game/pets/PetRenderer.tsx** — dog memakai world point dari placement.
- **src/ui/Toolbelt.tsx**, **src/game/input/KeyboardInput.ts**, **src/ui/Tutorial.tsx** — hapus Till dan remap 1 Water, 2 Seeds, 3 Harvest.
- **src/ui/ShopModal.tsx**, **src/game/economy/shopCatalog.ts**, **src/game/economy/economyDefinitions.ts**, dan **src/game/economy/economyCommands.ts** — hapus produk expansion.
- **src/game/audio/AudioManager.ts**, **src/game/audio/audioSynthesizer.ts**, dan **src/game/player/PlayerModel.tsx** — hapus aksi/animasi trowel.
- **src/game/multiplayer/RoomConnection.ts** — snapshot dan patch membawa placement.

### Modul yang dihapus setelah semua consumer berpindah

- **src/game/world/SoilGrid.tsx** — renderer dua bed/grid lama.
- **src/game/world/PlotMesh.tsx** — tile visual lama.
- **src/game/world/gridCoordinates.ts** — row/col sebagai koordinat dunia.
- **src/game/world/SoilGrid.test.ts** dan **src/game/world/SoilGridExpansion.test.ts** — kontrak grid visual/expansion usang.

---

### Task 1: Kontrak Geometri Empat Bed

**Files:**
- Create: src/game/world/farmLayout.ts
- Create: src/game/world/farmLayout.test.ts

**Interfaces:**
- Consumes: Tidak ada state React/Zustand.
- Produces: FarmBedId, CropPlacement, FARM_BED_IDS, FARM_BEDS, FARM_FENCE, FARM_OUTER_BOUNDS, worldPointToPlacement(point), placementToWorldPoint(placement, y), isPlacementInsideBed(placement), legacyGridToPlacement(row, col), dan isInsideFarmStudExclusion(x, z, padding).

- [ ] **Step 1: Tulis test kontrak layout yang gagal**

~~~ts
import { describe, expect, it } from 'vitest';
import {
  FARM_BED_IDS,
  FARM_BEDS,
  FARM_FENCE,
  legacyGridToPlacement,
  placementToWorldPoint,
  worldPointToPlacement,
} from './farmLayout';

describe('farmLayout', () => {
  it('defines four separated 6.0 x 5.4 beds', () => {
    expect(FARM_BED_IDS).toEqual([
      'north-west',
      'north-east',
      'south-west',
      'south-east',
    ]);
    expect(FARM_BEDS['north-west']).toMatchObject({
      centerX: -3.8,
      centerZ: -3.5,
      width: 6,
      depth: 5.4,
    });
    expect(FARM_BEDS['south-east']).toMatchObject({ centerX: 3.8, centerZ: 3.5 });
    expect(FARM_BEDS['north-east'].centerX - 3 - (FARM_BEDS['north-west'].centerX + 3))
      .toBeCloseTo(1.6, 6);
    expect(FARM_BEDS['south-west'].centerZ - 2.7 - (FARM_BEDS['north-west'].centerZ + 2.7))
      .toBeCloseTo(1.6, 6);
  });

  it('keeps every fence collider at least 0.9 from bed frames', () => {
    const eastFrame = FARM_BEDS['north-east'].centerX + 3;
    const eastFenceInner = FARM_FENCE.eastX - FARM_FENCE.thickness / 2;
    const southFrame = FARM_BEDS['south-east'].centerZ + 2.7;
    const southFenceInner = FARM_FENCE.frontZ - FARM_FENCE.thickness / 2;
    expect(eastFenceInner - eastFrame).toBeCloseTo(1.03, 6);
    expect(southFenceInner - southFrame).toBeCloseTo(1.03, 6);
  });

  it('round-trips an exact click and rejects frame/corridor points', () => {
    const placement = worldPointToPlacement({ x: -4.1374, z: -3.0126 });
    expect(placement).toEqual({ bedId: 'north-west', localX: -0.337, localZ: 0.487 });
    expect(placementToWorldPoint(placement!, 0.2)).toEqual({
      x: -4.137,
      y: 0.2,
      z: -3.013,
    });
    expect(worldPointToPlacement({ x: 0, z: 0 })).toBeNull();
    expect(worldPointToPlacement({ x: -6.75, z: -3.5 })).toBeNull();
  });

  it('maps all 64 legacy slots to unique safe placements', () => {
    const points = Array.from({ length: 64 }, (_, index) => {
      const placement = legacyGridToPlacement(Math.floor(index / 8), index % 8);
      return placementToWorldPoint(placement);
    });
    expect(new Set(points.map((p) => p.x + ':' + p.z))).toHaveSize(64);
    for (let a = 0; a < points.length; a += 1) {
      for (let b = a + 1; b < points.length; b += 1) {
        expect(Math.hypot(points[a].x - points[b].x, points[a].z - points[b].z))
          .toBeGreaterThanOrEqual(1.1);
      }
    }
  });
});
~~~

- [ ] **Step 2: Jalankan test dan pastikan merah**

Run: npm test -- --run src/game/world/farmLayout.test.ts

Expected: FAIL karena modul ./farmLayout belum ada.

- [ ] **Step 3: Implementasikan sumber geometri tunggal**

~~~ts
export const FARM_BED_IDS = [
  'north-west',
  'north-east',
  'south-west',
  'south-east',
] as const;

export type FarmBedId = (typeof FARM_BED_IDS)[number];

export interface CropPlacement {
  bedId: FarmBedId;
  localX: number;
  localZ: number;
}

export interface FarmBedDefinition {
  id: FarmBedId;
  centerX: number;
  centerZ: number;
  width: 6;
  depth: 5.4;
  soilHeight: number;
  plantingInset: 0.45;
}

const makeBed = (
  id: FarmBedId,
  centerX: number,
  centerZ: number
): FarmBedDefinition => ({
  id,
  centerX,
  centerZ,
  width: 6,
  depth: 5.4,
  soilHeight: 0.22,
  plantingInset: 0.45,
});

export const FARM_BEDS: Record<FarmBedId, FarmBedDefinition> = {
  'north-west': makeBed('north-west', -3.8, -3.5),
  'north-east': makeBed('north-east', 3.8, -3.5),
  'south-west': makeBed('south-west', -3.8, 3.5),
  'south-east': makeBed('south-east', 3.8, 3.5),
};

export const FARM_FENCE = {
  westX: -7.95,
  eastX: 7.95,
  backZ: -7.35,
  frontZ: 7.35,
  thickness: 0.24,
  height: 1.3,
  gateWidth: 2.2,
  segments: [
    { id: 'west', position: [-7.95, 0.65, 0] as const, size: [0.24, 1.3, 14.7] as const },
    { id: 'east', position: [7.95, 0.65, 0] as const, size: [0.24, 1.3, 14.7] as const },
    { id: 'back', position: [0, 0.65, -7.35] as const, size: [15.9, 1.3, 0.24] as const },
    { id: 'front-west', position: [-4.525, 0.65, 7.35] as const, size: [6.85, 1.3, 0.24] as const },
    { id: 'front-east', position: [4.525, 0.65, 7.35] as const, size: [6.85, 1.3, 0.24] as const },
  ],
} as const;

export const FARM_OUTER_BOUNDS = {
  minX: -6.8,
  maxX: 6.8,
  minZ: -6.2,
  maxZ: 6.2,
} as const;

const LOCAL_MIN_X = -2.55;
const LOCAL_MAX_X = 2.55;
const LOCAL_MIN_Z = -2.25;
const LOCAL_MAX_Z = 2.25;

function roundPlacement(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function isFarmBedId(value: unknown): value is FarmBedId {
  return typeof value === 'string' && FARM_BED_IDS.includes(value as FarmBedId);
}

export function isPlacementInsideBed(placement: CropPlacement): boolean {
  return (
    isFarmBedId(placement.bedId) &&
    Number.isFinite(placement.localX) &&
    Number.isFinite(placement.localZ) &&
    placement.localX >= LOCAL_MIN_X &&
    placement.localX <= LOCAL_MAX_X &&
    placement.localZ >= LOCAL_MIN_Z &&
    placement.localZ <= LOCAL_MAX_Z
  );
}

export function worldPointToPlacement(point: { x: number; z: number }): CropPlacement | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return null;
  for (const bedId of FARM_BED_IDS) {
    const bed = FARM_BEDS[bedId];
    const rawLocalX = point.x - bed.centerX;
    const rawLocalZ = point.z - bed.centerZ;
    if (
      rawLocalX < LOCAL_MIN_X ||
      rawLocalX > LOCAL_MAX_X ||
      rawLocalZ < LOCAL_MIN_Z ||
      rawLocalZ > LOCAL_MAX_Z
    ) {
      continue;
    }
    return {
      bedId,
      localX: roundPlacement(rawLocalX),
      localZ: roundPlacement(rawLocalZ),
    };
  }
  return null;
}

export function placementToWorldPoint(
  placement: CropPlacement,
  y = 0
): { x: number; y: number; z: number } {
  const bed = FARM_BEDS[placement.bedId];
  return {
    x: roundPlacement(bed.centerX + placement.localX),
    y,
    z: roundPlacement(bed.centerZ + placement.localZ),
  };
}

export function legacyGridToPlacement(row: number, col: number): CropPlacement {
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row > 7 || col < 0 || col > 7) {
    throw new RangeError('Legacy row and col must be integers from 0 through 7');
  }
  const northSouth = row < 4 ? 'north' : 'south';
  const westEast = col < 4 ? 'west' : 'east';
  return {
    bedId: (northSouth + '-' + westEast) as FarmBedId,
    localX: ((col % 4) - 1.5) * 1.2,
    localZ: ((row % 4) - 1.5) * 1.2,
  };
}

export function isInsideFarmStudExclusion(x: number, z: number, padding = 0.25): boolean {
  return (
    x >= FARM_OUTER_BOUNDS.minX - padding &&
    x <= FARM_OUTER_BOUNDS.maxX + padding &&
    z >= FARM_OUTER_BOUNDS.minZ - padding &&
    z <= FARM_OUTER_BOUNDS.maxZ + padding
  );
}
~~~

- [ ] **Step 4: Jalankan test sampai hijau**

Run: npm test -- --run src/game/world/farmLayout.test.ts

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit unit geometri**

~~~bash
git add src/game/world/farmLayout.ts src/game/world/farmLayout.test.ts
git commit -m "feat(world): define four-bed farm geometry"
~~~

---

### Task 2: Mesin Validasi dan Pemilihan Placement

**Files:**
- Create: src/game/farming/plantPlacement.ts
- Create: src/game/farming/plantPlacement.test.ts

**Interfaces:**
- Consumes: CropPlacement, isPlacementInsideBed, dan placementToWorldPoint dari Task 1.
- Produces: MIN_PLANT_SPACING, MAX_ACTIVE_CROPS, PlacementSlot, validatePlantPlacement(placement, slots), findFirstEmptySlot(slots), dan findNearestPlacedSlots(origin, slots, limit, maxDistance, excludeId).

- [ ] **Step 1: Tulis test batas collision, kapasitas, dan urutan**

~~~ts
import { describe, expect, it } from 'vitest';
import {
  findFirstEmptySlot,
  findNearestPlacedSlots,
  validatePlantPlacement,
  type PlacementSlot,
} from './plantPlacement';

const occupied = (
  id: string,
  row: number,
  col: number,
  localX: number,
  localZ: number
): PlacementSlot => ({
  id,
  row,
  col,
  crop: { placement: { bedId: 'north-west', localX, localZ } },
});

describe('plantPlacement', () => {
  it('rejects less than 1.1 and accepts exactly 1.1', () => {
    const slots = [occupied('plot-0-0', 0, 0, 0, 0)];
    expect(validatePlantPlacement(
      { bedId: 'north-west', localX: 1.099, localZ: 0 },
      slots
    )).toEqual({ ok: false, reason: 'occupied_position' });
    expect(validatePlantPlacement(
      { bedId: 'north-west', localX: 1.1, localZ: 0 },
      slots
    )).toEqual({ ok: true });
  });

  it('chooses the first empty slot by row then col', () => {
    const slots: PlacementSlot[] = [
      occupied('plot-0-1', 0, 1, 0, 0),
      { id: 'plot-1-0', row: 1, col: 0, crop: null },
      { id: 'plot-0-0', row: 0, col: 0, crop: null },
    ];
    expect(findFirstEmptySlot(slots)?.id).toBe('plot-0-0');
  });

  it('rejects the sixty-fifth active crop', () => {
    const slots = Array.from({ length: 64 }, (_, index) =>
      occupied('plot-' + Math.floor(index / 8) + '-' + (index % 8), Math.floor(index / 8), index % 8, 0, 0)
    );
    expect(validatePlantPlacement(
      { bedId: 'south-east', localX: 2, localZ: 2 },
      slots
    )).toEqual({ ok: false, reason: 'farm_full' });
  });

  it('orders spatial targets by distance and then slot identity', () => {
    const slots = [
      occupied('plot-0-2', 0, 2, 2, 0),
      occupied('plot-0-1', 0, 1, 1, 0),
      occupied('plot-0-0', 0, 0, -1, 0),
    ];
    expect(findNearestPlacedSlots(
      { bedId: 'north-west', localX: 0, localZ: 0 },
      slots,
      2,
      2.4
    ).map((slot) => slot.id)).toEqual(['plot-0-0', 'plot-0-1']);
  });
});
~~~

- [ ] **Step 2: Jalankan test dan pastikan merah**

Run: npm test -- --run src/game/farming/plantPlacement.test.ts

Expected: FAIL karena modul ./plantPlacement belum ada.

- [ ] **Step 3: Implementasikan fungsi murni tanpa mutation**

~~~ts
import {
  isFarmBedId,
  isPlacementInsideBed,
  placementToWorldPoint,
  type CropPlacement,
} from '../world/farmLayout';

export const MIN_PLANT_SPACING = 1.1;
export const MAX_ACTIVE_CROPS = 64;

export interface PlacementSlot {
  id: string;
  row: number;
  col: number;
  crop: { placement: CropPlacement } | null;
}

export type PlacementFailureReason =
  | 'invalid_placement'
  | 'outside_planting_area'
  | 'occupied_position'
  | 'farm_full';

export type PlacementValidation =
  | { ok: true }
  | { ok: false; reason: PlacementFailureReason };

export function placementDistance(a: CropPlacement, b: CropPlacement): number {
  const aw = placementToWorldPoint(a);
  const bw = placementToWorldPoint(b);
  return Math.hypot(aw.x - bw.x, aw.z - bw.z);
}

export function findFirstEmptySlot<T extends PlacementSlot>(slots: readonly T[]): T | null {
  return [...slots]
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .find((slot) => slot.crop === null) ?? null;
}

export function validatePlantPlacement(
  placement: CropPlacement,
  slots: readonly PlacementSlot[]
): PlacementValidation {
  if (
    !placement ||
    typeof placement !== 'object' ||
    !isFarmBedId(placement.bedId) ||
    !Number.isFinite(placement.localX) ||
    !Number.isFinite(placement.localZ)
  ) {
    return { ok: false, reason: 'invalid_placement' };
  }
  if (!isPlacementInsideBed(placement)) {
    return { ok: false, reason: 'outside_planting_area' };
  }
  if (slots.filter((slot) => slot.crop !== null).length >= MAX_ACTIVE_CROPS) {
    return { ok: false, reason: 'farm_full' };
  }
  if (slots.some((slot) =>
    slot.crop !== null && placementDistance(placement, slot.crop.placement) < MIN_PLANT_SPACING
  )) {
    return { ok: false, reason: 'occupied_position' };
  }
  return { ok: true };
}

export function findNearestPlacedSlots<T extends PlacementSlot>(
  origin: CropPlacement,
  slots: readonly T[],
  limit: number,
  maxDistance: number,
  excludeId?: string
): T[] {
  return slots
    .filter((slot) => slot.crop !== null && slot.id !== excludeId)
    .map((slot) => ({ slot, distance: placementDistance(origin, slot.crop!.placement) }))
    .filter((entry) => entry.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance || a.slot.row - b.slot.row || a.slot.col - b.slot.col)
    .slice(0, limit)
    .map((entry) => entry.slot);
}
~~~

- [ ] **Step 4: Jalankan kedua suite murni**

Run: npm test -- --run src/game/world/farmLayout.test.ts src/game/farming/plantPlacement.test.ts

Expected: PASS, 2 files.

- [ ] **Step 5: Commit aturan placement**

~~~bash
git add src/game/farming/plantPlacement.ts src/game/farming/plantPlacement.test.ts
git commit -m "feat(farming): validate free crop placement"
~~~

---

### Task 3: Schema Save v2 dan Migrasi Slot Legacy

**Files:**
- Modify: src/game/core/constants.ts
- Modify: src/state/storeTypes.ts
- Modify: src/state/gameStore.ts
- Modify: src/state/gameStore.test.ts
- Modify: src/persistence/saveSchema.ts
- Modify: src/persistence/saveSchema.test.ts
- Modify: src/persistence/migrations.ts
- Modify: src/persistence/migrations.test.ts
- Modify: src/persistence/saveService.test.ts
- Create: src/test/farmFixtures.ts
- Modify: src/game/farming/farmingCommands.test.ts
- Modify: src/game/farming/growthSystem.test.ts
- Modify: src/game/farming/mutationEngine.test.ts
- Modify: src/game/farming/plotMachine.test.ts
- Modify: src/game/pets/petSystem.test.ts
- Modify: src/game/world/SoilGridExpansion.test.ts
- Modify: src/persistence/offlineSimulation.test.ts
- Modify: src/test/testClock.test.ts
- Modify: src/ui/mobile/targetPlotFinder.test.ts

**Interfaces:**
- Consumes: CropPlacement dan legacyGridToPlacement dari Task 1.
- Produces: CURRENT_SCHEMA_VERSION = 2; CropData.placement; 64 default slots; schema v1 hanya untuk input migrasi; schema v2 untuk runtime/persist; migrateSaveEnvelope(raw) yang idempotent.

- [ ] **Step 1: Tambahkan test migrasi lossless yang gagal**

~~~ts
it('migrates v1 crops to deterministic v2 placements without losing values', () => {
  const v1 = createVersionOneFixture();
  v1.player.coins = 731;
  v1.farm.gridSize = 4;
  v1.farm.plots[0] = {
    id: 'plot-0-0',
    row: 0,
    col: 0,
    tilled: true,
    crop: {
      cropId: 'tomato',
      plantedAtUtcMs: 1234,
      growthProgressSec: 0.45,
      mutation: 'gold',
    },
    hydratedUntilUtcMs: 9876,
  };

  const result = runSaveMigrations(v1);

  expect(result.toVersion).toBe(2);
  expect(result.envelope.farm.gridSize).toBe(8);
  expect(result.envelope.farm.plots).toHaveLength(64);
  expect(result.envelope.farm.plots[0]).toEqual({
    id: 'plot-0-0',
    row: 0,
    col: 0,
    crop: {
      cropId: 'tomato',
      plantedAtUtcMs: 1234,
      growthProgressSec: 0.45,
      mutation: 'gold',
      placement: {
        bedId: 'north-west',
        localX: -1.8,
        localZ: -1.8,
      },
    },
    hydratedUntilUtcMs: 9876,
  });
  expect(result.envelope.player.coins).toBe(731);
  expect(runSaveMigrations(result.envelope)).toEqual({
    envelope: result.envelope,
    migrated: false,
    fromVersion: 2,
    toVersion: 2,
  });
});

it('rounds persisted free placement to three decimals', () => {
  const save = createDefaultSaveEnvelope(1000, 7);
  save.farm.plots[0].crop = {
    cropId: 'carrot',
    plantedAtUtcMs: 1000,
    growthProgressSec: 0,
    mutation: 'none',
    placement: { bedId: 'south-east', localX: 0.12349, localZ: -0.98751 },
  };
  const parsed = parseSaveEnvelope(save);
  expect(parsed.farm.plots[0].crop?.placement).toEqual({
    bedId: 'south-east',
    localX: 0.123,
    localZ: -0.988,
  });
  expect('tilled' in parsed.farm.plots[0]).toBe(false);
});
~~~

- [ ] **Step 2: Jalankan test migration/schema dan pastikan merah**

Run: npm test -- --run src/persistence/migrations.test.ts src/persistence/saveSchema.test.ts

Expected: FAIL karena schema masih literal 1, placement belum ada, dan default farm masih 4x4.

- [ ] **Step 3: Tambahkan model placement dan 64 slot default**

Gunakan bentuk akhir ini pada storeTypes.ts; selama Task 3 sampai Task 6, field tilled boleh dibuat opsional hanya sebagai bridge kompilasi untuk consumer lama, lalu dihapus total pada Task 7.

~~~ts
import type { CropPlacement } from '../game/world/farmLayout';

export type PlotState = 'empty' | 'planted' | 'watered' | 'harvestable';

export type CommandFailureReason =
  | 'out_of_range'
  | 'invalid_plot_state'
  | 'insufficient_seeds'
  | 'insufficient_coins'
  | 'inventory_full'
  | 'plot_locked'
  | 'wrong_tool'
  | 'not_mature'
  | 'max_pets_reached'
  | 'already_owned'
  | 'already_incubating'
  | 'outside_planting_area'
  | 'occupied_position'
  | 'farm_full'
  | 'invalid_placement'
  | 'unknown';

export interface CropData {
  cropId: CropId;
  plantedAtUtcMs: number;
  growthProgressSec: number;
  mutation: MutationType;
  placement: CropPlacement;
}

export interface PlotData {
  id: PlotId;
  row: number;
  col: number;
  crop: CropData | null;
  hydratedUntilUtcMs: number;
  tilled?: boolean;
}

export interface FarmState {
  gridSize: 8;
  plots: Record<PlotId, PlotData>;
  goldenWateringCanOwned: boolean;
}

export interface SaveEnvelope {
  schemaVersion: 2;
  savedAtUtcMs: number;
  player: PlayerState;
  farm: {
    gridSize: 8;
    plots: PlotData[];
    goldenWateringCanOwned: boolean;
  };
  inventory: InventoryState;
  weather: WeatherState;
  rngState: number;
  tutorial: TutorialState;
}
~~~

Ubah generateDefaultPlots agar selalu menghasilkan plot-0-0 sampai plot-7-7 dan tidak menerima ukuran:

~~~ts
export function generateDefaultPlots(
  existingPlots: Record<PlotId, PlotData> = {}
): Record<PlotId, PlotData> {
  const plots: Record<PlotId, PlotData> = { ...existingPlots };
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const id = 'plot-' + row + '-' + col;
      plots[id] ??= { id, row, col, crop: null, hydratedUntilUtcMs: 0 };
    }
  }
  return plots;
}
~~~

- [ ] **Step 4: Pisahkan input v1 dari output v2 dan bulatkan placement**

~~~ts
const round3 = (value: number) => Math.round(value * 1000) / 1000;

export const cropPlacementSchema = z.object({
  bedId: z.enum(['north-west', 'north-east', 'south-west', 'south-east']),
  localX: z.number().finite().min(-2.55).max(2.55).transform(round3),
  localZ: z.number().finite().min(-2.25).max(2.25).transform(round3),
});

export const cropDataSchema = z.object({
  cropId: cropIdSchema,
  plantedAtUtcMs: z.number().int().nonnegative().finite(),
  growthProgressSec: z.number().nonnegative().finite(),
  mutation: mutationTypeSchema,
  placement: cropPlacementSchema,
});

export const plotDataSchema = z.object({
  id: z.string().min(1),
  row: z.number().int().min(0).max(7),
  col: z.number().int().min(0).max(7),
  crop: cropDataSchema.nullable(),
  hydratedUntilUtcMs: z.number().int().nonnegative().finite(),
});

export const saveEnvelopeSchema = z.object({
  schemaVersion: z.literal(2),
  savedAtUtcMs: z.number().int().nonnegative().finite(),
  player: playerSaveSchema,
  farm: z.object({
    gridSize: z.literal(8),
    plots: z.array(plotDataSchema).length(64),
    goldenWateringCanOwned: z.boolean(),
  }),
  inventory: inventorySaveSchema,
  weather: weatherSaveSchema,
  rngState: z.number().finite(),
  tutorial: tutorialSaveSchema,
});
~~~

Pertahankan versionOneEnvelopeSchema privat dengan bentuk schema v1 lama, termasuk tilled dan crop tanpa placement. Jangan memakai schema v2 untuk mem-parse payload v1 sebelum placement dibuat.

- [ ] **Step 5: Implementasikan migrasi 1 ke 2 secara deterministik**

~~~ts
1: (data: Record<string, unknown>) => {
  const parsed = versionOneEnvelopeSchema.parse(data);
  const byId = new Map(parsed.farm.plots.map((plot) => [plot.id, plot]));
  const plots = Object.values(generateDefaultPlots()).map((empty) => {
    const legacy = byId.get(empty.id);
    if (!legacy?.crop) return empty;
    return {
      ...empty,
      hydratedUntilUtcMs: legacy.hydratedUntilUtcMs,
      crop: {
        ...legacy.crop,
        placement: legacyGridToPlacement(legacy.row, legacy.col),
      },
    };
  });
  return {
    ...parsed,
    schemaVersion: 2,
    farm: {
      gridSize: 8,
      plots,
      goldenWateringCanOwned: parsed.farm.goldenWateringCanOwned,
    },
  };
},
~~~

Pastikan createDefaultSaveEnvelope dan createInitialState memakai gridSize: 8 serta generateDefaultPlots() tanpa argumen. Di toSaveEnvelope, map tiap plot ke lima field v2 agar bridge tilled tidak pernah terserialisasi.

- [ ] **Step 6: Perbarui seluruh fixture crop agar kontrak tipe langsung hijau**

Setiap CropData buatan test harus memiliki placement eksplisit. Buat src/test/farmFixtures.ts dengan factory ini, lalu import di semua test yang membuat crop:

~~~ts
import type { CropData, PlotData, PlotId } from '../state/storeTypes';
import type { CropPlacement } from '../game/world/farmLayout';

export const DEFAULT_TEST_PLACEMENT: CropPlacement = {
  bedId: 'north-west',
  localX: 0,
  localZ: 0,
};

export function createTestCrop(overrides: Partial<CropData> = {}): CropData {
  return {
    cropId: 'carrot',
    plantedAtUtcMs: 0,
    growthProgressSec: 0,
    mutation: 'none',
    placement: DEFAULT_TEST_PLACEMENT,
    ...overrides,
  };
}

export function createPlacedPlot(
  id: PlotId,
  placement: CropPlacement,
  cropOverrides: Partial<CropData> = {}
): PlotData {
  const match = /^plot-(\d+)-(\d+)$/.exec(id);
  if (!match) throw new Error('Test plot id must use plot-row-col');
  return {
    id,
    row: Number(match[1]),
    col: Number(match[2]),
    crop: createTestCrop({ placement, ...cropOverrides }),
    hydratedUntilUtcMs: 0,
  };
}

export function createMaturePlot(id: PlotId, placement: CropPlacement): PlotData {
  return createPlacedPlot(id, placement, { growthProgressSec: 45 });
}
~~~

Gunakan helper tersebut pada farmingCommands, growthSystem, mutationEngine, plotMachine, petSystem, SoilGridExpansion, offlineSimulation, testClock, dan targetPlotFinder tests. Jangan menambahkan default placement diam-diam pada production parser; v2 yang kehilangan placement wajib ditolak.

- [ ] **Step 7: Jalankan test state dan persistence**

Run: npm test -- --run src/state/gameStore.test.ts src/persistence/saveSchema.test.ts src/persistence/migrations.test.ts src/persistence/saveService.test.ts src/game/farming/farmingCommands.test.ts src/game/farming/growthSystem.test.ts src/game/farming/mutationEngine.test.ts src/game/farming/plotMachine.test.ts src/game/pets/petSystem.test.ts src/game/world/SoilGridExpansion.test.ts src/persistence/offlineSimulation.test.ts src/test/testClock.test.ts src/ui/mobile/targetPlotFinder.test.ts

Expected: PASS dan save v2 tidak memuat key tilled.

- [ ] **Step 8: Commit cutover persistence**

~~~bash
git add src/game/core/constants.ts src/state/storeTypes.ts src/state/gameStore.ts src/state/gameStore.test.ts src/persistence/saveSchema.ts src/persistence/saveSchema.test.ts src/persistence/migrations.ts src/persistence/migrations.test.ts src/persistence/saveService.test.ts src/test/farmFixtures.ts src/game/farming/farmingCommands.test.ts src/game/farming/growthSystem.test.ts src/game/farming/mutationEngine.test.ts src/game/farming/plotMachine.test.ts src/game/pets/petSystem.test.ts src/game/world/SoilGridExpansion.test.ts src/persistence/offlineSimulation.test.ts src/test/testClock.test.ts src/ui/mobile/targetPlotFinder.test.ts
git commit -m "feat(persistence): migrate farms to placement schema v2"
~~~

---

### Task 4: Command Plant Langsung dan Lifecycle Crop

**Files:**
- Modify: src/game/farming/farmingCommands.ts
- Modify: src/game/farming/farmingCommands.test.ts
- Modify: src/game/farming/plotMachine.ts
- Modify: src/game/farming/plotMachine.test.ts
- Modify: src/game/farming/growthSystem.ts
- Modify: src/game/farming/growthSystem.test.ts
- Modify: src/game/weather/weatherSystem.ts
- Modify: src/game/weather/weatherSystem.test.ts
- Modify: src/persistence/offlineSimulation.ts
- Modify: src/persistence/offlineSimulation.test.ts

**Interfaces:**
- Consumes: CropPlacement, placementToWorldPoint, validatePlantPlacement, findFirstEmptySlot, dan findNearestPlacedSlots.
- Produces: plantCropAt(placement, cropId, playerPos, nowMs), waterCrop(slotId, options), harvestCrop(slotId), executePlantAction(placement, cropId, options), executeCropAction(slotId, tool, options).

- [ ] **Step 1: Tulis test command exact point dan atomic rejection**

~~~ts
describe('plantCropAt', () => {
  it('plants directly at the exact valid point without Till or Water', () => {
    const before = useGameStore.getState().inventory.seeds.carrot;
    const placement = { bedId: 'south-west' as const, localX: 0.347, localZ: -1.284 };
    const result = plantCropAt(placement, 'carrot', undefined, 4000);
    expect(result).toEqual({
      ok: true,
      value: { cropId: 'carrot', slotId: 'plot-0-0' },
      message: 'Carrot ditanam',
    });
    expect(useGameStore.getState().farm.plots['plot-0-0'].crop?.placement).toEqual(placement);
    expect(useGameStore.getState().inventory.seeds.carrot).toBe(before - 1);
  });

  it.each([
    [
      { bedId: 'north-west' as const, localX: 2.7, localZ: 0 },
      'outside_planting_area',
      'Tanam di area tanah',
    ],
    [
      { bedId: 'north-west' as const, localX: 0.5, localZ: 0 },
      'occupied_position',
      'Terlalu dekat dengan tanaman lain',
    ],
  ])('does not deduct seeds on %s', (placement, reason, message) => {
    seedCropAt({ bedId: 'north-west', localX: 0, localZ: 0 });
    const before = useGameStore.getState();
    const result = plantCropAt(placement, 'carrot');
    expect(result).toEqual({ ok: false, reason, message });
    expect(useGameStore.getState().inventory.seeds).toEqual(before.inventory.seeds);
    expect(useGameStore.getState().farm.plots).toEqual(before.farm.plots);
  });
});

it('golden water selects source plus no more than eight closest crops within 2.4', () => {
  const sourceId = seedSpatialCropFixture();
  const result = waterCrop(sourceId, {
    isGoldenCan: true,
    weather: 'sunny',
    nowMs: 1000,
  });
  expect(result.ok && result.value.hydratedPlotIds).toHaveLength(9);
  expect(result.ok && result.value.hydratedPlotIds[0]).toBe(sourceId);
  expect(result.ok && result.value.hydratedPlotIds).not.toContain('plot-7-7');
});

it('harvest clears crop placement and permits replanting at the same point', () => {
  const placement = { bedId: 'north-east' as const, localX: 0, localZ: 0 };
  const slotId = seedMatureCropAt(placement);
  expect(harvestCrop(slotId).ok).toBe(true);
  expect(useGameStore.getState().farm.plots[slotId].crop).toBeNull();
  expect(plantCropAt(placement, 'carrot').ok).toBe(true);
});
~~~

- [ ] **Step 2: Jalankan farming tests dan pastikan merah**

Run: npm test -- --run src/game/farming/farmingCommands.test.ts

Expected: FAIL karena plantCropAt dan waterCrop belum diekspor.

- [ ] **Step 3: Implementasikan plant atomic dan pesan terstruktur**

~~~ts
const PLACEMENT_MESSAGES = {
  invalid_placement: 'Posisi tanam tidak valid',
  outside_planting_area: 'Tanam di area tanah',
  occupied_position: 'Terlalu dekat dengan tanaman lain',
  farm_full: 'Kebun penuh (64/64)',
} as const;

export function plantCropAt(
  placement: CropPlacement,
  cropId: CropId,
  playerPos?: [number, number, number],
  nowMs = Date.now()
): CommandResult<{ cropId: CropId; slotId: PlotId }> {
  const store = useGameStore.getState();
  const slots = Object.values(store.farm.plots);
  const validation = validatePlantPlacement(placement, slots);
  if (!validation.ok) {
    return {
      ok: false,
      reason: validation.reason,
      message: PLACEMENT_MESSAGES[validation.reason],
    };
  }

  const world = placementToWorldPoint(placement);
  if (playerPos && Math.hypot(playerPos[0] - world.x, playerPos[2] - world.z) > FARMING_REACH) {
    return { ok: false, reason: 'out_of_range', message: 'Move closer to the crop' };
  }

  const slot = findFirstEmptySlot(slots);
  if (!slot) return { ok: false, reason: 'farm_full', message: PLACEMENT_MESSAGES.farm_full };
  const cropDef = getCropDefinition(cropId);
  if (!cropDef) return { ok: false, reason: 'unknown', message: 'Unknown crop type: ' + cropId };
  if ((store.inventory.seeds[cropId] ?? 0) < 1) {
    return {
      ok: false,
      reason: 'insufficient_seeds',
      message: 'No ' + cropDef.name + ' seeds in inventory',
    };
  }

  if (!store.deductSeed(cropId, 1)) {
    return {
      ok: false,
      reason: 'insufficient_seeds',
      message: 'No ' + cropDef.name + ' seeds in inventory',
    };
  }
  store.setPlot({
    ...slot,
    crop: {
      cropId,
      plantedAtUtcMs: nowMs,
      growthProgressSec: 0,
      mutation: 'none',
      placement,
    },
  });
  return {
    ok: true,
    value: { cropId, slotId: slot.id },
    message: cropDef.name + ' ditanam',
  };
}
~~~

Validasi placement, slot, crop definition, dan inventory dilakukan sebelum deductSeed. Tidak boleh mencari titik alternatif bila collision gagal.

- [ ] **Step 4: Ubah water menjadi spatial dan harvest mengosongkan crop**

~~~ts
export function waterCrop(
  plotId: PlotId,
  options: {
    playerPos?: [number, number, number];
    isGoldenCan?: boolean;
    weather?: WeatherType;
    nowMs?: number;
  } = {}
): CommandResult<{ hydratedPlotIds: PlotId[] }> {
  const store = useGameStore.getState();
  const source = store.farm.plots[plotId];
  if (!source?.crop) {
    return { ok: false, reason: 'invalid_plot_state', message: 'Tidak ada tanaman untuk disiram' };
  }
  const nowMs = options.nowMs ?? Date.now();
  const duration = (options.weather ?? store.weather.current) === 'heatwave'
    ? HYDRATION_DURATION_HEATWAVE_MS
    : HYDRATION_DURATION_BASIC_MS;
  const targets = options.isGoldenCan ?? store.farm.goldenWateringCanOwned
    ? [source, ...findNearestPlacedSlots(source.crop.placement, Object.values(store.farm.plots), 8, 2.4, source.id)]
    : [source];
  const updates = Object.fromEntries(
    targets.map((target) => [target.id, { hydratedUntilUtcMs: nowMs + duration }])
  );
  store.updatePlots(updates);
  return {
    ok: true,
    value: { hydratedPlotIds: targets.map((target) => target.id) },
    message: 'Tanaman disiram',
  };
}
~~~

Pada harvestCrop, set crop: null dan hydratedUntilUtcMs: 0. Karena placement berada di dalam crop, tidak ada placement yatim setelah harvest.

- [ ] **Step 5: Hapus ketergantungan tilled dari lifecycle**

~~~ts
export function getPlotState(plot: PlotData, nowMs = Date.now()): PlotState {
  if (!plot.crop) return 'empty';
  if (isPlotHarvestable(plot)) return 'harvestable';
  if (plot.hydratedUntilUtcMs > nowMs) return 'watered';
  return 'planted';
}
~~~

Growth, weather, dan offline simulation harus memilih slot dengan plot.crop !== null. Heavy rain hanya memperbarui hydratedUntilUtcMs untuk crop aktif; slot kosong tetap nol.

- [ ] **Step 6: Pisahkan dispatcher plant dan crop**

~~~ts
export function executePlantAction(
  placement: CropPlacement,
  cropId: CropId,
  options: { playerPos?: [number, number, number]; nowMs?: number } = {}
) {
  return plantCropAt(placement, cropId, options.playerPos, options.nowMs);
}

export function executeCropAction(
  plotId: PlotId,
  tool: ToolType,
  options: {
    playerPos?: [number, number, number];
    isGoldenCan?: boolean;
    weather?: WeatherType;
    nowMs?: number;
  } = {}
) {
  if (tool === 'watering_can') return waterCrop(plotId, options);
  if (tool === 'hand' || tool === 'scythe') return harvestCrop(plotId, options.playerPos);
  return { ok: false, reason: 'wrong_tool', message: 'Pilih Water atau Harvest' } as const;
}
~~~

- [ ] **Step 7: Jalankan seluruh test lifecycle terkait**

Run: npm test -- --run src/game/farming/farmingCommands.test.ts src/game/farming/plotMachine.test.ts src/game/farming/growthSystem.test.ts src/game/weather/weatherSystem.test.ts src/persistence/offlineSimulation.test.ts

Expected: PASS; test plant membuktikan seed tidak berkurang pada outside/overlap/full.

- [ ] **Step 8: Commit command dan lifecycle**

~~~bash
git add src/game/farming/farmingCommands.ts src/game/farming/farmingCommands.test.ts src/game/farming/plotMachine.ts src/game/farming/plotMachine.test.ts src/game/farming/growthSystem.ts src/game/farming/growthSystem.test.ts src/game/weather/weatherSystem.ts src/game/weather/weatherSystem.test.ts src/persistence/offlineSimulation.ts src/persistence/offlineSimulation.test.ts
git commit -m "feat(farming): plant directly at free positions"
~~~

---

### Task 5: Renderer Empat Bed dan Pagar Tanpa Irisan

**Files:**
- Create: src/game/world/FarmBeds.tsx
- Create: src/game/world/FarmBeds.test.tsx
- Create: src/game/world/PlacedCrop.tsx
- Create: src/game/world/PlacedCrop.test.tsx
- Modify: src/game/world/GardenIsland.tsx
- Modify: src/game/GameRuntime.tsx
- Delete: src/game/world/SoilGrid.tsx
- Delete: src/game/world/PlotMesh.tsx
- Delete: src/game/world/SoilGrid.test.ts
- Delete: src/game/world/SoilGridExpansion.test.ts

**Interfaces:**
- Consumes: FARM_BEDS, FARM_FENCE, isInsideFarmStudExclusion, placementToWorldPoint, worldPointToPlacement, PlotData.
- Produces: FarmBedsProps { plantingEnabled, onPlantAt }; PlacedCropProps { plot, onCropInteract }; GameRuntimeProps { onPlantAt, onCropInteract }.

- [ ] **Step 1: Tulis component test untuk exact click, drag guard, dan crop coordinate**

~~~tsx
it('forwards the exact R3F soil intersection as a placement', () => {
  const onPlantAt = vi.fn();
  render(<FarmBeds plantingEnabled onPlantAt={onPlantAt} />);
  const soil = screen.getByTestId('farm-bed-north-west-soil');

  fireEvent.pointerDown(soil, { clientX: 100, clientY: 120 });
  fireEvent.pointerUp(soil, {
    clientX: 104,
    clientY: 123,
    point: { x: -4.1374, y: 0.2, z: -3.0126 },
  });

  expect(onPlantAt).toHaveBeenCalledWith({
    bedId: 'north-west',
    localX: -0.337,
    localZ: 0.487,
  });
});

it('does not plant after a camera drag greater than six pixels', () => {
  const onPlantAt = vi.fn();
  render(<FarmBeds plantingEnabled onPlantAt={onPlantAt} />);
  const soil = screen.getByTestId('farm-bed-south-east-soil');
  fireEvent.pointerDown(soil, { clientX: 10, clientY: 10 });
  fireEvent.pointerUp(soil, {
    clientX: 17,
    clientY: 10,
    point: { x: 3.8, y: 0.2, z: 3.5 },
  });
  expect(onPlantAt).not.toHaveBeenCalled();
});

it('renders a crop from placement rather than row and col', () => {
  const plot = createPlacedPlot('plot-7-7', {
    bedId: 'north-west',
    localX: 0.125,
    localZ: -0.875,
  });
  render(<PlacedCrop plot={plot} onCropInteract={vi.fn()} />);
  expect(screen.getByTestId('placed-crop-plot-7-7')).toHaveAttribute(
    'position',
    '-3.675,0.24,-4.375'
  );
});
~~~

Mock React Three Fiber seperti test renderer repo saat ini, tetapi teruskan event.point pada mock fireEvent. Jangan membulatkan lagi di komponen.

- [ ] **Step 2: Jalankan component tests dan pastikan merah**

Run: npm test -- --run src/game/world/FarmBeds.test.tsx src/game/world/PlacedCrop.test.tsx

Expected: FAIL karena kedua komponen belum ada.

- [ ] **Step 3: Implementasikan permukaan bed dengan drag guard**

~~~tsx
import React, { useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import {
  FARM_BED_IDS,
  FARM_BEDS,
  worldPointToPlacement,
  type CropPlacement,
} from './farmLayout';

export interface FarmBedsProps {
  plantingEnabled: boolean;
  onPlantAt?: (placement: CropPlacement) => void;
}

const MAX_TAP_MOVEMENT_PX = 6;

export const FarmBeds: React.FC<FarmBedsProps> = ({ plantingEnabled, onPlantAt }) => {
  const downPoint = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    downPoint.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    const start = downPoint.current;
    downPoint.current = null;
    if (!plantingEnabled || !start || !onPlantAt) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > MAX_TAP_MOVEMENT_PX) return;
    const placement = worldPointToPlacement({ x: event.point.x, z: event.point.z });
    if (!placement) return;
    event.stopPropagation();
    onPlantAt(placement);
  };

  return (
    <group name="FarmBeds">
      {FARM_BED_IDS.map((bedId) => {
        const bed = FARM_BEDS[bedId];
        return (
          <group key={bedId} position={[bed.centerX, 0, bed.centerZ]}>
            <mesh
              name={'FarmBedSoil-' + bedId}
              data-testid={'farm-bed-' + bedId + '-soil'}
              position={[0, bed.soilHeight / 2, 0]}
              receiveShadow
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
            >
              <boxGeometry args={[bed.width, bed.soilHeight, bed.depth]} />
              <meshStandardMaterial color="#6b3f24" roughness={0.92} />
            </mesh>
            <mesh position={[0, 0.17, -2.61]} castShadow>
              <boxGeometry args={[6, 0.22, 0.18]} />
              <meshStandardMaterial color="#704226" roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.17, 2.61]} castShadow>
              <boxGeometry args={[6, 0.22, 0.18]} />
              <meshStandardMaterial color="#704226" roughness={0.85} />
            </mesh>
            <mesh position={[-2.91, 0.17, 0]} castShadow>
              <boxGeometry args={[0.18, 0.22, 5.4]} />
              <meshStandardMaterial color="#704226" roughness={0.85} />
            </mesh>
            <mesh position={[2.91, 0.17, 0]} castShadow>
              <boxGeometry args={[0.18, 0.22, 5.4]} />
              <meshStandardMaterial color="#704226" roughness={0.85} />
            </mesh>
            {[-1.8, -0.9, 0, 0.9, 1.8].map((x) => (
              <mesh key={x} position={[x, 0.225, 0]}>
                <boxGeometry args={[0.025, 0.012, 4.7]} />
                <meshStandardMaterial color="#4b2a19" roughness={1} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};
~~~

Furrow hanya dekoratif dan pointer tetap berasal dari satu soil mesh kontinu. Tidak ada mesh/collider tile.

- [ ] **Step 4: Implementasikan crop renderer berbasis placement**

~~~tsx
import React from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { PlotData } from '../../state/storeTypes';
import { CropRenderer } from '../farming/CropRenderer';
import { FARM_BEDS, placementToWorldPoint } from './farmLayout';

export interface PlacedCropProps {
  plot: PlotData;
  onCropInteract?: (plotId: string) => void;
}

export const PlacedCrop: React.FC<PlacedCropProps> = ({ plot, onCropInteract }) => {
  if (!plot.crop) return null;
  const bed = FARM_BEDS[plot.crop.placement.bedId];
  const point = placementToWorldPoint(
    plot.crop.placement,
    bed.soilHeight + 0.02
  );
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onCropInteract?.(plot.id);
  };
  return (
    <group
      name={'PlacedCrop-' + plot.id}
      data-testid={'placed-crop-' + plot.id}
      position={[point.x, point.y, point.z]}
      onClick={handleClick}
    >
      <CropRenderer crop={plot.crop} />
    </group>
  );
};
~~~

- [ ] **Step 5: Ganti pagar dan stud exclusion dengan farmLayout**

Di GardenIsland, hapus literal X 6.8/-6.8, offset bed, dan pengecualian dua lahan panjang. Render fence/collider dari FARM_FENCE.segments:

~~~tsx
{FARM_FENCE.segments.map((segment) => (
  <RigidBody key={segment.id} type="fixed" colliders={false}>
    <CuboidCollider
      args={[segment.size[0] / 2, segment.size[1] / 2, segment.size[2] / 2]}
      position={segment.position}
    />
    <FenceSegment position={segment.position} size={segment.size} />
  </RigidBody>
))}
~~~

Filter stud rumput dengan !isInsideFarmStudExclusion(x, z). Pertahankan stall pada posisi 10.8, 7.5; edge terdekatnya harus diverifikasi minimal 1.0 dari collider pagar depan/timur melalui test layout atau ukuran aktual stall.

- [ ] **Step 6: Komposisikan renderer tanpa coordinate math di GameRuntime**

~~~tsx
export interface GameRuntimeProps {
  onPlantAt?: (placement: CropPlacement) => void;
  onCropInteract?: (plotId: PlotId) => void;
  onPlayerFall?: () => void;
  inputManager?: InputManager;
  children?: React.ReactNode;
}

const plots = useGameStore((state) => Object.values(state.farm.plots));
const plantingEnabled = useUiStore((state) => state.selectedTool === 'seed_bag');

<GardenIsland />
<FarmBeds plantingEnabled={plantingEnabled} onPlantAt={onPlantAt} />
{plots.map((plot) => (
  <PlacedCrop key={plot.id} plot={plot} onCropInteract={onCropInteract} />
))}
~~~

Setelah import lama tidak memiliki consumer, hapus SoilGrid.tsx, PlotMesh.tsx, SoilGrid.test.ts, dan SoilGridExpansion.test.ts.

- [ ] **Step 7: Jalankan renderer tests dan typecheck**

Run: npm test -- --run src/game/world/farmLayout.test.ts src/game/world/FarmBeds.test.tsx src/game/world/PlacedCrop.test.tsx

Expected: PASS; exact placement diteruskan dan drag 7 px tidak menanam.

Run: npm run typecheck

Expected: PASS tanpa import SoilGrid, PlotMesh, atau getPlotPosition dari renderer.

- [ ] **Step 8: Commit renderer**

~~~bash
git add src/game/world/farmLayout.ts src/game/world/FarmBeds.tsx src/game/world/FarmBeds.test.tsx src/game/world/PlacedCrop.tsx src/game/world/PlacedCrop.test.tsx src/game/world/GardenIsland.tsx src/game/GameRuntime.tsx
git add -u src/game/world/SoilGrid.tsx src/game/world/PlotMesh.tsx src/game/world/SoilGrid.test.ts src/game/world/SoilGridExpansion.test.ts
git commit -m "feat(world): render four free-placement farm beds"
~~~

---

### Task 6: Wiring App, Mobile, dan Pet pada Placement Aktual

**Files:**
- Modify: src/app/App.tsx
- Modify: src/app/App.test.tsx
- Modify: src/ui/mobile/targetPlotFinder.ts
- Modify: src/ui/mobile/targetPlotFinder.test.ts
- Modify: src/ui/mobile/MobileHUD.tsx
- Modify: src/ui/mobile/MobileActionButton.tsx
- Modify: src/game/pets/petSystem.ts
- Modify: src/game/pets/petSystem.test.ts
- Modify: src/game/pets/PetRenderer.tsx
- Modify: src/game/pets/PetRenderer.test.ts

**Interfaces:**
- Consumes: executePlantAction, executeCropAction, placementToWorldPoint, PlotData.crop.placement.
- Produces: App callback onPlantAt(placement), onCropInteract(plotId), findNearestTargetCrop(...), dan mobile Seeds hint Tap Soil.

- [ ] **Step 1: Tulis test bahwa target mobile dan dog mengabaikan row/col**

~~~ts
it('targets the nearest crop by placement even when row/col suggest the opposite', () => {
  const near = createPlacedPlot('plot-7-7', {
    bedId: 'south-east',
    localX: 0,
    localZ: 0,
  });
  const far = createPlacedPlot('plot-0-0', {
    bedId: 'north-west',
    localX: 0,
    localZ: 0,
  });
  const result = findNearestTargetCrop(
    [3.8, 0, 1],
    0,
    [far, near],
    'watering_can',
    { maxDistance: 3, maxConeDeg: 180, nowUtcMs: 1000 }
  );
  expect(result?.plot.id).toBe('plot-7-7');
  expect(result?.worldPosition).toEqual([3.8, 0, 3.5]);
});

it('sends the dog toward the mature crop placement', () => {
  const plot = createMaturePlot('plot-0-0', {
    bedId: 'south-east',
    localX: 1,
    localZ: -0.5,
  });
  const target = findDogHarvestTarget([4.8, 0, 0], { [plot.id]: plot });
  expect(target?.worldPosition).toEqual([4.8, 0, 3]);
});
~~~

- [ ] **Step 2: Jalankan target/pet tests dan pastikan merah**

Run: npm test -- --run src/ui/mobile/targetPlotFinder.test.ts src/game/pets/petSystem.test.ts

Expected: FAIL karena target masih memakai getPlotPosition(row, col).

- [ ] **Step 3: Ubah finder menjadi crop-only dan placement-based**

~~~ts
export function findNearestTargetCrop(
  playerPosition: [number, number, number] | { x: number; z: number },
  playerYawRad: number,
  plots: Record<PlotId, PlotData> | PlotData[],
  tool: ToolType,
  options: FindTargetCropOptions = {}
): TargetPlotResult | null {
  const px = Array.isArray(playerPosition) ? playerPosition[0] : playerPosition.x;
  const pz = Array.isArray(playerPosition) ? playerPosition[2] : playerPosition.z;
  const candidates = (Array.isArray(plots) ? plots : Object.values(plots))
    .filter((plot) => plot.crop !== null && isCropValidForTool(plot, tool, options.nowUtcMs));

  return candidates
    .map((plot) => {
      const point = placementToWorldPoint(plot.crop!.placement);
      const distance = Math.hypot(point.x - px, point.z - pz);
      const angleDeg = calculateAngleToTarget(px, pz, playerYawRad, point.x, point.z);
      return {
        plot,
        distance,
        angleDeg,
        worldPosition: [point.x, point.y, point.z] as [number, number, number],
      };
    })
    .filter((target) =>
      target.distance <= (options.maxDistance ?? MOBILE_ACTION_REACH) &&
      target.angleDeg <= (options.maxConeDeg ?? MOBILE_ACTION_CONE_DEG) / 2
    )
    .sort((a, b) => a.distance - b.distance || a.plot.row - b.plot.row || a.plot.col - b.plot.col)[0] ?? null;
}
~~~

Untuk watering_can, crop valid bila ada dan hidrasi kedaluwarsa. Untuk hand/scythe, crop valid bila matang. seed_bag tidak memiliki target crop.

- [ ] **Step 4: Pisahkan App handler**

~~~tsx
const reportCommand = React.useCallback((result: CommandResult<unknown>) => {
  if (result.ok) {
    if (useNetStore.getState().roomId) getRoomConnection().playToolAnimation();
    return;
  }
  useUiStore.getState().showToast(result.message, 'warning', 2000);
}, []);

const handlePlantAt = React.useCallback((placement: CropPlacement) => {
  const ui = useUiStore.getState();
  reportCommand(executePlantAction(placement, ui.selectedSeed, { nowMs: Date.now() }));
}, [reportCommand]);

const handleCropInteract = React.useCallback((plotId: PlotId) => {
  const ui = useUiStore.getState();
  const game = useGameStore.getState();
  reportCommand(executeCropAction(plotId, ui.selectedTool, {
    isGoldenCan: game.farm.goldenWateringCanOwned,
    weather: game.weather.current,
    nowMs: Date.now(),
  }));
}, [reportCommand]);

<GameRuntime onPlantAt={handlePlantAt} onCropInteract={handleCropInteract} />
<MobileHUD inputManager={activeInputManager} onCropInteract={handleCropInteract} />
~~~

Pertahankan prop test override dengan dua prop eksplisit onPlantAt dan onCropInteract; hapus onPlotClick agar tanah tidak lagi menyamar sebagai slot.

- [ ] **Step 5: Ubah mobile interaction**

Saat selectedTool === seed_bag, MobileActionButton hanya menampilkan label Tap Soil dan disabled untuk callback otomatis. Touch pada soil mesh tetap satu-satunya jalur plant.

~~~tsx
if (selectedTool === 'seed_bag') {
  return <MobileActionButton label="Tap Soil" disabled icon="🌱" />;
}

const target = findNearestTargetCrop(
  playerPosition,
  playerYaw,
  plots,
  selectedTool,
  { filterByTool: true }
);
~~~

Water/Harvest memanggil onCropInteract(target.plot.id). Jangan membuat placement dari posisi karakter atau pusat bed.

- [ ] **Step 6: Ubah dog dan PetRenderer**

Semua tujuan gerak/harvest memakai:

~~~ts
const targetPoint = placementToWorldPoint(plot.crop.placement);
const worldPosition: [number, number, number] = [
  targetPoint.x,
  targetPoint.y,
  targetPoint.z,
];
~~~

Urutkan kandidat dog dengan jarak lalu row/col agar deterministik. Hapus import getPlotPosition dari kedua modul pet.

- [ ] **Step 7: Jalankan integration tests terkait**

Run: npm test -- --run src/app/App.test.tsx src/ui/mobile/targetPlotFinder.test.ts src/game/pets/petSystem.test.ts src/game/pets/PetRenderer.test.ts

Expected: PASS; row/col tidak memengaruhi target dunia.

- [ ] **Step 8: Commit wiring placement**

~~~bash
git add src/app/App.tsx src/app/App.test.tsx src/ui/mobile/targetPlotFinder.ts src/ui/mobile/targetPlotFinder.test.ts src/ui/mobile/MobileHUD.tsx src/ui/mobile/MobileActionButton.tsx src/game/pets/petSystem.ts src/game/pets/petSystem.test.ts src/game/pets/PetRenderer.tsx src/game/pets/PetRenderer.test.ts
git commit -m "feat(gameplay): target crops by saved placement"
~~~

---

### Task 7: Hapus Till, Trowel, dan Grid Expansion Sampai Tuntas

**Files:**
- Modify: src/state/storeTypes.ts
- Modify: src/state/uiStore.ts
- Modify: src/state/uiStore.test.ts
- Modify: src/state/gameStore.ts
- Modify: src/state/gameStore.test.ts
- Modify: src/game/core/constants.ts
- Modify: src/game/farming/farmingCommands.ts
- Modify: src/game/farming/farmingCommands.test.ts
- Modify: src/game/input/KeyboardInput.ts
- Modify: src/game/input/InputManager.test.ts
- Modify: src/ui/Toolbelt.tsx
- Modify: src/ui/Toolbelt.test.tsx
- Modify: src/ui/SeedPicker.tsx
- Modify: src/ui/SeedPicker.test.tsx
- Modify: src/ui/Tutorial.tsx
- Modify: src/ui/Tutorial.test.tsx
- Modify: src/ui/ShopModal.tsx
- Modify: src/ui/ShopModal.test.tsx
- Modify: src/game/economy/shopCatalog.ts
- Modify: src/game/economy/economyDefinitions.ts
- Modify: src/game/economy/economyCommands.ts
- Modify: src/game/economy/economyCommands.test.ts
- Modify: src/game/audio/AudioManager.ts
- Modify: src/game/audio/AudioManager.test.ts
- Modify: src/game/audio/audioSynthesizer.ts
- Modify: src/game/player/PlayerModel.tsx
- Modify: src/test/testClock.ts
- Modify: src/test/testClock.test.ts
- Delete: src/game/world/gridCoordinates.ts

**Interfaces:**
- Consumes: callback split dan runtime model placement dari Tasks 3-6.
- Produces: ToolType final watering_can | seed_bag | scythe | hand; PlotData final tanpa tilled; fixed capacity 64; shortcut 1/2/3.

- [ ] **Step 1: Tulis test permukaan produk tanpa Till**

~~~tsx
it('offers only Water, Seeds, and Harvest in that order', () => {
  render(<Toolbelt />);
  const buttons = screen.getAllByRole('button');
  expect(screen.getByRole('button', { name: /water/i })).toHaveAttribute('data-hotkey', '1');
  expect(screen.getByRole('button', { name: /seeds/i })).toHaveAttribute('data-hotkey', '2');
  expect(screen.getByRole('button', { name: /harvest/i })).toHaveAttribute('data-hotkey', '3');
  expect(screen.queryByText(/till/i)).not.toBeInTheDocument();
  expect(buttons.filter((button) => button.hasAttribute('data-tool'))).toHaveLength(3);
});

it('maps numeric keys to Water, Seeds, and Harvest', () => {
  const keyboard = new KeyboardInput();
  const selected: ToolType[] = [];
  keyboard.onToolSelect = (tool) => selected.push(tool);
  keyboard.attach(window);
  fireEvent.keyDown(window, { code: 'Digit1', key: '1' });
  fireEvent.keyDown(window, { code: 'Digit2', key: '2' });
  fireEvent.keyDown(window, { code: 'Digit3', key: '3' });
  expect(selected).toEqual(['watering_can', 'seed_bag', 'hand']);
  keyboard.detach();
});

it('contains neither Till copy nor grid expansion products', () => {
  render(<><Tutorial /><ShopModal /></>);
  expect(screen.queryByText(/till|trowel|6x6|8x8/i)).not.toBeInTheDocument();
  expect(SHOP_ITEMS.some((item) => item.id.includes('expansion'))).toBe(false);
});
~~~

- [ ] **Step 2: Jalankan UI/economy tests dan pastikan merah**

Run: npm test -- --run src/ui/Toolbelt.test.tsx src/ui/Tutorial.test.tsx src/ui/ShopModal.test.tsx src/game/economy/economyCommands.test.ts src/game/input/InputManager.test.ts

Expected: FAIL karena trowel dan expansion masih ada.

- [ ] **Step 3: Finalisasi tipe runtime**

~~~ts
export type ToolType = 'watering_can' | 'seed_bag' | 'scythe' | 'hand';

export interface PlotData {
  id: PlotId;
  row: number;
  col: number;
  crop: CropData | null;
  hydratedUntilUtcMs: number;
}

export interface FarmState {
  gridSize: 8;
  plots: Record<PlotId, PlotData>;
  goldenWateringCanOwned: boolean;
}
~~~

Hapus setGridSize dari GameStoreState dan implementasi Zustand. Hapus STARTING_GRID_SIZE, PLOT_SIZE, PLOT_SPACING, PLOT_TOTAL_SIZE, dan fungsi grid yang tidak lagi memiliki consumer. MAX_GRID_SIZE hanya boleh dipertahankan bila masih dipakai sebagai kapasitas data; prefer nama MAX_ACTIVE_CROPS dari plantPlacement.

- [ ] **Step 4: Remap UI dan tutorial**

~~~ts
function createInitialUiState(): UiState {
  return {
    activeModal: null,
    modalData: null,
    toasts: [],
    activeToast: null,
    isJoystickActive: false,
    joystickVector: { x: 0, y: 0 },
    selectedTool: 'seed_bag',
    selectedSeed: 'carrot',
    hoveredPlotId: null,
    targetedPlotId: null,
    isFirstPerson: false,
  };
}
~~~

Keyboard mapping final:

~~~ts
if (code === 'Digit1' || key === '1') {
  this.onToolSelect?.('watering_can');
} else if (code === 'Digit2' || key === '2') {
  this.onToolSelect?.('seed_bag');
} else if (code === 'Digit3' || key === '3') {
  this.onToolSelect?.('hand');
}
~~~

Toolbelt hanya merender tiga tool. Menutup SeedPicker mempertahankan seed_bag atau memilih watering_can; jangan kembali ke trowel. Nomori quickslot produce menjadi 4 Carrot, 5 Tomato, 6 Pumpkin, 7 Berry, dan 8 Starfruit. Tutorial pertama berbunyi Pilih Seeds, lalu ketuk tanah untuk menanam.

- [ ] **Step 5: Hapus expansion dari shop/economy**

Hapus item grid_expansion_6 dan grid_expansion_8 dari union/record katalog, switch purchase, copy UI, dan test. Golden Watering Can serta produk seed/pet tetap tidak berubah.

~~~ts
export type PermanentUpgradeId = 'golden_watering_can';

case 'golden_watering_can':
  store.setGoldenWateringCan(true);
  return { ok: true, value: { itemId }, message: 'Golden Watering Can purchased' };
~~~

- [ ] **Step 6: Hapus audio dan visual trowel**

Hapus 'till' dari SfxName, AudioManager switch/cache, audioSynthesizer, PlayerModel prop/tool mesh, serta App sound routing. Plant, water, harvest, dan ui_click tetap tersedia. Ubah test audio untuk menegaskan nama berikut:

~~~ts
expect(SFX_NAMES).toEqual([
  'plant',
  'water',
  'harvest',
  'sell',
  'buy',
  'ui_click',
  'weather',
  'pet',
]);
~~~

- [ ] **Step 7: Ganti test-clock API Till dengan exact-placement API**

~~~ts
declare global {
  interface Window {
    __plantCropAt?: (
      placement: CropPlacement,
      cropId: CropId
    ) => CommandResult<{ cropId: CropId; slotId: PlotId }>;
  }
}

window.__plantCropAt = (placement, cropId) => plantCropAt(placement, cropId);
~~~

Hapus __tillPlot dan signature __plantCrop(plotId, cropId) dari install/uninstall test clock. Perbarui testClock.test.ts agar memanggil __plantCropAt dengan placement valid.

- [ ] **Step 8: Jalankan scan literal dan semua test yang terdampak**

Run: rg -n -i "trowel|\btill(ed|ing)?\b|grid.?expan|setGridSize|getLockedPlotSlots|getPlotPosition" src

Expected: tidak ada hasil runtime. Kata tilled hanya boleh tersisa di versionOneEnvelopeSchema dan fixture migrasi v1; bila scan menemukan lokasi itu, verifikasi import-nya tidak dapat dicapai dari runtime v2.

Run: npm test -- --run src/state/uiStore.test.ts src/state/gameStore.test.ts src/game/farming/farmingCommands.test.ts src/game/input/InputManager.test.ts src/ui/Toolbelt.test.tsx src/ui/SeedPicker.test.tsx src/ui/Tutorial.test.tsx src/ui/ShopModal.test.tsx src/game/economy/economyCommands.test.ts src/game/audio/AudioManager.test.ts

Expected: PASS.

- [ ] **Step 9: Jalankan typecheck**

Run: npm run typecheck

Expected: PASS; tidak ada referensi tilled pada PlotData final atau import gridCoordinates.

- [ ] **Step 10: Commit penghapusan Till**

~~~bash
git add src/state/storeTypes.ts src/state/uiStore.ts src/state/uiStore.test.ts src/state/gameStore.ts src/state/gameStore.test.ts src/game/core/constants.ts src/game/farming/farmingCommands.ts src/game/farming/farmingCommands.test.ts src/game/input/KeyboardInput.ts src/game/input/InputManager.test.ts src/ui/Toolbelt.tsx src/ui/Toolbelt.test.tsx src/ui/SeedPicker.tsx src/ui/SeedPicker.test.tsx src/ui/Tutorial.tsx src/ui/Tutorial.test.tsx src/ui/ShopModal.tsx src/ui/ShopModal.test.tsx src/game/economy/shopCatalog.ts src/game/economy/economyDefinitions.ts src/game/economy/economyCommands.ts src/game/economy/economyCommands.test.ts src/game/audio/AudioManager.ts src/game/audio/AudioManager.test.ts src/game/audio/audioSynthesizer.ts src/game/player/PlayerModel.tsx src/test/testClock.ts src/test/testClock.test.ts
git add -u src/game/world/gridCoordinates.ts
git commit -m "refactor(gameplay): remove till and grid expansion"
~~~

---

### Task 8: Kontrak Placement Supabase dan Farm Patch

**Files:**
- Create: supabase/migrations/0007_free_placement_farm.sql
- Create: src/game/multiplayer/farmPatchProtocol.ts
- Create: src/game/multiplayer/farmPatchProtocol.test.ts
- Modify: src/game/multiplayer/RoomConnection.ts
- Modify: src/game/multiplayer/RoomConnection.test.ts

**Interfaces:**
- Consumes: aturan bed 0=NW, 1=NE, 2=SW, 3=SE; local bounds; spacing squared 1.21; tile index 0-63.
- Produces: FarmPatchTile dengan bedId/positionX/positionZ; parseFarmPatch; RPC farm_plant_at(crop, tile, bed, x, z, key); snapshot placement.

- [ ] **Step 1: Tulis protocol test yang gagal**

~~~ts
it('parses placement fields from farm patches', () => {
  const patch = parseFarmPatch({
    ownerId: 'user-1',
    plotVersion: 9,
    tiles: [{
      i: 7,
      state: 3,
      crop: 'carrot',
      plantedAt: '2026-09-03T00:00:00Z',
      readyAt: '2026-09-03T00:01:00Z',
      mutation: 0,
      bedId: 2,
      positionX: 0.123,
      positionZ: -0.456,
    }],
  });
  expect(patch.tiles[0].placement).toEqual({
    bedId: 'south-west',
    localX: 0.123,
    localZ: -0.456,
  });
});

it.each([
  [{ bedId: 4, positionX: 0, positionZ: 0 }],
  [{ bedId: 0, positionX: Number.NaN, positionZ: 0 }],
  [{ bedId: 0, positionX: 2.551, positionZ: 0 }],
])('rejects an invalid active placement', (placement) => {
  expect(() => parseFarmPatch(makeActivePatch(placement))).toThrow('INVALID_PLACEMENT_PATCH');
});

it('allows null placement only for empty tiles', () => {
  expect(parseFarmPatch(makeEmptyPatch()).tiles[0].placement).toBeNull();
});
~~~

- [ ] **Step 2: Jalankan protocol test dan pastikan merah**

Run: npm test -- --run src/game/multiplayer/farmPatchProtocol.test.ts

Expected: FAIL karena parser belum ada.

- [ ] **Step 3: Implementasikan mapper payload**

~~~ts
import type { CropPlacement, FarmBedId } from '../world/farmLayout';
import { isPlacementInsideBed } from '../world/farmLayout';

const BED_BY_INDEX: Record<number, FarmBedId> = {
  0: 'north-west',
  1: 'north-east',
  2: 'south-west',
  3: 'south-east',
};

export interface FarmPatchTile {
  i: number;
  state: number;
  crop: string | null;
  plantedAt: string | null;
  readyAt: string | null;
  mutation: number;
  bedId: number | null;
  positionX: number | null;
  positionZ: number | null;
  placement: CropPlacement | null;
}

export function parsePatchPlacement(tile: Omit<FarmPatchTile, 'placement'>): CropPlacement | null {
  if (tile.crop === null) {
    if (tile.bedId !== null || tile.positionX !== null || tile.positionZ !== null) {
      throw new Error('INVALID_PLACEMENT_PATCH');
    }
    return null;
  }
  const bedId = tile.bedId === null ? undefined : BED_BY_INDEX[tile.bedId];
  const placement = {
    bedId,
    localX: tile.positionX,
    localZ: tile.positionZ,
  };
  if (
    !bedId ||
    typeof placement.localX !== 'number' ||
    typeof placement.localZ !== 'number' ||
    !isPlacementInsideBed(placement as CropPlacement)
  ) {
    throw new Error('INVALID_PLACEMENT_PATCH');
  }
  return placement as CropPlacement;
}
~~~

parseFarmPatch memeriksa ownerId string, plotVersion integer nonnegative, i 0-63 unik, lalu menambahkan placement hasil fungsi tersebut.

- [ ] **Step 4: Buat migrasi SQL additive dan backfill**

Awal 0007_free_placement_farm.sql harus menambah kolom dan constraints:

~~~sql
alter table public.plot_tiles
  add column if not exists bed_id smallint,
  add column if not exists position_x real,
  add column if not exists position_z real;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'plot_tiles_bed_id_check'
  ) then
    alter table public.plot_tiles
      add constraint plot_tiles_bed_id_check
      check (bed_id is null or bed_id between 0 and 3) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'plot_tiles_placement_shape_check'
  ) then
    alter table public.plot_tiles
      add constraint plot_tiles_placement_shape_check
      check (
        (crop_id is null and bed_id is null and position_x is null and position_z is null)
        or
        (crop_id is not null and bed_id is not null and
         position_x between -2.55 and 2.55 and position_z between -2.25 and 2.25)
      ) not valid;
  end if;
end
$migration$;

update public.plot_tiles
set
  bed_id = case
    when tile_index / 8 < 4 and tile_index % 8 < 4 then 0
    when tile_index / 8 < 4 then 1
    when tile_index % 8 < 4 then 2
    else 3
  end,
  position_x = (((tile_index % 8) % 4) - 1.5) * 1.2,
  position_z = (((tile_index / 8) % 4) - 1.5) * 1.2
where crop_id is not null;

update public.plot_tiles
set state = 0, bed_id = null, position_x = null, position_z = null
where crop_id is null;

alter table public.plot_tiles validate constraint plot_tiles_bed_id_check;
alter table public.plot_tiles validate constraint plot_tiles_placement_shape_check;
~~~

Nama constraint dicek lewat pg_constraint sehingga migration aman bila diulang pada database staging.

- [ ] **Step 5: Perbarui tile patch dan helper world coordinate SQL**

~~~sql
create or replace function public.farm_world_x(p_bed_id smallint, p_local_x real)
returns double precision language sql immutable as $$
  select (case when p_bed_id in (0, 2) then -3.8 else 3.8 end) + p_local_x;
$$;

create or replace function public.farm_world_z(p_bed_id smallint, p_local_z real)
returns double precision language sql immutable as $$
  select (case when p_bed_id in (0, 1) then -3.5 else 3.5 end) + p_local_z;
$$;

create or replace function public.tile_patch_row(t public.plot_tiles)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'i', t.tile_index,
    'state', t.state,
    'crop', t.crop_id,
    'plantedAt', t.planted_at,
    'readyAt', t.ready_at,
    'mutation', t.mutation,
    'bedId', t.bed_id,
    'positionX', t.position_x,
    'positionZ', t.position_z
  );
$$;
~~~

- [ ] **Step 6: Buat RPC plant tunggal dan atomic**

Signature final:

~~~sql
public.farm_plant_at(
  p_crop_id text,
  p_tile_index integer,
  p_bed_id smallint,
  p_position_x real,
  p_position_z real,
  p_idempotency_key uuid
) returns jsonb
~~~

Di function body lakukan urutan ini setelah auth:

~~~sql
if p_tile_index is null or p_tile_index < 0 or p_tile_index > 63
   or p_bed_id is null or p_bed_id < 0 or p_bed_id > 3
   or p_position_x is null or p_position_z is null then
  raise exception 'INVALID_PLACEMENT';
end if;
if p_position_x not between -2.55 and 2.55
   or p_position_z not between -2.25 and 2.25 then
  raise exception 'OUTSIDE_PLANTING_AREA';
end if;

select * into v_plot
from public.plots where owner_id = v_owner for update;

perform 1 from public.plot_tiles
where plot_id = v_plot.id
order by tile_index
for update;

if (select count(*) from public.plot_tiles
    where plot_id = v_plot.id and crop_id is not null) >= 64 then
  raise exception 'FARM_FULL';
end if;

if exists (
  select 1 from public.plot_tiles t
  where t.plot_id = v_plot.id and t.crop_id is not null
    and power(public.farm_world_x(t.bed_id, t.position_x) -
              public.farm_world_x(p_bed_id, p_position_x), 2)
      + power(public.farm_world_z(t.bed_id, t.position_z) -
              public.farm_world_z(p_bed_id, p_position_z), 2) < 1.21
) then
  raise exception 'OCCUPIED_POSITION';
end if;

if exists (
  select 1 from public.plot_tiles
  where plot_id = v_plot.id and tile_index = p_tile_index and crop_id is not null
) then
  raise exception 'INVALID_TILE_STATE';
end if;
~~~

Digest idempotency wajib memasukkan crop, tile, bed, dan koordinat yang dibulatkan tiga desimal. Setelah catalog/unlock/inventory checks lama lolos, kurangi tepat satu seed lalu update candidate tile ke state 3 beserta bed_id/position_x/position_z. Pertahankan perhitungan ready_at server yang ada; penyamaan model hidrasi server dengan simulasi lokal bukan bagian redesign ini.

- [ ] **Step 7: Bersihkan harvest dan cabut RPC Till**

Ubah update harvest menjadi state 0 dan null-kan placement:

~~~sql
update public.plot_tiles
set
  state = 0,
  crop_id = null,
  planted_at = null,
  ready_at = null,
  mutation = 0,
  bed_id = null,
  position_x = null,
  position_z = null,
  version = version + 1
where plot_id = v_plot.id and tile_index = any(p_tile_indices);

revoke all on function public.farm_till(integer[], uuid) from public, anon, authenticated;
revoke all on function public.farm_plant(text, integer[], uuid) from public, anon, authenticated;
grant execute on function public.farm_plant_at(text, integer, smallint, real, real, uuid)
  to authenticated;
~~~

Jangan drop function lama dalam migration additive; revoke menjaga client baru tidak memakainya dan memungkinkan rollback database terkontrol.

- [ ] **Step 8: Terapkan parser pada snapshot dan realtime patch**

RoomConnection harus mem-parse setiap plot snapshot dan realtime payload sebelum memanggil listener. Snapshot type harus memuat plots, bukan hanya members:

~~~ts
const snap = snapshot.data as {
  members: Array<{ userId: string; username: string; slot: 0 | 1 | 2 | 3 }>;
  plots: unknown[];
};
for (const rawPlot of snap.plots ?? []) {
  this.onFarmPatch?.(parseFarmPatch({
    ownerId: rawPlot.ownerId,
    plotVersion: rawPlot.version,
    tiles: rawPlot.tiles,
  }));
}
~~~

Tambahkan test RoomConnection bahwa snapshot awal dan event realtime membawa placement identik. Jika patch invalid, set net error dan minta snapshot baru; jangan menerapkan setengah patch.

- [ ] **Step 9: Jalankan test protocol/multiplayer**

Run: npm test -- --run src/game/multiplayer/farmPatchProtocol.test.ts src/game/multiplayer/RoomConnection.test.ts

Expected: PASS; active tile tanpa placement ditolak, empty tile dengan null placement diterima.

Run: npm run typecheck

Expected: PASS.

- [ ] **Step 10: Commit backend contract**

~~~bash
git add supabase/migrations/0007_free_placement_farm.sql src/game/multiplayer/farmPatchProtocol.ts src/game/multiplayer/farmPatchProtocol.test.ts src/game/multiplayer/RoomConnection.ts src/game/multiplayer/RoomConnection.test.ts
git commit -m "feat(multiplayer): persist free crop placement"
~~~

---

### Task 9: Integrasi Penuh, Visual Polish, dan Acceptance Verification

**Files:**
- Modify: src/game/farming/farmingCommands.test.ts
- Modify: src/persistence/saveService.test.ts
- Modify: tests/e2e/farming-loop.spec.ts
- Modify: tests/e2e/mobile-controls.spec.ts
- Modify: docs/superpowers/specs/2026-09-02-free-placement-farm-redesign-design.md

**Interfaces:**
- Consumes: Seluruh interface final Tasks 1-8.
- Produces: suite hijau, bukti acceptance, dan status spec Implemented.

- [ ] **Step 1: Jalankan seluruh suite untuk menemukan regresi integrasi**

Run: npm test -- --run

Expected sebelum perbaikan integrasi: E2E lama gagal karena memanggil Till dan plant-by-plot. Catat nama test yang gagal; jangan mengubah assertion gameplay lain hanya agar hijau.

- [ ] **Step 2: Pastikan helper fixture final tidak menyembunyikan spatial assertions**

Untuk test non-spasial gunakan helper fixture test berikut; untuk test spatial gunakan koordinat eksplisit sesuai skenario:

~~~ts
export const DEFAULT_TEST_PLACEMENT: CropPlacement = {
  bedId: 'north-west',
  localX: 0,
  localZ: 0,
};

export function createTestCrop(overrides: Partial<CropData> = {}): CropData {
  return {
    cropId: 'carrot',
    plantedAtUtcMs: 0,
    growthProgressSec: 0,
    mutation: 'none',
    placement: DEFAULT_TEST_PLACEMENT,
    ...overrides,
  };
}
~~~

Factory ini sudah dibuat pada Task 3. Test collision dan exact point harus selalu mengoverride placement; hanya test non-spasial yang boleh memakai DEFAULT_TEST_PLACEMENT.

- [ ] **Step 3: Tambahkan regression test koordinat click-to-render**

~~~tsx
it('renders a successful plant within 0.01 world unit of the click', () => {
  const clicked = { x: 4.314, z: 2.111 };
  const placement = worldPointToPlacement(clicked);
  expect(placement).not.toBeNull();
  const result = plantCropAt(placement!, 'carrot', undefined, 1000);
  expect(result.ok).toBe(true);
  const crop = useGameStore.getState().farm.plots['plot-0-0'].crop!;
  const rendered = placementToWorldPoint(crop.placement);
  expect(Math.hypot(rendered.x - clicked.x, rendered.z - clicked.z)).toBeLessThanOrEqual(0.01);
});
~~~

Tambahkan test reload: toSaveEnvelope -> parseSaveEnvelope -> loadSaveEnvelope mempertahankan placement sama persis hingga tiga desimal.

- [ ] **Step 4: Ubah E2E farming dan mobile yang sudah ada**

Ganti urutan Till lama pada tests/e2e/farming-loop.spec.ts dengan helper test-clock exact placement:

~~~ts
import { expect, test } from '@playwright/test';

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
~~~

Pada tests/e2e/mobile-controls.spec.ts, hapus test Till dan assert Seeds menampilkan Tap Soil tanpa memanggil plant dari tombol:

~~~ts
await page.locator('[data-testid="tool-seed_bag"]').click();
const action = page.locator('[data-testid="mobile-action-button"]');
await expect(action).toContainText('Tap Soil');
await expect(action).toBeDisabled();
~~~

- [ ] **Step 5: Jalankan formatter/lint dan perbaiki hanya file in-scope**

Run: npm run lint

Expected: exit 0.

Run: npm run typecheck

Expected: exit 0.

- [ ] **Step 6: Jalankan verifikasi otomatis penuh**

Run: npm test -- --run

Expected: seluruh test PASS.

Run: npm run build

Expected: TypeScript dan Vite build exit 0.

Run: npm run test:e2e

Expected: PASS bila auth/browser tersedia; jika executable browser atau kredensial test memang tidak tersedia, simpan output error persis sebagai batas verifikasi dan jangan menyebut E2E lulus.

- [ ] **Step 7: Jalankan smoke test SQL bila Supabase lokal tersedia**

Run: supabase db reset

Expected: migrations 0001 sampai 0007 sukses.

Lalu uji dua call farm_plant_at konkuren pada titik berjarak kurang dari 1.1: satu sukses dan satu OCCUPIED_POSITION; query inventory memastikan hanya satu seed berkurang. Bila CLI/database tidak tersedia, laporkan migration sebagai statically reviewed dan belum di-smoke-test, bukan sebagai sukses.

- [ ] **Step 8: Inspeksi visual dengan Impeccable**

Gunakan skill impeccable untuk mengecek viewport desktop dan mobile dari depan serta samping. Verifikasi:

- empat bed terbaca sebagai 2x2 dan koridor + tetap lapang;
- pagar/collider tidak menembus frame di semua sisi;
- gerbang depan tepat segaris dengan koridor;
- merchant/dekorasi minimal 1.0 dari pagar;
- crop muncul pada titik input, bukan pusat slot;
- furrow tidak terbaca sebagai grid placement;
- Tap Soil jelas namun tidak menjadi tombol plant kedua.

Ambil screenshot pembanding bila browser dan sesi autentikasi tersedia. Jangan mengubah footprint artistik tanpa memperbarui farmLayout.test.ts pada commit yang sama.

- [ ] **Step 9: Scan invariant final**

Run: rg -n -i "trowel|\btill(ed|ing)?\b|grid.?expan|bedShiftX|getPlotPosition|getLockedPlotSlots" src

Expected: hanya parser/fixture schema v1 boleh memuat tilled; tidak ada hasil runtime lain.

Run: rg -n "6\.8|7\.95|7\.35|3\.8|3\.5|2\.55|2\.25|1\.1|2\.4" src/game src/ui

Expected: literal footprint/spacing hanya berada pada farmLayout.ts, farmLayout.test.ts, plantPlacement.ts, plantPlacement.test.ts, dan test kontrak yang sengaja memverifikasi nilainya.

- [ ] **Step 10: Tandai spec dan commit verifikasi**

Ubah Status spec menjadi Implemented and verified hanya jika lint, typecheck, unit tests, dan build lulus. Cantumkan batas E2E/Supabase bila salah satunya tidak tersedia.

~~~bash
git add docs/superpowers/specs/2026-09-02-free-placement-farm-redesign-design.md src/game/farming/farmingCommands.test.ts src/persistence/saveService.test.ts tests/e2e/farming-loop.spec.ts tests/e2e/mobile-controls.spec.ts
git commit -m "test: verify free-placement farm redesign"
~~~

Jangan stage .env.example, bugfixes&update.md, atau screenshot referensi.

---

## Definition of Done

- Semua 10 kriteria penerimaan pada spec dapat ditunjuk ke test otomatis atau bukti visual.
- Layout, collider, hit-testing, mobile, dan pet membaca farmLayout; tidak ada offset lokal.
- Plant exact-point, collision kurang dari 1.1, capacity 64, dan seed atomicity memiliki regression test.
- Save v1 -> v2 dan SQL backfill memakai mapping 4x4 per kuadran yang identik.
- Runtime final tidak memiliki tilled/trowel atau expansion.
- Patch/snapshot multiplayer selalu menyertakan placement untuk crop aktif.
- npm run lint, npm run typecheck, npm test -- --run, dan npm run build berhasil pada output terbaru.
- npm run test:e2e dan Supabase smoke test dilaporkan secara jujur sebagai lulus atau dibatasi environment.
- Working tree tetap mempertahankan file pengguna yang tidak terkait tanpa staging.
