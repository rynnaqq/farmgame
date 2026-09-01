/**
 * Game Constants for Garden Island 3D
 * Defined in accordance with game design specifications (farm.md).
 */

// ==========================================
// 1. Simulation & Timestep
// ==========================================
export const FIXED_TIMESTEP_SEC = 1 / 60; // 0.016666... seconds
export const FIXED_TIMESTEP_MS = 1000 / 60; // ~16.6666 ms
export const MAX_SUB_STEPS = 5;

// ==========================================
// 2. World & Island Dimensions
// ==========================================
export const ISLAND_SIZE = 28; // 28x28 playable grass top
export const ISLAND_WIDTH = 28;
export const ISLAND_DEPTH = 28;
export const ISLAND_FALL_Y_THRESHOLD = -5;
export const PLAYER_SPAWN_POSITION = [0, 0, 0] as const;

// ==========================================
// 3. Grid & Plot Layout
// ==========================================
export const PLOT_SIZE = 1.4; // 1.4 x 1.4 world units
export const PLOT_SPACING = 0.15; // 0.15 units visual separation
export const PLOT_TOTAL_SIZE = PLOT_SIZE + PLOT_SPACING; // 1.55 units per cell

export const STARTING_GRID_SIZE = 4; // 4x4
export const EXPANSION_1_GRID_SIZE = 6; // 6x6
export const EXPANSION_1_COST = 750; // 750 coins
export const EXPANSION_2_GRID_SIZE = 8; // 8x8
export const EXPANSION_2_COST = 3500; // 3,500 coins
export const MAX_GRID_SIZE = 8;

export const GRID_EXPANSIONS = {
  4: { nextSize: 6, cost: 750 },
  6: { nextSize: 8, cost: 3500 },
} as const;

// ==========================================
// 4. Player Movement & Physics
// ==========================================
export const PLAYER_WALK_SPEED = 3.5; // units/sec
export const PLAYER_RUN_SPEED = 5.25; // units/sec

// ==========================================
// 5. Camera Settings
// ==========================================
export const CAMERA_DEFAULT_YAW_DEG = 45;
export const CAMERA_DEFAULT_PITCH_DEG = 40;
export const CAMERA_DEFAULT_DISTANCE = 12;
export const CAMERA_MIN_PITCH_DEG = 15;
export const CAMERA_MAX_PITCH_DEG = 75;
export const CAMERA_MIN_DISTANCE = 0.0;
export const CAMERA_MAX_DISTANCE = 20.0;
export const CAMERA_TARGET_HEIGHT_OFFSET = 1.0;
export const CAMERA_EYE_HEIGHT_OFFSET = 1.35;
export const FIRST_PERSON_DISTANCE_THRESHOLD = 0.8;

// ==========================================
// 6. Interaction Ranges & Reaches
// ==========================================
export const FARMING_REACH = 3.0; // Desktop click / general reach in world units
export const MOBILE_ACTION_REACH = 2.8; // Mobile context button distance
export const MOBILE_ACTION_CONE_DEG = 70; // 70-degree forward cone
export const MERCHANT_INTERACTION_RANGE = 2.5; // Merchant opening range
export const MERCHANT_POSITION = [8.5, 0, 4.2] as const;

// ==========================================
// 7. Mobile Virtual Joystick
// ==========================================
export const JOYSTICK_BASE_DIAMETER = 112; // CSS pixels
export const JOYSTICK_BASE_DIAMETER_SMALL = 96; // CSS pixels for small screens (<380px)
export const JOYSTICK_KNOB_DIAMETER = 48; // CSS pixels
export const JOYSTICK_MAX_TRAVEL = 42; // CSS pixels
export const JOYSTICK_DEADZONE_RATIO = 0.12; // 12% of max travel
export const JOYSTICK_RUN_THRESHOLD = 0.88; // Magnitude >= 0.88
export const JOYSTICK_RUN_TIME_MS = 350; // Sustained for 350ms to run

// ==========================================
// 8. Hydration Durations
// ==========================================
export const HYDRATION_DURATION_BASIC_SEC = 120;
export const HYDRATION_DURATION_BASIC_MS = 120 * 1000;
export const HYDRATION_DURATION_HEATWAVE_SEC = 60;
export const HYDRATION_DURATION_HEATWAVE_MS = 60 * 1000;
export const RAIN_HYDRATION_BUFFER_SEC = 20;
export const RAIN_HYDRATION_BUFFER_MS = 20 * 1000;

