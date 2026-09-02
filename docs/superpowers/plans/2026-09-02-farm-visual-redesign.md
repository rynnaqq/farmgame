# Farm Visual Redesign (Growden.io Style) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the visual appearance, environment, farm plots, marketplace stalls, and UI of "Garden Island 3D" to match the cheerful, vibrant, clean blocky aesthetic of Growden.io without modifying or breaking any database schemas or saved player data.

**Architecture:** Visual-only layer redesign using React Three Fiber, Three.js procedural geometries/instancing, and Tailwind CSS. The underlying state (`SaveEnvelope`, `PlotData`, `InventoryState`, `PlayerState`) and coordinate mappings remain 100% intact and backward-compatible.

**Tech Stack:** React 19, Three.js, @react-three/fiber, @react-three/rapier, Tailwind CSS, Dexie (IndexedDB).

**Spec:** Redesign specification based on `Screen_Recording_20260902_111616.mp4` (Growden.io reference video).

## Global Constraints

- **CRITICAL**: No changes to `src/persistence/saveSchema.ts`, `src/persistence/database.ts`, or schema version (`CURRENT_SCHEMA_VERSION = 1`).
- All `PlotData` fields (`id`, `row`, `col`, `tilled`, `crop`, `hydratedUntilUtcMs`) and `plot.id` format (`${row}-${col}`) must remain identical.
- All existing tests in `src/persistence/*.test.ts`, `src/game/world/*.test.ts`, and `src/state/*.test.ts` must continue to pass.
- Maintain smooth 60fps performance on mobile by leveraging geometry sharing and instanced meshes for repeated props (studs, fences, market details).

---

### Task 1: Vibrant World Atmosphere, Cartoon Clouds & Studded Island Ground

**Files:**
- Modify: `src/game/world/WorldLighting.tsx`
- Modify: `src/game/world/GardenIsland.tsx`
- Modify: `src/game/GameCanvas.tsx`

**Interfaces:**
- Consumes: `ISLAND_SIZE` from `src/game/core/constants.ts`
- Produces: Cheerful sunny environment, vibrant sky color, instanced grass studs, floating 3D low-poly clouds.

- [ ] **Step 1: Update WorldLighting with cheerful, warm sunlight and balanced ambient bounce**
- [ ] **Step 2: Add stylized round studs to GardenIsland grass surface and update terrain colors**
- [ ] **Step 3: Add floating procedural cartoon 3D clouds around the sky**
- [ ] **Step 4: Update GameCanvas scene background fog/sky color to vibrant sky blue**
- [ ] **Step 5: Verify in browser / run typecheck**

---

### Task 2: Raised Planter Bed Plots & Garden Perimeter Fences

**Files:**
- Modify: `src/game/world/PlotMesh.tsx`
- Modify: `src/game/world/SoilGrid.tsx`
- Modify: `src/game/world/GardenIsland.tsx`

**Interfaces:**
- Consumes: `PlotData`, `PlotId`, `PLOT_SIZE`, `useUiStore`
- Produces: Raised wooden garden planter beds, rich furrowed soil textures, log perimeter fences with entrance ramp, 3D farm signboard.

- [ ] **Step 1: Redesign PlotMesh with raised wooden planter frame and furrowed soil stages**
- [ ] **Step 2: Update untilled, tilled, and hydrated soil visual materials and hover feedback**
- [ ] **Step 3: Enhance SoilGrid locked plot indicators with stylized wooden barricades/locks**
- [ ] **Step 4: Add rustic wooden log perimeter fences enclosing the garden with an entrance gateway**
- [ ] **Step 5: Verify plot click interactions and run unit tests**

---

### Task 3: Festive Marketplace Stalls with Striped Canopies & Blocky NPCs

**Files:**
- Modify: `src/game/world/Merchant.tsx`
- Modify: `src/game/world/Decorations.tsx`

**Interfaces:**
- Consumes: `useUiStore`, `useGameStore`
- Produces: 4 specialized market stalls (Eggs, Seeds, Sell, Gear) with striped fabric canopies, blocky merchant NPCs, and 3D floating interaction prompts.

- [ ] **Step 1: Create modular StripedCanopyStall component with customizable stripe colors and counter**
- [ ] **Step 2: Build the 4 stalls: Pet Eggs (Yellow/White), Seeds (Blue/White), Sell (Red/White), Gear (Green/White)**
- [ ] **Step 3: Add blocky merchant NPCs behind counters with floating interaction labels**
- [ ] **Step 4: Wire merchant stalls to existing modals (EggShop, SeedPicker, ShopModal, etc.)**
- [ ] **Step 5: Run Merchant.test.tsx to ensure all interaction logic passes**

---

### Task 4: Arcade-Style HUD & Minecraft-Style Hotbar

**Files:**
- Modify: `src/ui/HUD.tsx`
- Modify: `src/ui/Toolbelt.tsx`

**Interfaces:**
- Consumes: `useGameStore`, `useUiStore`
- Produces: Bold top action buttons [SEEDS] [GARDEN] [SELL], 10-slot bottom hotbar with hotkey numbers and active slot highlight, clean currency and stat badges.

- [ ] **Step 1: Add arcade top navigation buttons ([SEEDS], [GARDEN], [SELL]) to HUD**
- [ ] **Step 2: Redesign bottom hotbar in Toolbelt with 10 slots, slot numbers 1..0, and count badges**
- [ ] **Step 3: Polish mobile touch controls and currency/status badges**
- [ ] **Step 4: Verify HUD tests (`HUD.test.tsx`, `Toolbelt.test.tsx`)**

---

### Task 5: End-to-End Verification & Database Preservation Check

**Files:**
- Test: `src/persistence/saveService.test.ts`
- Test: `src/persistence/migrations.test.ts`
- Test: `src/game/world/SoilGrid.test.ts`
- Test: `src/game/world/SoilGridExpansion.test.ts`

- [ ] **Step 1: Run full typecheck (`npm run typecheck`)**
- [ ] **Step 2: Run all test suites (`npm run test`)**
- [ ] **Step 3: Run production build (`npm run build`)**
- [ ] **Step 4: Confirm zero regressions and database backward-compatibility**
