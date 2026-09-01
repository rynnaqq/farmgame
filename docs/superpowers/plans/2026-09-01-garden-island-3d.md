# Garden Island 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, production-ready, single-player browser-based 3D farming simulator ("Garden Island 3D") featuring procedural low-poly visuals, keyboard/mouse & mobile touch controls, expandable farming grids, dynamic weather, deterministic crop mutations, economy/shop, companion pets, IndexedDB persistence, offline simulation, and comprehensive automated test suites.

**Architecture:** Separation of concerns between high-frequency 60Hz fixed-step simulation (core clock, player kinematics, weather, crop growth, pet steering), discrete reactive domain state (Zustand stores for farm plots, inventory, coins, settings, weather, pets), and 3D rendering (React Three Fiber, Drei, Rapier physics, custom procedural low-poly meshes, instancing, pooled particles, and Web Audio).

**Tech Stack:** React 19, TypeScript 5.x (strict), Vite, Three.js, @react-three/fiber v9, @react-three/drei, @react-three/rapier v2, Zustand, Tailwind CSS, Dexie (IndexedDB), Zod, Vitest, React Testing Library, Playwright.

**Spec:** `farm.md`

## Global Constraints

- Implement all requirements in `farm.md` across Phases 1–6 with strict TypeScript throughout.
- Procedural low-poly geometry is the intended final art style — no gray placeholder boxes or copyrighted assets.
- Do not use pseudocode, ellipses, placeholder functions, fake imports, or "implement later" stubs.
- Keep gameplay logic separate from rendering and UI.
- All gameplay randomness must be deterministic and based on a persisted seeded random-number generator (`xorshift32`). No `Math.random()` for mutations, weather, eggs, or saved outcomes.
- Mobile virtual joystick and touch camera controls are mandatory and first-class.
- Persist serializable domain data only via Dexie (`GardenIslandDB`) and validate with Zod.
- Support offline simulation up to 24 hours with chronological event boundaries.
- All commands (farming, economy, pets) return structured `CommandResult<T>` and enforce validation atomically.
- All verification commands must pass: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:e2e`.

---

### Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `eslint.config.js`
- Create: `playwright.config.ts`
- Create: `src/vite-env.d.ts`
- Create: `src/styles/index.css`
- Create: `src/test/setup.ts`
- Create: `index.html`
- Create: `public/favicon.svg`
- Create: `public/manifest.webmanifest`
- Test: `src/test/sanity.test.ts`

**Interfaces:**
- Consumes: None
- Produces: Build scripts, typecheck config, vitest runner, tailwind styles, root html.

- [ ] **Step 1: Write package.json and configuration files**
- [ ] **Step 2: Run npm install**
- [ ] **Step 3: Write initial sanity unit test in src/test/sanity.test.ts**
- [ ] **Step 4: Run vitest to verify test runner works**
- [ ] **Step 5: Commit scaffolding**

---

### Task 2: Core Simulation Primitives (RNG, GameClock, FixedStepLoop, Constants)

**Files:**
- Create: `src/game/core/rng.ts`
- Create: `src/game/core/GameClock.ts`
- Create: `src/game/core/FixedStepLoop.ts`
- Create: `src/game/core/constants.ts`
- Test: `src/game/core/rng.test.ts`
- Test: `src/game/core/GameClock.test.ts`
- Test: `src/game/core/FixedStepLoop.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  - `class SeededRNG { constructor(seed: number); next(): number; nextFloat(): number; range(min: number, max: number): number; getState(): number; setState(state: number): void; }`
  - `class GameClock { constructor(initialTimeUtcMs?: number); now(): number; advance(ms: number): void; setTime(utcMs: number): void; }`
  - `class FixedStepLoop { constructor(stepMs: number, maxSubSteps: number, updateFn: (dt: number) => void); step(frameDeltaMs: number): number; getAlpha(): number; reset(): void; }`
  - Game constants for world size (28x28), plot size (1.4x1.4), spacing (0.15), player speed (3.5 / 5.25), weather timings, etc.

- [ ] **Step 1: Write failing unit tests for SeededRNG, GameClock, and FixedStepLoop**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement SeededRNG (xorshift32 algorithm with uint32 state), GameClock, FixedStepLoop, and constants**
- [ ] **Step 4: Run tests to verify passing**
- [ ] **Step 5: Commit core simulation primitives**

