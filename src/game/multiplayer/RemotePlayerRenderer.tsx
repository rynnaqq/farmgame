import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useNetStore } from './netStore';
import { getRoomConnection } from './RoomConnection';
import { REMOTE_RENDER_DELAY_MS, type RemoteSnapshot } from './movementProtocol';

/**
 * RemotePlayerRenderer (PRD §7.14, §21):
 * - A fixed pool of 3 avatar rigs (max 4 players minus the local player) is
 *   pre-created; player joins never create materials, geometries, or shader
 *   variants (PRD §21 guardrail, §11.2).
 * - Per-frame transforms mutate refs only; no React state in the render loop.
 * - Samples ~100 ms behind the newest snapshot with lerp; eases to idle after
 *   250 ms without data (handled by RemotePlayerBuffer).
 */

const POOL_SIZE = 3;
const AVATAR_COLORS = ['#e74c3c', '#3498db', '#9b59b6'] as const;

/** Pre-created avatar rig: geometry + material singletons, shown/hidden by ref. */
const RemoteAvatarRig: React.FC<{
  slot: number;
  color: string;
  userIdRef: React.MutableRefObject<string | null>;
}> = ({ slot, color, userIdRef }) => {
  const connection = useMemo(() => getRoomConnection(), []);
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);

  const materials = useMemo(() => {
    const suit = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: '#f5d7b0', roughness: 0.9 });
    return { suit, skin };
  }, [color]);
  useEffectDispose(materials);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const userId = userIdRef.current;
    if (!userId) {
      group.visible = false;
      return;
    }
    const buffer = connection.getBuffer(userId);
    const latest = buffer?.newest;
    if (!latest) {
      group.visible = false;
      return;
    }
    const state: RemoteSnapshot | null = buffer!.sample(latest.t - REMOTE_RENDER_DELAY_MS);
    if (!state) {
      group.visible = false;
      return;
    }

    group.visible = true;
    group.position.set(state.p[0], state.p[1], state.p[2]);
    group.rotation.y = state.yaw;

    if (bodyRef.current) {
      const bob =
        state.anim === 0 ? 0 : Math.sin(Date.now() / 120) * 0.04 * Math.min(state.speed / 4, 1);
      bodyRef.current.position.y = 0.65 + bob;
    }
  });

  return (
    <group ref={groupRef} name={`remote-avatar-${slot}`} visible={false}>
      <mesh ref={bodyRef} position={[0, 0.65, 0]} castShadow material={materials.suit}>
        <capsuleGeometry args={[0.3, 0.5, 4, 8]} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow material={materials.skin}>
        <sphereGeometry args={[0.22, 10, 8]} />
      </mesh>
      <mesh position={[0, 1.44, 0]} material={materials.suit}>
        <coneGeometry args={[0.24, 0.18, 8]} />
      </mesh>
    </group>
  );
};

function useEffectDispose(materials: { suit: THREE.Material; skin: THREE.Material }): void {
  React.useEffect(() => {
    return () => {
      materials.suit.dispose();
      materials.skin.dispose();
    };
  }, [materials]);
}

/**
 * Maps at most 3 remote members onto the pre-created avatar pool. Subscribes
 * to the member list only (low frequency); movement sampling never re-renders.
 */
export const RemotePlayerRenderer: React.FC = () => {
  const members = useNetStore((state) => state.members);
  const ownUserId = useNetStore((state) => state.ownUserId);

  const assignments = useMemo(() => {
    const remote = members.filter((m) => m.userId !== ownUserId).slice(0, POOL_SIZE);
    return remote.map((m, i) => ({ userId: m.userId, poolSlot: i }));
  }, [members, ownUserId]);

  const slotRefs = useRef<Array<React.MutableRefObject<string | null>>>([]);
  if (slotRefs.current.length !== POOL_SIZE) {
    slotRefs.current = Array.from({ length: POOL_SIZE }, () => React.createRef<string | null>());
  }
  // Assign the newest member list to stable pool slots (refs only).
  for (let i = 0; i < POOL_SIZE; i++) {
    slotRefs.current[i].current = assignments.find((a) => a.poolSlot === i)?.userId ?? null;
  }

  return (
    <group name="remote-players">
      {Array.from({ length: POOL_SIZE }, (_, i) => (
        <RemoteAvatarRig
          key={i}
          slot={i}
          color={AVATAR_COLORS[i % AVATAR_COLORS.length]}
          userIdRef={slotRefs.current[i]}
        />
      ))}
    </group>
  );
};
