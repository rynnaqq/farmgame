import type React from 'react';
import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { RigidBody, CylinderCollider, CuboidCollider } from '@react-three/rapier';
import type * as THREE from 'three';
import { useGameStore } from '../../state/gameStore';
import { useUiStore } from '../../state/uiStore';
import { MERCHANT_INTERACTION_RANGE, MERCHANT_POSITION } from '../core/constants';
import { StripedStall } from './StripedStall';

export interface MerchantProps {
  position?: [number, number, number];
  onOpenShop?: () => void;
}

/**
 * Procedural low-poly merchant character NPC:
 * - Dressed in a warm merchant apron, linen shirt, and merchant beret
 * - Friendly facial features (smiling eyes, blush, mustache/smile)
 * - Articulated arms resting attentively behind the stall counter
 * - Proximity detection (<= 2.5 units) with floating billboard prompt ("Press E to Open Shop")
 * - Keyboard 'E' shortcut & click/tap interaction opening ShopModal
 * - Rapier physics body preventing player pass-through
 */
export const Merchant: React.FC<MerchantProps> = ({ position = MERCHANT_POSITION, onOpenShop }) => {
  const characterRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  const playerPosition = useGameStore((state) => state.player.position);
  const activeModal = useUiStore((state) => state.activeModal);

  // Calculate distance between player and merchant
  const isNear = useMemo(() => {
    const dx = playerPosition[0] - position[0];
    const dz = playerPosition[2] - position[2];
    const dist = Math.hypot(dx, dz);
    return dist <= MERCHANT_INTERACTION_RANGE;
  }, [playerPosition, position]);

  const handleOpenShop = useCallback(() => {
    if (useUiStore.getState().activeModal !== null) return;
    useUiStore.getState().openModal('shop');
    onOpenShop?.();
  }, [onOpenShop]);

  // Nearest market counter (center SELL + 3 side stalls) for the E shortcut.
  // Side-stall offsets must match the <StripedStall position> props below.
  const nearestCounter = useMemo(() => {
    const counters: { dx: number; dz: number; tab: 'seeds' | 'eggs' | 'upgrades' | null }[] = [
      { dx: 0, dz: 0, tab: null }, // center SELL merchant (shop default tab)
      { dx: -3.4, dz: 0, tab: 'seeds' },
      { dx: -6.8, dz: 0, tab: 'eggs' },
      { dx: 3.4, dz: 0, tab: 'upgrades' },
    ];
    let best: { tab: 'seeds' | 'eggs' | 'upgrades' | null; dist: number } | null = null;
    for (const counter of counters) {
      const dist = Math.hypot(
        playerPosition[0] - (position[0] + counter.dx),
        playerPosition[2] - (position[2] + counter.dz)
      );
      if (dist <= MERCHANT_INTERACTION_RANGE && (!best || dist < best.dist)) {
        best = { tab: counter.tab, dist };
      }
    }
    return best;
  }, [playerPosition, position]);

  // Single market-wide 'E' shortcut: opens the nearest counter's shop tab.
  // (Stalls own no E listener so overlapping ranges can't stack modals.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'e' || e.key === 'E') && nearestCounter && activeModal === null) {
        // Prevent triggering if typing in an input element
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        if (nearestCounter.tab) {
          useUiStore.getState().openModal('shop', { initialTab: nearestCounter.tab });
        } else {
          handleOpenShop();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nearestCounter, activeModal, handleOpenShop]);

  // Subtle procedural idle animation (gentle breathing & head movement)
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (characterRef.current) {
      characterRef.current.position.y = Math.sin(t * 2.0) * 0.015;
    }
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 1.2) * 0.08;
      headRef.current.rotation.z = Math.cos(t * 1.5) * 0.03;
    }
  });

  return (
    <group position={position} name="MerchantNPC">
      {/* 0. Adjacent Festival Marketplace Stalls (Seeds, Eggs, Gear) */}
      <StripedStall
        position={[-3.4, 0, 0]}
        basePosition={position}
        primaryColor="#3B82F6"
        signTitle="SEEDS"
        npcName="Seed Vendor"
        interactionLabel="Buy Seeds"
        tab="seeds"
        displayType="seeds"
      />
      <StripedStall
        position={[-6.8, 0, 0]}
        basePosition={position}
        primaryColor="#F59E0B"
        signTitle="PET EGGS"
        npcName="Pet Handler"
        interactionLabel="Adopt Pets"
        tab="eggs"
        displayType="eggs"
      />
      <StripedStall
        position={[3.4, 0, 0]}
        basePosition={position}
        primaryColor="#10B981"
        signTitle="GEAR"
        npcName="Toolsmith"
        interactionLabel="Upgrades"
        tab="upgrades"
        displayType="tools"
      />

      {/* Physics Collider around NPC */}
      <RigidBody type="fixed" colliders={false} name="MerchantRigidBody">
        <CuboidCollider args={[1.2, 0.45, 0.4]} position={[0, 0.45, 0]} />
        <CylinderCollider args={[0.75, 0.45]} position={[0, 0.75, 0.35]} />

        {/* Wooden Stall Platform Floor */}
        <mesh position={[0, 0.04, 0]} receiveShadow>
          <boxGeometry args={[2.8, 0.08, 2.2]} />
          <meshStandardMaterial color="#683E1C" roughness={0.85} flatShading />
        </mesh>

        {/* Counter */}
        <mesh position={[0, 0.45, 0.35]} castShadow receiveShadow>
          <boxGeometry args={[2.2, 0.85, 0.6]} />
          <meshStandardMaterial color="#7D4F26" roughness={0.8} flatShading />
        </mesh>

        {/* Counter Top Plaque */}
        <mesh position={[0, 0.89, 0.35]} castShadow receiveShadow>
          <boxGeometry args={[2.3, 0.06, 0.7]} />
          <meshStandardMaterial color="#945E2D" roughness={0.75} flatShading />
        </mesh>

        {/* 4 Corner Support Posts */}
        {[
          [-1.0, 1.25, -0.65],
          [1.0, 1.25, -0.65],
          [-1.0, 1.25, 0.65],
          [1.0, 1.25, 0.65],
        ].map(([px, py, pz], idx) => (
          <mesh key={idx} position={[px, py, pz]} castShadow>
            <cylinderGeometry args={[0.045, 0.05, 2.4, 6]} />
            <meshStandardMaterial color="#4A2E16" roughness={0.88} flatShading />
          </mesh>
        ))}

        {/* Red & White Striped Fabric Canopy */}
        <group position={[0, 2.35, 0]} rotation={[0.09, 0, 0]}>
          {[-0.875, -0.525, -0.175, 0.175, 0.525, 0.875].map((sx, idx) => (
            <mesh key={idx} position={[sx, 0, 0]} castShadow>
              <boxGeometry args={[0.34, 0.06, 1.7]} />
              <meshStandardMaterial
                color={idx % 2 === 0 ? '#EF4444' : '#FFFFFF'}
                roughness={0.7}
                flatShading
              />
            </mesh>
          ))}
          {/* Front Scalloped Valance */}
          {[-0.875, -0.525, -0.175, 0.175, 0.525, 0.875].map((sx, idx) => (
            <mesh key={`val-${idx}`} position={[sx, -0.09, 0.84]} castShadow>
              <boxGeometry args={[0.34, 0.15, 0.05]} />
              <meshStandardMaterial
                color={idx % 2 === 0 ? '#EF4444' : '#FFFFFF'}
                roughness={0.7}
                flatShading
              />
            </mesh>
          ))}
        </group>

        {/* Overhead 3D Signboard "SELL" */}
        <group position={[0, 2.75, 0.6]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.7, 0.44, 0.07]} />
            <meshStandardMaterial color="#502E14" roughness={0.85} flatShading />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[1.5, 0.32, 0.03]} />
            <meshStandardMaterial color="#EF4444" roughness={0.6} flatShading />
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[1.1, 0.16, 0.02]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.4} flatShading />
          </mesh>
        </group>

        {/* Produce Crates on Counter */}
        <mesh position={[-0.45, 0.96, 0.35]} castShadow>
          <boxGeometry args={[0.45, 0.16, 0.4]} />
          <meshStandardMaterial color="#A16207" roughness={0.8} flatShading />
        </mesh>
        <mesh position={[-0.45, 1.06, 0.35]}>
          <sphereGeometry args={[0.1, 6, 6]} />
          <meshStandardMaterial color="#EA580C" roughness={0.6} flatShading />
        </mesh>
        <mesh position={[0.45, 0.96, 0.35]} castShadow>
          <boxGeometry args={[0.45, 0.16, 0.4]} />
          <meshStandardMaterial color="#A16207" roughness={0.8} flatShading />
        </mesh>
        <mesh position={[0.45, 1.06, 0.35]}>
          <sphereGeometry args={[0.1, 6, 6]} />
          <meshStandardMaterial color="#DC2626" roughness={0.6} flatShading />
        </mesh>
      </RigidBody>

      {/* Interactive Mesh Group */}
      <group position={[0, 0, 0.35]} rotation={[0, Math.PI, 0]} onClick={handleOpenShop}>
        <group ref={characterRef}>
          {/* ========================================== */}
          {/* 1. Body, Linen Shirt & Merchant Apron      */}
          {/* ========================================== */}
          <group name="MerchantBody" position={[0, 0.55, 0]}>
            {/* Cream Linen Shirt */}
            <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.38, 0.32, 0.24]} />
              <meshStandardMaterial color="#FEF3C7" roughness={0.8} flatShading />
            </mesh>

            {/* Merchant Apron / Vest (Deep Burgundy / Wine) */}
            <mesh position={[0, 0.08, 0.01]} castShadow receiveShadow>
              <boxGeometry args={[0.4, 0.36, 0.25]} />
              <meshStandardMaterial color="#831843" roughness={0.7} flatShading />
            </mesh>

            {/* Apron Pocket */}
            <mesh position={[0, -0.02, 0.14]} castShadow>
              <boxGeometry args={[0.22, 0.14, 0.02]} />
              <meshStandardMaterial color="#9D174D" roughness={0.75} flatShading />
            </mesh>

            {/* Brass Coin / Button Accessories */}
            <mesh position={[-0.07, 0.18, 0.135]}>
              <cylinderGeometry args={[0.02, 0.02, 0.01, 8]} />
              <meshStandardMaterial color="#F59E0B" roughness={0.3} metalness={0.8} />
            </mesh>
            <mesh position={[0.07, 0.18, 0.135]}>
              <cylinderGeometry args={[0.02, 0.02, 0.01, 8]} />
              <meshStandardMaterial color="#F59E0B" roughness={0.3} metalness={0.8} />
            </mesh>

            {/* Pants */}
            <mesh position={[0, -0.26, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.36, 0.32, 0.22]} />
              <meshStandardMaterial color="#1E293B" roughness={0.85} flatShading />
            </mesh>

            {/* Sturdy Boots */}
            <mesh position={[-0.1, -0.48, 0.02]} castShadow receiveShadow>
              <boxGeometry args={[0.13, 0.14, 0.18]} />
              <meshStandardMaterial color="#451A03" roughness={0.8} flatShading />
            </mesh>
            <mesh position={[0.1, -0.48, 0.02]} castShadow receiveShadow>
              <boxGeometry args={[0.13, 0.14, 0.18]} />
              <meshStandardMaterial color="#451A03" roughness={0.8} flatShading />
            </mesh>
          </group>

          {/* ========================================== */}
          {/* 2. Head, Friendly Face & Merchant Cap      */}
          {/* ========================================== */}
          <group ref={headRef} name="MerchantHead" position={[0, 0.98, 0]}>
            {/* Head Block */}
            <mesh position={[0, 0, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.27, 0.27, 0.25]} />
              <meshStandardMaterial color="#FBD38D" roughness={0.65} flatShading />
            </mesh>

            {/* Eyes */}
            <mesh position={[-0.065, 0.03, 0.13]}>
              <boxGeometry args={[0.035, 0.035, 0.01]} />
              <meshStandardMaterial color="#1E293B" roughness={0.4} />
            </mesh>
            <mesh position={[0.065, 0.03, 0.13]}>
              <boxGeometry args={[0.035, 0.035, 0.01]} />
              <meshStandardMaterial color="#1E293B" roughness={0.4} />
            </mesh>

            {/* Rosy Cheeks */}
            <mesh position={[-0.095, -0.03, 0.13]}>
              <boxGeometry args={[0.04, 0.025, 0.01]} />
              <meshStandardMaterial color="#FB7185" roughness={0.6} />
            </mesh>
            <mesh position={[0.095, -0.03, 0.13]}>
              <boxGeometry args={[0.04, 0.025, 0.01]} />
              <meshStandardMaterial color="#FB7185" roughness={0.6} />
            </mesh>

            {/* Friendly Handlebar Mustache / Beard */}
            <mesh position={[0, -0.05, 0.135]} castShadow>
              <boxGeometry args={[0.16, 0.045, 0.025]} />
              <meshStandardMaterial color="#78350F" roughness={0.8} flatShading />
            </mesh>

            {/* Hair */}
            <mesh position={[0, 0.08, -0.02]} castShadow>
              <boxGeometry args={[0.28, 0.12, 0.26]} />
              <meshStandardMaterial color="#78350F" roughness={0.8} flatShading />
            </mesh>

            {/* Merchant Beret / Cap */}
            <mesh position={[0.02, 0.16, -0.01]} rotation={[-0.1, 0.1, -0.15]} castShadow>
              <cylinderGeometry args={[0.22, 0.24, 0.09, 8]} />
              <meshStandardMaterial color="#065F46" roughness={0.65} flatShading />
            </mesh>
            {/* Beret Golden Feather / Coin Accent */}
            <mesh position={[-0.14, 0.2, 0.06]} rotation={[0.2, 0, 0.4]}>
              <boxGeometry args={[0.02, 0.08, 0.04]} />
              <meshStandardMaterial color="#F59E0B" roughness={0.3} metalness={0.7} />
            </mesh>
          </group>

          {/* ========================================== */}
          {/* 3. Arms Resting On / Above Counter         */}
          {/* ========================================== */}
          <group name="MerchantArms">
            {/* Left Arm */}
            <mesh
              position={[-0.24, 0.72, 0.08]}
              rotation={[0.4, 0.2, -0.1]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.1, 0.22, 0.1]} />
              <meshStandardMaterial color="#FEF3C7" roughness={0.8} flatShading />
            </mesh>
            <mesh position={[-0.25, 0.62, 0.18]} rotation={[0.8, 0, 0]} castShadow>
              <boxGeometry args={[0.09, 0.12, 0.09]} />
              <meshStandardMaterial color="#FBD38D" roughness={0.65} flatShading />
            </mesh>

            {/* Right Arm */}
            <mesh
              position={[0.24, 0.72, 0.08]}
              rotation={[0.4, -0.2, 0.1]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[0.1, 0.22, 0.1]} />
              <meshStandardMaterial color="#FEF3C7" roughness={0.8} flatShading />
            </mesh>
            <mesh position={[0.25, 0.62, 0.18]} rotation={[0.8, 0, 0]} castShadow>
              <boxGeometry args={[0.09, 0.12, 0.09]} />
              <meshStandardMaterial color="#FBD38D" roughness={0.65} flatShading />
            </mesh>
          </group>
        </group>
      </group>

      {/* ========================================== */}
      {/* 4. Floating Billboard Interaction Prompt   */}
      {/* ========================================== */}
      {isNear && activeModal === null && (
        <Html position={[0, 2.25, 0]} center distanceFactor={14} pointerEvents="none">
          <div
            data-testid="merchant-proximity-prompt"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/90 border-2 border-amber-400 text-amber-200 font-bold text-xs shadow-2xl backdrop-blur-md animate-bounce select-none pointer-events-none whitespace-nowrap"
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-amber-500 text-slate-950 font-black text-[11px] font-mono shadow-sm">
              E
            </span>
            <span className="tracking-wide">Open Shop</span>
          </div>
        </Html>
      )}
    </group>
  );
};
