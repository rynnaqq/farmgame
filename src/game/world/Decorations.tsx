import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useSettingsStore } from '../../state/settingsStore';
import { CulledGroup } from '../effects/CulledGroup';
import { DECOR_CULL_DISTANCE } from '../effects/culling';

// ==========================================
// Preallocated Geometries for Scene Performance
// ==========================================

const TRUNK_GEO = new THREE.CylinderGeometry(0.18, 0.28, 1.4, 6);
const FOLIAGE_CONE_1_GEO = new THREE.ConeGeometry(1.2, 1.2, 7);
const FOLIAGE_CONE_2_GEO = new THREE.ConeGeometry(0.95, 1.1, 7);
const FOLIAGE_CONE_3_GEO = new THREE.ConeGeometry(0.65, 0.9, 7);
const FLOWER_STEM_GEO = new THREE.CylinderGeometry(0.015, 0.015, 1, 4);
const FLOWER_PETAL_GEO = new THREE.SphereGeometry(0.065, 5, 5);
const GRASS_BLADE_GEO = new THREE.BoxGeometry(0.04, 0.22, 0.16);
const BOULDER_GEO = new THREE.DodecahedronGeometry(1.0, 0);

function treeMaterial(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true });
}

// Shared materials: one instance per color for ALL trees, boulders, flowers
// and grass tufts instead of per-mesh JSX pairs.
const TRUNK_MAT = new THREE.MeshStandardMaterial({
  color: '#5D4037',
  roughness: 0.85,
  flatShading: true,
});
const FOLIAGE_MATS = ['#388E3C', '#2E7D32', '#43A047'].map(treeMaterial);
const BOULDER_MAT = new THREE.MeshStandardMaterial({
  color: '#6B7280',
  roughness: 0.88,
  flatShading: true,
});
const FLOWER_STEM_MAT = new THREE.MeshStandardMaterial({ color: '#4CAF50', roughness: 0.8 });
const GRASS_BLADE_MAT = new THREE.MeshStandardMaterial({
  color: '#68A538',
  roughness: 0.8,
  flatShading: true,
});
const PETAL_MATS = new Map<string, THREE.MeshStandardMaterial>();
function petalMaterial(color: string): THREE.MeshStandardMaterial {
  let mat = PETAL_MATS.get(color);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true });
    PETAL_MATS.set(color, mat);
  }
  return mat;
}

// ==========================================
// Types & Item Definitions
// ==========================================

interface TreeItem {
  id: string;
  x: number;
  z: number;
  scale: number;
  variant: 0 | 1 | 2;
  minDensity: number;
}

interface BoulderItem {
  id: string;
  x: number;
  z: number;
  scale: number;
  rotY: number;
  minDensity: number;
  hasCollision: boolean;
}

interface FlowerClusterItem {
  id: string;
  x: number;
  z: number;
  color: string;
  minDensity: number;
}

interface GrassTuftItem {
  id: string;
  x: number;
  z: number;
  scale: number;
  minDensity: number;
}

// Deterministic list of trees around the perimeter/corners of island (outside 8x8 farm grid)
const TREES: TreeItem[] = [
  // Northwest Corner Grove
  { id: 'tree-nw-1', x: -10.5, z: -10.5, scale: 1.2, variant: 0, minDensity: 0.5 },
  { id: 'tree-nw-2', x: -8.0, z: -11.5, scale: 0.95, variant: 1, minDensity: 0.6 },
  { id: 'tree-nw-3', x: -11.5, z: -7.5, scale: 1.05, variant: 2, minDensity: 0.8 },
  // Northeast Corner Grove
  { id: 'tree-ne-1', x: 10.5, z: -10.5, scale: 1.15, variant: 1, minDensity: 0.5 },
  { id: 'tree-ne-2', x: 11.8, z: -8.0, scale: 0.9, variant: 0, minDensity: 0.7 },
  { id: 'tree-ne-3', x: 8.5, z: -11.0, scale: 1.0, variant: 2, minDensity: 0.9 },
  // Southwest Corner Grove
  { id: 'tree-sw-1', x: -11.0, z: 10.5, scale: 1.25, variant: 2, minDensity: 0.5 },
  { id: 'tree-sw-2', x: -8.5, z: 11.5, scale: 0.95, variant: 0, minDensity: 0.65 },
  { id: 'tree-sw-3', x: -11.5, z: 7.5, scale: 1.0, variant: 1, minDensity: 0.85 },
  // Southeast / Merchant Backdrop Grove
  { id: 'tree-se-1', x: 11.5, z: 10.5, scale: 1.3, variant: 0, minDensity: 0.5 },
  { id: 'tree-se-2', x: 9.0, z: 11.8, scale: 1.0, variant: 2, minDensity: 0.75 },
  { id: 'tree-se-3', x: 12.0, z: 7.5, scale: 0.85, variant: 1, minDensity: 0.95 },
  // West & East edge anchors
  { id: 'tree-w-1', x: -11.8, z: 0.0, scale: 1.1, variant: 0, minDensity: 0.55 },
  { id: 'tree-w-2', x: -11.2, z: -3.0, scale: 0.85, variant: 1, minDensity: 0.8 },
];

