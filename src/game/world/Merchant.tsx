import type React from 'react';
import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { RigidBody, CylinderCollider } from '@react-three/rapier';
import type * as THREE from 'three';
import { useGameStore } from '../../state/gameStore';
import { useUiStore } from '../../state/uiStore';
import { MERCHANT_INTERACTION_RANGE, MERCHANT_POSITION } from '../core/constants';

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
export const Merchant: React.FC<MerchantProps> = ({
  position = MERCHANT_POSITION,
  onOpenShop,
}) => {
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

  // Desktop 'E' key shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'e' || e.key === 'E') && isNear && activeModal === null) {
        // Prevent triggering if typing in an input element
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }
        e.preventDefault();
        handleOpenShop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNear, activeModal, handleOpenShop]);

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
      {/* Physics Collider around NPC */}
      <RigidBody type="fixed" colliders={false} name="MerchantRigidBody">
        <CylinderCollider args={[0.75, 0.45]} position={[0, 0.75, 0.35]} />
      </RigidBody>

      {/* Interactive Mesh Group */}
      <group
        position={[0, 0, 0.35]}
        rotation={[0, Math.PI, 0]}
        onClick={handleOpenShop}
      >
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
            <mesh position={[-0.24, 0.72, 0.08]} rotation={[0.4, 0.2, -0.1]} castShadow receiveShadow>
              <boxGeometry args={[0.1, 0.22, 0.1]} />
              <meshStandardMaterial color="#FEF3C7" roughness={0.8} flatShading />
            </mesh>
            <mesh position={[-0.25, 0.62, 0.18]} rotation={[0.8, 0, 0]} castShadow>
              <boxGeometry args={[0.09, 0.12, 0.09]} />
              <meshStandardMaterial color="#FBD38D" roughness={0.65} flatShading />
            </mesh>

            {/* Right Arm */}
            <mesh position={[0.24, 0.72, 0.08]} rotation={[0.4, -0.2, 0.1]} castShadow receiveShadow>
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