// ==========================================
// 9. Crop Stages & Transitions
// ==========================================
export const CROP_STAGE_SPROUT_MAX = 0.3299; // Sprout: 0% - 32.99%
export const CROP_STAGE_MID_MIN = 0.33; // Mid: 33% - 74.99%
export const CROP_STAGE_MID_MAX = 0.7499;
export const CROP_STAGE_GROWN_MIN = 0.75; // Fully grown: 75% - 100%
export const CROP_STAGE_HARVESTABLE = 1.0; // 100%

export const STAGE_TRANSITION_EASE_DURATION_MS = 250;
export const STAGE_TRANSITION_REDUCED_MOTION_MS = 100;

// ==========================================
// 10. Crop Balance & Catalog
// ==========================================
export type CropId = 'carrot' | 'tomato' | 'pumpkin' | 'golden_berry' | 'starfruit';

export interface CropDefinition {
  id: CropId;
  name: string;
  seedCost: number;
  baseGrowthSec: number;
  baseGrowthMs: number;
  baseSalePrice: number;
  visualIdentity: string;
}

export const CROPS: Record<CropId, CropDefinition> = {
  carrot: {
    id: 'carrot',
    name: 'Carrot',
    seedCost: 5,
    baseGrowthSec: 45,
    baseGrowthMs: 45 * 1000,
    baseSalePrice: 12,
    visualIdentity: 'Orange root, layered green leaves',
  },
  tomato: {
    id: 'tomato',
    name: 'Tomato',
    seedCost: 20,
    baseGrowthSec: 90,
    baseGrowthMs: 90 * 1000,
    baseSalePrice: 48,
    visualIdentity: 'Green vine with red fruit clusters',
  },
  pumpkin: {
    id: 'pumpkin',
    name: 'Pumpkin',
    seedCost: 75,
    baseGrowthSec: 180,
    baseGrowthMs: 180 * 1000,
    baseSalePrice: 190,
    visualIdentity: 'Ribbed orange body and curling stem',
  },
  golden_berry: {
    id: 'golden_berry',
    name: 'Golden Berry',
    seedCost: 200,
    baseGrowthSec: 300,
    baseGrowthMs: 300 * 1000,
    baseSalePrice: 550,
    visualIdentity: 'Bush with warm amber berries',
  },
  starfruit: {
    id: 'starfruit',
    name: 'Starfruit',
    seedCost: 500,
    baseGrowthSec: 480,
    baseGrowthMs: 480 * 1000,
    baseSalePrice: 1500,
    visualIdentity: 'Five-point yellow-green fruit',
  },
} as const;

// ==========================================
// 11. Starting Player State
// ==========================================
export const STARTING_COINS = 100;
export const STARTING_CARROT_SEEDS = 5;
export const STARTING_SEEDS: Record<CropId, number> = {
  carrot: 5,
  tomato: 0,
  pumpkin: 0,
  golden_berry: 0,
  starfruit: 0,
};

// ==========================================
// 12. Weather & Mutation Engine
// ==========================================
export type WeatherType = 'sunny' | 'heavy_rain' | 'heatwave' | 'blood_moon';
export type MutationType = 'none' | 'gold' | 'giant' | 'cosmic';

export const WEATHER_DURATION_MIN_SEC = 180;
export const WEATHER_DURATION_MAX_SEC = 300;
export const WEATHER_DURATION_MIN_MS = 180 * 1000;
export const WEATHER_DURATION_MAX_MS = 300 * 1000;
export const WEATHER_TRANSITION_DURATION_SEC = 2;

export interface WeatherDefinition {
  id: WeatherType;
  name: string;
  weight: number;
  growthMultiplier: number;
  mutationType: MutationType;
  mutationChance: number;
  description: string;
}

