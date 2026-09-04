import { useEffect, useState } from 'react';

/**
 * Global budget for per-crop mutation point lights.
 * Forward rendering pays every active point light in ALL object shaders, so
 * an unbounded farm of gold/cosmic crops would tank the frame rate. The
 * first N mounted decorators own a real light; the rest render emissive
 * sparkles/motes only (still pretty, nearly free).
 */
export const MAX_MUTATION_LIGHTS = 6;

let activeLights = 0;

export function resetMutationLightBudget(): void {
  activeLights = 0;
}

function claimSlot(): boolean {
  if (activeLights < MAX_MUTATION_LIGHTS) {
    activeLights += 1;
    return true;
  }
  return false;
}

function releaseSlot(): void {
  if (activeLights > 0) {
    activeLights -= 1;
  }
}

/**
 * Claims a global mutation-light slot on mount, releases on unmount.
 * First-come-first-served; late crops beyond the budget stay dark.
 */
export function useMutationLightSlot(): boolean {
  const [hasSlot, setHasSlot] = useState(false);

  useEffect(() => {
    if (claimSlot()) {
      setHasSlot(true);
      return () => {
        releaseSlot();
      };
    }
    return undefined;
  }, []);

  return hasSlot;
}
