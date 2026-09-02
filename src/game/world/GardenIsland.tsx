import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { ISLAND_SIZE } from '../core/constants';

// Shared geometries and materials for grass studs
const STUD_GEO = new THREE.CylinderGeometry(0.18, 0.18, 0.04, 8);
const STUD_MAT = new THREE.MeshStandardMaterial({
  color: '#62D938',
  roughness: 0.72,
  metalness: 0.04,
  flatShading: true,
});

/**
 * Procedural circular studs on grass top surface (Roblox/Lego style as seen in Growden.io)
 */
const GrassStuds: React.FC = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const studPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    const step = 1.15;
    const half = ISLAND_SIZE / 2 - 0.7;
    for (let x = -half; x <= half; x += step) {
      for (let z = -half; z <= half; z += step) {
        // Exclude central farm plot area so planter beds sit flush
        if (Math.abs(x) < 7.2 && Math.abs(z) < 7.2) continue;
        // Exclude merchant platform
        if (x > 8.0 && z > 5.0) continue;
        // Exclude water barrel platform
        if (x > 5.8 && z < -1.8) continue;
        // Exclude outer cliff edges
        if (Math.hypot(x, z) > 13.5) continue;
        positions.push([x, 0.02, z]);
      }
    }
    return positions;
  }, []);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    studPositions.forEach((pos, i) => {
      dummy.position.set(pos[0], pos[1], pos[2]);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [studPositions, dummy]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[STUD_GEO, STUD_MAT, studPositions.length]}
      receiveShadow
    />
  );
};

/**
 * Fluffy procedural low-poly cartoon clouds drifting in the cyan sky
 */
