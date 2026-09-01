# Product Requirements Document

## Browser-Based 3D Farming Simulator

**Document status:** Approved for implementation  
**Working title:** Garden Island 3D  
**Product type:** Single-player browser game  
**Primary platforms:** Desktop and mobile web  
**Visual direction:** Original low-poly / voxel-inspired 3D  
**Implementation scope:** Complete game, including every requirement in Phases 1–6

---

## 1. Directive to the Implementing AI

Act as a senior full-stack game developer specializing in WebGL, Three.js, React Three Fiber, browser input systems, deterministic simulation, and offline game persistence.

Build the complete game described in this PRD. Do not return only an explanation, prototype, isolated demo, partial scaffold, or code for the first three phases. Implement all required systems, create every source file, run the verification commands, fix failures, and leave the project in a playable production-ready state.

Mandatory delivery rules:

1. Implement all requirements in this document.
2. Use strict TypeScript throughout the application.
3. Do not use pseudocode, ellipses, placeholder functions, fake imports, unfinished TODO comments, or “implement later” stubs.
4. Procedural low-poly geometry is the intended final art style and must look deliberate. Do not use gray placeholder boxes.
5. Do not copy names, logos, maps, characters, UI, meshes, sounds, or other protected content from Growden.io, Grow a Garden, or any other game. The result must have an original identity.
6. Use only dependencies that are necessary and compatible with one another.
7. Keep gameplay logic separate from rendering and UI.
8. All gameplay randomness must be deterministic and based on a persisted seeded random-number generator. Do not use `Math.random()` for mutations, weather, eggs, or any saved outcome.
9. The game must work with keyboard and mouse, touchscreen joystick controls, and touch camera gestures.
10. Do not declare completion until linting, type-checking, unit tests, end-to-end tests, and the production build pass.
11. If operating as a coding agent with filesystem access, create the project directly in the workspace instead of merely pasting file contents.
12. If an output limit prevents a single response, continue in numbered batches without reducing scope, changing architecture, or repeating completed files.

---

## 2. Product Vision

Create a polished, approachable 3D farming simulator that runs entirely in a modern browser. The player explores a compact floating garden island, prepares soil, plants crops, waters them, experiences changing weather, discovers valuable mutations, trades with a merchant, expands the farm, hatches companion pets, and returns later to see meaningful offline progress.

The experience should feel tactile, cheerful, readable, and responsive. Its depth comes from the interaction between farming, weather, mutations, tool upgrades, pets, and an economy—not from a large map or complicated menus.

### 2.1 Core player fantasy

“I am building a small magical garden into a productive, colorful farm, and every weather cycle may produce a rare surprise.”

### 2.2 Core gameplay loop

1. Select a tool or seed.
2. Till an empty plot.
3. Plant a crop.
4. Keep the crop watered while it grows.
5. React to weather and pet perks.
6. Harvest a normal or mutated crop.
7. Sell produce to earn coins.
8. Buy better seeds, eggs, upgrades, and farm expansions.
9. Leave and return to collect offline progress.

### 2.3 Target session

- First session: 10–20 minutes.
- Return session: 2–10 minutes.
- A new player must be able to complete the first till → plant → water → harvest → sell loop within five minutes without external instructions.

---

## 3. Scope

### 3.1 Required

- Original low-poly 3D island and garden.
- Third-person isometric-style camera with smooth follow, orbit, and zoom.
- Animated procedural player with desktop and mobile movement.
- Expandable 4×4, 6×6, and 8×8 plot grids.
- Plot state machine and raycast interactions.
- Five crops with three visible growth stages.
- Four tools, seed selection, and one meaningful watering-can upgrade.
- Dynamic weather with exact gameplay and visual effects.
- Three mutually exclusive crop mutations.
- Coins, seed inventory, produce inventory, shop, selling, upgrades, and expansions.
- Pet egg purchase, incubation, hatching, following, and perks.
- Deterministic IndexedDB saves, autosave, migration, and offline simulation.
- Desktop HUD and responsive mobile HUD with a virtual joystick.
- Audio, settings, onboarding hints, feedback, accessibility basics, and quality scaling.
- Automated tests and production documentation.

### 3.2 Explicit non-goals

- Multiplayer, accounts, authentication, cloud saves, leaderboards, chat, or backend services.
- Real-money purchases, ads, crypto, or gambling mechanics.
- Combat, crafting, housing interiors, breeding, seasons, or large open-world exploration.
- Direct reproduction of another game’s branding or visual design.
- Mandatory external 3D asset downloads.

---

## 4. Technical Baseline

Use stable mutually compatible releases from the following families:

| Area | Required technology |
|---|---|
| Runtime | Node.js 22 LTS |
| Framework | React 19 |
| Build tool | Vite 8 |
| Language | TypeScript 5.x with strict mode |
| Renderer | Three.js through `@react-three/fiber` v9 |
| 3D helpers | `@react-three/drei` |
| Physics | `@react-three/rapier` v2 |
| State | Zustand |
| Styling | Tailwind CSS |
| Persistence | IndexedDB through Dexie; LocalStorage only for tiny display/input settings |
| Validation | Zod for persisted-data validation |
| Testing | Vitest, React Testing Library, and Playwright |
| Formatting/linting | ESLint and Prettier |

Generate and commit a lockfile. Do not mix incompatible React, R3F, or Rapier majors. The project must include these scripts:

