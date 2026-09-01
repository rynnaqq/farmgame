import React from 'react';
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier';
import { ISLAND_SIZE } from '../core/constants';

/**
 * 28x28 Floating Garden Island with faceted geometry:
 * - Grass top layer (Y = 0)
 * - Earth cliff layers (Y = -0.8 to -3.5)
 * - Stone underside keel (Y = -3.5 to -8.0)
 * - Built-in props: water barrel, merchant stall platform, fences, stepping stones.
 * - Solid Rapier colliders for floor, cliffs, and solid props.
 */
export const GardenIsland: React.FC = () => {
  const halfSize = ISLAND_SIZE / 2; // 14

  return (
    <group name="GardenIsland">
      {/* ========================================== */}
      {/* 1. Main Island Body & Physics Floor        */}
      {/* ========================================== */}
      <RigidBody type="fixed" colliders={false} name="IslandFloor">
        {/* Playable top surface collider */}
        <CuboidCollider args={[halfSize, 0.4, halfSize]} position={[0, -0.4, 0]} />

        {/* 1.1 Grass Top Layer */}
        <mesh position={[0, -0.4, 0]} receiveShadow castShadow>
          <boxGeometry args={[ISLAND_SIZE, 0.8, ISLAND_SIZE]} />
          <meshStandardMaterial
            color="#589E2D"
            roughness={0.8}
            metalness={0.05}
            flatShading
          />
        </mesh>

        {/* Subtle grass edge bevels / skirt */}
        <mesh position={[0, -0.7, 0]} receiveShadow castShadow>
          <boxGeometry args={[ISLAND_SIZE + 0.4, 0.3, ISLAND_SIZE + 0.4]} />
          <meshStandardMaterial
            color="#488624"
            roughness={0.85}
            metalness={0.05}
            flatShading
          />
        </mesh>

        {/* 1.2 Earth Cliff Layers (Mid-section tapering down) */}
        <mesh position={[0, -2.0, 0]} receiveShadow castShadow>
          <boxGeometry args={[ISLAND_SIZE * 0.94, 2.2, ISLAND_SIZE * 0.94]} />
          <meshStandardMaterial
            color="#784B24"
            roughness={0.9}
            metalness={0.0}
            flatShading
          />
        </mesh>

        <mesh position={[0, -3.4, 0]} receiveShadow castShadow>
          <boxGeometry args={[ISLAND_SIZE * 0.84, 1.4, ISLAND_SIZE * 0.84]} />
          <meshStandardMaterial
            color="#633C1B"
            roughness={0.9}
            metalness={0.0}
            flatShading
          />
        </mesh>

        {/* 1.3 Stone Underside Keel (Inverted faceted rock base) */}
        <mesh
          position={[0, -5.8, 0]}
          rotation={[0, Math.PI / 4, 0]}
          receiveShadow
          castShadow
        >
          <coneGeometry args={[ISLAND_SIZE * 0.55, 4.2, 7]} />
          <meshStandardMaterial
            color="#434C56"
            roughness={0.88}
            metalness={0.12}
            flatShading
          />
        </mesh>

        <mesh
          position={[1.5, -7.4, -1.0]}
          rotation={[0.3, 0.5, 0.2]}
          receiveShadow
          castShadow
        >
          <dodecahedronGeometry args={[2.0, 0]} />
          <meshStandardMaterial
            color="#333A42"
            roughness={0.92}
            metalness={0.1}
            flatShading
          />
        </mesh>
      </RigidBody>

      {/* ========================================== */}
      {/* 2. Stepping Stone Paths                   */}
      {/* ========================================== */}
      <group name="SteppingStones" position={[0, 0.015, 0]}>
        {[
          { x: 3.5, z: 0.5, scale: 0.7, rot: 0.2 },
          { x: 4.8, z: 1.2, scale: 0.8, rot: 0.5 },
          { x: 6.0, z: 2.0, scale: 0.75, rot: -0.3 },
          { x: 7.2, z: 2.8, scale: 0.85, rot: 0.1 },
          { x: 8.0, z: 3.6, scale: 0.7, rot: 0.8 },
          { x: 3.6, z: -1.0, scale: 0.75, rot: -0.2 },
          { x: 4.8, z: -1.8, scale: 0.8, rot: 0.4 },
          { x: 5.6, z: -2.4, scale: 0.7, rot: -0.5 },
        ].map((stone, idx) => (
          <mesh
            key={idx}
            position={[stone.x, 0, stone.z]}
            rotation={[0, stone.rot, 0]}
            receiveShadow
          >
            <cylinderGeometry args={[stone.scale * 0.6, stone.scale * 0.7, 0.04, 6]} />
            <meshStandardMaterial
              color="#88929A"
              roughness={0.85}
              metalness={0.1}
              flatShading
            />
          </mesh>
        ))}
      </group>

      {/* ========================================== */}
      {/* 3. Water Well / Water Barrel Station      */}
      {/* ========================================== */}
      <group name="WaterBarrelStation" position={[6.2, 0, -2.8]}>
        <RigidBody type="fixed" colliders={false}>
          <CylinderCollider args={[0.55, 0.6]} position={[0, 0.55, 0]} />

          {/* Stone Base Pad */}
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <cylinderGeometry args={[1.1, 1.2, 0.08, 8]} />
            <meshStandardMaterial
              color="#6C757D"
              roughness={0.88}
              metalness={0.1}
              flatShading
            />
          </mesh>

          {/* Wooden Barrel Body */}
          <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.55, 0.48, 0.95, 10]} />
            <meshStandardMaterial
              color="#6B4423"
              roughness={0.8}
              metalness={0.05}
              flatShading
            />
          </mesh>

          {/* Metal Hoops / Bands */}
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.54, 0.54, 0.06, 10]} />
            <meshStandardMaterial
              color="#2D3748"
              roughness={0.4}
              metalness={0.7}
              flatShading
            />
          </mesh>
          <mesh position={[0, 0.75, 0]}>
            <cylinderGeometry args={[0.57, 0.57, 0.06, 10]} />
            <meshStandardMaterial
              color="#2D3748"
              roughness={0.4}
              metalness={0.7}
              flatShading
            />
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
            <meshStandardMaterial
              color="#784B24"
              roughness={0.75}
              flatShading
            />
          </mesh>
        </RigidBody>
      </group>

      {/* ========================================== */}
      {/* 4. Merchant Stall Area & Counter           */}
      {/* ========================================== */}
      <group name="MerchantStallArea" position={[8.5, 0, 4.2]}>
        <RigidBody type="fixed" colliders={false}>
          {/* Platform Floor */}
          <mesh position={[0, 0.04, 0]} receiveShadow>
            <boxGeometry args={[3.2, 0.08, 2.8]} />
            <meshStandardMaterial
              color="#8B5A2B"
              roughness={0.78}
              metalness={0.05}
              flatShading
            />
          </mesh>

          {/* Counter Collider & Mesh */}
          <CuboidCollider args={[0.9, 0.45, 0.4]} position={[0, 0.45, 0]} />
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.8, 0.85, 0.75]} />
            <meshStandardMaterial
              color="#653D1C"
              roughness={0.75}
              metalness={0.05}
              flatShading
            />
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
              <meshStandardMaterial
                color="#4E2F18"
                roughness={0.8}
                flatShading
              />
            </mesh>
          ))}

          {/* Awning Fabric Canopy */}
          <mesh position={[0, 2.35, 0]} rotation={[0.08, 0, 0]} castShadow>
            <boxGeometry args={[2.0, 0.1, 1.6]} />
            <meshStandardMaterial
              color="#D97706"
              roughness={0.7}
              metalness={0.05}
              flatShading
            />
          </mesh>

          {/* Produce Display Crates */}
          <mesh position={[-0.5, 0.95, -0.05]} castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.18, 0.45]} />
            <meshStandardMaterial
              color="#9A6B38"
              roughness={0.8}
              flatShading
            />
          </mesh>
          <mesh position={[0.4, 0.95, -0.05]} castShadow receiveShadow>
            <boxGeometry args={[0.5, 0.18, 0.45]} />
            <meshStandardMaterial
              color="#9A6B38"
              roughness={0.8}
              flatShading
            />
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
      {/* 5. Perimeter Fences & Edge Barriers        */}
      {/* ========================================== */}
      <group name="PerimeterFences">
        <RigidBody type="fixed" colliders={false}>
          {/* North-East Fence Section */}
          <CuboidCollider args={[3.2, 0.45, 0.15]} position={[8.5, 0.45, -13.0]} />
          <FenceSection startX={5.5} endX={11.5} z={-13.0} />

          {/* North-West Fence Section */}
          <CuboidCollider args={[3.2, 0.45, 0.15]} position={[-8.5, 0.45, -13.0]} />
          <FenceSection startX={-11.5} endX={-5.5} z={-13.0} />

          {/* South-West Fence Section */}
          <CuboidCollider args={[3.2, 0.45, 0.15]} position={[-8.5, 0.45, 13.0]} />
          <FenceSection startX={-11.5} endX={-5.5} z={13.0} />

          {/* South-East Fence Section */}
          <CuboidCollider args={[3.2, 0.45, 0.15]} position={[8.5, 0.45, 13.0]} />
          <FenceSection startX={5.5} endX={11.5} z={13.0} />
        </RigidBody>
      </group>
    </group>
  );
};

// Helper for rendering low-poly wooden fence segments
interface FenceSectionProps {
  startX: number;
  endX: number;
  z: number;
}

const FenceSection: React.FC<FenceSectionProps> = ({ startX, endX, z }) => {
  const postCount = 5;
  const step = (endX - startX) / (postCount - 1);
  const width = Math.abs(endX - startX);
  const midX = (startX + endX) / 2;

  return (
    <group position={[0, 0, 0]}>
      {/* Horizontal Rails */}
      <mesh position={[midX, 0.35, z]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.2, 0.08, 0.08]} />
        <meshStandardMaterial color="#684223" roughness={0.8} flatShading />
      </mesh>
      <mesh position={[midX, 0.65, z]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.2, 0.08, 0.08]} />
        <meshStandardMaterial color="#684223" roughness={0.8} flatShading />
      </mesh>

      {/* Vertical Posts */}
      {Array.from({ length: postCount }).map((_, idx) => (
        <mesh
          key={idx}
          position={[startX + idx * step, 0.45, z]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[0.14, 0.9, 0.14]} />
          <meshStandardMaterial color="#55341B" roughness={0.82} flatShading />
        </mesh>
      ))}
    </group>
  );
};