// Deterministic rock and boulder clusters
const BOULDERS: BoulderItem[] = [
  { id: 'rock-nw', x: -9.5, z: -9.0, scale: 1.1, rotY: 0.4, minDensity: 0.5, hasCollision: true },
  { id: 'rock-ne', x: 10.0, z: -9.5, scale: 0.9, rotY: 1.2, minDensity: 0.6, hasCollision: true },
  { id: 'rock-sw', x: -9.8, z: 9.2, scale: 1.2, rotY: 0.8, minDensity: 0.5, hasCollision: true },
  { id: 'rock-se', x: 10.5, z: 8.8, scale: 0.8, rotY: 2.1, minDensity: 0.7, hasCollision: true },
  {
    id: 'rock-s-mid',
    x: 0.0,
    z: 12.2,
    scale: 0.85,
    rotY: 1.7,
    minDensity: 0.5,
    hasCollision: true,
  },
  {
    id: 'rock-n-mid',
    x: 0.0,
    z: -12.2,
    scale: 0.9,
    rotY: 0.3,
    minDensity: 0.6,
    hasCollision: true,
  },
  {
    id: 'rock-w-sm',
    x: -10.0,
    z: 3.5,
    scale: 0.5,
    rotY: 0.9,
    minDensity: 0.8,
    hasCollision: false,
  },
  {
    id: 'rock-e-sm',
    x: 10.5,
    z: -2.0,
    scale: 0.55,
    rotY: 1.5,
    minDensity: 0.85,
    hasCollision: false,
  },
];

// Deterministic flower patches
const FLOWERS: FlowerClusterItem[] = [
  { id: 'flower-1', x: -7.5, z: -7.5, color: '#F87171', minDensity: 0.5 },
  { id: 'flower-2', x: -6.5, z: -8.5, color: '#FBBF24', minDensity: 0.6 },
  { id: 'flower-3', x: 7.5, z: -7.5, color: '#60A5FA', minDensity: 0.5 },
  { id: 'flower-4', x: 8.5, z: -6.5, color: '#F472B6', minDensity: 0.7 },
  { id: 'flower-5', x: -7.8, z: 6.8, color: '#FBBF24', minDensity: 0.5 },
  { id: 'flower-6', x: -6.8, z: 7.8, color: '#F87171', minDensity: 0.75 },
  { id: 'flower-7', x: 5.5, z: 6.5, color: '#A78BFA', minDensity: 0.6 },
  { id: 'flower-8', x: 6.8, z: 7.9, color: '#34D399', minDensity: 0.85 },
  { id: 'flower-9', x: -4.0, z: 8.5, color: '#F87171', minDensity: 0.9 },
  { id: 'flower-10', x: 4.0, z: -8.5, color: '#FBBF24', minDensity: 0.9 },
];

// Deterministic grass tufts
const GRASS_TUFTS: GrassTuftItem[] = [
  { id: 'grass-1', x: -8.8, z: -3.0, scale: 0.8, minDensity: 0.5 },
  { id: 'grass-2', x: -9.0, z: 2.0, scale: 0.9, minDensity: 0.6 },
  { id: 'grass-3', x: 8.8, z: -1.0, scale: 0.75, minDensity: 0.5 },
  { id: 'grass-4', x: 9.0, z: 1.0, scale: 0.85, minDensity: 0.7 },
  { id: 'grass-5', x: -3.0, z: -7.9, scale: 0.95, minDensity: 0.5 },
  { id: 'grass-6', x: 3.0, z: -7.9, scale: 0.8, minDensity: 0.65 },
  { id: 'grass-7', x: -3.0, z: 7.9, scale: 0.7, minDensity: 0.8 },
  { id: 'grass-8', x: 3.0, z: 7.9, scale: 0.85, minDensity: 0.85 },
  { id: 'grass-9', x: -10.0, z: -5.0, scale: 1.0, minDensity: 0.9 },
  { id: 'grass-10', x: 10.0, z: 5.0, scale: 0.9, minDensity: 0.95 },
];

// ==========================================
// Subcomponents
// ==========================================

const LowPolyTree: React.FC<{ tree: TreeItem }> = ({ tree }) => {
  const { scale, variant } = tree;

  // Foliage variations
  const primaryColor = FOLIAGE_MATS[variant % FOLIAGE_MATS.length];
  const secondaryColor = FOLIAGE_MATS[(variant + 1) % FOLIAGE_MATS.length];

  return (
    <group position={[tree.x, 0, tree.z]} scale={[scale, scale, scale]}>
      {/* Tree Trunk */}
      <mesh
        geometry={TRUNK_GEO}
        material={TRUNK_MAT}
        position={[0, 0.7, 0]}
        castShadow
        receiveShadow
      />

      {/* Layer 1 - Lower foliage cone */}
      <mesh
        geometry={FOLIAGE_CONE_1_GEO}
        material={primaryColor}
        position={[0, 1.6, 0]}
        castShadow
        receiveShadow
      />

      {/* Layer 2 - Mid foliage cone */}
      <mesh
        geometry={FOLIAGE_CONE_2_GEO}
        material={secondaryColor}
        position={[0, 2.3, 0]}
        castShadow
        receiveShadow
      />

      {/* Layer 3 - Top foliage cone */}
      <mesh
        geometry={FOLIAGE_CONE_3_GEO}
        material={primaryColor}
        position={[0, 2.95, 0]}
        castShadow
        receiveShadow
      />
    </group>
  );
};