---

### Task 3: State Foundation & Stores (Zustand & Types)

**Files:**
- Create: `src/state/storeTypes.ts`
- Create: `src/state/gameStore.ts`
- Create: `src/state/settingsStore.ts`
- Create: `src/state/uiStore.ts`
- Create: `src/state/selectors.ts`
- Test: `src/state/gameStore.test.ts`
- Test: `src/state/settingsStore.test.ts`

**Interfaces:**
- Consumes: `src/game/core/rng.ts`, `src/game/core/constants.ts`
- Produces:
  - Domain types: `PlotId`, `PlotState`, `PlotData`, `CropId`, `CropStage`, `MutationType`, `WeatherType`, `PetType`, `EggType`, `ToolType`, `ProduceStack`, `CommandResult<T>`
  - `useGameStore`: atomic actions for plot updates, coin transactions, inventory changes, weather, pets, tool selection
  - `useSettingsStore`: audio volumes, quality level (Auto/Low/Medium/High), reducedMotion, haptics, inputMode, camera settings
  - `useUiStore`: activeModal, activeToast, isJoystickActive, selectedSeed

- [ ] **Step 1: Write failing unit tests for gameStore and settingsStore**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement storeTypes, gameStore, settingsStore, uiStore, and selectors**
- [ ] **Step 4: Run tests to verify passing**
- [ ] **Step 5: Commit state foundation**

---

### Task 4: World Geometry, Island, Grid Base & World Lighting

**Files:**
- Create: `src/game/world/GardenIsland.tsx`
- Create: `src/game/world/SoilGrid.tsx`
- Create: `src/game/world/PlotMesh.tsx`
- Create: `src/game/world/Boundaries.tsx`
- Create: `src/game/world/Decorations.tsx`
- Create: `src/game/world/WorldLighting.tsx`
- Create: `src/game/GameCanvas.tsx`
- Create: `src/game/GameRuntime.tsx`
- Test: `src/game/world/SoilGrid.test.ts`

**Interfaces:**
- Consumes: `src/state/gameStore.ts`, `src/state/settingsStore.ts`, `src/game/core/constants.ts`
- Produces:
  - 28x28 floating island with layered faceted geometry (grass top, earth side, stone underside, rocks, trees, water barrel, fences).
  - 4x4 default soil grid (expandable to 6x6, 8x8) with locked plot markers.
  - Directional sun/moon and hemisphere light with shadow mapping based on quality settings.
  - Invisible boundary colliders and Y = -5 respawn safety.

- [ ] **Step 1: Write unit test verifying plot coordinate calculation and grid positioning**
- [ ] **Step 2: Implement GardenIsland, SoilGrid, PlotMesh, Boundaries, Decorations, and WorldLighting**
- [ ] **Step 3: Implement GameCanvas and GameRuntime with R3F Canvas and Rapier Physics world**
- [ ] **Step 4: Verify rendering and grid layout**
- [ ] **Step 5: Commit world and rendering components**

---

### Task 5: App Shell, Error Boundary & WebGL Fallback

**Files:**
- Create: `src/app/App.tsx`
- Create: `src/app/ErrorBoundary.tsx`
- Create: `src/app/providers.tsx`
- Create: `src/main.tsx`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `src/game/GameCanvas.tsx`, `src/state/settingsStore.ts`
- Produces: Main application root, WebGL2 context failure fallback UI with retry button, global error boundary.

- [ ] **Step 1: Write failing component test for App and ErrorBoundary**
- [ ] **Step 2: Implement ErrorBoundary, providers, App, and main entrypoint**
- [ ] **Step 3: Run component tests to verify passing**
- [ ] **Step 4: Verify dev server starts and renders canvas**
- [ ] **Step 5: Commit App shell**

---

### Task 6: Cross-Platform Input Pipeline