const CartoonClouds: React.FC = () => {
  const cloudsRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.02;
    }
  });

  const cloudConfigs = useMemo(
    () => [
      { radius: 24, angle: 0, y: 14, scale: 1.2 },
      { radius: 26, angle: Math.PI * 0.35, y: 16, scale: 1.4 },
      { radius: 23, angle: Math.PI * 0.7, y: 13.5, scale: 1.1 },
      { radius: 27, angle: Math.PI * 1.1, y: 15, scale: 1.5 },
      { radius: 25, angle: Math.PI * 1.5, y: 14.5, scale: 1.3 },
      { radius: 28, angle: Math.PI * 1.85, y: 16.5, scale: 1.6 },
    ],
    []
  );

  return (
    <group ref={cloudsRef} name="CartoonClouds">
      {cloudConfigs.map((c, idx) => {
        const x = Math.cos(c.angle) * c.radius;
        const z = Math.sin(c.angle) * c.radius;
        return (
          <group key={idx} position={[x, c.y, z]} scale={c.scale}>
            <mesh position={[0, 0, 0]}>
              <dodecahedronGeometry args={[1.8, 1]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.9} flatShading />
            </mesh>
            <mesh position={[1.4, -0.2, 0.2]}>
              <dodecahedronGeometry args={[1.3, 1]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.9} flatShading />
            </mesh>
            <mesh position={[-1.3, -0.1, -0.3]}>
              <dodecahedronGeometry args={[1.2, 1]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.9} flatShading />
            </mesh>
            <mesh position={[0.2, 0.7, -0.2]}>
              <dodecahedronGeometry args={[1.1, 1]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.9} flatShading />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

/**
 * 28x28 Floating Garden Island with faceted geometry:
 * - Grass top layer (Y = 0) with vibrant studded grass
 * - Earth cliff layers (Y = -0.8 to -3.5)
 * - Stone underside keel (Y = -3.5 to -8.0)
 * - Built-in props: water barrel, merchant stall platform, fences, stepping stones.
 * - Solid Rapier colliders for floor, cliffs, and solid props.
 */
export const GardenIsland: React.FC = () => {
  const halfSize = ISLAND_SIZE / 2; // 14

  return (
    <group name="GardenIsland">
      <CartoonClouds />

      {/* ========================================== */}
      {/* 1. Main Island Body & Physics Floor        */}
      {/* ========================================== */}
      <RigidBody type="fixed" colliders={false} name="IslandFloor">
        {/* Playable top surface collider */}
        <CuboidCollider args={[halfSize, 0.4, halfSize]} position={[0, -0.4, 0]} />

        {/* 1.1 Grass Top Layer - Vibrant cheerful green */}
        <mesh position={[0, -0.4, 0]} receiveShadow castShadow>
          <boxGeometry args={[ISLAND_SIZE, 0.8, ISLAND_SIZE]} />
          <meshStandardMaterial color="#55D129" roughness={0.78} metalness={0.04} flatShading />
        </mesh>

        {/* Grass edge bevels / skirt */}
        <mesh position={[0, -0.7, 0]} receiveShadow castShadow>
          <boxGeometry args={[ISLAND_SIZE + 0.4, 0.3, ISLAND_SIZE + 0.4]} />
          <meshStandardMaterial color="#44B91D" roughness={0.82} metalness={0.04} flatShading />
        </mesh>

        {/* 1.2 Earth Cliff Layers (Mid-section tapering down) */}
        <mesh position={[0, -2.0, 0]} receiveShadow castShadow>
          <boxGeometry args={[ISLAND_SIZE * 0.94, 2.2, ISLAND_SIZE * 0.94]} />
          <meshStandardMaterial color="#7A4C22" roughness={0.9} metalness={0.0} flatShading />
        </mesh>

        <mesh position={[0, -3.4, 0]} receiveShadow castShadow>
          <boxGeometry args={[ISLAND_SIZE * 0.84, 1.4, ISLAND_SIZE * 0.84]} />
          <meshStandardMaterial color="#613917" roughness={0.9} metalness={0.0} flatShading />
        </mesh>

        {/* 1.3 Stone Underside Keel (Inverted faceted rock base) */}
        <mesh position={[0, -5.8, 0]} rotation={[0, Math.PI / 4, 0]} receiveShadow castShadow>
          <coneGeometry args={[ISLAND_SIZE * 0.55, 4.2, 7]} />
          <meshStandardMaterial color="#434C56" roughness={0.88} metalness={0.12} flatShading />
        </mesh>

        <mesh position={[1.5, -7.4, -1.0]} rotation={[0.3, 0.5, 0.2]} receiveShadow castShadow>
          <dodecahedronGeometry args={[2.0, 0]} />
          <meshStandardMaterial color="#333A42" roughness={0.92} metalness={0.1} flatShading />
        </mesh>
      </RigidBody>

      {/* Tactile Grass Studs */}
      <GrassStuds />

      {/* ========================================== */}
      {/* 2. Stepping Stone Paths                   */}
      {/* ========================================== */}
      <group name="SteppingStones" position={[0, 0.015, 0]}>
        {[
          // Path to Water Barrel (North-East)
          { x: 3.8, z: -0.5, scale: 0.75, rot: 0.2 },
          { x: 4.8, z: -1.4, scale: 0.8, rot: -0.3 },
          { x: 5.8, z: -2.2, scale: 0.7, rot: 0.4 },
          // Path to Merchant Stall (South-East)
          { x: 6.8, z: 2.8, scale: 0.85, rot: 0.1 },
          { x: 7.8, z: 3.8, scale: 0.8, rot: -0.2 },
          { x: 8.8, z: 4.9, scale: 0.75, rot: 0.3 },
          { x: 9.6, z: 5.9, scale: 0.8, rot: -0.1 },
          { x: 10.4, z: 6.8, scale: 0.85, rot: 0.2 },
          // South Entrance walkway stones
          { x: 0.0, z: 7.2, scale: 0.8, rot: 0.0 },
          { x: 0.0, z: 8.5, scale: 0.85, rot: 0.15 },
          { x: 0.0, z: 9.8, scale: 0.75, rot: -0.1 },
        ].map((stone, idx) => (
          <mesh
            key={idx}
            position={[stone.x, 0, stone.z]}
            rotation={[0, stone.rot, 0]}
            receiveShadow
          >
            <cylinderGeometry args={[stone.scale * 0.6, stone.scale * 0.7, 0.04, 6]} />
            <meshStandardMaterial color="#88929A" roughness={0.85} metalness={0.1} flatShading />
          </mesh>
        ))}
      </group>

      {/* ========================================== */}
      {/* 3. Water Well / Water Barrel Station      */}
      {/* ========================================== */}
      <group name="WaterBarrelStation" position={[7.5, 0, -3.5]}>
        <RigidBody type="fixed" colliders={false}>
          <CylinderCollider args={[0.55, 0.6]} position={[0, 0.55, 0]} />

          {/* Stone Base Pad */}
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <cylinderGeometry args={[1.1, 1.2, 0.08, 8]} />
            <meshStandardMaterial color="#6C757D" roughness={0.88} metalness={0.1} flatShading />
          </mesh>

          {/* Wooden Barrel Body */}
          <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.55, 0.48, 0.95, 10]} />
            <meshStandardMaterial color="#6B4423" roughness={0.8} metalness={0.05} flatShading />
          </mesh>

          {/* Metal Hoops / Bands */}
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.54, 0.54, 0.06, 10]} />
            <meshStandardMaterial color="#2D3748" roughness={0.4} metalness={0.7} flatShading />
          </mesh>
          <mesh position={[0, 0.75, 0]}>
            <cylinderGeometry args={[0.57, 0.57, 0.06, 10]} />
            <meshStandardMaterial color="#2D3748" roughness={0.4} metalness={0.7} flatShading />
          </mesh>

          {/* Water Surface Inside Barrel */}
          <mesh position={[0, 0.92, 0]}>
            <cylinderGeometry args={[0.48, 0.48, 0.02, 10]} />
            <meshStandardMaterial
              color="#3182CE"
              roughness={0.1}
              metalness={0.3}
              transparent
              opacity={0.85}
            />
          </mesh>

          {/* Small Wooden Bucket Nearby */}
          <mesh position={[0.8, 0.25, 0.4]} castShadow receiveShadow>
            <cylinderGeometry args={[0.22, 0.17, 0.42, 8]} />
            <meshStandardMaterial color="#784B24" roughness={0.75} flatShading />
          </mesh>
        </RigidBody>
      </group>

      {/* ========================================== */}
      {/* 4. Merchant Stall Area & Counter (Farther) */}
      {/* ========================================== */}
      <group name="MerchantStallArea" position={[10.8, 0, 7.5]}>
        <RigidBody type="fixed" colliders={false}>
          {/* Platform Floor */}
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <boxGeometry args={[3.2, 0.08, 2.8]} />
            <meshStandardMaterial color="#8B5A2B" roughness={0.78} metalness={0.05} flatShading />
          </mesh>

          {/* Counter Collider & Mesh */}
          <CuboidCollider args={[0.9, 0.45, 0.4]} position={[0, 0.45, 0]} />
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.8, 0.85, 0.75]} />
            <meshStandardMaterial color="#653D1C" roughness={0.75} metalness={0.05} flatShading />
          </mesh>

          {/* Awning Corner Support Posts */}
          {[
            [-0.85, 1.2, -0.6],
            [0.85, 1.2, -0.6],
            [-0.85, 1.2, 0.6],
            [0.85, 1.2, 0.6],
          ].map(([px, py, pz], idx) => (
            <mesh key={idx} position={[px, py, pz]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 2.3, 6]} />
              <meshStandardMaterial color="#4E2F18" roughness={0.8} flatShading />
            </mesh>
          ))}

          {/* Striped Fabric Canopy (Growden.io Festival Stall) */}
          <group position={[0, 2.35, 0]} rotation={[0.08, 0, 0]}>
            {[-0.8, -0.48, -0.16, 0.16, 0.48, 0.8].map((sx, idx) => (
              <mesh key={idx} position={[sx, 0, 0]} castShadow>
                <boxGeometry args={[0.32, 0.08, 1.6]} />
                <meshStandardMaterial
                  color={idx % 2 === 0 ? '#EF4444' : '#FFFFFF'}
                  roughness={0.7}
                  flatShading
                />
              </mesh>
            ))}
            {/* Front overhang valance */}
            {[-0.8, -0.48, -0.16, 0.16, 0.48, 0.8].map((sx, idx) => (
              <mesh key={`val-${idx}`} position={[sx, -0.09, 0.78]} castShadow>
                <boxGeometry args={[0.32, 0.14, 0.05]} />
                <meshStandardMaterial
                  color={idx % 2 === 0 ? '#EF4444' : '#FFFFFF'}
                  roughness={0.7}
                  flatShading
                />
              </mesh>
            ))}
          </group>

          {/* 3D Wooden Signboard */}
          <group position={[0, 2.75, 0.5]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[1.6, 0.4, 0.06]} />
              <meshStandardMaterial color="#502E14" roughness={0.85} flatShading />
            </mesh>
            <mesh position={[0, 0, 0.04]}>
              <boxGeometry args={[1.4, 0.28, 0.02]} />
              <meshStandardMaterial color="#DC2626" roughness={0.7} flatShading />
            </mesh>
          </group>

          {/* Produce Display Crates */}
          <mesh position={[-0.5, 0.95, -0.05]} castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.18, 0.45]} />
            <meshStandardMaterial color="#9A6B38" roughness={0.8} flatShading />
          </mesh>
          <mesh position={[0.4, 0.95, -0.05]} castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.18, 0.45]} />
            <meshStandardMaterial color="#9A6B38" roughness={0.8} flatShading />
          </mesh>

          {/* Crate Carrots and Produce Decor */}
          <mesh position={[-0.5, 1.07, -0.05]}>
            <sphereGeometry args={[0.12, 6, 6]} />
            <meshStandardMaterial color="#EA580C" roughness={0.6} flatShading />
          </mesh>
          <mesh position={[0.4, 1.07, -0.05]}>
            <sphereGeometry args={[0.12, 6, 6]} />
            <meshStandardMaterial color="#DC2626" roughness={0.6} flatShading />
          </mesh>
        </RigidBody>
      </group>

      {/* ========================================== */}
      {/* 5. Farm Garden Enclosure & Perimeter Fences*/}
      {/* ========================================== */}
      <group name="GardenEnclosureFences">
        <RigidBody type="fixed" colliders={false}>
          {/* North Garden Fence (Z = -6.8) */}
          <CuboidCollider args={[6.8, 0.5, 0.15]} position={[0, 0.5, -6.8]} />
          <FenceSection startX={-6.8} endX={6.8} z={-6.8} />

          {/* South Garden Fence with Center Gate (Z = 6.8) */}
          <CuboidCollider args={[2.5, 0.5, 0.15]} position={[-4.2, 0.5, 6.8]} />
          <FenceSection startX={-6.8} endX={-1.6} z={6.8} />
          <CuboidCollider args={[2.5, 0.5, 0.15]} position={[4.2, 0.5, 6.8]} />
          <FenceSection startX={1.6} endX={6.8} z={6.8} />

          {/* 3D Garden Gate Wooden Signs */}
          <GardenEntranceSign />
          <QuickActionSign />

          {/* West Garden Fence (X = -6.8) */}
          <CuboidCollider args={[0.15, 0.5, 6.8]} position={[-6.8, 0.5, 0]} />
          <FenceSection startZ={-6.8} endZ={6.8} x={-6.8} isVertical />

          {/* East Garden Fence with Exit to Merchant (X = 6.8) */}
          <CuboidCollider args={[0.15, 0.5, 4.0]} position={[6.8, 0.5, -2.8]} />
          <FenceSection startZ={-6.8} endZ={1.2} x={6.8} isVertical />
          <CuboidCollider args={[0.15, 0.5, 1.4]} position={[6.8, 0.5, 5.4]} />
          <FenceSection startZ={4.0} endZ={6.8} x={6.8} isVertical />

          {/* Outer Island Edge Safety Barriers */}
          <CuboidCollider args={[3.2, 0.5, 0.15]} position={[8.5, 0.5, -13.0]} />
          <FenceSection startX={5.5} endX={11.5} z={-13.0} />

          <CuboidCollider args={[3.2, 0.5, 0.15]} position={[-8.5, 0.5, -13.0]} />
          <FenceSection startX={-11.5} endX={-5.5} z={-13.0} />

          <CuboidCollider args={[3.2, 0.5, 0.15]} position={[-8.5, 0.5, 13.0]} />
          <FenceSection startX={-11.5} endX={-5.5} z={13.0} />

          <CuboidCollider args={[2.0, 0.5, 0.15]} position={[5.0, 0.5, 13.0]} />
          <FenceSection startX={3.0} endX={7.0} z={13.0} />
        </RigidBody>
      </group>
    </group>
  );
};

