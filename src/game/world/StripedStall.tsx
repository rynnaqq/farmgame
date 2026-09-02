import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import type * as THREE from 'three';
import { useGameStore } from '../../state/gameStore';
import { useUiStore } from '../../state/uiStore';
import type { ShopTabId } from '../../ui/ShopModal';

export interface StripedStallProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  primaryColor: string;
  secondaryColor?: string;
  signTitle: string;
  npcName: string;
  interactionLabel: string;
  tab: ShopTabId;
  displayType: 'eggs' | 'seeds' | 'produce' | 'tools';
}

export const StripedStall: React.FC<StripedStallProps> = ({
  position,
  rotation = [0, 0, 0],
  primaryColor,
  secondaryColor = '#FFFFFF',
  signTitle,
  npcName,
  interactionLabel,
  tab,
  displayType,
}) => {
  const playerPosition = useGameStore((state) => state.player.position);
  const activeModal = useUiStore((state) => state.activeModal);
  const headRef = useRef<THREE.Group>(null);
  const characterRef = useRef<THREE.Group>(null);

  // Proximity check (within 3.0 meters)
  const isNear = useMemo(() => {
    const dx = playerPosition[0] - position[0];
    const dz = playerPosition[2] - position[2];
    return Math.hypot(dx, dz) <= 3.2;
  }, [playerPosition, position]);

  const handleOpenStall = useCallback(() => {
    if (useUiStore.getState().activeModal !== null) return;
    useUiStore.getState().openModal('shop', { initialTab: tab });
  }, [tab]);

  // Keyboard shortcut E when near
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'e' || e.key === 'E') && isNear && activeModal === null) {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        handleOpenStall();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNear, activeModal, handleOpenStall]);

  // Idle animation for NPC
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (characterRef.current) {
      characterRef.current.position.y = Math.sin(t * 2.2 + position[0]) * 0.012;
    }
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 1.3 + position[0]) * 0.1;
    }
  });

  const stripes = useMemo(() => {
    const colors = [
      primaryColor,
      secondaryColor,
      primaryColor,
      secondaryColor,
      primaryColor,
      secondaryColor,
    ];
    return colors.map((col, idx) => ({
      color: col,
      x: -1.05 + idx * 0.35 + 0.175,
    }));
  }, [primaryColor, secondaryColor]);

  return (
    <group position={position} rotation={rotation} name={`Stall-${signTitle}`}>
      {/* Physics Solid Base & Counter */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.2, 0.45, 0.4]} position={[0, 0.45, 0]} />

        {/* 1. Wooden Floor Platform */}
        <mesh position={[0, 0.04, 0]} receiveShadow>
          <boxGeometry args={[2.8, 0.08, 2.2]} />
          <meshStandardMaterial color="#683E1C" roughness={0.85} flatShading />
        </mesh>

        {/* 2. Front Counter */}
        <mesh position={[0, 0.45, 0.35]} castShadow receiveShadow>
          <boxGeometry args={[2.2, 0.85, 0.6]} />
          <meshStandardMaterial color="#7D4F26" roughness={0.8} flatShading />
        </mesh>

        {/* Counter Top Wooden Plaque */}
        <mesh position={[0, 0.89, 0.35]} castShadow receiveShadow>
          <boxGeometry args={[2.3, 0.06, 0.7]} />
          <meshStandardMaterial color="#945E2D" roughness={0.75} flatShading />
        </mesh>

        {/* 3. Four Corner Support Posts */}
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

        {/* 4. Striped Fabric Canopy */}
        <group position={[0, 2.35, 0]} rotation={[0.09, 0, 0]}>
          {stripes.map((s, idx) => (
            <mesh key={idx} position={[s.x, 0, 0]} castShadow>
              <boxGeometry args={[0.34, 0.06, 1.7]} />
              <meshStandardMaterial color={s.color} roughness={0.7} flatShading />
            </mesh>
          ))}

          {/* Front Scalloped Valance / Fringe */}
          {stripes.map((s, idx) => (
            <mesh key={`val-${idx}`} position={[s.x, -0.09, 0.84]} castShadow>
              <boxGeometry args={[0.34, 0.15, 0.05]} />
              <meshStandardMaterial color={s.color} roughness={0.7} flatShading />
            </mesh>
          ))}
        </group>

        {/* 5. Overhead 3D Signboard */}
        <group position={[0, 2.75, 0.6]}>
          {/* Wooden backing board */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.7, 0.44, 0.07]} />
            <meshStandardMaterial color="#502E14" roughness={0.85} flatShading />
          </mesh>
          {/* Inset colored banner */}
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[1.5, 0.32, 0.03]} />
            <meshStandardMaterial color={primaryColor} roughness={0.6} flatShading />
          </mesh>
          {/* Stylized White Title Strip */}
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[1.1, 0.16, 0.02]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.4} flatShading />
          </mesh>
        </group>

        {/* 6. Merchandise Displays on Counter */}
        {displayType === 'eggs' && (
          <group position={[0, 0.96, 0.35]}>
            <mesh position={[-0.45, 0.06, 0]} castShadow>
              <sphereGeometry args={[0.13, 8, 8]} />
              <meshStandardMaterial color="#FBBF24" roughness={0.4} flatShading />
            </mesh>
            <mesh position={[0, 0.07, 0]} castShadow>
              <sphereGeometry args={[0.14, 8, 8]} />
              <meshStandardMaterial color="#60A5FA" roughness={0.4} flatShading />
            </mesh>
            <mesh position={[0.45, 0.08, 0]} castShadow>
              <sphereGeometry args={[0.15, 8, 8]} />
              <meshStandardMaterial color="#A855F7" roughness={0.4} flatShading />
            </mesh>
          </group>
        )}

        {displayType === 'seeds' && (
          <group position={[0, 0.95, 0.35]}>
            {/* Seed bags */}
            <mesh position={[-0.4, 0.1, 0]} castShadow>
              <cylinderGeometry args={[0.12, 0.15, 0.22, 6]} />
              <meshStandardMaterial color="#D97706" roughness={0.9} flatShading />
            </mesh>
            <mesh position={[0.3, 0.1, 0]} castShadow>
              <cylinderGeometry args={[0.13, 0.16, 0.24, 6]} />
              <meshStandardMaterial color="#059669" roughness={0.9} flatShading />
            </mesh>
          </group>
        )}

        {displayType === 'produce' && (
          <group position={[0, 0.95, 0.35]}>
            {/* Wooden Produce Crate */}
            <mesh position={[-0.35, 0.08, 0]} castShadow>
              <boxGeometry args={[0.45, 0.16, 0.4]} />
              <meshStandardMaterial color="#A16207" roughness={0.8} flatShading />
            </mesh>
            <mesh position={[-0.35, 0.18, 0]}>
              <sphereGeometry args={[0.1, 6, 6]} />
              <meshStandardMaterial color="#EA580C" roughness={0.6} flatShading />
            </mesh>
            <mesh position={[0.35, 0.08, 0]} castShadow>
              <boxGeometry args={[0.45, 0.16, 0.4]} />
              <meshStandardMaterial color="#A16207" roughness={0.8} flatShading />
            </mesh>
            <mesh position={[0.35, 0.18, 0]}>
              <sphereGeometry args={[0.1, 6, 6]} />
              <meshStandardMaterial color="#DC2626" roughness={0.6} flatShading />
            </mesh>
          </group>
        )}

        {displayType === 'tools' && (
          <group position={[0, 0.95, 0.35]}>
            {/* Tool watering can & wrench props */}
            <mesh position={[-0.35, 0.12, 0]} castShadow>
              <cylinderGeometry args={[0.1, 0.12, 0.22, 8]} />
              <meshStandardMaterial color="#2563EB" roughness={0.5} metalness={0.6} flatShading />
            </mesh>
            <mesh position={[0.35, 0.08, 0]} castShadow>
              <boxGeometry args={[0.35, 0.06, 0.12]} />
              <meshStandardMaterial color="#64748B" roughness={0.3} metalness={0.8} flatShading />
            </mesh>
          </group>
        )}
      </RigidBody>

      {/* 7. Stylized Blocky NPC Merchant */}
      <group
        position={[0, 0, -0.35]}
        ref={characterRef}
        onClick={handleOpenStall}
        name={`NPC-${npcName}`}
      >
        {/* Torso & Shirt */}
        <mesh position={[0, 0.72, 0]} castShadow>
          <boxGeometry args={[0.42, 0.44, 0.26]} />
          <meshStandardMaterial color={primaryColor} roughness={0.7} flatShading />
        </mesh>

        {/* Apron / Vest Overlay */}
        <mesh position={[0, 0.66, 0.02]} castShadow>
          <boxGeometry args={[0.44, 0.36, 0.25]} />
          <meshStandardMaterial color="#F1F5F9" roughness={0.8} flatShading />
        </mesh>

        {/* Head with Friendly Cap / Straw Hat */}
        <group ref={headRef} position={[0, 1.1, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.28, 0.28, 0.26]} />
            <meshStandardMaterial color="#FCD34D" roughness={0.7} flatShading />
          </mesh>
          {/* Eyes */}
          <mesh position={[-0.07, 0.02, 0.135]}>
            <boxGeometry args={[0.035, 0.035, 0.01]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
          <mesh position={[0.07, 0.02, 0.135]}>
            <boxGeometry args={[0.035, 0.035, 0.01]} />
            <meshStandardMaterial color="#0F172A" />
          </mesh>
          {/* Straw Hat Brim */}
          <mesh position={[0, 0.14, 0]} castShadow>
            <cylinderGeometry args={[0.3, 0.32, 0.04, 10]} />
            <meshStandardMaterial color="#EAB308" roughness={0.85} flatShading />
          </mesh>
          {/* Hat Crown */}
          <mesh position={[0, 0.22, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.2, 0.12, 10]} />
            <meshStandardMaterial color="#CA8A04" roughness={0.85} flatShading />
          </mesh>
        </group>

        {/* Resting Arms */}
        <mesh position={[-0.26, 0.7, 0.12]} rotation={[0.5, 0.2, 0]} castShadow>
          <boxGeometry args={[0.1, 0.24, 0.1]} />
          <meshStandardMaterial color={primaryColor} roughness={0.7} flatShading />
        </mesh>
        <mesh position={[0.26, 0.7, 0.12]} rotation={[0.5, -0.2, 0]} castShadow>
          <boxGeometry args={[0.1, 0.24, 0.1]} />
          <meshStandardMaterial color={primaryColor} roughness={0.7} flatShading />
        </mesh>
      </group>

      {/* 8. Proximity 3D Billboard Prompt */}
      {isNear && activeModal === null && (
        <Html position={[0, 2.3, 0.4]} center distanceFactor={14} pointerEvents="none">
          <div
            data-testid={`stall-prompt-${tab}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/95 border-2 border-white/80 text-white font-bold text-xs shadow-2xl backdrop-blur-md animate-bounce select-none pointer-events-none whitespace-nowrap"
          >
            <span
              className="flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase text-slate-950"
              style={{ backgroundColor: primaryColor }}
            >
              {signTitle}
            </span>
            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-white text-slate-950 font-black text-[11px] font-mono shadow-sm">
              E
            </span>
            <span className="tracking-wide">{interactionLabel}</span>
          </div>
        </Html>
      )}
    </group>
  );
};