export const WEATHER_CONFIGS: Record<WeatherType, WeatherDefinition> = {
  sunny: {
    id: 'sunny',
    name: 'Sunny',
    weight: 45,
    growthMultiplier: 1.0,
    mutationType: 'gold',
    mutationChance: 0.05,
    description: 'Blue sky, warm sun, soft clouds',
  },
  heavy_rain: {
    id: 'heavy_rain',
    name: 'Heavy Rain',
    weight: 30,
    growthMultiplier: 1.15,
    mutationType: 'giant',
    mutationChance: 0.08,
    description: 'Dark sky, rain pool, splashes, cooler light',
  },
  heatwave: {
    id: 'heatwave',
    name: 'Heatwave',
    weight: 15,
    growthMultiplier: 1.25,
    mutationType: 'gold',
    mutationChance: 0.08,
    description: 'Warm haze, heat distortion, strong amber light',
  },
  blood_moon: {
    id: 'blood_moon',
    name: 'Blood Moon',
    weight: 10,
    growthMultiplier: 1.05,
    mutationType: 'cosmic',
    mutationChance: 0.03,
    description: 'Red moon, crimson fog, drifting motes',
  },
} as const;

export const MUTATION_MULTIPLIERS: Record<MutationType, number> = {
  none: 1,
  gold: 5,
  giant: 3,
  cosmic: 15,
};

// ==========================================
// 13. Upgrades & Tools
// ==========================================
export const GOLDEN_WATERING_CAN_COST = 1200;
export const GOLDEN_WATERING_CAN_RADIUS = 1; // 3x3 grid around target plot (-1 to +1)

// ==========================================
// 14. Pets & Eggs
// ==========================================
export type PetType = 'dog' | 'bee' | 'pig';
export type EggType = 'common' | 'rare';

export const MAX_PET_INVENTORY = 12;
export const EGG_HATCH_TIME_SEC = 90;
export const EGG_HATCH_TIME_MS = 90 * 1000;
export const EGG_HATCH_DISTANCE = 120; // Units walked

export const PET_FOLLOW_MIN_DISTANCE = 1.5;
export const PET_FOLLOW_MAX_DISTANCE = 2.2;
export const PET_TELEPORT_DISTANCE = 12.0;

export const PET_PERKS = {
  bee: {
    growthSpeedMultiplier: 1.15,
  },
  dog: {
    checkIntervalSec: 1,
    harvestRange: 1.75,
    offlineHarvestDelaySec: 30,
  },
  pig: {
    mutationChanceMultiplier: 1.2, // Relative +20% (e.g. 5% -> 6%)
  },
} as const;

export const DOG_OFFLINE_HARVEST_DELAY_SEC = PET_PERKS.dog.offlineHarvestDelaySec;

export interface EggDefinition {
  id: EggType;
  name: string;
  cost: number;
  weights: Record<PetType, number>;
}

export const EGG_CONFIGS: Record<EggType, EggDefinition> = {
  common: {
    id: 'common',
    name: 'Common Egg',
    cost: 450,
    weights: {
      dog: 60,
      bee: 35,
      pig: 5,
    },
  },
  rare: {
    id: 'rare',
    name: 'Rare Egg',
    cost: 1500,
    weights: {
      pig: 50,
      bee: 30,
      dog: 20,
    },
  },
} as const;

// ==========================================
// 15. Quality & Performance Settings
// ==========================================
export type QualityLevel = 'auto' | 'low' | 'medium' | 'high';

export const QUALITY_CONFIGS = {
  low: {
    pixelRatioCap: 1.0,
    shadowMapSize: 0,
    weatherParticleRatio: 0.3,
    bloom: 'off' as const,
    decorativeDensity: 0.6,
  },
  medium: {
    pixelRatioCap: 1.5,
    shadowMapSize: 1024,
    weatherParticleRatio: 0.65,
    bloom: 'mutations_only' as const,
    decorativeDensity: 0.85,
  },
  high: {
    pixelRatioCapDesktop: 2.0,
    pixelRatioCapMobile: 1.5,
    shadowMapSize: 2048,
    weatherParticleRatio: 1.0,
    bloom: 'mutations_and_weather' as const,
    decorativeDensity: 1.0,
  },
} as const;

// ==========================================
// 16. Persistence & Offline Progression
// ==========================================
export const DB_NAME = 'GardenIslandDB';
export const AUTOSAVE_INTERVAL_SEC = 10;
export const AUTOSAVE_INTERVAL_MS = 10 * 1000;
export const MAX_OFFLINE_PROGRESSION_HOURS = 24;
export const MAX_OFFLINE_PROGRESSION_MS = 24 * 60 * 60 * 1000;
export const CURRENT_SCHEMA_VERSION = 1;