| Script | Required behavior |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Run TypeScript checking, then create the production bundle |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint with zero errors |
| `npm run typecheck` | Run TypeScript with no emit |
| `npm run test` | Run all unit and component tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run Playwright desktop and mobile projects |
| `npm run format` | Format supported project files |

### 4.1 Browser support

- Latest two stable versions of Chrome, Edge, Firefox, and Safari.
- Current Chrome on Android.
- Safari on iOS 17 or newer.
- WebGL2 is required.
- If WebGL2 is unavailable or context creation fails, show an accessible full-page explanation and retry button instead of a blank canvas.

### 4.2 Architectural rules

- React components own composition and UI, not high-frequency simulation state.
- Zustand stores own discrete game state, inventory, settings, and commands.
- Mutable refs and the fixed-step loop own per-frame movement and animation data.
- Never call React state setters or broad Zustand updates every animation frame.
- All farming actions pass through atomic command functions that validate range, tool, plot state, inventory, and cost before changing state.
- Persist serializable domain data only. Do not persist Three.js objects, Rapier handles, React refs, functions, or derived meshes.
- Rendering reads domain state and turns it into visual state; rendering must not contain economy or mutation rules.

---

## 5. Required Project Structure

The implementation may split an oversized file further, but it must preserve these module boundaries:

