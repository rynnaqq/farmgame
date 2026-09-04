import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../state/gameStore';
import { useSettingsStore } from '../../state/settingsStore';
import {
  getQualityParticleCapacity,
  createParticleBuffer,
  initRainParticles,
  initHeatMoteParticles,
  initBloodMoteParticles,
  stepRainParticles,
  stepHeatMoteParticles,
  stepBloodMoteParticles,
  stepBurstParticles,
  spawnBurst,
  subscribeParticleBursts,
  type ParticleBuffer,
  type ParticleBounds,
} from './particlePoolMath';
import { PARTICLE_POOL_SPHERE } from './culling';

// ============================================================================
// Constants & Bounds
// ============================================================================

const ISLAND_BOUNDS: ParticleBounds = {
  minX: -14,
  maxX: 14,
  minY: 0.05,
  maxY: 16,
  minZ: -14,
  maxZ: 14,
};

const BASE_CAPACITIES = {
  rain: 600,
  rainSplash: 120,
  heatMote: 140,
  bloodMote: 140,
  gameplayBurst: 180,
} as const;

const DUMMY_OFFSCREEN_POS = new THREE.Vector3(0, -999, 0);

// ============================================================================
// ParticlePool Component
// ============================================================================

/**
 * ParticlePool manages all 3D GPU-instanced particle systems:
 * - Rain drops & ground splash ripples for Heavy Rain
 * - Shimmering amber heat motes for Heatwave
 * - Floating crimson night motes for Blood Moon
 * - Gameplay splash & sparkle burst pools for watering and harvesting
 * - Quality-scaled particle counts (30% Low, 65% Med, 100% High)
 * - Zero per-frame heap allocations using preallocated Float32Array buffers and InstancedMesh
 */
