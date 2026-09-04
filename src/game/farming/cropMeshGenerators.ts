import type { CropId, MutationType } from '../core/constants';
import {
  CROP_STAGE_SPROUT_MAX,
  CROP_STAGE_MID_MAX,
  STAGE_TRANSITION_EASE_DURATION_MS,
} from '../core/constants';

export type CropStage = 'sprout' | 'mid' | 'grown';

export type MeshElementType =
  'cone' | 'cylinder' | 'sphere' | 'box' | 'dodecahedron' | 'torus' | 'star';

export interface MeshElementDef {
  type: MeshElementType;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  args?: number[];
  color: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

export interface CropStageMeshConfig {
  cropId: CropId;
  stage: CropStage;
  description: string;
  primaryColor: string;
  elements: MeshElementDef[];
}

export interface MutationMaterialProps {
  color: string;
  roughness: number;
  metalness: number;
  emissive?: string;
  emissiveIntensity?: number;
  isGold: boolean;
  isCosmic: boolean;
}

/**
 * Resolves the visual stage ('sprout' | 'mid' | 'grown') for a crop.
 * - sprout: 0% to < 33%
 * - mid: 33% to < 75%
 * - grown: >= 75%
 */
export function getCropStage(progressSec: number, baseGrowthSec: number): CropStage {
  if (baseGrowthSec <= 0) {
    return 'grown';
  }
  const ratio = Math.max(0, progressSec) / baseGrowthSec;
  if (ratio <= CROP_STAGE_SPROUT_MAX) {
    return 'sprout';
  }
  if (ratio <= CROP_STAGE_MID_MAX) {
    return 'mid';
  }
  return 'grown';
}

/**
 * Returns clamped progress ratio [0, 1].
 */
export function getCropProgressRatio(progressSec: number, baseGrowthSec: number): number {
  if (baseGrowthSec <= 0) {
    return 1;
  }
  return Math.max(0, Math.min(1, progressSec / baseGrowthSec));
}

/**
 * Returns the scale multiplier for mutation variants.
 * Giant mutation expands to 2x scale cleanly anchored to ground.
 */
export function getMutationScale(mutation: MutationType): number {
  if (mutation === 'giant') {
    return 2.0;
  }
  return 1.0;
}

/**
 * Below this overall growth ratio a freshly planted seed shows nothing yet —
 * just the dark soil spot. The sprout emerges gradually afterwards.
 */
export const CROP_EMERGE_RATIO = 0.02;

/**
 * Continuous growth scale so crops visibly grow from tiny to full size
 * across the whole growth bar (0.25x at emergence → 1.0x at maturity),
 * instead of popping between fixed-size stage meshes.
 */
export function getGrowthScale(ratio: number): number {
  const r = Math.max(0, Math.min(1, ratio));
  const eased = 1 - (1 - r) * (1 - r);
  return 0.25 + 0.75 * eased;
}

/**
 * Returns material properties considering active mutation.
 */
export function getMutationMaterialProps(
  mutation: MutationType,
  defaultColor: string
): MutationMaterialProps {
  switch (mutation) {
    case 'gold':
      return {
        color: '#FFD700',
        roughness: 0.25,
        metalness: 0.85,
        emissive: '#FFB300',
        emissiveIntensity: 0.4,
        isGold: true,
        isCosmic: false,
      };
    case 'cosmic':
      return {
        color: '#AB47BC',
        roughness: 0.3,
        metalness: 0.4,
        emissive: '#7C4DFF',
        emissiveIntensity: 0.6,
        isGold: false,
        isCosmic: true,
      };
    case 'giant':
    case 'none':
    default:
      return {
        color: defaultColor,
        roughness: 0.75,
        metalness: 0.0,
        isGold: false,
        isCosmic: false,
      };
  }
}

/**
 * Calculates transition progress with cubic ease-out.
 */
export function calculateStageTransition(
  elapsedMs: number,
  durationMs: number = STAGE_TRANSITION_EASE_DURATION_MS,
  reducedMotion: boolean = false
): { scale: number; opacity: number } {
  if (durationMs <= 0 || elapsedMs >= durationMs) {
    return { scale: 1.0, opacity: 1.0 };
  }

  const t = Math.max(0, Math.min(1, elapsedMs / durationMs));

  if (reducedMotion) {
    // 100ms quick opacity fade without scale bounce
    return {
      scale: 1.0,
      opacity: 0.4 + 0.6 * t,
    };
  }

  // Ease-out cubic: 1 - (1 - t)^3
  const easeOut = 1 - Math.pow(1 - t, 3);
  const scale = 0.75 + 0.25 * easeOut;
  const opacity = 0.7 + 0.3 * easeOut;

  return { scale, opacity };
}

// ============================================================================
// 15 Procedural Low-Poly Crop Stage Configurations
// ============================================================================

export const CROP_STAGE_CATALOG: Record<CropId, Record<CropStage, CropStageMeshConfig>> = {
  // --------------------------------------------------------------------------
  // 1. CARROT
  // --------------------------------------------------------------------------
  carrot: {
    sprout: {
      cropId: 'carrot',
      stage: 'sprout',
      description: 'Delicate green shoot with twin upright leaf tips',
      primaryColor: '#7CB342',
      elements: [
        {
          type: 'cylinder',
          position: [0, 0.075, 0],
          args: [0.02, 0.02, 0.15, 5],
          color: '#689F38',
        },
        {
          type: 'cone',
          position: [-0.03, 0.15, 0],
          rotation: [0, 0, -0.3],
          args: [0.035, 0.12, 4],
          color: '#7CB342',
        },
        {
          type: 'cone',
          position: [0.03, 0.15, 0],
          rotation: [0, 0, 0.3],
          args: [0.035, 0.12, 4],
          color: '#7CB342',
        },
      ],
    },
    mid: {
      cropId: 'carrot',
      stage: 'mid',
      description: 'Orange root shoulder peaking above soil with branching leaves',
      primaryColor: '#FB8C00',
      elements: [
        // Exposed carrot crown shoulder
        {
          type: 'cylinder',
          position: [0, 0.04, 0],
          args: [0.07, 0.05, 0.08, 6],
          color: '#FB8C00',
        },
        // Central stalk
        {
          type: 'cylinder',
          position: [0, 0.16, 0],
          args: [0.025, 0.03, 0.22, 5],
          color: '#43A047',
        },
        // Leaf stalks
        {
          type: 'cone',
          position: [-0.06, 0.22, 0.03],
          rotation: [0.2, 0, -0.4],
          args: [0.05, 0.18, 4],
          color: '#4CAF50',
        },
        {
          type: 'cone',
          position: [0.06, 0.22, -0.03],
          rotation: [-0.2, 0, 0.4],
          args: [0.05, 0.18, 4],
          color: '#388E3C',
        },
        {
          type: 'cone',
          position: [0, 0.25, 0.05],
          rotation: [0.4, 0, 0],
          args: [0.045, 0.16, 4],
          color: '#43A047',
        },
      ],
    },
    grown: {
      cropId: 'carrot',
      stage: 'grown',
      description: 'Faceted conical orange root with dense feathery greens',
      primaryColor: '#F4511E',
      elements: [
        // Main tapered faceted orange carrot body
        {
          type: 'cone',
          position: [0, 0.16, 0],
          rotation: [Math.PI, 0, 0],
          args: [0.12, 0.32, 6],
          color: '#F4511E',
        },
        // Crown ring
        {
          type: 'cylinder',
          position: [0, 0.32, 0],
          args: [0.11, 0.12, 0.04, 6],
          color: '#FB8C00',
        },
        // Feathery leaves
        {
          type: 'cone',
          position: [0, 0.44, 0],
          args: [0.06, 0.22, 5],
          color: '#2E7D32',
        },
        {
          type: 'cone',
          position: [-0.09, 0.42, 0.06],
          rotation: [0.2, 0.2, -0.5],
          args: [0.065, 0.22, 5],
          color: '#388E3C',
        },
        {
          type: 'cone',
          position: [0.09, 0.42, -0.06],
          rotation: [-0.2, -0.2, 0.5],
          args: [0.065, 0.22, 5],
          color: '#43A047',
        },
        {
          type: 'cone',
          position: [0.06, 0.4, 0.09],
          rotation: [0.5, 0, 0.2],
          args: [0.06, 0.2, 5],
          color: '#2E7D32',
        },
        {
          type: 'cone',
          position: [-0.06, 0.4, -0.09],
          rotation: [-0.5, 0, -0.2],
          args: [0.06, 0.2, 5],
          color: '#388E3C',
        },
      ],
    },
  },

  // --------------------------------------------------------------------------
  // 2. TOMATO
  // --------------------------------------------------------------------------
  tomato: {
    sprout: {
      cropId: 'tomato',
      stage: 'sprout',
      description: 'Slender stem with twin leaves cotyledons',
      primaryColor: '#81C784',
      elements: [
        {
          type: 'cylinder',
          position: [0, 0.07, 0],
          args: [0.02, 0.02, 0.14, 5],
          color: '#81C784',
        },
        {
          type: 'box',
          position: [-0.04, 0.14, 0],
          rotation: [0, 0, -0.35],
          args: [0.07, 0.015, 0.045],
          color: '#66BB6A',
        },
        {
          type: 'box',
          position: [0.04, 0.14, 0],
          rotation: [0, 0, 0.35],
          args: [0.07, 0.015, 0.045],
          color: '#66BB6A',
        },
      ],
    },
    mid: {
      cropId: 'tomato',
      stage: 'mid',
      description: 'Branching vine with small unripe green tomatoes',
      primaryColor: '#8BC34A',
      elements: [
        // Upright stem
        {
          type: 'cylinder',
          position: [0, 0.175, 0],
          args: [0.03, 0.035, 0.35, 6],
          color: '#43A047',
        },
        // Foliage clumps
        {
          type: 'dodecahedron',
          position: [-0.06, 0.22, 0],
          args: [0.08, 0],
          color: '#388E3C',
        },
        {
          type: 'dodecahedron',
          position: [0.06, 0.28, 0.02],
          args: [0.085, 0],
          color: '#2E7D32',
        },
        // Unripe green tomato spheres
        {
          type: 'sphere',
          position: [-0.08, 0.18, 0.07],
          args: [0.055, 6, 6],
          color: '#8BC34A',
        },
        {
          type: 'sphere',
          position: [0.08, 0.23, -0.06],
          args: [0.05, 6, 6],
          color: '#9CCC65',
        },
      ],
    },
    grown: {
      cropId: 'tomato',
      stage: 'grown',
      description: 'Lush leafy vine with bright glossy red tomato clusters',
      primaryColor: '#E53935',
      elements: [
        // Central sturdy vine trunk
        {
          type: 'cylinder',
          position: [0, 0.26, 0],
          args: [0.04, 0.05, 0.52, 6],
          color: '#2E7D32',
        },
        // Dense foliage canopy
        {
          type: 'dodecahedron',
          position: [0, 0.44, 0],
          args: [0.15, 0],
          color: '#2E7D32',
        },
        {
          type: 'dodecahedron',
          position: [-0.12, 0.34, -0.04],
          args: [0.12, 0],
          color: '#388E3C',
        },
        {
          type: 'dodecahedron',
          position: [0.12, 0.36, 0.04],
          args: [0.12, 0],
          color: '#43A047',
        },
        // Ripe red tomato fruits
        {
          type: 'sphere',
          position: [-0.12, 0.24, 0.09],
          args: [0.085, 8, 8],
          color: '#E53935',
        },
        {
          type: 'sphere',
          position: [0.13, 0.28, -0.08],
          args: [0.08, 8, 8],
          color: '#E53935',
        },
        {
          type: 'sphere',
          position: [-0.05, 0.38, -0.1],
          args: [0.075, 8, 8],
          color: '#D32F2F',
        },
        {
          type: 'sphere',
          position: [0.08, 0.18, 0.1],
          args: [0.07, 8, 8],
          color: '#E53935',
        },
        // Green calyx star on top fruit
        {
          type: 'cone',
          position: [-0.12, 0.325, 0.09],
          args: [0.04, 0.03, 5],
          color: '#1B5E20',
        },
      ],
    },
  },

  // --------------------------------------------------------------------------
  // 3. PUMPKIN
  // --------------------------------------------------------------------------
  pumpkin: {
    sprout: {
      cropId: 'pumpkin',
      stage: 'sprout',
      description: 'Stout shoot with broad rounded leaves resting near soil',
      primaryColor: '#66BB6A',
      elements: [
        {
          type: 'cylinder',
          position: [0, 0.06, 0],
          args: [0.03, 0.03, 0.12, 5],
          color: '#81C784',
        },
        {
          type: 'box',
          position: [-0.08, 0.08, 0],
          rotation: [0.15, 0, -0.3],
          args: [0.12, 0.015, 0.1],
          color: '#66BB6A',
        },
        {
          type: 'box',
          position: [0.08, 0.08, 0],
          rotation: [-0.15, 0, 0.3],
          args: [0.12, 0.015, 0.1],
          color: '#66BB6A',
        },
      ],
    },
    mid: {
      cropId: 'pumpkin',
      stage: 'mid',
      description: 'Sprawling vine with young green gourd',
      primaryColor: '#8BC34A',
      elements: [
        // Sprawling vine stem
        {
          type: 'cylinder',
          position: [-0.05, 0.03, 0],
          rotation: [0, 0, Math.PI / 2],
          args: [0.02, 0.02, 0.3, 5],
          color: '#43A047',
        },
        // Green gourd body
        {
          type: 'sphere',
          position: [0.08, 0.1, 0.03],
          scale: [1.1, 0.85, 1.1],
          args: [0.12, 7, 7],
          color: '#8BC34A',
        },
        // Vine leaf
        {
          type: 'box',
          position: [-0.15, 0.04, -0.05],
          rotation: [0.1, 0.4, 0],
          args: [0.13, 0.015, 0.12],
          color: '#388E3C',
        },
      ],
    },
    grown: {
      cropId: 'pumpkin',
      stage: 'grown',
      description: 'Large faceted ribbed orange pumpkin with dark curly stem',
      primaryColor: '#E65100',
      elements: [
        // Main ribbed pumpkin body (squashed sphere)
        {
          type: 'sphere',
          position: [0, 0.16, 0],
          scale: [1.25, 0.88, 1.25],
          args: [0.22, 8, 8],
          color: '#E65100',
        },
        // Secondary facet ribs
        {
          type: 'sphere',
          position: [0, 0.16, 0],
          rotation: [0, Math.PI / 4, 0],
          scale: [1.2, 0.86, 1.2],
          args: [0.21, 8, 8],
          color: '#FB8C00',
        },
        // Curly dark green stem
        {
          type: 'cylinder',
          position: [0.02, 0.33, -0.01],
          rotation: [0.25, 0.4, -0.2],
          args: [0.03, 0.038, 0.12, 5],
          color: '#1B5E20',
        },
        // Sprawling vine leaf
        {
          type: 'box',
          position: [-0.22, 0.03, -0.1],
          rotation: [0.1, -0.3, 0.15],
          args: [0.16, 0.015, 0.14],
          color: '#2E7D32',
        },
      ],
    },
  },

  // --------------------------------------------------------------------------
  // 4. GOLDEN BERRY
  // --------------------------------------------------------------------------
  golden_berry: {
    sprout: {
      cropId: 'golden_berry',
      stage: 'sprout',
      description: 'Delicate woody stem seedling with golden-green apical bud',
      primaryColor: '#AED581',
      elements: [
        {
          type: 'cylinder',
          position: [0, 0.08, 0],
          args: [0.02, 0.025, 0.16, 5],
          color: '#8D6E63',
        },
        {
          type: 'sphere',
          position: [0, 0.17, 0],
          args: [0.04, 6, 6],
          color: '#AED581',
        },
      ],
    },
    mid: {
      cropId: 'golden_berry',
      stage: 'mid',
      description: 'Branching woody bush with developing papery husks',
      primaryColor: '#C0CA33',
      elements: [
        // Woody branching frame
        {
          type: 'cylinder',
          position: [0, 0.15, 0],
          args: [0.025, 0.035, 0.3, 5],
          color: '#6D4C41',
        },
        {
          type: 'cylinder',
          position: [-0.06, 0.22, 0],
          rotation: [0, 0, -0.5],
          args: [0.018, 0.02, 0.16, 5],
          color: '#6D4C41',
        },
        {
          type: 'cylinder',
          position: [0.06, 0.24, 0],
          rotation: [0, 0, 0.5],
          args: [0.018, 0.02, 0.16, 5],
          color: '#6D4C41',
        },
        // Papery husks
        {
          type: 'cone',
          position: [-0.1, 0.25, 0.04],
          rotation: [Math.PI, 0, -0.3],
          args: [0.065, 0.12, 5],
          color: '#C0CA33',
        },
        {
          type: 'cone',
          position: [0.1, 0.28, -0.04],
          rotation: [Math.PI, 0, 0.3],
          args: [0.06, 0.11, 5],
          color: '#DCE775',
        },
      ],
    },
    grown: {
      cropId: 'golden_berry',
      stage: 'grown',
      description: 'Woody shrub with luminous amber glowing berries in open husks',
      primaryColor: '#FFB300',
      elements: [
        // Woody trunk
        {
          type: 'cylinder',
          position: [0, 0.22, 0],
          args: [0.035, 0.05, 0.44, 6],
          color: '#5D4037',
        },
        // Shrub foliage mounds
        {
          type: 'dodecahedron',
          position: [0, 0.38, 0],
          args: [0.16, 0],
          color: '#33691E',
        },
        {
          type: 'dodecahedron',
          position: [-0.14, 0.3, 0.04],
          args: [0.12, 0],
          color: '#558B2F',
        },
        {
          type: 'dodecahedron',
          position: [0.14, 0.32, -0.04],
          args: [0.12, 0],
          color: '#33691E',
        },
        // Luminous glowing amber berries
        {
          type: 'sphere',
          position: [-0.12, 0.24, 0.09],
          args: [0.07, 8, 8],
          color: '#FFB300',
          emissive: '#FF8F00',
          emissiveIntensity: 0.5,
        },
        {
          type: 'sphere',
          position: [0.13, 0.3, -0.07],
          args: [0.065, 8, 8],
          color: '#FFC107',
          emissive: '#FFA000',
          emissiveIntensity: 0.5,
        },
        {
          type: 'sphere',
          position: [0, 0.44, 0.08],
          args: [0.06, 8, 8],
          color: '#FFB300',
          emissive: '#FF8F00',
          emissiveIntensity: 0.5,
        },
        {
          type: 'sphere',
          position: [-0.07, 0.38, -0.1],
          args: [0.065, 8, 8],
          color: '#FFC107',
          emissive: '#FFA000',
          emissiveIntensity: 0.5,
        },
      ],
    },
  },

  // --------------------------------------------------------------------------
  // 5. STARFRUIT
  // --------------------------------------------------------------------------
  starfruit: {
    sprout: {
      cropId: 'starfruit',
      stage: 'sprout',
      description: 'Crystalline star spire shoot with basal leaves',
      primaryColor: '#C0CA33',
      elements: [
        // 5-point star-like spire cone
        {
          type: 'cone',
          position: [0, 0.11, 0],
          args: [0.05, 0.22, 5],
          color: '#C0CA33',
        },
        {
          type: 'box',
          position: [-0.04, 0.04, 0],
          rotation: [0, 0, -0.4],
          args: [0.06, 0.012, 0.035],
          color: '#8BC34A',
        },
        {
          type: 'box',
          position: [0.04, 0.04, 0],
          rotation: [0, 0, 0.4],
          args: [0.06, 0.012, 0.035],
          color: '#8BC34A',
        },
      ],
    },
    mid: {
      cropId: 'starfruit',
      stage: 'mid',
      description: 'Small woody trunk with young ribbed starfruit',
      primaryColor: '#9CCC65',
      elements: [
        // Trunk & branch
        {
          type: 'cylinder',
          position: [0, 0.18, 0],
          args: [0.035, 0.045, 0.36, 5],
          color: '#795548',
        },
        {
          type: 'cylinder',
          position: [0.07, 0.26, 0],
          rotation: [0, 0, 0.6],
          args: [0.02, 0.025, 0.18, 5],
          color: '#795548',
        },
        // Canopy bunch
        {
          type: 'dodecahedron',
          position: [-0.04, 0.36, 0],
          args: [0.12, 0],
          color: '#388E3C',
        },
        // Developing 5-ridge young starfruit
        {
          type: 'cylinder',
          position: [0.14, 0.24, 0.02],
          rotation: [0.3, 0.2, 0.4],
          args: [0.06, 0.06, 0.14, 5],
          color: '#9CCC65',
        },
      ],
    },
    grown: {
      cropId: 'starfruit',
      stage: 'grown',
      description: 'Woody trunk and lush canopy with 5-point starfruit',
      primaryColor: '#FDD835',
      elements: [
        // Sturdy sculpted tree trunk
        {
          type: 'cylinder',
          position: [0, 0.25, 0],
          args: [0.05, 0.07, 0.5, 6],
          color: '#5D4037',
        },
        // Lush crown foliage
        {
          type: 'dodecahedron',
          position: [0, 0.52, 0],
          args: [0.18, 0],
          color: '#2E7D32',
        },
        {
          type: 'dodecahedron',
          position: [-0.15, 0.44, 0.05],
          args: [0.14, 0],
          color: '#388E3C',
        },
        {
          type: 'dodecahedron',
          position: [0.15, 0.46, -0.05],
          args: [0.14, 0],
          color: '#43A047',
        },
        // Distinct 5-point yellow starfruit hanging from canopy
        {
          type: 'cylinder',
          position: [-0.15, 0.36, 0.09],
          rotation: [0.35, 0.2, -0.2],
          args: [0.075, 0.075, 0.18, 5],
          color: '#FDD835',
        },
        {
          type: 'cylinder',
          position: [0.16, 0.38, -0.08],
          rotation: [-0.3, 0.4, 0.25],
          args: [0.08, 0.08, 0.19, 5],
          color: '#FBC02D',
        },
        {
          type: 'cylinder',
          position: [0.05, 0.32, -0.14],
          rotation: [0.4, -0.3, 0.3],
          args: [0.07, 0.07, 0.17, 5],
          color: '#FFEE58',
        },
      ],
    },
  },
};

export interface CosmicMote {
  position: [number, number, number];
  size: number;
  color: string;
}

export const COSMIC_COLORS = ['#E040FB', '#7C4DFF', '#00E5FF', '#FF4081', '#B388FF'];

/**
 * Calculates 8 deterministic orbiting star mote positions around a crop.
 */
export function getCosmicMotePositions(timeSec: number): CosmicMote[] {
  const motes: CosmicMote[] = [];
  const count = 8;
  const baseRadius = 0.38;

  for (let i = 0; i < count; i++) {
    const angleOffset = (i * Math.PI * 2) / count;
    const speed = 0.8 + (i % 3) * 0.3;
    const currentAngle = angleOffset + timeSec * speed;
    const radius = baseRadius + (i % 2 === 0 ? 0.08 : -0.06);

    const x = Math.cos(currentAngle) * radius;
    const z = Math.sin(currentAngle) * radius;
    const y = 0.15 + i * 0.05 + Math.sin(timeSec * 2 + i) * 0.06;
    const size = 0.02 + (i % 3) * 0.01;
    const color = COSMIC_COLORS[i % COSMIC_COLORS.length];

    motes.push({
      position: [x, y, z],
      size,
      color,
    });
  }

  return motes;
}

/**
 * Calculates animated cycling cosmic hex color.
 */
export function calculateCosmicColor(timeSec: number): string {
  const t = (timeSec * 0.5) % (Math.PI * 2);
  const r = Math.floor(180 + Math.sin(t) * 75);
  const g = Math.floor(60 + Math.cos(t) * 40);
  const b = Math.floor(220 + Math.sin(t + 2) * 35);

  const clamp = (val: number) => Math.max(0, Math.min(255, val)).toString(16).padStart(2, '0');
  return `#${clamp(r)}${clamp(g)}${clamp(b)}`;
}