```text
garden-island-3d/
├── public/
│   ├── favicon.svg
│   └── manifest.webmanifest
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── providers.tsx
│   ├── game/
│   │   ├── GameCanvas.tsx
│   │   ├── GameRuntime.tsx
│   │   ├── core/
│   │   │   ├── FixedStepLoop.ts
│   │   │   ├── GameClock.ts
│   │   │   ├── rng.ts
│   │   │   └── constants.ts
│   │   ├── camera/
│   │   │   └── FollowCamera.tsx
│   │   ├── input/
│   │   │   ├── InputManager.ts
│   │   │   ├── KeyboardInput.ts
│   │   │   ├── TouchInput.ts
│   │   │   └── inputTypes.ts
│   │   ├── player/
│   │   │   ├── Player.tsx
│   │   │   ├── PlayerModel.tsx
│   │   │   ├── PlayerController.tsx
│   │   │   └── playerAnimation.ts
│   │   ├── world/
│   │   │   ├── GardenIsland.tsx
│   │   │   ├── SoilGrid.tsx
│   │   │   ├── PlotMesh.tsx
│   │   │   ├── Merchant.tsx
│   │   │   ├── Boundaries.tsx
│   │   │   ├── Decorations.tsx
│   │   │   └── WorldLighting.tsx
│   │   ├── farming/
│   │   │   ├── cropDefinitions.ts
│   │   │   ├── plotMachine.ts
│   │   │   ├── farmingCommands.ts
│   │   │   ├── growthSystem.ts
│   │   │   ├── CropRenderer.tsx
│   │   │   └── mutationVisuals.tsx
│   │   ├── weather/
│   │   │   ├── weatherDefinitions.ts
│   │   │   ├── weatherSystem.ts
│   │   │   └── WeatherRenderer.tsx
│   │   ├── pets/
│   │   │   ├── petDefinitions.ts
│   │   │   ├── petSystem.ts
│   │   │   ├── PetRenderer.tsx
│   │   │   └── EggRenderer.tsx
│   │   ├── economy/
│   │   │   ├── economyDefinitions.ts
│   │   │   ├── economyCommands.ts
│   │   │   └── shopCatalog.ts
│   │   ├── audio/
│   │   │   └── AudioManager.ts
│   │   └── effects/
│   │       ├── ParticlePool.tsx
│   │       └── PostProcessing.tsx
│   ├── state/
│   │   ├── gameStore.ts
│   │   ├── uiStore.ts
│   │   ├── settingsStore.ts
│   │   ├── selectors.ts
│   │   └── storeTypes.ts
│   ├── persistence/
│   │   ├── database.ts
│   │   ├── saveSchema.ts
│   │   ├── saveService.ts
│   │   ├── migrations.ts
│   │   └── offlineSimulation.ts
│   ├── ui/
│   │   ├── HUD.tsx
│   │   ├── Toolbelt.tsx
│   │   ├── SeedPicker.tsx
│   │   ├── InventoryPanel.tsx
│   │   ├── ShopModal.tsx
│   │   ├── EggShop.tsx
│   │   ├── OfflineSummary.tsx
│   │   ├── Tutorial.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── ToastRegion.tsx
│   │   └── mobile/
│   │       ├── VirtualJoystick.tsx
│   │       ├── MobileActionButton.tsx
│   │       └── MobileHUD.tsx
│   ├── styles/
│   │   └── index.css
│   ├── test/
│   │   ├── setup.ts
│   │   └── fixtures.ts
│   ├── main.tsx
│   └── vite-env.d.ts
├── tests/
│   └── e2e/
│       ├── farming-loop.spec.ts
│       ├── persistence.spec.ts
│       ├── mobile-controls.spec.ts
│       └── shop-and-pets.spec.ts
├── index.html
├── package.json
├── playwright.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 6. World, Camera, and Rendering

### 6.1 Garden island

- Create an original floating low-poly island whose playable grass-top footprint is 28×28 world units.
- Use layered, beveled or faceted geometry: grass top, exposed earth sides, stone underside, small rocks, flowers, shrubs, fencing, water barrel, merchant stall, and a few trees.
- The terrain must use a cohesive custom palette and flat or softly faceted shading.
- The farm grid occupies the island center and is aligned to world axes.
- Place the merchant close enough to discover but outside the crop grid.
- Add invisible Rapier colliders around cliffs and solid props.
- The player must never be able to fall permanently off the island. If the player somehow moves below Y = -5, safely respawn at the start point.

### 6.2 Plot grid

- Start with a centered 4×4 grid.
- Expansion 1 unlocks a 6×6 grid and costs 750 coins.
- Expansion 2 unlocks an 8×8 grid and costs 3,500 coins.
- Existing plot IDs and contents must remain unchanged when expanding.
- Each plot is 1.4×1.4 world units with 0.15 units of visual separation.
- Locked plots remain visible beyond the current boundary as subtle stone-bordered grass tiles with a lock indicator.
- Plot IDs use stable row-major coordinates such as `plot-0-0`; never identify persisted plots by array index alone.

### 6.3 Lighting and atmosphere

- Use a hemisphere light plus one shadow-casting directional “sun/moon” light.
- Use ACES filmic tone mapping and correct sRGB output.
- Use soft shadows with a tightly fitted shadow camera.
- Animate light color, intensity, fog, sky gradient, and particles as weather changes.
- Add selective bloom only to Gold and Cosmic mutations and specific weather effects.
- Avoid full-screen blur or excessive bloom that reduces readability.

### 6.4 Quality levels

Provide Auto, Low, Medium, and High quality settings:

| Setting | Low | Medium | High |
|---|---:|---:|---:|
| Pixel ratio cap | 1.0 | 1.5 | 2.0 desktop / 1.5 mobile |
| Shadow map | Off | 1024 | 2048 |
| Weather particles | 30% | 65% | 100% |
| Bloom | Off | Mutations only | Mutations and weather |
| Decorative density | 60% | 85% | 100% |

Auto begins at Medium. If average FPS remains below 45 for five consecutive seconds, step down one level. If average FPS remains above 58 for 30 consecutive seconds, step up one level. Never change more than one level in a 10-second period, and never exceed the device-specific pixel-ratio cap.

---

## 7. Player and Camera Controls

### 7.1 Player

- Build the player from intentional procedural low-poly body parts with a distinct color palette and simple face.
- Use a kinematic Rapier capsule collider.
- Walking speed: 3.5 world units per second.
- Running speed while desktop Shift is held: 5.25 units per second.
- Acceleration and deceleration must be smoothed; do not snap velocity.
- Movement is camera-relative on every platform.
- Rotate the character toward movement direction using shortest-angle interpolation.
- Idle animation: breathing/bobbing and subtle arm motion.
- Walk/run animation: procedural opposing arm and leg swings whose speed follows actual velocity.
- Stop motion and reset animation safely when the browser loses focus or touch input is cancelled.

### 7.2 Camera

Use a third-person camera with an isometric-style default:

- Default yaw: 45 degrees.
- Default pitch: 40 degrees.
- Default distance: 12 units.
- Pitch clamp: 25–65 degrees.
- Zoom clamp: 7–18 units.
- Smoothly follow a point 1.2 units above the player.
- Use damping for target, yaw, pitch, and distance.
- Prevent camera clipping by raycasting from the target toward the desired camera position and moving the camera in front of obstacles.

### 7.3 Desktop controls

| Input | Action |
|---|---|
| WASD / Arrow keys | Move |
| Shift | Run |
| Right mouse drag | Orbit camera |
| Mouse wheel | Zoom |
| Left click on plot | Use selected tool/seed on that plot |
| 1 | Trowel |
| 2 | Watering Can |
| 3 | Seed Bag |
| 4 | Hand/Scythe |
| Q / E while Seed Bag selected | Previous / next seed |
| E near merchant | Open shop |
| Escape | Close top modal or open settings |

Hovering a plot must show a lightweight outline and the valid next action. Plot actions fail if the player is more than 3 world units from the target.

### 7.4 Mobile joystick and touch controls

Mobile controls are mandatory, not an optional enhancement.

#### Virtual joystick

- Show a translucent fixed joystick in the lower-left corner when `pointer: coarse` is detected or Touch Mode is selected.
- Respect `env(safe-area-inset-left)` and `env(safe-area-inset-bottom)`.
- Base diameter: 112 CSS pixels on normal phones and 96 pixels below 380 CSS pixels wide.
- Knob diameter: 48 CSS pixels.
- Maximum knob travel: 42 CSS pixels.
- Radial dead zone: 12% of maximum travel.
- Remap the magnitude after the dead zone from 0–1 and clamp the resulting vector length to 1.
- Acquire pointer capture on pointer down and release on up, cancel, lost capture, page blur, and modal opening.
- Support only the pointer that began the joystick gesture; ignore extra pointers.
- Feed the normalized vector into the same camera-relative movement pipeline as keyboard input.
- If keyboard and joystick are both present, merge their vectors and clamp to length 1.
- The player runs when joystick magnitude is at least 0.88 for 350 ms; otherwise the player walks.
- The joystick must never move the camera, scroll the page, select text, or trigger a plot.

#### Touch camera

- A one-finger drag outside UI and outside the joystick region orbits the camera.
- A two-finger pinch zooms the camera.
- Camera gestures use pointer capture and continue smoothly if a finger moves outside the canvas.
- Touching a HUD control must never rotate the camera.
- Use `touch-action: none` on the game interaction layer, but restore normal touch scrolling inside modal content.

#### Mobile farming actions

- Display a large context action button in the lower-right corner.
- Minimum interactive size: 56×56 CSS pixels.
- It uses the selected tool on the nearest valid plot inside 2.8 units and a 70-degree forward cone.
- Directly tapping an in-range plot also applies the selected tool.
- If a tapped plot is too far away, show “Move closer” and briefly mark the plot; do not move the player automatically.
- Keep the toolbelt centered above the bottom safe area. Make it horizontally scrollable below 480 CSS pixels wide.
- The Seed Bag button opens a compact seed picker above the toolbelt.
- Merchant and pet interactions receive contextual buttons when in range.
- Optional haptic feedback may use `navigator.vibrate(15)` only when supported and enabled in Settings.

#### Responsive behavior

- Support portrait and landscape without forcing orientation.
- Portrait uses compact stat chips and collapsible inventory.
- Landscape uses the wider desktop-like HUD while retaining joystick and action buttons.
- Never render critical controls under a notch, browser home indicator, or system gesture area.
- No gameplay action may rely on hover.

---

## 8. Farming System

### 8.1 Plot state model

Each plot has persistent soil and crop data. The user-facing state is computed using these rules:

1. `Untilled`: soil is not prepared and no crop exists.
2. `Tilled`: soil is prepared, empty, and not hydrated.
3. `Planted`: a crop exists but the plot is not currently hydrated.
4. `Watered`: prepared soil is hydrated; a planted crop can progress.
5. `Harvestable`: crop progress is 100%.

Store soil preparation, crop presence, hydration expiry, and growth progress separately. Do not encode all behavior in one fragile enum.

### 8.2 Valid actions

| Selected item | Preconditions | Result |
|---|---|---|
| Trowel | Untilled, empty plot | Set soil to tilled |
| Trowel | Any other state | No change; explain why |
| Watering Can | Tilled plot, with or without crop | Hydrate plot |
| Seed Bag | Tilled, empty plot; selected seed count > 0 | Consume one seed and create crop at 0% |
| Seed Bag | Invalid plot or no seed | No change; show feedback |
| Hand/Scythe | Crop is mature | Move produce to harvested inventory and clear crop |
| Hand/Scythe | Crop is not mature | No change; show remaining time |

Every command is atomic. Rapid clicks, multi-touch, or the dog pet must not harvest the same crop twice or produce negative inventory.

### 8.3 Hydration

- Basic watering hydrates a plot for 120 real-time seconds.
- Rewatering resets its expiry to current time + 120 seconds; durations do not stack.
- Hydrated soil is darker, slightly reflective, and emits a brief splash particle.
- Crop growth advances only during hydrated time.
- Heavy Rain continuously hydrates every unlocked tilled plot and keeps it hydrated until 20 seconds after the rain ends.
- Heatwave reduces manual hydration duration to 60 seconds.
- An empty watered plot remains watered and can immediately grow a newly planted seed.

### 8.4 Crop stages

Every crop has exactly three clearly different procedural meshes:

- Sprout: progress 0%–32.99%.
- Mid: progress 33%–74.99%.
- Fully Grown: progress 75%–100%.

Only 100% is harvestable. Animate each stage change with a 250 ms ease-out scale transition instead of a hard pop. Reduced Motion shortens this to a 100 ms opacity transition.

### 8.5 Crop balance

Growth time means total hydrated seconds before modifiers.

| Crop | Seed cost | Base growth | Base sale price | Visual identity |
|---|---:|---:|---:|---|
| Carrot | 5 | 45 sec | 12 | Orange root, layered green leaves |
| Tomato | 20 | 90 sec | 48 | Green vine with red fruit clusters |
| Pumpkin | 75 | 180 sec | 190 | Ribbed orange body and curling stem |
| Golden Berry | 200 | 300 sec | 550 | Bush with warm amber berries |
| Starfruit | 500 | 480 sec | 1,500 | Five-point yellow-green fruit |

Starting state:

- 100 coins.
- Five Carrot seeds.
- Zero harvested crops.
- Basic Trowel, Watering Can, Seed Bag, and Hand.
- 4×4 grid.
- No pet.

### 8.6 Growth modifiers

Use multiplicative modifiers:

`effectiveGrowthDelta = hydratedDelta × weatherGrowthMultiplier × petGrowthMultiplier`

- Round progress only for display, never during simulation.
- Clamp progress to the crop’s required duration.
- A crop may mature only once.
- Run the mutation roll exactly when progress first reaches the required duration.

---

## 9. Weather and Mutation Engine

### 9.1 Weather schedule

- The initial weather is Sunny.
- Each weather period lasts a deterministic seeded random duration between 180 and 300 seconds inclusive.
- After the first period, select weather using these weights:

| Weather | Weight |
|---|---:|
| Sunny | 45 |
| Heavy Rain | 30 |
| Heatwave | 15 |
| Blood Moon | 10 |

- Do not select the same weather twice consecutively.
- Persist the current weather, start timestamp, end timestamp, and RNG state.
- Show weather name, icon, and countdown in the HUD.
- Crossfade visuals and audio over 2 seconds.

### 9.2 Weather effects

| Weather | Growth | Hydration behavior | Mutation roll at maturity | Required visuals |
|---|---:|---|---|---|
| Sunny | ×1.00 | Normal 120 sec | 5% Gold | Blue sky, warm sun, soft clouds |
| Heavy Rain | ×1.15 | All tilled plots hydrated | 8% Giant | Dark sky, rain pool, splashes, cooler light |
| Heatwave | ×1.25 while hydrated | Manual water lasts 60 sec | 8% Gold | Warm haze, heat distortion, strong amber light |
| Blood Moon | ×1.05 | Normal 120 sec | 3% Cosmic | Red moon, crimson fog, drifting motes |

### 9.3 Mutation rules

Mutations are mutually exclusive. A crop can have exactly one of:

| Mutation | Value multiplier | Visual behavior |
|---|---:|---|
| None | ×1 | Normal crop |
| Gold | ×5 | Metallic gold palette, subtle pulsing glow, yellow particles |
| Giant | ×3 | Smoothly reaches 2× normal crop scale, grounded correctly |
| Cosmic | ×15 | Controlled animated hue-shift shader, star motes, selective bloom |

At crop maturity:

1. Determine the mutation type associated with the active weather.
2. Multiply the weather chance by the equipped Pig modifier if applicable.
3. Clamp final chance to 100%.
4. Consume exactly one value from the persisted seeded RNG.
5. Store the final mutation permanently on the crop.
6. Never reroll because of reload, remount, visibility change, or rehydration.

The Pig’s “+20% mutation chance” is relative, not 20 percentage points. For example, a 5% chance becomes 6%.

---

## 10. Economy, Inventory, Shop, and Expansion

### 10.1 Currency and inventory

- Coins are non-negative safe integers.
- Seed inventory stores a quantity per crop type.
- Harvested inventory stacks by crop type plus mutation.
- There is no inventory capacity limit in this version.
- Show a compact coin counter at all times.
- Inventory UI must show seed quantity, produce quantity, mutation, unit value, and stack value.

Sale value:

`stackValue = baseSalePrice × mutationMultiplier × quantity`

Use integer coin values only.

### 10.2 Merchant

- Render an original low-poly merchant NPC and stall.
- Opening range: 2.5 world units.
- Desktop opens with E or click/tap.
- Mobile displays a contextual “Shop” button.
- Opening a modal disables player, joystick, camera, and farming input.
- Weather and crop timers continue while a modal is open.

### 10.3 Shop tabs

1. **Seeds:** buy one or buy five of any crop seed when funds permit.
2. **Sell:** sell a selected produce stack or sell all harvested produce.
3. **Upgrades:** buy the Golden Watering Can and plot expansions.
4. **Eggs:** buy Common or Rare eggs.

Purchases and sales must be atomic. Disable unaffordable actions, show exact prices before confirmation, and show a toast after success or failure.

### 10.4 Upgrade

**Golden Watering Can**

- Cost: 1,200 coins.
- Permanent account upgrade.
- Replaces the basic watering action.
- Waters the selected plot and all unlocked plots within one row and column offset, producing a maximum 3×3 area.
- Apply weather-specific hydration duration to each affected plot.
- Never affect locked plots.
- Provide a visible golden tool icon and a larger but pooled splash effect.

### 10.5 Expansion

- The 6×6 upgrade is offered only while the grid is 4×4.
- The 8×8 upgrade is offered only while the grid is 6×6.
- Expanding animates newly unlocked plots in an outward wave, delaying each distance ring by 60 ms and completing the entire effect within 600 ms.
- The save operation must complete immediately after an expansion purchase.

---

## 11. Pet and Companion System

### 11.1 Eggs

| Egg | Cost | Deterministic outcome weights |
|---|---:|---|
| Common Egg | 450 | Dog 60%, Bee 35%, Pig 5% |
| Rare Egg | 1,500 | Pig 50%, Bee 30%, Dog 20% |

- Roll and persist the egg’s outcome when it is purchased, not when it hatches.
- Do not reveal the outcome until hatching.
- Only one egg may incubate at a time.
- Additional purchased eggs remain in egg inventory.
- An incubating egg hatches when either 90 seconds of real time elapse or the player travels 120 world units, whichever occurs first.
- Offline elapsed time advances the timer.
- Pet inventory holds up to 12 pets. Disable egg purchase if all slots are occupied or reserved by eggs.
- Duplicate pet types are allowed.
- Only one pet may be equipped at once.

### 11.2 Pet behavior

- Pets use original procedural low-poly meshes and clear silhouettes.
- The active pet follows 1.5–2.2 units behind the player using smooth steering.
- It teleports to a safe trailing location if farther than 12 units away.
- It avoids obvious jitter and does not physically push the player.
- Add idle personality motion and a brief celebration when a crop mutates or an egg hatches.

### 11.3 Perks

| Pet | Perk |
|---|---|
| Bee | ×1.15 crop growth speed while equipped |
| Dog | Checks once per second and auto-harvests one mature crop within 1.75 units |
| Pig | ×1.20 relative mutation chance while equipped |

Pet perk rules:

- Bee and Pig effects apply at the exact simulation time they are equipped.
- Dog harvesting uses the same atomic harvest command as the player.
- Dog harvest goes into produce inventory and never sells automatically.
- Swapping pets must not retroactively alter completed growth or mutations.
- During offline simulation, Bee and Pig remain active if equipped. An equipped Dog harvests each crop 30 simulated seconds after that crop matures.

---

## 12. Persistence and Offline Progression

### 12.1 Storage

- Use an IndexedDB database named `GardenIslandDB`.
- Use LocalStorage only for volume, quality, reduced motion, haptics, and preferred input mode.
- Autosave every 10 seconds if data is dirty.
- Save immediately after purchases, sales, harvests, planting, expansion, pet changes, and mutations.
- Save on `visibilitychange` when hidden and on `pagehide`.
- Do not depend on `beforeunload` alone.

### 12.2 Save envelope

Persist at minimum:

```ts
interface SaveEnvelope {
  schemaVersion: number;
  savedAtUtcMs: number;
  player: {
    position: [number, number, number];
    coins: number;
    totalDistance: number;
  };
  farm: {
    gridSize: 4 | 6 | 8;
    plots: PlotSaveData[];
    goldenWateringCanOwned: boolean;
  };
  inventory: {
    seeds: Record<CropId, number>;
    produce: ProduceStack[];
    eggs: EggSaveData[];
    pets: PetSaveData[];
    equippedPetId: string | null;
    incubatingEggId: string | null;
  };
  weather: WeatherSaveData;
  rngState: number;
  tutorial: {
    completedSteps: string[];
    dismissed: boolean;
  };
}
```

Use discriminated unions for crop, mutation, weather, pet, and egg IDs. Zod must validate the complete save envelope before it enters the store.

### 12.3 Save integrity and migration

- Start at schema version 1 and implement an explicit migration pipeline.
- A migration transforms version N to N+1 and is covered by a unit test.
- Ignore unknown object keys but reject invalid required values, negative inventory, impossible grid sizes, and non-finite numbers.
- On invalid or unreadable data, preserve the bad record as a dated backup, create a new valid save, and tell the user what happened.
- Never silently erase a valid save.
- Prevent two overlapping writes from applying out of order by serializing saves and coalescing dirty updates.

### 12.4 Offline simulation

On load:

1. Calculate `elapsedMs = nowUtcMs - savedAtUtcMs`.
2. If elapsed time is negative because the clock moved backward, use zero and show a non-blocking warning.
3. Cap credited offline time at 24 hours.
4. Simulate chronologically using event boundaries rather than frame-by-frame iteration.
5. Event boundaries include hydration expiry, weather transition, crop maturity, egg hatch, and Dog auto-harvest.
6. Reconstruct weather transitions from the saved end time and persisted RNG.
7. Apply Heavy Rain hydration, Heatwave water duration, weather growth, equipped pet perks, and mutation rolls exactly as online simulation would.
8. Store every generated outcome and final RNG state.
9. Commit the updated save before showing the game.
10. Show one Offline Summary modal listing elapsed credited time, crop stage changes, mutations, Dog harvests, and newly hatched pets.

Offline processing must be idempotent. Reloading immediately after the summary must not grant progress twice.

---

## 13. HUD and User Experience

### 13.1 Always-visible HUD

- Coins with animated delta feedback.
- Active weather, icon, and countdown.
- Current selected tool and seed.
- Compact seed/produce inventory access.
- Equipped pet icon and perk.
- Settings button.

### 13.2 Toolbelt

Order is fixed:

1. Trowel.
2. Watering Can.
3. Seed Bag.
4. Hand/Scythe.

Requirements:

- Selected tool has more than a color change: use border, scale, and label.
- Disabled actions explain their requirement.
- Show desktop shortcut numbers.
- On mobile, use large touch targets and no hover-only tooltip.
- Seed Bag always shows the selected crop and remaining count.

### 13.3 Feedback

Every action must provide at least two applicable feedback channels:

- Mesh animation.
- Particle effect.
- Sound.
- HUD change.
- Toast or contextual message.
- Optional haptic feedback on mobile.

Use polite, rate-limited feedback. Repeated invalid watering clicks must not create dozens of stacked toasts or sounds.

### 13.4 Tutorial

Create a skippable first-run tutorial that highlights:

1. Movement and camera.
2. Tilling.
3. Seed selection and planting.
4. Watering and crop timer.
5. Harvesting and selling.
6. Weather mutations and pets.

Use device-specific instructions. Never tell a mobile user to press keyboard keys.

### 13.5 Settings

- Master, music/ambience, and SFX volume.
- Mute.
- Quality: Auto/Low/Medium/High.
- Reduced motion.
- Haptics when supported.
- Input mode: Auto/Desktop/Touch.
- Camera sensitivity and invert-Y.
- Reset save behind a two-step confirmation.

---

## 14. Audio and Polish

- Use Web Audio or small legally reusable audio assets stored in the project.
- Audio must not begin before a valid user gesture.
- Include distinct sounds for till, plant, water, harvest, coin transaction, error, mutation, weather transition, egg hatch, and UI click.
- Include subtle looped ambience for the island and weather.
- Crossfade weather ambience.
- Pause or reduce audio when the tab becomes hidden.
- All audio must obey settings and handle unavailable audio APIs without crashing.
- Add a pooled particle system; do not create unbounded particle objects.
- Use 180–300 ms eased transitions for modal, plot stage, mutation, expansion, and HUD updates unless another duration is explicitly defined.
- Reduced Motion disables screen shake, strong camera impulses, heat distortion, and unnecessary looping UI motion.

---

## 15. State and Simulation Contracts

### 15.1 Fixed-step loop

- Simulation step: 1/60 second.
- Accumulate real frame delta and execute fixed steps.
- Cap a frame at five simulation steps to avoid a spiral of death.
- Handle longer hidden-tab time through timestamp reconciliation, not hundreds of catch-up frames.
- Interpolate player movement, camera target, and pet following using the accumulator ratio.

### 15.2 Seeded RNG

Implement a small persisted 32-bit generator such as xorshift32:

- Initial seed comes from cryptographically strong browser randomness when a new save is created.
- Persist its state after every consumed result.
- Centralize all calls in one RNG service.
- Tests must be able to inject a known seed.
- Never consume RNG for purely visual particles, animation variation, or sound pitch; use a separate non-persisted visual random source.

### 15.3 Command results

Farming and economy commands return structured results:

```ts
type CommandResult<T = undefined> =
  | { ok: true; value: T; message?: string }
  | { ok: false; reason: CommandFailureReason; message: string };
