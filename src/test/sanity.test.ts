import { describe, it, expect } from 'vitest';

describe('Project Sanity Suite', () => {
  it('verifies that vitest runner executes tests properly', () => {
    expect(1 + 1).toBe(2);
  });

  it('verifies environment variables and typescript types work', () => {
    const appName: string = 'Garden Island 3D';
    expect(appName).toBeDefined();
    expect(typeof appName).toBe('string');
  });

  it('verifies dom matchers are configured', () => {
    const div = document.createElement('div');
    div.textContent = 'Garden Island';
    expect(div).toHaveTextContent('Garden Island');
  });
});