/**
 * 3D Wooden Farm Entrance Signboard beside the south gate
 */
const GardenEntranceSign: React.FC = () => {
  return (
    <group position={[2.4, 0, 7.1]} rotation={[0, Math.PI, 0]}>
      {/* Two wooden posts */}
      <mesh position={[-0.7, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.08, 1.2, 8]} />
        <meshStandardMaterial color="#4A2E16" roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0.7, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.08, 1.2, 8]} />
        <meshStandardMaterial color="#4A2E16" roughness={0.85} flatShading />
      </mesh>
      {/* Rustic Signboard Backing */}
      <mesh position={[0, 0.85, 0.02]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.55, 0.08]} />
        <meshStandardMaterial color="#5C381E" roughness={0.8} flatShading />
      </mesh>
      {/* Inset Green Garden Banner */}
      <mesh position={[0, 0.85, 0.07]}>
        <boxGeometry args={[1.6, 0.4, 0.02]} />
        <meshStandardMaterial color="#2E7D32" roughness={0.7} flatShading />
      </mesh>
      {/* Emblem / Plant icon */}
      <mesh position={[0, 0.85, 0.09]}>
        <boxGeometry args={[1.1, 0.18, 0.02]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.5} flatShading />
      </mesh>
    </group>
  );
};

