import * as THREE from 'three';

// ============================================================================
// GLSL Shader Definitions for Procedural Mutation Materials
// ============================================================================

export const COSMIC_SHADER_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const COSMIC_SHADER_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uBaseColor;
uniform vec3 uGlowColor;
uniform float uSwirlSpeed;
uniform float uPulseSpeed;
uniform float uOpacity;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;

// Fast HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec3 norm = normalize(vNormal);
  vec3 viewDir = normalize(-vPosition);
  
  // Fresnel rim glow
  float fresnel = pow(1.0 - max(dot(norm, vec3(0.0, 0.0, 1.0)), 0.0), 2.5);

  // Swirling procedural coordinates
  float angle = atan(vPosition.z, vPosition.x);
  float radius = length(vPosition.xz);
  float swirl = sin(angle * 3.0 + radius * 5.0 - uTime * uSwirlSpeed);

  // Animated cycling galactic hue shift [0.7 (violet) -> 0.95 (magenta) -> 0.5 (cyan)]
  float hue = fract(0.75 + 0.25 * sin(uTime * 0.5 + vPosition.y * 2.0 + swirl * 0.3));
  float saturation = 0.8 + 0.2 * sin(uTime * uPulseSpeed + radius);
  float value = 0.85 + 0.15 * cos(uTime * uPulseSpeed * 1.5 + angle);

  vec3 galacticColor = hsv2rgb(vec3(hue, saturation, value));

  // Mix with base and glow uniforms
  vec3 mixedColor = mix(uBaseColor, galacticColor, 0.7);
  mixedColor = mix(mixedColor, uGlowColor, fresnel * 0.6);

  // Add celestial stardust shimmer
  float shimmer = sin(vPosition.x * 20.0 + uTime * 4.0) * sin(vPosition.y * 20.0 - uTime * 3.0) * sin(vPosition.z * 20.0 + uTime * 2.0);
  if (shimmer > 0.6) {
    mixedColor += vec3(0.35, 0.45, 0.6) * (shimmer - 0.6) * 2.5;
  }

  gl_FragColor = vec4(mixedColor, uOpacity);
}
`;

export const GOLD_SHADER_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const GOLD_SHADER_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uGoldColor;
uniform vec3 uAuraColor;
uniform float uPulseSpeed;
uniform float uShimmerIntensity;
uniform float uOpacity;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;

void main() {
  vec3 norm = normalize(vNormal);
  vec3 lightDir = normalize(vec3(0.5, 1.0, 0.75));
  vec3 viewDir = normalize(-vPosition);

  // Diffuse lighting
  float diff = max(dot(norm, lightDir), 0.0);

  // Specular highlight with high metalness look (0.85 metalness, 0.25 roughness)
  vec3 reflectDir = reflect(-lightDir, norm);
  float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

  // Pulsing aura modulation
  float pulse = 0.5 + 0.5 * sin(uTime * uPulseSpeed);
  float auraFresnel = pow(1.0 - max(dot(norm, vec3(0.0, 0.0, 1.0)), 0.0), 3.0);

  // Metallic gold color computation
  vec3 base = uGoldColor * (0.4 + 0.6 * diff);
  vec3 goldSpec = vec3(1.0, 0.92, 0.65) * spec * 1.2;
  vec3 aura = uAuraColor * (auraFresnel * (0.3 + 0.4 * pulse) * uShimmerIntensity);

  // Moving golden sparkle glint
  float glint = sin(vPosition.x * 15.0 + uTime * 3.0) * cos(vPosition.y * 15.0 + uTime * 2.0);
  float glintHighlight = smoothstep(0.7, 1.0, glint) * 0.5;

  vec3 finalColor = base + goldSpec + aura + vec3(glintHighlight);

  gl_FragColor = vec4(finalColor, uOpacity);
}
`;

// ============================================================================
// Shader Material Factory Helpers
// ============================================================================

export interface CosmicShaderMaterialOptions {
  baseColor?: string | THREE.Color;
  glowColor?: string | THREE.Color;
  swirlSpeed?: number;
  pulseSpeed?: number;
  opacity?: number;
}

