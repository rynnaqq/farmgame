/**
 * Validates whether the current browser runtime supports WebGL2 context creation.
 */
export function isWebGL2Available(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    const gl =
      (window.WebGL2RenderingContext && canvas.getContext('webgl2')) ||
      canvas.getContext('experimental-webgl2');

    return Boolean(gl);
  } catch {
    return false;
  }
}
