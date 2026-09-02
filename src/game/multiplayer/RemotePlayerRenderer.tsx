import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useNetStore } from './netStore'
import { getRoomConnection } from './RoomConnection'
import { REMOTE_RENDER_DELAY_MS, type RemoteSnapshot } from './movementProtocol'

/**
 * RemotePlayerRenderer (PRD §7.14, §21):
 * - One small React component per remote PLAYER (not per snapshot/tile).
 * - Per-frame transforms mutate refs only; no React state in the render loop.
 * - Samples ~100 ms behind the newest snapshot with lerp; eases to idle after
 *   250 ms without data (handled by RemotePlayerBuffer).
 */

const AVATAR_COLORS = ['#e74c3c', '#3498db', '#9b59b6', '#f39c12'] as const

interface RemoteAvatarProps {
  userId: string
}

const RemoteAvatar: React.FC<RemoteAvatarProps> = ({ userId }) => {
  const connection = useMemo(() => getRoomConnection(), [])
  const groupRef = useRef<THREE.Group>(null)
  const bodyRef = useRef<THREE.Mesh>(null)
  const color = AVATAR_COLORS[hashUserId(userId) % AVATAR_COLORS.length]

  useFrame(() => {
    const buffer = connection.getBuffer(userId)
    const group = groupRef.current
    if (!buffer || !group) return

    const latest = buffer.newest
    if (!latest) return
    const renderTime = latest.t - REMOTE_RENDER_DELAY_MS
    const state: RemoteSnapshot | null = buffer.sample(renderTime)
    if (!state) return

    group.visible = true
    group.position.set(state.p[0], state.p[1], state.p[2])
    group.rotation.y = state.yaw

    // Cheap walk bob from speed; idle when anim === 0.
    if (bodyRef.current) {
      const bob =
        state.anim === 0 ? 0 : Math.sin(Date.now() / 120) * 0.04 * Math.min(state.speed / 4, 1)
      bodyRef.current.position.y = bob
    }
  })

  return (
    <group ref={groupRef} name={`remote-player-${userId}`} visible={false}>
      <mesh ref={bodyRef} position={[0, 0.65, 0]} castShadow>
        <capsuleGeometry args={[0.3, 0.5, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow>
        <sphereGeometry args={[0.22, 10, 8]} />
        <meshStandardMaterial color="#f5d7b0" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.44, 0]}>
        <coneGeometry args={[0.24, 0.18, 8]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  )
}

function hashUserId(userId: string): number {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * Renders one avatar per remote room member. The component subscribes to the
 * member list only (low frequency); movement sampling never re-renders React.
 */
export const RemotePlayerRenderer: React.FC = () => {
  const members = useNetStore((state) => state.members)
  const ownUserId = useNetStore((state) => state.ownUserId)

  const visible = members.filter((m) => m.userId !== ownUserId)

  return (
    <group name="remote-players">
      {visible.map((member) => (
        <RemoteAvatar key={member.userId} userId={member.userId} />
      ))}
    </group>
  )
}