```

UI displays the result but never reimplements validation.

---

## 16. Performance Requirements

Targets measured during a full 8×8 farm with mature crops, one active pet, and active weather:

- Desktop target: stable 60 FPS at 1920×1080 on integrated graphics comparable to Intel Iris Xe.
- Mobile target: at least stable 30 FPS and a 60 FPS goal on a mid-range Android device.
- Normal gameplay draw calls: target below 200.
- No per-frame object allocation in core movement, camera, crop, or pet loops.
- Use instancing for plot bases, locked-plot markers, rain, repeated rocks/flowers, and repeated crop parts grouped by crop type, stage, and mutation whenever those meshes share geometry and material.
- Pool splash, harvest, mutation, and weather particles.
- Cap device pixel ratio according to quality level.
- Dispose geometries, materials, textures, render targets, listeners, and physics objects on teardown.
- Lazy-load ShopModal, SettingsModal, OfflineSummary, and the development diagnostics panel.
- Production bundle must not include source maps unless intentionally configured.

Add a development-only diagnostics panel or query flag showing FPS, frame time, draw calls, triangles, active particles, and current quality level. It must be excluded or disabled by default in production.

---

## 17. Accessibility and Safety

- All HTML controls require accessible names and visible focus states.
- Support keyboard navigation inside modals and trap focus while a modal is open.
- Escape closes the top modal.
- Minimum touch target is 44×44 CSS pixels; primary mobile action is at least 56×56.
- Do not communicate crop state, mutation, or affordability through color alone.
- Maintain readable text contrast over the 3D scene.
- Respect reduced-motion preferences on first load.
- Prevent accidental page scrolling, zooming, and text selection during joystick/camera play without blocking scrolling inside modals.
- Handle `pointercancel`, lost pointer capture, page blur, orientation change, resize, and WebGL context loss.
- Collect no personal data and send no telemetry or network gameplay data.

---

## 18. Error and Edge-Case Requirements

The implementation must explicitly handle:

- Planting with zero selected seeds.
- Clicking an already tilled, planted, watered, or harvested plot with the wrong tool.
- Multiple simultaneous pointers.
- Switching from touch to keyboard during a session.
- Opening a modal while a movement pointer is held.
- Browser resize or orientation change during a camera gesture.
- Rapid double-click/tap on harvest, purchase, sale, or expansion.
- Pet and player attempting the same harvest.
- Weather changing on the exact tick a crop matures.
- Crop hydration expiring on the exact maturity boundary.
- Reloading during an egg hatch or mutation.
- A hidden tab resuming after several hours.
- Device clock moving backward or offline time exceeding 24 hours.
- Corrupted, old, or partially written save data.
- IndexedDB unavailable or quota exceeded. Show a clear warning and keep the in-memory session playable; retry later.
- WebGL context loss and restoration.
- Unsupported WebGL2.

Boundary order for equal timestamps is fixed:

1. Apply weather transition.
2. Apply hydration changes caused by the new weather.
3. Advance crop growth.
4. Resolve maturity and mutation under the new active weather.
5. Run pet auto-harvest.
6. Save.

---

## 19. Testing Requirements

### 19.1 Unit tests

Cover at minimum:

- Every valid and invalid plot-state transition.
- Hydration expiry and rewatering.
- Growth stage thresholds.
- Every crop’s base growth and value.
- Weather duration bounds, weights with deterministic fixtures, and no immediate repeat.
- Maturity boundary ordering.
- Gold, Giant, Cosmic, and non-mutated outcomes with injected RNG.
- Pig relative chance calculation.
- Bee growth multiplier.
- Dog online and offline harvesting without duplication.
- Golden Watering Can 3×3 edge/corner behavior.
- Purchase, sale, insufficient-funds, and non-negative inventory rules.
- Grid expansion preserving plots.
- Egg outcome persistence, hatch by timer, and hatch by distance.
- Save validation, serialized writes, and each migration.
- Offline simulation with hydration, multiple weather transitions, mutations, eggs, pets, 24-hour cap, clock rollback, and idempotency.
- Input vector merging, joystick dead zone, magnitude remapping, and cancellation.

### 19.2 Component tests

- Toolbelt keyboard and pointer selection.
- Seed picker quantities.
- Shop focus trapping, disabled states, purchase and sell feedback.
- Mobile joystick pointer capture and cleanup.
- Mobile/desktop HUD switching.
- Offline Summary rendering.
- Settings persistence.

### 19.3 Playwright end-to-end tests

Configure at least:

- Desktop Chromium at 1440×900.
- Mobile Chromium emulating a modern Android viewport with touch.

Required flows:

1. New game → move → till → plant Carrot → water → mature via test clock → harvest → sell.
2. Buy a seed and verify coin/inventory math.
3. Reload and verify player, plots, inventory, weather, and selected upgrade persist.
4. Simulate offline time and verify it is applied once.
5. Buy and hatch an egg with deterministic test seed.
6. Use the virtual joystick, orbit camera by touch, select a tool, and act on a plot.
7. Open the mobile shop and confirm joystick/camera input is disabled.

Use a test-only clock and seed injection available only in development/test builds so tests do not wait for real crop or weather durations.

---

## 20. Implementation Phases

All phases are mandatory and must be completed in order.

### Phase 1 — Foundation and world

- Initialize Vite, React, strict TypeScript, Tailwind, R3F, Drei, Rapier, Zustand, Dexie, testing, linting, and formatting.
- Create Canvas, lighting, camera baseline, island, plot grid, collisions, quality settings, and WebGL fallback.
- Establish domain definitions, RNG, fixed-step loop, and state boundaries.

**Exit condition:** The island renders responsively with a stable camera, collisions, initial grid, and passing foundational tests.

### Phase 2 — Player, camera, and cross-platform input

- Implement procedural player, kinematic movement, animations, camera follow/orbit/zoom, keyboard controls, joystick, touch camera, safe areas, and input cancellation.

**Exit condition:** Player movement and camera are smooth on desktop and mobile; no stuck input occurs after blur, cancel, or modal opening.

### Phase 3 — Farming

- Implement plot commands, raycasting, mobile contextual actions, toolbelt, seed picker, hydration, crop definitions, stage meshes, growth simulation, feedback, and tests.

**Exit condition:** The complete till → plant → water → grow → harvest loop works with all five crops on desktop and mobile.

### Phase 4 — UI, economy, shop, upgrades, and expansion

- Implement HUD, inventory, merchant, responsive modal, buy/sell flows, Golden Watering Can, grid expansion, tutorials, toasts, settings, and accessibility behavior.

**Exit condition:** A player can earn and spend coins, expand the farm, and complete the first-session tutorial.

### Phase 5 — Weather, mutations, visuals, audio, and performance

- Implement deterministic weather, all effects, mutation resolution, shaders/particles, quality levels, audio, diagnostics, pooling, instancing, and performance tuning.

**Exit condition:** All four weather states and three mutations work deterministically and meet the defined performance targets.

### Phase 6 — Pets, persistence, offline simulation, and final QA

- Implement eggs, hatching, pet inventory/equipment/following/perks, IndexedDB, validation, migrations, autosave, offline event simulation, Offline Summary, recovery paths, and all automated tests.

**Exit condition:** Saves and offline progress are deterministic, pet perks work online and offline, production build passes, and all Definition of Done items are satisfied.

---

## 21. Acceptance Criteria

The product is accepted only when all statements are true:

1. The application starts with one documented install command and one development command.
2. It renders a polished original low-poly farm rather than placeholder geometry.
3. Desktop keyboard/mouse controls and mobile joystick/touch controls are both fully playable.
4. Mobile controls respect safe areas and never leave movement stuck.
5. The player can use all four tools and all five crops.
6. Every plot follows the defined state and hydration rules.
7. All three growth stages are visually distinct for every crop.
8. Weather changes every 3–5 minutes with the exact effects and probabilities in this PRD.
9. Mutations are deterministic, permanent, mutually exclusive, and valued correctly.
10. The merchant can buy seeds, sell produce, sell all, buy eggs, upgrade the watering can, and expand the farm.
11. Coins and inventories cannot become negative or duplicate through rapid input.
12. All three pets hatch, follow, equip, and apply their correct online and offline perks.
13. Reloading restores the full game state.
14. Offline progress accounts for hydration, weather, maturity, mutation, pets, eggs, and the 24-hour cap exactly once.
15. Corrupt saves and storage failures produce understandable recovery behavior.
16. The game remains playable at the required desktop and mobile performance targets.
17. UI is responsive in phone portrait, phone landscape, tablet, and desktop layouts.
18. No critical action depends on hover or audio alone.
19. No copyrighted game assets or direct visual copies are included.
20. Lint, typecheck, unit tests, end-to-end tests, and production build all pass.

---

## 22. Required README

The final `README.md` must contain:

- Game overview and screenshots or a clear screenshot capture instruction.
- Exact prerequisites.
- Install, development, test, build, and preview commands.
- Controls table for desktop and mobile.
- Architecture summary.
- Save/offline progression explanation.
- Quality and accessibility settings.
- How to run deterministic test mode.
- Browser requirements.
- Known limitations limited to genuine platform constraints, not unfinished features.

---

## 23. Final Verification and Delivery

Before reporting completion, the implementing AI must:

1. Install dependencies successfully.
2. Run formatting.
3. Run `npm run lint`.
4. Run `npm run typecheck`.
5. Run `npm run test`.
6. Run `npm run build`.
7. Run `npm run test:e2e`.
8. Launch the production preview and manually verify at least one desktop and one mobile viewport.
9. Inspect browser console output and fix uncaught errors, React warnings, resource failures, and leaked event-listener warnings.
10. Report the commands run and their actual outcomes.

Do not claim that the game is complete if any verification step failed, was skipped, or is still running. State any genuine blocker precisely and never replace missing functionality with a claim that it is “outside the current phase,” because all six phases are part of this delivery.

---

## 24. Definition of Done

“Done” means a user can open the browser game on desktop or mobile, control the character with the appropriate inputs, manage and expand a complete farm, experience deterministic weather and rare mutations, participate in a working economy, hatch and use pets, close the game, return later, receive correct offline progress, and continue playing without data loss or developer intervention.

The final result must be cohesive, tested, original, responsive, performant, and complete.
