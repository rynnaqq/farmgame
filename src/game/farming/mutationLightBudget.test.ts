import { describe, it, expect, beforeEach } from 'vitest';
import { MAX_MUTATION_LIGHTS, resetMutationLightBudget } from './mutationLightBudget';
import { renderHook, act } from '@testing-library/react';
import { useMutationLightSlot } from './mutationLightBudget';

describe('mutationLightBudget - global point light cap', () => {
  beforeEach(() => {
    resetMutationLightBudget();
  });

  it(`grants slots to the first ${MAX_MUTATION_LIGHTS} mounted decorators`, () => {
    const hooks = Array.from({ length: MAX_MUTATION_LIGHTS }, () =>
      renderHook(() => useMutationLightSlot())
    );
    for (const h of hooks) {
      expect(h.result.current).toBe(true);
    }
    const extra = renderHook(() => useMutationLightSlot());
    expect(extra.result.current).toBe(false);
    for (const h of [...hooks, extra]) h.unmount();
  });

  it('releases the slot on unmount so new crops can light up', () => {
    const hooks = Array.from({ length: MAX_MUTATION_LIGHTS }, () =>
      renderHook(() => useMutationLightSlot())
    );
    act(() => {
      hooks[0].unmount();
    });
    const next = renderHook(() => useMutationLightSlot());
    expect(next.result.current).toBe(true);
    for (const h of hooks.slice(1)) h.unmount();
    next.unmount();
  });
});
