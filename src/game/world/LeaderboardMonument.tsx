import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MONUMENT_POSITION } from '../core/constants'
import { useLeaderboardStore, LEADERBOARD_REFRESH_MS } from '../../features/leaderboard/leaderboardStore'
import { getLeaderboardService } from '../../features/leaderboard/leaderboardService'

/**
 * LeaderboardMonument (PRD §7.3, §7.12):
 * - Physical landmark opposite the Market displaying the global Top 10.
 * - Uses one pre-created canvas texture updated in place; no new material
 *   is created on any poll (PRD §21 guardrail).
 * - Refreshes on mount and every 60 s; failed refreshes keep last data.
 */

const CANVAS_W = 512
const CANVAS_H = 640

function drawLeaderboard(
  ctx: CanvasRenderingContext2D,
  rows: Array<{ rank: number; usernameDisplay: string; balance: number }>,
  isStale: boolean,
  freshnessSeconds: number | null
): void {
  ctx.fillStyle = '#1c1917'
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  ctx.fillStyle = '#fbbf24'
  ctx.font = 'bold 44px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('TOP 10 FARMERS', CANVAS_W / 2, 64)

  ctx.font = '28px monospace'
  ctx.textAlign = 'left'
  if (rows.length === 0) {
    ctx.fillStyle = '#a8a29e'
    ctx.fillText('No ranked farmers yet…', 40, 140)
  }
  rows.forEach((row, i) => {
    const y = 130 + i * 46
    ctx.fillStyle = row.rank <= 3 ? '#fbbf24' : '#e7e5e4'
    ctx.fillText(`${row.rank}.`, 32, y)
    const name = row.usernameDisplay.length > 12 ? `${row.usernameDisplay.slice(0, 11)}…` : row.usernameDisplay
    ctx.fillText(name, 90, y)
    ctx.textAlign = 'right'
    ctx.fillText(row.balance.toLocaleString(), CANVAS_W - 32, y)
    ctx.textAlign = 'left'
  })

  if (isStale) {
    ctx.fillStyle = '#f87171'
    ctx.font = '20px monospace'
    ctx.fillText('connection issue — showing last results', 32, CANVAS_H - 28)
  } else if (freshnessSeconds !== null) {
    ctx.fillStyle = '#78716c'
    ctx.font = '20px monospace'
    ctx.fillText(`updated ${freshnessSeconds}s ago`, 32, CANVAS_H - 28)
  }
}

export const LeaderboardMonument: React.FC = () => {
  const rows = useLeaderboardStore((state) => state.rows)
  const isStale = useLeaderboardStore((state) => state.isStale)
  const lastFetchedAt = useLeaderboardStore((state) => state.lastFetchedAt)

  const canvasEl = useMemo(() => document.createElement('canvas'), [])
  const ctx = useMemo(() => {
    canvasEl.width = CANVAS_W
    canvasEl.height = CANVAS_H
    return canvasEl.getContext('2d')
  }, [canvasEl])
  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(canvasEl)
    tex.needsUpdate = true
    return tex
  }, [canvasEl])

  const service = useMemo(() => getLeaderboardService(), [])
  const secondsSinceFetch = lastFetchedAt ? Math.floor((Date.now() - lastFetchedAt) / 1000) : null

  // One-time texture draw whenever data/staleness changes; same texture object.
  useEffect(() => {
    if (!ctx) return
    drawLeaderboard(ctx, rows, isStale, secondsSinceFetch)
    texture.needsUpdate = true
  }, [ctx, rows, isStale, secondsSinceFetch, texture])

  useEffect(() => {
    void service.fetchTop10()
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void service.fetchTop10()
      }
    }, LEADERBOARD_REFRESH_MS)
    return () => clearInterval(timer)
  }, [service])

  useEffect(() => {
    return () => texture.dispose()
  }, [texture])

  const stoneMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#a8a29e', roughness: 0.9 }),
    []
  )
  const plaqueMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 }),
    [texture]
  )
  useEffect(() => {
    return () => {
      stoneMat.dispose()
      plaqueMat.dispose()
    }
  }, [stoneMat, plaqueMat])

  useFrame(({ clock }) => {
    // Subtle floating halo above the monument for landmark readability.
    if (haloRef.current) {
      haloRef.current.position.y = 7.4 + Math.sin(clock.elapsedTime * 1.2) * 0.15
    }
  })
  const haloRef = useRef<THREE.Mesh>(null)

  return (
    <group position={[MONUMENT_POSITION[0], MONUMENT_POSITION[1], MONUMENT_POSITION[2]]} name="LeaderboardMonument">
      {/* Stone base */}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow material={stoneMat}>
        <boxGeometry args={[5.2, 1.2, 1.6]} />
      </mesh>
      {/* Central pillar */}
      <mesh position={[0, 3.4, 0]} castShadow material={stoneMat}>
        <boxGeometry args={[3.4, 4.4, 1.2]} />
      </mesh>
      {/* Plaque with live canvas texture */}
      <mesh position={[0, 3.4, 0.65]} material={plaqueMat}>
        <planeGeometry args={[3.0, 4.0]} />
      </mesh>
      {/* Floating trophy halo */}
      <mesh ref={haloRef} position={[0, 7.4, 0]}>
        <torusGeometry args={[0.7, 0.18, 10, 24]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.6} roughness={0.4} />
      </mesh>
      {/* Accessibility: mirror panel handled by LeaderboardModal (HTML) */}
    </group>
  )
}
