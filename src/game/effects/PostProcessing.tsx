import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, RenderPass, UnrealBloomPass } from 'three-stdlib';
import { useGameStore } from '../../state/gameStore';
import { useSettingsStore } from '../../state/settingsStore';
import { getBloomConfig } from './postProcessingMath';

/**
 * Quality-aware PostProcessing bloom pass wrapper:
 * - Low = off (renders default R3F pipeline directly with zero composer overhead)
 * - Medium = mutations only
 * - High = mutations and weather
 * - Graceful fallback on WebGL context errors or reduced motion
 */
export const PostProcessing: React.FC = () => {
  const { gl, scene, camera, size } = useThree();
  const weather = useGameStore((state) => state.weather.current);
  const effectiveQuality = useSettingsStore((state) => state.effectiveQuality);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);

  const bloomConfig = useMemo(
    () => getBloomConfig(effectiveQuality, weather, reducedMotion),
    [effectiveQuality, weather, reducedMotion]
  );

  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);

  // Initialize or reconfigure EffectComposer
  useEffect(() => {
    if (!bloomConfig.enabled) {
      if (composerRef.current) {
        composerRef.current.dispose();
        composerRef.current = null;
      }
      return;
    }

    try {
      const composer = new EffectComposer(gl);
      const renderPass = new RenderPass(scene, camera);
      // Half-resolution bloom: the blur is low-frequency by nature, so full
      // resolution only burns fill-rate (up to 2x DPR) for no visible gain.
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.floor(size.width / 2), Math.floor(size.height / 2)),
        bloomConfig.strength,
        bloomConfig.radius,
        bloomConfig.threshold
      );

      composer.addPass(renderPass);
      composer.addPass(bloomPass);

      composerRef.current = composer;
      bloomPassRef.current = bloomPass;

      return () => {
        composer.dispose();
        composerRef.current = null;
        bloomPassRef.current = null;
      };
    } catch {
      // Graceful fallback if WebGL postprocessing creation fails
      composerRef.current = null;
      bloomPassRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bloomConfig.enabled,
    gl,
    scene,
    camera,
    // NOTE: size intentionally excluded — the resize effect below updates the
    // live composer without a full rebuild (rebuild = shader recompile hitch).
    bloomConfig.strength,
    bloomConfig.radius,
    bloomConfig.threshold,
  ]);

  // Update bloom properties dynamically
  useEffect(() => {
    if (bloomPassRef.current && bloomConfig.enabled) {
      bloomPassRef.current.strength = bloomConfig.strength;
      bloomPassRef.current.radius = bloomConfig.radius;
      bloomPassRef.current.threshold = bloomConfig.threshold;
    }
  }, [bloomConfig.enabled, bloomConfig.strength, bloomConfig.radius, bloomConfig.threshold]);

  // Update composer size on canvas resize
  useEffect(() => {
    if (composerRef.current) {
      composerRef.current.setSize(size.width, size.height);
      if (bloomPassRef.current) {
        bloomPassRef.current.resolution.set(
          Math.floor(size.width / 2),
          Math.floor(size.height / 2)
        );
      }
    }
  }, [size.width, size.height]);

  // Custom frame render loop when post-processing is enabled (priority = 1 disables default render)
  useFrame(
    (_, delta) => {
      if (composerRef.current && bloomConfig.enabled) {
        try {
          composerRef.current.render(delta);
        } catch {
          // Fallback silently if render fails
        }
      }
    },
    bloomConfig.enabled ? 1 : 0
  );

  return null;
};
