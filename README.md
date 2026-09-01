# 🌿 Garden Island 3D

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.180-black.svg)](https://threejs.org/)
[![R3F](https://img.shields.io/badge/React_Three_Fiber-9.1-orange.svg)](https://docs.pmnd.rs/react-three-fiber)
[![Zustand](https://img.shields.io/badge/Zustand-5.0-brown.svg)](https://github.com/pmndrs/zustand)
[![Tests](https://img.shields.io/badge/Tests-810_Passing-brightgreen.svg)](<>)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](<>)

**Garden Island 3D** is a rich, cozy, low-poly procedural farming simulation game built entirely for the modern web. Featuring 100% procedurally synthesized 3D meshes, custom GLSL mutation shaders, procedural Web Audio sound synthesis, deterministic offline progression, companion pets, dynamic weather systems, and responsive desktop & mobile touch controls.

---

## 🌟 Key Features & Gameplay Mechanics

### 🌾 Procedural Crops & Growth Cycles

Cultivate 5 unique crop varieties across **3 distinct procedural growth stages** (Sprout, Vegetative, Mature) with 15 bespoke 3D geometric meshes generated on-the-fly without external 3D model asset downloads:

- 🥕 **Carrot**: Fast-growing root vegetable ideal for early-game income.
- 🍅 **Tomato**: Vine crop with vibrant red yields.
- 🎃 **Pumpkin**: Sturdy squash providing substantial payouts.
- 🍓 **Golden Berry**: High-value specialty crop that thrives in sunlight.
- ⭐ **Starfruit**: Rare celestial crop offering astronomical market returns.

### ☀️ Dynamic Weather Engine & Environmental Hydration

A real-time atmospheric simulation featuring 2-second crossfades, dynamic lighting adjustments, procedural particle effects, and environmental hydration shifts:

- **Sunny**: Standard day cycle with steady growth conditions.
- **Heavy Rain**: Automatically irrigates all island soil plots and hydrates dry ground.
- **Heatwave**: Accelerated soil drying rate requiring frequent watering; increases specific mutation chances.
- **Blood Moon**: Eerie nocturnal phenomenon that triggers high-tier cosmic crop mutations.

### ✨ Crop Mutations & Custom GLSL Shaders

Every harvest has a chance to produce rare mutant variants rendered with custom vertex and fragment shaders:

- **Gold Variant (5x Sell Value)**: Procedural specular metallic gleam and warm golden shimmer.
- **Giant Variant (3x Yield)**: Scaled volumetric mesh with increased harvest drops.
- **Cosmic Variant (15x Sell Value)**: Pulsing procedural starfield, iridescence, and ethereal glowing aura.

### 🐾 Companion Pets & Egg Incubation

- **Bee**: Hovers across crops to pollinate, accelerating growth rates.
- **Dog**: Patrols the farm, loyally following the player and digging up bonus treasures.
- **Pig**: Forages near tilled soil, providing natural fertilization and rare truffles.
- **Incubation System**: Purchase pet eggs at the nursery and incubate them through a combination of elapsed game-time and player walking distance.

### 🛒 Island Economy, Upgrades & Expansion

- **Merchant Shop**: Buy seeds, sell harvested crops, and acquire companion eggs.
- **Tool Upgrades**: Upgrade from the standard Watering Can to the **Golden Watering Can** for wide 3x3 Area-of-Effect (AoE) watering.
- **Island Expansions**: Expand your cozy plot from a starter **4×4 (16 plots)** to **6×6 (36 plots)** and the ultimate **8×8 (64 plots)** island sanctuary.

### 🔊 Procedural Web Audio Synthesis

- **Zero Audio Assets**: All sound effects (footsteps, tilling, seed sowing, watering, harvesting, level-ups, menu clicks) are procedurally synthesized in real-time via the Web Audio API (`AudioContext`).
- **Dynamic Weather Ambience**: Procedural white-noise rain filters, low-frequency wind hums, and atmospheric Blood Moon resonant pads.

### 💾 Deterministic Persistence & Offline Simulation

- **IndexedDB via Dexie & Zod**: Game saves are automatically persisted with strict schema validation and versioned migrations.
- **Catch-up Simulation**: When returning after time away, the game executes a deterministic offline catch-up simulation—processing soil hydration decay, crop growth ticks, and pet activities—and presents an **Offline Summary** dialog.

---

## 🎮 Controls Quick Reference

Garden Island 3D provides full cross-platform parity with responsive desktop keyboard/mouse controls and dedicated mobile touch HUD controls with haptic feedback.

### 🖥️ Desktop Keyboard & Mouse

| Input                                                                                                     | Action                                  |
| :-------------------------------------------------------------------------------------------------------- | :-------------------------------------- |
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / <kbd>↑</kbd> <kbd>←</kbd> <kbd>↓</kbd> <kbd>→</kbd> | Move Character                          |
| <kbd>Shift</kbd> (Hold)                                                                                   | Sprint                                  |
| <kbd>1</kbd>                                                                                              | Select Hoe (Till Soil)                  |
| <kbd>2</kbd>                                                                                              | Select Watering Can (Water Soil)        |
| <kbd>3</kbd>                                                                                              | Select Seed Bag (Plant Selected Crop)   |
| <kbd>4</kbd>                                                                                              | Select Harvest Hand (Pick Mature Crops) |
| <kbd>Space</kbd> / Left Click                                                                             | Use Active Tool / Interact              |
| <kbd>Q</kbd> / <kbd>E</kbd>                                                                               | Rotate Camera View Left / Right         |
| Right-Click Drag / Middle-Click                                                                           | Orbit / Rotate Camera                   |
| Mouse Scroll Wheel                                                                                        | Zoom Camera In / Out                    |
| <kbd>B</kbd> / <kbd>I</kbd>                                                                               | Open Inventory & Seed Selector          |
| <kbd>M</kbd> / <kbd>P</kbd>                                                                               | Open Merchant Shop                      |
| <kbd>Escape</kbd>                                                                                         | Pause Game / Open Settings              |

### 📱 Mobile & Touch Devices

| Touch Element                      | Action                                                    |
| :--------------------------------- | :-------------------------------------------------------- |
| **Virtual Joystick (Bottom Left)** | Smooth 360° Character Movement & Direction                |
| **Action Button (Bottom Right)**   | Primary Tool Action / Interact (Haptic Feedback)          |
| **Quick Toolbelt (Bottom Center)** | Tap to Switch Tools (Hoe, Watering Can, Seeds, Harvest)   |
| **Single-Finger Swipe (Canvas)**   | Orbit / Rotate Isometric Camera View                      |
| **Pinch Gesture (Canvas)**         | Zoom In / Out                                             |
| **Top HUD Icons**                  | Quick Access to Shop, Inventory, Audio Mute, and Settings |

---

## 🏗️ Technical Architecture & Tech Stack

```mermaid
flowchart TB
    subgraph UI ["UI Layer (React 19 & Tailwind CSS)"]
        HUD[HUD & Stats]
        Toolbelt[Toolbelt & SeedPicker]
        Modals[Shop / Inventory / Settings / Offline Modal]
        Joystick[Virtual Touch Joystick]
    end

    subgraph State ["Global State Management (Zustand)"]
        GameStore[Game Store: Inventory, Grid, Pets, Gold]
        UIStore[UI Store: Active Modal, Selected Tool]
        SettingsStore[Settings: Audio Volume, Graphics Quality]
    end

    subgraph Simulation ["Core Simulation & Game Engine"]
        FixedStep[FixedStepLoop (60 Hz)]
        PlotMachine[Farming State Machine & SoilGrid]
        GrowthSys[Growth & Mutation Pipeline]
        WeatherSys[Weather & Hydration Controller]
        PetAI[Pet AI & Follow/Forage Behaviors]
    end

    subgraph Rendering ["3D Render Engine (Three.js & R3F)"]
        GameCanvas[Canvas & Orbit Controls]
        ProceduralMeshes[Procedural Crop & Island Geometries]
        CustomShaders[GLSL Mutation & Water Shaders]
        RapierPhysics[Rapier Physics Character Controller]
        Particles[Weather & Mutation Particle Systems]
    end

    subgraph Audio ["Audio Engine (Web Audio API)"]
        SFXSynth[Procedural Sound Synthesis]
        AmbienceGen[Dynamic Ambient Weather Drone]
    end

    subgraph Persistence ["Storage & Persistence Layer"]
        SaveService[Save Service & Auto-save Worker]
        DexieDB[(IndexedDB Database)]
        ZodSchema[Zod Validation & Migrations]
        OfflineSim[Deterministic Offline Catch-up Engine]
    end

    UI --> State
    State --> Simulation
    Simulation --> Rendering
    Simulation --> Audio
    Simulation --> Persistence
```

### Core Technologies

- **React 19 & TypeScript 5.7**: Component-driven UI and strict type safety.
- **Three.js & React Three Fiber (R3F)**: WebGL declarative scene graphs and 3D rendering.
- **@react-three/drei & @react-three/rapier**: Camera helpers and rigid-body physics simulation.
- **Zustand 5**: High-performance, lightweight reactive state store.
- **Dexie.js & Zod**: Type-safe IndexedDB persistence with versioned schema migrations and runtime validation.
- **Tailwind CSS & Lucide Icons**: Modern, responsive HUD and UI layouts.
- **Vitest & Testing Library**: Comprehensive unit, component, and simulation test suites (810+ tests).
- **Playwright**: End-to-end user journey verification and graphics integration tests.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20.0.0` or higher
- **npm**: `v10.0.0` or higher

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/username/garden-island-3d.git
   cd garden-island-3d
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

---

## 🧪 Verification & Build Scripts

| Command              | Purpose                                                                                    |
| :------------------- | :----------------------------------------------------------------------------------------- |
| `npm run dev`        | Starts Vite local development server with HMR.                                             |
| `npm run build`      | Runs strict typecheck (`tsc --noEmit`) and creates optimized production bundle in `dist/`. |
| `npm run preview`    | Serves the production build locally for testing.                                           |
| `npm run test`       | Executes full Vitest test suite (810 tests across 44 test files).                          |
| `npm run test:watch` | Runs Vitest in interactive watch mode for TDD.                                             |
| `npm run test:e2e`   | Runs Playwright end-to-end browser test suites.                                            |
| `npm run typecheck`  | Validates TypeScript types across the entire project with zero errors.                     |
| `npm run lint`       | Runs ESLint 9 checks to enforce code quality and clean patterns.                           |
| `npm run format`     | Runs Prettier to ensure consistent code formatting.                                        |

---

## 📜 Project Structure

```text
garden-island-3d/
├── e2e/                     # Playwright end-to-end tests
├── src/
│   ├── app/                # Root App component and application layout
│   ├── game/
│   │   ├── audio/          # Procedural Web Audio API sound & ambience synthesizers
│   │   ├── camera/         # Isometric camera controller and orbit bounds
│   │   ├── core/           # Fixed-step game loop, GameClock, coordinate math
│   │   ├── economy/        # Shop pricing, sell values, crop catalog
│   │   ├── effects/        # Particle systems, post-processing, mutation shaders
│   │   ├── farming/        # Soil grid, crop growth, plot state machines, mutations
│   │   ├── input/          # Keyboard, mouse, and touch input handlers
│   │   ├── pets/           # Companion pet AI, behaviors, incubation system
│   │   ├── player/         # Character physics, animations, tool interactions
│   │   ├── weather/        # Dynamic weather renderer, transitions, lighting
│   │   └── world/          # Procedural island meshes, ocean shaders, grid expansion
│   ├── persistence/        # IndexedDB Dexie DB, Zod schemas, migrations, offline sim
│   ├── state/              # Zustand stores (gameStore, uiStore, settingsStore)
│   ├── styles/             # Tailwind CSS stylesheets and design tokens
│   ├── test/               # Test setup, mocks, and sanity helpers
│   └── ui/                 # React UI HUD, Toolbelt, Modals, Mobile Virtual Joystick
├── public/                 # Static assets and icons
├── eslint.config.js        # ESLint flat configuration
├── package.json            # Project dependencies and script runner
├── tailwind.config.ts      # Tailwind styling configuration
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite build and plugin configuration
```

---

## 📄 License

MIT © Garden Island 3D Contributors