export const ParticlePool: React.FC = () => {
  const weather = useGameStore((state) => state.weather.current);
  const effectiveQuality = useSettingsStore((state) => state.effectiveQuality);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);

  // InstancedMesh refs
  const rainMeshRef = useRef<THREE.InstancedMesh>(null);
  const rainSplashMeshRef = useRef<THREE.InstancedMesh>(null);
  const heatMoteMeshRef = useRef<THREE.InstancedMesh>(null);
  const bloodMoteMeshRef = useRef<THREE.InstancedMesh>(null);
  const burstMeshRef = useRef<THREE.InstancedMesh>(null);

  // Calculate capacities based on quality level
  const rainCap = useMemo(
    () => getQualityParticleCapacity(BASE_CAPACITIES.rain, effectiveQuality),
    [effectiveQuality]
  );
  const rainSplashCap = useMemo(
    () => getQualityParticleCapacity(BASE_CAPACITIES.rainSplash, effectiveQuality),
    [effectiveQuality]
  );
  const heatMoteCap = useMemo(
    () => getQualityParticleCapacity(BASE_CAPACITIES.heatMote, effectiveQuality),
    [effectiveQuality]
  );
  const bloodMoteCap = useMemo(
    () => getQualityParticleCapacity(BASE_CAPACITIES.bloodMote, effectiveQuality),
    [effectiveQuality]
  );
  const burstCap = useMemo(
    () => getQualityParticleCapacity(BASE_CAPACITIES.gameplayBurst, effectiveQuality),
    [effectiveQuality]
  );

  // Particle state buffers
  const rainBufferRef = useRef<ParticleBuffer>(createParticleBuffer(BASE_CAPACITIES.rain));
  const rainSplashBufferRef = useRef<ParticleBuffer>(
    createParticleBuffer(BASE_CAPACITIES.rainSplash)
  );
  const heatMoteBufferRef = useRef<ParticleBuffer>(createParticleBuffer(BASE_CAPACITIES.heatMote));
  const bloodMoteBufferRef = useRef<ParticleBuffer>(
    createParticleBuffer(BASE_CAPACITIES.bloodMote)
  );
  const burstBufferRef = useRef<ParticleBuffer>(
    createParticleBuffer(BASE_CAPACITIES.gameplayBurst)
  );

  // Reusable THREE objects for zero-allocation matrix transforms
  const dummyMatrix = useMemo(() => new THREE.Matrix4(), []);
  const dummyPos = useMemo(() => new THREE.Vector3(), []);
  const dummyQuat = useMemo(() => new THREE.Quaternion(), []);
  const dummyScale = useMemo(() => new THREE.Vector3(), []);
  const dummyColor = useMemo(() => new THREE.Color(), []);

  // Static frustum-culling bounds for every pool. Instances fly around each
  // frame, so an auto-computed sphere would go stale (or degenerate when all
  // instances are parked offscreen) — while `frustumCulled` forces
  // the GPU to process every pool even when looking away. One generous
  // island-covering sphere restores correct, zero-cost culling.
  useEffect(() => {
    const center = new THREE.Vector3(
      PARTICLE_POOL_SPHERE.centerX,
      PARTICLE_POOL_SPHERE.centerY,
      PARTICLE_POOL_SPHERE.centerZ
    );
    for (const ref of [
      rainMeshRef,
      rainSplashMeshRef,
      heatMoteMeshRef,
      bloodMoteMeshRef,
      burstMeshRef,
    ]) {
      const mesh = ref.current;
      if (mesh) {
        mesh.frustumCulled = true;
        mesh.boundingSphere = new THREE.Sphere(center.clone(), PARTICLE_POOL_SPHERE.radius);
      }
    }
  }, []);

  // Initialize continuous weather buffers when weather or quality changes
  useEffect(() => {
    // 1. Rain
    if (weather === 'heavy_rain') {
      initRainParticles(rainBufferRef.current, ISLAND_BOUNDS, rainCap);
    } else {
      rainBufferRef.current.active.fill(0);
      rainBufferRef.current.activeCount = 0;
      rainSplashBufferRef.current.active.fill(0);
      rainSplashBufferRef.current.activeCount = 0;
    }

    // 2. Heat motes
    if (weather === 'heatwave') {
      initHeatMoteParticles(heatMoteBufferRef.current, ISLAND_BOUNDS, heatMoteCap);
    } else {
      heatMoteBufferRef.current.active.fill(0);
      heatMoteBufferRef.current.activeCount = 0;
    }

    // 3. Blood motes
    if (weather === 'blood_moon') {
      initBloodMoteParticles(bloodMoteBufferRef.current, ISLAND_BOUNDS, bloodMoteCap);
    } else {
      bloodMoteBufferRef.current.active.fill(0);
      bloodMoteBufferRef.current.activeCount = 0;
    }
  }, [weather, rainCap, heatMoteCap, bloodMoteCap]);

  // Subscribe to gameplay burst events (watering splash, harvest sparkles)
  useEffect(() => {
    const unsubscribe = subscribeParticleBursts((event) => {
      const burstBuf = burstBufferRef.current;
      const count = Math.min(event.count ?? 15, Math.floor(burstCap * 0.4));

      let color: [number, number, number] = [1.0, 1.0, 1.0];
      if (Array.isArray(event.color)) {
        color = event.color;
      } else if (typeof event.color === 'string') {
        const c = new THREE.Color(event.color);
        color = [c.r, c.g, c.b];
      } else if (event.type === 'splash') {
        color = [0.3, 0.75, 1.0];
      } else if (event.type === 'sparkle') {
        color = [1.0, 0.85, 0.3];
      }

      spawnBurst(burstBuf, count, event.position, {
        speedMin: event.type === 'splash' ? 1.5 : 0.8,
        speedMax: event.type === 'splash' ? 3.8 : 2.2,
        lifetimeMin: 0.5,
        lifetimeMax: 1.0,
        scaleMin: event.scale ? event.scale * 0.5 : 0.1,
        scaleMax: event.scale ?? 0.22,
        color,
        gravity: event.type === 'splash' ? 12.0 : -0.5, // Sparkles float upward
      });
    });

    return () => {
      unsubscribe();
    };
  }, [burstCap]);

  // Animation frame loop
  useFrame(({ clock }, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const elapsedTime = clock.getElapsedTime();

    // ------------------------------------------------------------------------
    // 1. Rain & Splash Update
    // ------------------------------------------------------------------------
    if (weather === 'heavy_rain' && rainMeshRef.current) {
      const rainBuf = rainBufferRef.current;
      const splashBuf = rainSplashBufferRef.current;

      stepRainParticles(rainBuf, delta, ISLAND_BOUNDS, (x, z) => {
        // Spawn small ground splash
        if (Math.random() < 0.25) {
          spawnBurst(splashBuf, 2, [x, 0.05, z], {
            speedMin: 0.8,
            speedMax: 1.8,
            lifetimeMin: 0.15,
            lifetimeMax: 0.35,
            scaleMin: 0.04,
            scaleMax: 0.08,
            color: [0.75, 0.85, 0.98],
            gravity: 8.0,
          });
        }
      });

      stepBurstParticles(splashBuf, delta, 8.0);

      // Render Rain InstancedMesh
      const mesh = rainMeshRef.current;
      for (let i = 0; i < rainCap; i++) {
        if (rainBuf.active[i] === 1) {
          const pIdx = i * 3;
          dummyPos.set(
            rainBuf.positions[pIdx],
            rainBuf.positions[pIdx + 1],
            rainBuf.positions[pIdx + 2]
          );
          dummyScale.set(rainBuf.scales[i], rainBuf.scales[i] * 3.5, rainBuf.scales[i]);
          dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
          mesh.setMatrixAt(i, dummyMatrix);

          dummyColor.setRGB(
            rainBuf.colors[pIdx],
            rainBuf.colors[pIdx + 1],
            rainBuf.colors[pIdx + 2]
          );
          mesh.setColorAt(i, dummyColor);
        } else {
          dummyScale.set(0, 0, 0);
          dummyMatrix.compose(DUMMY_OFFSCREEN_POS, dummyQuat, dummyScale);
          mesh.setMatrixAt(i, dummyMatrix);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

      // Render Rain Splash InstancedMesh
      if (rainSplashMeshRef.current) {
        const splashMesh = rainSplashMeshRef.current;
        for (let i = 0; i < rainSplashCap; i++) {
          if (splashBuf.active[i] === 1) {
            const pIdx = i * 3;
            dummyPos.set(
              splashBuf.positions[pIdx],
              splashBuf.positions[pIdx + 1],
              splashBuf.positions[pIdx + 2]
            );
            dummyScale.setScalar(splashBuf.scales[i]);
            dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
            splashMesh.setMatrixAt(i, dummyMatrix);

            dummyColor.setRGB(
              splashBuf.colors[pIdx],
              splashBuf.colors[pIdx + 1],
              splashBuf.colors[pIdx + 2]
            );
            splashMesh.setColorAt(i, dummyColor);
          } else {
            dummyScale.set(0, 0, 0);
            dummyMatrix.compose(DUMMY_OFFSCREEN_POS, dummyQuat, dummyScale);
            splashMesh.setMatrixAt(i, dummyMatrix);
          }
        }
        splashMesh.instanceMatrix.needsUpdate = true;
        if (splashMesh.instanceColor) splashMesh.instanceColor.needsUpdate = true;
      }
    }

    // ------------------------------------------------------------------------
    // 2. Heat Haze Motes Update
    // ------------------------------------------------------------------------
    if (weather === 'heatwave' && heatMoteMeshRef.current) {
      const heatBuf = heatMoteBufferRef.current;
      stepHeatMoteParticles(heatBuf, delta, ISLAND_BOUNDS, reducedMotion ? 0 : elapsedTime);

      const mesh = heatMoteMeshRef.current;
      for (let i = 0; i < heatMoteCap; i++) {
        if (heatBuf.active[i] === 1) {
          const pIdx = i * 3;
          dummyPos.set(
            heatBuf.positions[pIdx],
            heatBuf.positions[pIdx + 1],
            heatBuf.positions[pIdx + 2]
          );
          dummyScale.setScalar(heatBuf.scales[i]);
          dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
          mesh.setMatrixAt(i, dummyMatrix);

          dummyColor.setRGB(
            heatBuf.colors[pIdx],
            heatBuf.colors[pIdx + 1],
            heatBuf.colors[pIdx + 2]
          );
          mesh.setColorAt(i, dummyColor);
        } else {
          dummyScale.set(0, 0, 0);
          dummyMatrix.compose(DUMMY_OFFSCREEN_POS, dummyQuat, dummyScale);
          mesh.setMatrixAt(i, dummyMatrix);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // ------------------------------------------------------------------------
    // 3. Blood Moon Crimson Motes Update
    // ------------------------------------------------------------------------
    if (weather === 'blood_moon' && bloodMoteMeshRef.current) {
      const bloodBuf = bloodMoteBufferRef.current;
      stepBloodMoteParticles(bloodBuf, delta, ISLAND_BOUNDS, reducedMotion ? 0 : elapsedTime);

      const mesh = bloodMoteMeshRef.current;
      for (let i = 0; i < bloodMoteCap; i++) {
        if (bloodBuf.active[i] === 1) {
          const pIdx = i * 3;
          dummyPos.set(
            bloodBuf.positions[pIdx],
            bloodBuf.positions[pIdx + 1],
            bloodBuf.positions[pIdx + 2]
          );
          dummyScale.setScalar(bloodBuf.scales[i]);
          dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
          mesh.setMatrixAt(i, dummyMatrix);

          dummyColor.setRGB(
            bloodBuf.colors[pIdx],
            bloodBuf.colors[pIdx + 1],
            bloodBuf.colors[pIdx + 2]
          );
          mesh.setColorAt(i, dummyColor);
        } else {
          dummyScale.set(0, 0, 0);
          dummyMatrix.compose(DUMMY_OFFSCREEN_POS, dummyQuat, dummyScale);
          mesh.setMatrixAt(i, dummyMatrix);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // ------------------------------------------------------------------------
    // 4. Gameplay Bursts Update (Water Splashes & Harvest Sparkles)
    // ------------------------------------------------------------------------
    if (burstMeshRef.current) {
      const burstBuf = burstBufferRef.current;
      if (burstBuf.activeCount > 0) {
        stepBurstParticles(burstBuf, delta, 8.0);

        const mesh = burstMeshRef.current;
        for (let i = 0; i < burstCap; i++) {
          if (burstBuf.active[i] === 1) {
            const pIdx = i * 3;
            dummyPos.set(
              burstBuf.positions[pIdx],
              burstBuf.positions[pIdx + 1],
              burstBuf.positions[pIdx + 2]
            );
            dummyScale.setScalar(burstBuf.scales[i]);
            dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);
            mesh.setMatrixAt(i, dummyMatrix);

            dummyColor.setRGB(
              burstBuf.colors[pIdx],
              burstBuf.colors[pIdx + 1],
              burstBuf.colors[pIdx + 2]
            );
            mesh.setColorAt(i, dummyColor);
          } else {
            dummyScale.set(0, 0, 0);
            dummyMatrix.compose(DUMMY_OFFSCREEN_POS, dummyQuat, dummyScale);
            mesh.setMatrixAt(i, dummyMatrix);
          }
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <group name="ParticlePool">
      {/* 1. Rain Streaks */}
      <instancedMesh
        ref={rainMeshRef}
        args={[undefined, undefined, BASE_CAPACITIES.rain]}
        frustumCulled
        visible={weather === 'heavy_rain'}
      >
        <boxGeometry args={[0.04, 0.4, 0.04]} />
        <meshBasicMaterial
          color="#B0C4DE"
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      {/* 1.1 Rain Splashes */}
      <instancedMesh
        ref={rainSplashMeshRef}
        args={[undefined, undefined, BASE_CAPACITIES.rainSplash]}
        frustumCulled
        visible={weather === 'heavy_rain'}
      >
        <dodecahedronGeometry args={[0.06, 0]} />
        <meshBasicMaterial
          color="#C6E2FF"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      {/* 2. Heat Haze Motes */}
      <instancedMesh
        ref={heatMoteMeshRef}
        args={[undefined, undefined, BASE_CAPACITIES.heatMote]}
        frustumCulled
        visible={weather === 'heatwave'}
      >
        <octahedronGeometry args={[0.1, 0]} />
        <meshBasicMaterial
          color="#FFB347"
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      {/* 3. Blood Moon Crimson Motes */}
      <instancedMesh
        ref={bloodMoteMeshRef}
        args={[undefined, undefined, BASE_CAPACITIES.bloodMote]}
        frustumCulled
        visible={weather === 'blood_moon'}
      >
        <octahedronGeometry args={[0.12, 0]} />
        <meshBasicMaterial
          color="#E63946"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>

      {/* 4. Gameplay Bursts Pool (Watering Splashes, Harvest Sparkles) */}
      <instancedMesh
        ref={burstMeshRef}
        args={[undefined, undefined, BASE_CAPACITIES.gameplayBurst]}
        frustumCulled
      >
        <octahedronGeometry args={[0.1, 0]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
};