/**
 * 3D Boost / Special Signboard (Growden style)
 */
const QuickActionSign: React.FC = () => {
  return (
    <group position={[-2.4, 0, 7.1]} rotation={[0, Math.PI, 0]}>
      {/* Post */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.08, 1.1, 8]} />
        <meshStandardMaterial color="#4A2E16" roughness={0.85} flatShading />
      </mesh>
      {/* Purple board */}
      <mesh position={[0, 0.8, 0.02]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.48, 0.08]} />
        <meshStandardMaterial color="#4A154B" roughness={0.8} flatShading />
      </mesh>
      {/* Gem icon emblem */}
      <mesh position={[0, 0.8, 0.07]}>
        <octahedronGeometry args={[0.12, 0]} />
        <meshStandardMaterial color="#E879F9" roughness={0.3} metalness={0.2} flatShading />
      </mesh>
    </group>
  );
};

// Helper for rendering chunky low-poly wooden post-and-rail fence segments
interface FenceSectionProps {
  startX?: number;
  endX?: number;
  z?: number;
  startZ?: number;
  endZ?: number;
  x?: number;
  isVertical?: boolean;
}

const FenceSection: React.FC<FenceSectionProps> = ({
  startX = 0,
  endX = 0,
  z = 0,
  startZ = 0,
  endZ = 0,
  x = 0,
  isVertical = false,
}) => {
  if (isVertical) {
    const span = Math.abs(endZ - startZ);
    const postCount = Math.max(2, Math.round(span / 1.8) + 1);
    const step = (endZ - startZ) / (postCount - 1);
    const midZ = (startZ + endZ) / 2;

    return (
      <group position={[0, 0, 0]}>
        {/* Horizontal Rounded Log Rails */}
        <mesh position={[x, 0.35, midZ]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.065, 0.065, span + 0.15, 8]} />
          <meshStandardMaterial color="#6E4424" roughness={0.82} metalness={0.04} flatShading />
        </mesh>
        <mesh position={[x, 0.65, midZ]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.065, 0.065, span + 0.15, 8]} />
          <meshStandardMaterial color="#6E4424" roughness={0.82} metalness={0.04} flatShading />
        </mesh>

        {/* Chunky Vertical Posts */}
        {Array.from({ length: postCount }).map((_, idx) => (
          <group key={idx} position={[x, 0, startZ + idx * step]}>
            <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.1, 0.11, 0.96, 8]} />
              <meshStandardMaterial
                color="#523218"
                roughness={0.85}
                metalness={0.05}
                flatShading
              />
            </mesh>
            {/* Pyramidal post cap */}
            <mesh position={[0, 0.98, 0]} castShadow>
              <coneGeometry args={[0.13, 0.1, 4]} />
              <meshStandardMaterial color="#422510" roughness={0.88} flatShading />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  const span = Math.abs(endX - startX);
  const postCount = Math.max(2, Math.round(span / 1.8) + 1);
  const step = (endX - startX) / (postCount - 1);
  const midX = (startX + endX) / 2;

  return (
    <group position={[0, 0, 0]}>
      {/* Horizontal Rounded Log Rails */}
      <mesh position={[midX, 0.35, z]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.065, 0.065, span + 0.15, 8]} />
        <meshStandardMaterial color="#6E4424" roughness={0.82} metalness={0.04} flatShading />
      </mesh>
      <mesh position={[midX, 0.65, z]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.065, 0.065, span + 0.15, 8]} />
        <meshStandardMaterial color="#6E4424" roughness={0.82} metalness={0.04} flatShading />
      </mesh>

      {/* Chunky Vertical Posts */}
      {Array.from({ length: postCount }).map((_, idx) => (
        <group key={idx} position={[startX + idx * step, 0, z]}>
          <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.1, 0.11, 0.96, 8]} />
            <meshStandardMaterial color="#523218" roughness={0.85} metalness={0.05} flatShading />
          </mesh>
          {/* Pyramidal post cap */}
          <mesh position={[0, 0.98, 0]} castShadow>
            <coneGeometry args={[0.13, 0.1, 4]} />
            <meshStandardMaterial color="#422510" roughness={0.88} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
};