export function createCosmicShaderMaterial(
  options?: CosmicShaderMaterialOptions
): THREE.ShaderMaterial {
  const baseColor =
    typeof options?.baseColor === 'string'
      ? new THREE.Color(options.baseColor)
      : options?.baseColor ?? new THREE.Color('#7C4DFF');

  const glowColor =
    typeof options?.glowColor === 'string'
      ? new THREE.Color(options.glowColor)
      : options?.glowColor ?? new THREE.Color('#00E5FF');

  return new THREE.ShaderMaterial({
    vertexShader: COSMIC_SHADER_VERTEX,
    fragmentShader: COSMIC_SHADER_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: baseColor },
      uGlowColor: { value: glowColor },
      uSwirlSpeed: { value: options?.swirlSpeed ?? 1.2 },
      uPulseSpeed: { value: options?.pulseSpeed ?? 1.5 },
      uOpacity: { value: options?.opacity ?? 1.0 },
    },
    transparent: true,
  });
}

export function updateCosmicShaderUniforms(
  material: THREE.ShaderMaterial,
  timeSec: number
): void {
  if (material.uniforms?.uTime) {
    material.uniforms.uTime.value = timeSec;
  }
}

export interface GoldShaderMaterialOptions {
  goldColor?: string | THREE.Color;
  auraColor?: string | THREE.Color;
  pulseSpeed?: number;
  shimmerIntensity?: number;
  opacity?: number;
}

export function createGoldShaderMaterial(
  options?: GoldShaderMaterialOptions
): THREE.ShaderMaterial {
  const goldColor =
    typeof options?.goldColor === 'string'
      ? new THREE.Color(options.goldColor)
      : options?.goldColor ?? new THREE.Color('#FFD700');

  const auraColor =
    typeof options?.auraColor === 'string'
      ? new THREE.Color(options.auraColor)
      : options?.auraColor ?? new THREE.Color('#FFE082');

  return new THREE.ShaderMaterial({
    vertexShader: GOLD_SHADER_VERTEX,
    fragmentShader: GOLD_SHADER_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uGoldColor: { value: goldColor },
      uAuraColor: { value: auraColor },
      uPulseSpeed: { value: options?.pulseSpeed ?? 3.5 },
      uShimmerIntensity: { value: options?.shimmerIntensity ?? 1.0 },
      uOpacity: { value: options?.opacity ?? 1.0 },
    },
    transparent: true,
  });
}

export function updateGoldShaderUniforms(
  material: THREE.ShaderMaterial,
  timeSec: number
): void {
  if (material.uniforms?.uTime) {
    material.uniforms.uTime.value = timeSec;
  }
}

// ============================================================================
// Sparkle Particle Motes for Gold Crops
// ============================================================================

export interface GoldSparkleMote {
  position: [number, number, number];
  size: number;
  opacity: number;
  color: string;
}

export const GOLD_SPARKLE_COLORS = [
  '#FFE082',
  '#FFD54F',
  '#FFCA28',
  '#FFF9C4',
  '#FFECB3',
  '#FFD700',
];

/**
 * Calculates deterministic floating twinkling sparkle motes around a gold crop.
 */
export function getGoldSparklePositions(timeSec: number): GoldSparkleMote[] {
  const sparkles: GoldSparkleMote[] = [];
  const count = 6;
  const baseRadius = 0.32;

  for (let i = 0; i < count; i++) {
    const angleOffset = (i * Math.PI * 2) / count;
    const speed = 0.6 + (i % 2) * 0.4;
    const currentAngle = angleOffset + timeSec * speed;
    const radius = baseRadius + (i % 2 === 0 ? 0.05 : -0.04);

    const x = Math.cos(currentAngle) * radius;
    const z = Math.sin(currentAngle) * radius;
    // Rising and looping vertical position [0.08, 0.45]
    const cycleY = ((timeSec * 0.25 + i * 0.16) % 0.4) + 0.08;
    const y = cycleY;

    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(timeSec * 4.0 + i * 1.5));
    const size = (0.018 + (i % 3) * 0.008) * (0.6 + 0.4 * twinkle);
    const color = GOLD_SPARKLE_COLORS[i % GOLD_SPARKLE_COLORS.length];

    sparkles.push({
      position: [x, y, z],
      size,
      opacity: Math.max(0, Math.min(1.0, twinkle)),
      color,
    });
  }

  return sparkles;
}