const FacetedBoulder: React.FC<{ boulder: BoulderItem }> = ({ boulder }) => {
  const { scale, rotY, hasCollision } = boulder;

  const meshElement = (
    <mesh
      position={[boulder.x, scale * 0.45, boulder.z]}
      rotation={[0.2, rotY, 0.1]}
      scale={[scale * 0.7, scale * 0.7, scale * 0.7]}
      geometry={BOULDER_GEO}
      material={BOULDER_MAT}
      castShadow
      receiveShadow
    />
  );

  if (hasCollision) {
    return (
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[scale * 0.45, scale * 0.45, scale * 0.45]}
          position={[boulder.x, scale * 0.45, boulder.z]}
        />
        {meshElement}
      </RigidBody>
    );
  }

  return meshElement;
};

const FlowerCluster: React.FC<{ flower: FlowerClusterItem }> = ({ flower }) => {
  return (
    <group position={[flower.x, 0, flower.z]}>
      {/* 3 small flower heads in a cluster */}
      {[
        [-0.12, 0.15, -0.08],
        [0.14, 0.18, 0.05],
        [-0.04, 0.12, 0.12],
      ].map(([px, py, pz], idx) => (
        <group key={idx} position={[px, 0, pz]}>
          {/* Green Stem */}
          <mesh
            geometry={FLOWER_STEM_GEO}
            material={FLOWER_STEM_MAT}
            position={[0, py / 2, 0]}
            scale={[1, py, 1]}
          />
          {/* Petal Head (no shadow: tiny, saves shadow-pass calls) */}
          <mesh
            geometry={FLOWER_PETAL_GEO}
            material={petalMaterial(flower.color)}
            position={[0, py, 0]}
          />
        </group>
      ))}
    </group>
  );
};

const GrassTuft: React.FC<{ tuft: GrassTuftItem }> = ({ tuft }) => {
  return (
    <group position={[tuft.x, 0, tuft.z]} scale={[tuft.scale, tuft.scale, tuft.scale]}>
      {[0, Math.PI / 3, (2 * Math.PI) / 3].map((rot, idx) => (
        <mesh
          key={idx}
          geometry={GRASS_BLADE_GEO}
          material={GRASS_BLADE_MAT}
          position={[0, 0.1, 0]}
          rotation={[0.1, rot, 0.05]}
          receiveShadow
        />
      ))}
    </group>
  );
};

// ==========================================
// Main Decorations Component
// ==========================================

export const Decorations: React.FC = () => {
  const effectiveQuality = useSettingsStore((state) => state.effectiveQuality);

  // Density factor from quality settings (Low = 0.6, Medium = 0.85, High = 1.0)
  const currentDensity = useMemo(() => {
    switch (effectiveQuality) {
      case 'low':
        return 0.6;
      case 'high':
        return 1.0;
      case 'medium':
      default:
        return 0.85;
    }
  }, [effectiveQuality]);

  // Filter items based on active density
  const visibleTrees = useMemo(
    () => TREES.filter((t) => t.minDensity <= currentDensity),
    [currentDensity]
  );

  const visibleBoulders = useMemo(
    () => BOULDERS.filter((b) => b.minDensity <= currentDensity),
    [currentDensity]
  );

  const visibleFlowers = useMemo(
    () => FLOWERS.filter((f) => f.minDensity <= currentDensity),
    [currentDensity]
  );

  const visibleGrassTufts = useMemo(
    () => GRASS_TUFTS.filter((g) => g.minDensity <= currentDensity),
    [currentDensity]
  );

  return (
    <group name="WorldDecorations">
      {/* Trees */}
      {visibleTrees.map((tree) => (
        <LowPolyTree key={tree.id} tree={tree} />
      ))}

      {/* Boulders */}
      {visibleBoulders.map((boulder) => (
        <FacetedBoulder key={boulder.id} boulder={boulder} />
      ))}

      {/* Flower Clusters (distance-culled: subpixel noise at range) */}
      {visibleFlowers.map((flower) => (
        <CulledGroup key={flower.id} maxDistance={DECOR_CULL_DISTANCE}>
          <FlowerCluster flower={flower} />
        </CulledGroup>
      ))}

      {/* Grass Tufts (distance-culled: subpixel noise at range) */}
      {visibleGrassTufts.map((tuft) => (
        <CulledGroup key={tuft.id} maxDistance={DECOR_CULL_DISTANCE}>
          <GrassTuft tuft={tuft} />
        </CulledGroup>
      ))}
    </group>
  );
};