**Files:**
- Create: `src/game/input/inputTypes.ts`
- Create: `src/game/input/KeyboardInput.ts`
- Create: `src/game/input/TouchInput.ts`
- Create: `src/game/input/InputManager.ts`
- Test: `src/game/input/InputManager.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  - `class InputManager`: combines keyboard (WASD/Arrows, Shift, Numbers 1-4, Q/E, Esc) and mobile joystick vector.
  - 12% radial dead zone, clamped magnitude [0, 1], camera-relative direction resolution, pointer cancellation, blur handling.

- [ ] **Step 1: Write failing unit tests for vector merging, deadzone math, run threshold (0.88 for 350ms), and cancellation**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement inputTypes, KeyboardInput, TouchInput, and InputManager**
- [ ] **Step 4: Run tests to verify passing**
- [ ] **Step 5: Commit input pipeline**

---

### Task 7: Procedural Player Model, Animation & Kinematic Controller

**Files:**
- Create: `src/game/player/playerAnimation.ts`
- Create: `src/game/player/PlayerModel.tsx`
- Create: `src/game/player/PlayerController.tsx`
- Create: `src/game/player/Player.tsx`
- Test: `src/game/player/PlayerController.test.ts`

**Interfaces:**
- Consumes: `src/game/input/InputManager.ts`, `src/state/gameStore.ts`
- Produces:
  - Procedural low-poly humanoid player character (head, torso, limbs, hat, face).
  - Procedural arm/leg swing animations mapped to speed (3.5 walk, 5.25 run) and idle bobbing.
  - Kinematic Rapier capsule movement with smoothed acceleration, shortest-angle rotation, and safety respawn at Y < -5.

- [ ] **Step 1: Write unit test for player velocity smoothing and distance calculation**
- [ ] **Step 2: Implement playerAnimation math, PlayerModel component, PlayerController, and Player wrapper**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit player system**

---

### Task 8: Follow Camera with Orbit, Zoom & Collision Avoidance

**Files:**
- Create: `src/game/camera/FollowCamera.tsx`
- Test: `src/game/camera/FollowCamera.test.ts`

**Interfaces:**
- Consumes: `src/state/settingsStore.ts`, Player position ref
- Produces:
  - Third-person isometric follow camera targeting player (Y + 1.2).
  - Default yaw 45°, pitch 40°, distance 12.
  - Pitch clamp [25°, 65°], distance clamp [7, 18].
  - Right-mouse / one-finger touch drag orbit, scroll / pinch zoom with damping and collision avoidance.

- [ ] **Step 1: Write unit test for camera spherical math and angle/distance clamping**
- [ ] **Step 2: Implement FollowCamera with Three.js camera controls and raycast clipping prevention**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit camera system**

---

### Task 9: Mobile Virtual Joystick & Touch Camera Layer

**Files:**
- Create: `src/ui/mobile/VirtualJoystick.tsx`
- Create: `src/ui/mobile/MobileActionButton.tsx`
- Create: `src/ui/mobile/MobileHUD.tsx`
- Test: `src/ui/mobile/VirtualJoystick.test.tsx`

**Interfaces:**
- Consumes: `src/game/input/InputManager.ts`, `src/state/uiStore.ts`, `src/state/gameStore.ts`
- Produces:
  - Translucent fixed joystick (112px base, 48px knob, 42px travel) in lower-left safe area.
  - Pointer capture management (single active pointer, cancel on blur/modal).
  - MobileActionButton in lower-right (56x56 min) targeting nearest valid plot within 2.8 units and 70° forward cone.

- [ ] **Step 1: Write failing component tests for VirtualJoystick pointer capture, drag math, and cleanup**
- [ ] **Step 2: Implement VirtualJoystick, MobileActionButton, and MobileHUD**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit mobile input controls**

---

### Task 10: Farming State Machine & Crop Definitions

**Files:**
- Create: `src/game/farming/cropDefinitions.ts`
- Create: `src/game/farming/plotMachine.ts`
- Test: `src/game/farming/cropDefinitions.test.ts`
- Test: `src/game/farming/plotMachine.test.ts`

**Interfaces:**
- Consumes: `src/state/storeTypes.ts`
- Produces:
  - 5 Crops: Carrot (5c/45s/12c), Tomato (20c/90s/48c), Pumpkin (75c/180s/190c), Golden Berry (200c/300s/550c), Starfruit (500c/480s/1500c).
  - Plot state evaluator: `Untilled`, `Tilled`, `Planted`, `Watered`, `Harvestable`.
  - Stage evaluator: Sprout (0-32.99%), Mid (33-74.99%), Fully Grown (75-100%).

- [ ] **Step 1: Write exhaustive unit tests for plot states, stage boundaries, and crop configs**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement cropDefinitions and plotMachine state evaluation functions**
- [ ] **Step 4: Run tests to verify passing**
- [ ] **Step 5: Commit farming state machine**

---

### Task 11: Farming Commands & Atomic Validation

**Files:**
- Create: `src/game/farming/farmingCommands.ts`
- Test: `src/game/farming/farmingCommands.test.ts`

**Interfaces:**
- Consumes: `src/state/storeTypes.ts`, `src/state/gameStore.ts`, `src/game/farming/cropDefinitions.ts`
- Produces:
  - `tillPlot(plotId, playerPos): CommandResult`
  - `waterPlot(plotId, playerPos, isGoldenCan, weather, nowMs): CommandResult`
  - `plantCrop(plotId, cropId, playerPos): CommandResult`
  - `harvestCrop(plotId, playerPos): CommandResult<{ cropId: CropId; mutation: MutationType; saleValue: number }>`
  - Range validation (<= 3.0 units), inventory checks, Golden Watering Can 3x3 neighbor hydration.

- [ ] **Step 1: Write failing unit tests for all valid/invalid actions, range limits, inventory deductions, and 3x3 golden water logic**
- [ ] **Step 2: Implement atomic farmingCommands**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit farming commands**

---

### Task 12: Growth Simulation System

**Files:**
- Create: `src/game/farming/growthSystem.ts`
- Test: `src/game/farming/growthSystem.test.ts`

**Interfaces:**
- Consumes: `src/game/farming/cropDefinitions.ts`, `src/game/core/rng.ts`, `src/state/storeTypes.ts`
- Produces:
  - `advancePlotGrowth(plot, deltaSeconds, weather, pet, rng, nowMs): { updatedPlot, maturedEvent? }`
  - Multiplicative modifiers: `effectiveGrowthDelta = hydratedDelta * weatherGrowthMultiplier * petGrowthMultiplier`
  - Maturity trigger and one-time mutation roll at 100% progress.

- [ ] **Step 1: Write failing unit tests for growth math, hydration countdown, weather/pet multipliers, and maturity mutation roll**
- [ ] **Step 2: Implement growthSystem**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit growth simulation**

---

### Task 13: Procedural Crop Meshes & CropRenderer

**Files:**
- Create: `src/game/farming/CropRenderer.tsx`
- Create: `src/game/farming/mutationVisuals.tsx`
- Test: `src/game/farming/CropRenderer.test.ts`

**Interfaces:**
- Consumes: `src/game/farming/cropDefinitions.ts`, `src/state/storeTypes.ts`
- Produces:
  - Procedural low-poly meshes for all 5 crops across 3 distinct stages (15 distinct meshes).
  - Visual stage transition animations (250ms scale ease-out / 100ms opacity on reduced motion).
  - Mutation visual decorators (Gold metallic/glow, Giant 2x scale, Cosmic animated shader/motes).

- [ ] **Step 1: Write test for crop visual stage resolver and mutation scales**
- [ ] **Step 2: Implement procedural geometry generators for Carrot, Tomato, Pumpkin, Golden Berry, Starfruit, and CropRenderer**
- [ ] **Step 3: Implement mutation visual shaders and particle effects**
- [ ] **Step 4: Verify rendering and stage transitions**
- [ ] **Step 5: Commit crop renderer**

---

### Task 14: Toolbelt, Seed Picker & HUD Farming Controls

**Files:**
- Create: `src/ui/Toolbelt.tsx`
- Create: `src/ui/SeedPicker.tsx`
- Test: `src/ui/Toolbelt.test.tsx`
- Test: `src/ui/SeedPicker.test.tsx`

**Interfaces:**
- Consumes: `src/state/gameStore.ts`, `src/state/uiStore.ts`, `src/game/farming/cropDefinitions.ts`
- Produces:
  - 4 Tool buttons: Trowel (1), Watering Can (2), Seed Bag (3), Hand/Scythe (4) with active indicator, keyboard shortcuts, and golden can styling.
  - SeedPicker popup with seed inventory counts and Q/E cycling.
  - Accessible button labels and touch targets (>= 44px).

- [ ] **Step 1: Write failing component tests for tool selection, seed selection, keyboard shortcuts, and disabled states**
- [ ] **Step 2: Implement Toolbelt and SeedPicker**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit toolbelt and seed picker**

---

### Task 15: Economy Definitions, Catalog & Commands

**Files:**
- Create: `src/game/economy/economyDefinitions.ts`
- Create: `src/game/economy/shopCatalog.ts`
- Create: `src/game/economy/economyCommands.ts`
- Test: `src/game/economy/economyCommands.test.ts`

**Interfaces:**
- Consumes: `src/state/storeTypes.ts`, `src/state/gameStore.ts`
- Produces:
  - Shop catalog items (Seeds, Golden Watering Can: 1200c, Expansions: 6x6=750c, 8x8=3500c, Common Egg: 450c, Rare Egg: 1500c).
  - `buySeed(cropId, quantity): CommandResult`
  - `sellProduce(cropId, mutation, quantity): CommandResult<{ coinsEarned: number }>`
  - `sellAllProduce(): CommandResult<{ totalCoinsEarned: number }>`
  - `buyUpgrade(upgradeId): CommandResult`
  - `buyEgg(eggType, rng): CommandResult<{ eggId: string }>`

- [ ] **Step 1: Write failing unit tests for economy transactions, coin math, insufficient funds, sell-all calculations, and egg slot caps (max 12 pets/eggs)**
- [ ] **Step 2: Implement economyDefinitions, shopCatalog, and economyCommands**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit economy engine**

---

### Task 16: Merchant NPC, Shop Modal & Interaction

**Files:**
- Create: `src/game/world/Merchant.tsx`
- Create: `src/ui/ShopModal.tsx`
- Create: `src/ui/EggShop.tsx`
- Test: `src/ui/ShopModal.test.tsx`

**Interfaces:**
- Consumes: `src/game/economy/economyCommands.ts`, `src/state/gameStore.ts`, `src/state/uiStore.ts`
- Produces:
  - Procedural low-poly merchant NPC and market stall placed outside plot grid.
  - Proximity detection (<= 2.5 units), E key prompt on desktop, "Shop" context button on mobile.
  - Tabbed Shop Modal: Seeds (1x/5x), Sell (Single stack/Sell all), Upgrades (Golden Can, Expansions), Eggs (Common/Rare).
  - Modal focus trapping, Esc to close, input disabling during open.

- [ ] **Step 1: Write failing component tests for ShopModal tabs, buy/sell interactions, disabled states, and keyboard traps**
- [ ] **Step 2: Implement Merchant 3D mesh, ShopModal, and EggShop sub-tab**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit merchant and shop UI**

---

### Task 17: Island Grid Expansion System

**Files:**
- Modify: `src/game/world/SoilGrid.tsx`
- Modify: `src/game/economy/economyCommands.ts`
- Test: `src/game/world/SoilGridExpansion.test.ts`

**Interfaces:**
- Consumes: `src/state/gameStore.ts`
- Produces:
  - Expansion from 4x4 -> 6x6 (750c) and 6x6 -> 8x8 (3500c).
  - Outward wave animation delaying each distance ring by 60ms (completing in <= 600ms).
  - Preserves all existing plot data and IDs (`plot-r-c`).

- [ ] **Step 1: Write unit tests verifying plot ID preservation and expansion boundary math**
- [ ] **Step 2: Implement grid expansion wave logic and visual animation in SoilGrid**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit grid expansion**

---

### Task 18: Complete Responsive HUD, Mobile HUD, Inventory & Toasts

**Files:**
- Create: `src/ui/HUD.tsx`
- Create: `src/ui/InventoryPanel.tsx`
- Create: `src/ui/ToastRegion.tsx`
- Test: `src/ui/HUD.test.tsx`
- Test: `src/ui/InventoryPanel.test.tsx`

**Interfaces:**
- Consumes: `src/state/gameStore.ts`, `src/state/uiStore.ts`, `src/state/settingsStore.ts`
- Produces:
  - Always-visible coin counter with animated delta, weather chip + timer, active pet badge, settings button.
  - Collapsible inventory panel showing seeds, harvested produce stacks (with mutation multiplier, unit and stack value), and pet eggs.
  - Rate-limited polite toast notification container.
  - Responsive layouts: phone portrait (compact chips), phone landscape, tablet, desktop.

- [ ] **Step 1: Write failing component tests for HUD rendering, inventory calculations, and toast rate limiting**
- [ ] **Step 2: Implement HUD, InventoryPanel, and ToastRegion**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit HUD and inventory**

---

### Task 19: Tutorial, Settings Modal & Accessibility

**Files:**
- Create: `src/ui/Tutorial.tsx`
- Create: `src/ui/SettingsModal.tsx`
- Test: `src/ui/Tutorial.test.tsx`
- Test: `src/ui/SettingsModal.test.tsx`

**Interfaces:**
- Consumes: `src/state/settingsStore.ts`, `src/state/gameStore.ts`, `src/state/uiStore.ts`
- Produces:
  - 6-step interactive/skippable onboarding tutorial with device-aware instructions (desktop WASD vs mobile joystick).
  - Settings Modal: Master/Music/SFX volume sliders, Quality (Auto/Low/Medium/High), Reduced Motion, Haptics toggle, Input Mode, Camera Sensitivity, Invert-Y, Reset Save confirmation.
  - Full keyboard accessibility and visible focus outlines.

- [ ] **Step 1: Write failing tests for Tutorial steps, device phrasing, and Settings persistence**
- [ ] **Step 2: Implement Tutorial and SettingsModal**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit tutorial and settings**

---

### Task 20: Weather Engine & State System

**Files:**
- Create: `src/game/weather/weatherDefinitions.ts`
- Create: `src/game/weather/weatherSystem.ts`
- Test: `src/game/weather/weatherSystem.test.ts`

**Interfaces:**
- Consumes: `src/game/core/rng.ts`, `src/state/storeTypes.ts`
- Produces:
  - 4 Weather states: Sunny (45%), Heavy Rain (30%), Heatwave (15%), Blood Moon (10%).
  - Seeded random duration [180s, 300s], no immediate repeat rule.
  - Gameplay effects: Heavy Rain hydrates all tilled plots continuously (+20s buffer), Heatwave 60s water duration, growth multipliers, mutation rolls.

- [ ] **Step 1: Write failing unit tests for weather schedule, duration bounds, deterministic weighted selection, no repeat rule, and hydration effects**
- [ ] **Step 2: Implement weatherDefinitions and weatherSystem**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit weather system**

---

### Task 21: Weather 3D Renderer, Lighting Transitions & Particle Pool

**Files:**
- Create: `src/game/weather/WeatherRenderer.tsx`
- Create: `src/game/effects/ParticlePool.tsx`
- Create: `src/game/effects/PostProcessing.tsx`
- Test: `src/game/effects/ParticlePool.test.ts`

**Interfaces:**
- Consumes: `src/game/weather/weatherDefinitions.ts`, `src/state/settingsStore.ts`
- Produces:
  - 2-second crossfades for sky colors, fog density, sun/moon lighting, and ambient light.
  - Pooled instanced particles for rain drops/splashes, warm heat haze motes, blood moon crimson motes, and harvest sparkles.
  - Selective bloom post-processing for Gold/Cosmic mutations and weather effects according to quality level.

- [ ] **Step 1: Write unit tests for particle pooling recycling and allocation caps**
- [ ] **Step 2: Implement WeatherRenderer, ParticlePool, and PostProcessing**
- [ ] **Step 3: Verify weather transitions and particle performance**
- [ ] **Step 4: Commit weather renderer and particles**

---

### Task 22: Procedural Mutation Engine & Shaders

**Files:**
- Modify: `src/game/farming/growthSystem.ts`
- Modify: `src/game/farming/mutationVisuals.tsx`
- Test: `src/game/farming/mutationEngine.test.ts`

**Interfaces:**
- Consumes: `src/game/core/rng.ts`, `src/game/weather/weatherDefinitions.ts`
- Produces:
  - Deterministic mutation roll at maturity:
    - Sunny: 5% Gold (x5 value)
    - Heavy Rain: 8% Giant (x3 value, 2x scale)
    - Heatwave: 8% Gold (x5 value)
    - Blood Moon: 3% Cosmic (x15 value, animated shader)
  - Pig pet +20% relative chance multiplier: `effectiveChance = clamp(baseChance * 1.2, 0, 1)`.
  - Mutually exclusive, permanent on crop, never rerolled.

- [ ] **Step 1: Write exhaustive unit tests for mutation probabilities, seeded outcomes, Pig modifier, and persistence**
- [ ] **Step 2: Implement mutation calculations and custom GLSL/Three shader materials**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit mutation engine**

---

### Task 23: Web Audio Engine & Sound Synthesis

**Files:**
- Create: `src/game/audio/AudioManager.ts`
- Test: `src/game/audio/AudioManager.test.ts`

**Interfaces:**
- Consumes: `src/state/settingsStore.ts`
- Produces:
  - Web Audio synthesis/player for: till, plant, water, harvest, coin transaction, error, mutation discovery, weather transition, egg hatch, UI click.
  - Ambient background loops with 2s crossfades for weather types.
  - Unlock on user gesture, pause on tab hidden, obeys volume/mute settings without crashing on unsupported browsers.

- [ ] **Step 1: Write unit tests for AudioManager volume calculations, state transitions, and mute behavior**
- [ ] **Step 2: Implement AudioManager with Web Audio oscillator/buffer synthesis and ambience generator**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit audio manager**

---

### Task 24: Performance Optimization, Instancing & Diagnostics

**Files:**
- Create: `src/game/effects/DiagnosticsPanel.tsx`
- Modify: `src/game/world/PlotMesh.tsx`
- Modify: `src/game/farming/CropRenderer.tsx`
- Test: `src/game/effects/DiagnosticsPanel.test.tsx`

**Interfaces:**
- Consumes: Three.js renderer info, `src/state/settingsStore.ts`
- Produces:
  - Mesh instancing for plot bases, locked markers, rocks, foliage, and repeated crop geometries to keep draw calls < 200 on 8x8 farm.
  - Auto quality manager (stepping down if FPS < 45 for 5s, stepping up if FPS > 58 for 30s).
  - Development diagnostics overlay (FPS, draw calls, triangles, active particles) accessible via `?debug=1`.

- [ ] **Step 1: Implement mesh instancing and auto-quality monitoring**
- [ ] **Step 2: Implement DiagnosticsPanel**
- [ ] **Step 3: Verify draw call counts and memory cleanup**
- [ ] **Step 4: Commit performance optimizations**

---

### Task 25: Pet & Egg Domain Logic, Hatching & Perks

**Files:**
- Create: `src/game/pets/petDefinitions.ts`
- Create: `src/game/pets/petSystem.ts`
- Test: `src/game/pets/petSystem.test.ts`

**Interfaces:**
- Consumes: `src/game/core/rng.ts`, `src/state/storeTypes.ts`, `src/state/gameStore.ts`
- Produces:
  - 3 Pets: Bee (x1.15 crop growth), Dog (auto-harvests 1 mature crop/sec within 1.75 units), Pig (+20% relative mutation chance).
  - Egg outcomes rolled at purchase: Common Egg (Dog 60%, Bee 35%, Pig 5%), Rare Egg (Pig 50%, Bee 30%, Dog 20%).
  - Hatching: 90 seconds real-time OR 120 world units traveled.
  - Equip/unequip system (1 equipped at a time, max 12 total pets).

- [ ] **Step 1: Write failing unit tests for egg purchase weights, hatch timer/distance triggers, perk math, and Dog auto-harvest atomic deduplication**
- [ ] **Step 2: Implement petDefinitions and petSystem**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit pet domain system**

---

### Task 26: Procedural Pet Renderer, Egg Renderer & Steering

**Files:**
- Create: `src/game/pets/PetRenderer.tsx`
- Create: `src/game/pets/EggRenderer.tsx`
- Test: `src/game/pets/PetRenderer.test.ts`

**Interfaces:**
- Consumes: `src/state/gameStore.ts`, Player position ref
- Produces:
  - Procedural low-poly meshes for Bee (wings flutter), Dog (tail wag), Pig (snout/ears), and incubating Egg.
  - Smooth follow steering (1.5–2.2 units trailing distance, teleport if > 12 units).
  - Celebration animations on mutation/hatching.

- [ ] **Step 1: Write unit tests for pet steering target interpolation and distance clamping**
- [ ] **Step 2: Implement PetRenderer and EggRenderer procedural meshes and animations**
- [ ] **Step 3: Verify pet following and visual feedback**
- [ ] **Step 4: Commit pet renderers**

---

### Task 27: IndexedDB Persistence, Schema Validation & Migrations

**Files:**
- Create: `src/persistence/database.ts`
- Create: `src/persistence/saveSchema.ts`
- Create: `src/persistence/migrations.ts`
- Create: `src/persistence/saveService.ts`
- Test: `src/persistence/saveSchema.test.ts`
- Test: `src/persistence/migrations.test.ts`
- Test: `src/persistence/saveService.test.ts`

**Interfaces:**
- Consumes: `src/state/storeTypes.ts`
- Produces:
  - Dexie database `GardenIslandDB`.
  - Zod validation schema for `SaveEnvelope` (v1) rejecting invalid values, non-finite numbers, negative items.
  - Serialized async save queue with coalescing to prevent out-of-order writes.
  - Autosave every 10s if dirty, instant save on transactions/expansion/mutations, save on pagehide/visibilitychange.
  - Corrupt data backup and recovery fallback.

- [ ] **Step 1: Write failing unit tests for save validation, migration pipeline, dirty coalescing, and corrupt save recovery**
- [ ] **Step 2: Implement database, saveSchema with Zod, migrations, and saveService**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit persistence system**

---

### Task 28: Deterministic Offline Simulation & Offline Summary

**Files:**
- Create: `src/persistence/offlineSimulation.ts`
- Create: `src/ui/OfflineSummary.tsx`
- Test: `src/persistence/offlineSimulation.test.ts`
- Test: `src/ui/OfflineSummary.test.tsx`

**Interfaces:**
- Consumes: `src/state/storeTypes.ts`, `src/game/farming/growthSystem.ts`, `src/game/weather/weatherSystem.ts`, `src/game/pets/petSystem.ts`
- Produces:
  - Event-boundary chronological offline simulator (hydration expiry, weather change, maturity, mutation, egg hatch, Dog harvest at maturity + 30s).
  - 24-hour cap, backward clock protection (0ms), deterministic RNG replay, idempotent result commitment.
  - OfflineSummary modal presenting elapsed time, matured crops, mutations discovered, Dog harvests, and hatched pets.

- [ ] **Step 1: Write failing unit tests for complex offline simulation scenarios (multi-weather changes, rain hydration, mutations, egg hatch, Dog harvest, 24h cap, idempotency)**
- [ ] **Step 2: Implement offlineSimulation and OfflineSummary modal**
- [ ] **Step 3: Run tests to verify passing**
- [ ] **Step 4: Commit offline simulation**

---

### Task 29: End-to-End Automated Test Suite

**Files:**
- Create: `tests/e2e/farming-loop.spec.ts`
- Create: `tests/e2e/persistence.spec.ts`
- Create: `tests/e2e/mobile-controls.spec.ts`
- Create: `tests/e2e/shop-and-pets.spec.ts`
- Create: `src/test/testClock.ts`

**Interfaces:**
- Consumes: Full application bundle / preview
- Produces: Playwright desktop (1440x900) and mobile (Android viewport with touch) tests verifying:
  1. Full farming loop (till -> plant -> water -> test clock mature -> harvest -> sell).
  2. Shop seed purchase math & coin balance.
  3. Reload & persistence restoration.
  4. Offline progress calculation & idempotency.
  5. Egg purchase, incubation, and hatching.
  6. Mobile virtual joystick and action button interactions.
  7. Mobile shop modal input suppression.

- [ ] **Step 1: Implement deterministic test clock injection helper for e2e tests**
- [ ] **Step 2: Implement all 4 Playwright e2e test specifications**
- [ ] **Step 3: Run Playwright tests and verify passes**
- [ ] **Step 4: Commit e2e tests**

---

### Task 30: Final Verification, Production Build & Comprehensive Documentation

**Files:**
- Create: `README.md`
- Modify: Any files needing polish / lint fixes
- Test: Full verification suite (`lint`, `typecheck`, `test`, `build`, `test:e2e`)

**Interfaces:**
- Consumes: All completed modules
- Produces: Production-ready build artifacts and complete user/developer documentation.

- [ ] **Step 1: Run code formatting and lint check (`npm run lint`)**
- [ ] **Step 2: Run TypeScript strict typecheck (`npm run typecheck`)**
- [ ] **Step 3: Run all unit and component tests (`npm run test`)**
- [ ] **Step 4: Run production Vite build (`npm run build`)**
- [ ] **Step 5: Write comprehensive README.md with controls, mechanics, offline simulation explanation, architecture, and verification instructions**
- [ ] **Step 6: Commit final documentation and polish**
