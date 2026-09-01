import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  CAMERA_DEFAULT_YAW_DEG,
  CAMERA_DEFAULT_PITCH_DEG,
  CAMERA_DEFAULT_DISTANCE,
  CAMERA_MIN_PITCH_DEG,
  CAMERA_MAX_PITCH_DEG,
  CAMERA_MIN_DISTANCE,
  CAMERA_MAX_DISTANCE,
  CAMERA_TARGET_HEIGHT_OFFSET,
} from '../core/constants';
import {
  degToRad,
  radToDeg,
  clampPitchDeg,
  clampPitchRad,
  clampDistance,
  normalizeAngleRad,
  sphericalToCartesian,
  cartesianToSpherical,
  applyOrbitDelta,
  applyZoomDelta,
  dampValue,
  dampAngle,
  dampVector3,
  calculateCollisionOffsetDistance,
  computeCameraTarget,
  DEFAULT_ORBIT_SENSITIVITY,
  DEFAULT_ZOOM_SENSITIVITY,
  DEFAULT_POSITION_DAMPING,
  DEFAULT_ROTATION_DAMPING,
  DEFAULT_DISTANCE_DAMPING,
  DEFAULT_COLLISION_BUFFER,
  isCameraObstacle,
} from './cameraMath';
import { InputManager } from '../input/InputManager';

describe('Camera Math Pure Calculations', () => {
  describe('Degree / Radian conversion and angle normalization', () => {
    it('correctly converts degrees to radians and back', () => {
      expect(degToRad(0)).toBeCloseTo(0);
      expect(degToRad(45)).toBeCloseTo(Math.PI / 4);
      expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
      expect(degToRad(180)).toBeCloseTo(Math.PI);
      expect(degToRad(360)).toBeCloseTo(Math.PI * 2);

      expect(radToDeg(0)).toBeCloseTo(0);
      expect(radToDeg(Math.PI / 4)).toBeCloseTo(45);
      expect(radToDeg(Math.PI / 2)).toBeCloseTo(90);
      expect(radToDeg(Math.PI)).toBeCloseTo(180);
    });

    it('normalizes angles within [-PI, PI]', () => {
      expect(normalizeAngleRad(0)).toBeCloseTo(0);
      expect(normalizeAngleRad(Math.PI)).toBeCloseTo(Math.PI);
      expect(normalizeAngleRad(-Math.PI)).toBeCloseTo(-Math.PI);
      expect(normalizeAngleRad(Math.PI * 3)).toBeCloseTo(Math.PI);
      expect(normalizeAngleRad(-Math.PI * 3)).toBeCloseTo(-Math.PI);
      expect(normalizeAngleRad(Math.PI / 2 + Math.PI * 2)).toBeCloseTo(Math.PI / 2);
    });
  });

  describe('Pitch and Distance Clamping', () => {
    it('clamps pitch in degrees to [25, 65]', () => {
      expect(clampPitchDeg(CAMERA_DEFAULT_PITCH_DEG)).toBe(40);
      expect(clampPitchDeg(10)).toBe(CAMERA_MIN_PITCH_DEG); // 25
      expect(clampPitchDeg(25)).toBe(25);
      expect(clampPitchDeg(65)).toBe(65);
      expect(clampPitchDeg(80)).toBe(CAMERA_MAX_PITCH_DEG); // 65
    });

    it('clamps pitch in radians to [25°, 65°]', () => {
      const minRad = degToRad(CAMERA_MIN_PITCH_DEG);
      const maxRad = degToRad(CAMERA_MAX_PITCH_DEG);

      expect(clampPitchRad(degToRad(40))).toBeCloseTo(degToRad(40));
      expect(clampPitchRad(degToRad(10))).toBeCloseTo(minRad);
      expect(clampPitchRad(degToRad(75))).toBeCloseTo(maxRad);
    });

    it('clamps distance to [0, 20]', () => {
      expect(clampDistance(CAMERA_DEFAULT_DISTANCE)).toBe(12);
      expect(clampDistance(-5)).toBe(CAMERA_MIN_DISTANCE); // 0
      expect(clampDistance(7)).toBe(7);
      expect(clampDistance(18)).toBe(18);
      expect(clampDistance(25)).toBe(CAMERA_MAX_DISTANCE); // 20
    });
  });

  describe('Spherical to Cartesian Transformation', () => {
    it('computes default camera position at (6.5, 8.71, 6.5) for default angles and target (0, 1.0, 0)', () => {
      const yawRad = degToRad(CAMERA_DEFAULT_YAW_DEG); // 45°
      const pitchRad = degToRad(CAMERA_DEFAULT_PITCH_DEG); // 40°
      const distance = CAMERA_DEFAULT_DISTANCE; // 12
      const target = { x: 0, y: CAMERA_TARGET_HEIGHT_OFFSET, z: 0 }; // (0, 1.0, 0)

      const pos = sphericalToCartesian(yawRad, pitchRad, distance, target);

      // Distance 12:
      // Y = 1.0 + 12 * sin(40°) = 1.0 + 7.71345 = 8.71345
      // horizRadius = 12 * cos(40°) = 9.19253
      // X = 0 + 9.19253 * sin(45°) = 6.4999... ≈ 6.5
      // Z = 0 + 9.19253 * cos(45°) = 6.4999... ≈ 6.5
      expect(pos.x).toBeCloseTo(6.5, 1);
      expect(pos.y).toBeCloseTo(8.71, 1);
      expect(pos.z).toBeCloseTo(6.5, 1);
    });

    it('handles target offset properly', () => {
      const yawRad = 0; // facing +Z direction
      const pitchRad = 0; // horizontal
      const distance = 10;
      const target = { x: 5, y: 3, z: 2 };

      const pos = sphericalToCartesian(yawRad, pitchRad, distance, target);

      expect(pos.x).toBeCloseTo(5);
      expect(pos.y).toBeCloseTo(3);
      expect(pos.z).toBeCloseTo(12); // 2 + 10 * cos(0)
    });

    it('handles array target format [x, y, z]', () => {
      const yawRad = degToRad(90); // +X direction
      const pitchRad = 0;
      const distance = 10;
      const target: [number, number, number] = [1, 2, 3];

      const pos = sphericalToCartesian(yawRad, pitchRad, distance, target);

      expect(pos.x).toBeCloseTo(11); // 1 + 10 * sin(90°)
      expect(pos.y).toBeCloseTo(2);
      expect(pos.z).toBeCloseTo(3);
    });

    it('round-trips correctly with cartesianToSpherical', () => {
      const target = { x: 2, y: 1.2, z: -3 };
      const originalYaw = degToRad(45);
      const originalPitch = degToRad(40);
      const originalDistance = 12;

      const cartesian = sphericalToCartesian(originalYaw, originalPitch, originalDistance, target);
      const spherical = cartesianToSpherical(cartesian, target);

      expect(spherical.yaw).toBeCloseTo(originalYaw, 4);
      expect(spherical.pitch).toBeCloseTo(originalPitch, 4);
      expect(spherical.distance).toBeCloseTo(originalDistance, 4);
    });
  });

  describe('Orbit and Zoom Input Calculations', () => {
    it('applies orbit deltas to yaw and pitch with sensitivity', () => {
      const initialYaw = degToRad(45);
      const initialPitch = degToRad(40);

      const result = applyOrbitDelta(
        initialYaw,
        initialPitch,
        10, // deltaX
        5, // deltaY
        1.0, // sensitivity
        false // invertY
      );

      expect(result.yaw).not.toBe(initialYaw);
      expect(result.pitch).not.toBe(initialPitch);
      expect(result.pitch).toBeGreaterThanOrEqual(degToRad(CAMERA_MIN_PITCH_DEG));
      expect(result.pitch).toBeLessThanOrEqual(degToRad(CAMERA_MAX_PITCH_DEG));
    });

    it('scales orbit delta proportionally with sensitivity', () => {
      const initialYaw = degToRad(45);
      const initialPitch = degToRad(40);

      const normal = applyOrbitDelta(initialYaw, initialPitch, 10, 0, 1.0, false);
      const doubled = applyOrbitDelta(initialYaw, initialPitch, 10, 0, 2.0, false);

      const deltaNormal = initialYaw - normal.yaw;
      const deltaDoubled = initialYaw - doubled.yaw;

      expect(deltaDoubled).toBeCloseTo(deltaNormal * 2, 4);
    });

    it('inverts pitch delta when invertY is enabled', () => {
      const initialPitch = degToRad(40);

      const normal = applyOrbitDelta(0, initialPitch, 0, 10, 1.0, false);
      const inverted = applyOrbitDelta(0, initialPitch, 0, 10, 1.0, true);

      const normalDiff = normal.pitch - initialPitch;
      const invertedDiff = inverted.pitch - initialPitch;

      expect(invertedDiff).toBeCloseTo(-normalDiff, 4);
    });

    it('clamps pitch delta within [25°, 65°]', () => {
      const initialPitch = degToRad(40);

      // Extreme drag down
      const clampedMin = applyOrbitDelta(0, initialPitch, 0, -10000, 1.0, false);
      expect(clampedMin.pitch).toBeCloseTo(degToRad(CAMERA_MIN_PITCH_DEG), 4);

      // Extreme drag up
      const clampedMax = applyOrbitDelta(0, initialPitch, 0, 10000, 1.0, false);
      expect(clampedMax.pitch).toBeCloseTo(degToRad(CAMERA_MAX_PITCH_DEG), 4);
    });

    it('applies zoom deltas and clamps distance within [7, 18]', () => {
      const initialDist = 12;

      const zoomedIn = applyZoomDelta(initialDist, -2, 1.0);
      expect(zoomedIn).toBe(10);

      const zoomedOut = applyZoomDelta(initialDist, 3, 1.0);
      expect(zoomedOut).toBe(15);

      const clampedMin = applyZoomDelta(initialDist, -20, 1.0);
      expect(clampedMin).toBe(CAMERA_MIN_DISTANCE);

      const clampedMax = applyZoomDelta(initialDist, 50, 1.0);
      expect(clampedMax).toBe(CAMERA_MAX_DISTANCE);
    });
  });

  describe('Damping & Smoothing Helpers', () => {
    it('smoothly damps scalar value toward target', () => {
      const current = 10;
      const target = 20;
      const decay = 10;
      const dt = 0.016; // ~60fps frame

      const next = dampValue(current, target, decay, dt);
      expect(next).toBeGreaterThan(current);
      expect(next).toBeLessThan(target);

      // Over large delta time it reaches target
      const finished = dampValue(current, target, decay, 1.0);
      expect(finished).toBeCloseTo(target, 3);
    });

    it('smoothly damps angles using shortest arc', () => {
      const current = Math.PI - 0.1; // ~3.04 rad
      const target = -Math.PI + 0.1; // ~ -3.04 rad (difference is 0.2 rad across boundary)
      const decay = 10;
      const dt = 0.016;

      const next = dampAngle(current, target, decay, dt);

      // Should wrap across boundary rather than rotating 6 rad all the way backwards
      expect(next).toBeGreaterThan(current); // Moving forward toward PI / wrapping
    });

    it('smoothly damps 3D vectors', () => {
      const current = { x: 0, y: 1.2, z: 0 };
      const target = { x: 5, y: 1.2, z: -5 };
      const decay = 8;
      const dt = 0.016;

      const next = dampVector3(current, target, decay, dt);
      expect(next.x).toBeGreaterThan(0);
      expect(next.x).toBeLessThan(5);
      expect(next.y).toBeCloseTo(1.2);
      expect(next.z).toBeLessThan(0);
      expect(next.z).toBeGreaterThan(-5);
    });
  });

  describe('Camera Target Height Offset', () => {
    it('computes camera lookAt target with Y + 1.2 offset', () => {
      const playerPos = { x: 3, y: 0.5, z: -2 };
      const target = computeCameraTarget(playerPos);

      expect(target.x).toBe(3);
      expect(target.y).toBe(0.5 + CAMERA_TARGET_HEIGHT_OFFSET); // 1.7
      expect(target.z).toBe(-2);
    });

    it('handles player position array format', () => {
      const playerPos: [number, number, number] = [0, 0, 0];
      const target = computeCameraTarget(playerPos);

      expect(target.x).toBe(0);
      expect(target.y).toBe(CAMERA_TARGET_HEIGHT_OFFSET);
      expect(target.z).toBe(0);
    });
  });

  describe('Raycast Obstacle Collision Offset', () => {
    it('returns desired distance when there are no raycast hits', () => {
      const desiredDistance = 12;
      const hits: Array<{ distance: number }> = [];

      const distance = calculateCollisionOffsetDistance(desiredDistance, hits);
      expect(distance).toBe(12);
    });

    it('shortens distance when an obstruction is closer than desired distance', () => {
      const desiredDistance = 12;
      const buffer = 0.3;
      const hits = [{ distance: 9.5 }, { distance: 11.0 }];

      const distance = calculateCollisionOffsetDistance(desiredDistance, hits, buffer);
      // Shortest hit is 9.5 -> distance should be 9.5 - 0.3 = 9.2
      expect(distance).toBeCloseTo(9.2, 2);
    });

    it('clamps shortened collision distance to minimum distance', () => {
      const desiredDistance = 12;
      const buffer = 0.3;
      const hits = [{ distance: 5.0 }];
      const customMinDistance = 6.0;

      const distance = calculateCollisionOffsetDistance(
        desiredDistance,
        hits,
        buffer,
        customMinDistance
      );
      expect(distance).toBe(customMinDistance); // 5.0 - 0.3 = 4.7 -> clamped to 6.0
    });

    it('ignores hits further than desired distance', () => {
      const desiredDistance = 10;
      const hits = [{ distance: 14.0 }];

      const distance = calculateCollisionOffsetDistance(desiredDistance, hits);
      expect(distance).toBe(10);
    });
  });

  describe('Default Constants', () => {
    it('exports appropriate tuning defaults', () => {
      expect(DEFAULT_ORBIT_SENSITIVITY).toBe(0.005);
      expect(DEFAULT_ZOOM_SENSITIVITY).toBe(0.01);
      expect(DEFAULT_POSITION_DAMPING).toBe(8);
      expect(DEFAULT_ROTATION_DAMPING).toBe(10);
      expect(DEFAULT_DISTANCE_DAMPING).toBe(8);
      expect(DEFAULT_COLLISION_BUFFER).toBe(0.3);
    });
  });
});

describe('FollowCamera Scene Obstacle Filtering (isCameraObstacle)', () => {
  it('identifies standard visible meshes as camera obstacles', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.name = 'IslandTerrainCliff';
    mesh.visible = true;

    expect(isCameraObstacle(mesh)).toBe(true);
  });

  it('rejects invisible meshes', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.visible = false;

    expect(isCameraObstacle(mesh)).toBe(false);
  });

  it('rejects non-mesh objects like Groups or Lights', () => {
    const group = new THREE.Group();
    group.visible = true;
    expect(isCameraObstacle(group)).toBe(false);

    const light = new THREE.DirectionalLight();
    light.visible = true;
    expect(isCameraObstacle(light)).toBe(false);
  });

  it('rejects meshes that belong to Player character hierarchy', () => {
    const playerRoot = new THREE.Group();
    playerRoot.name = 'PlayerCharacter';

    const playerMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.5),
      new THREE.MeshBasicMaterial()
    );
    playerMesh.name = 'PlayerHead';
    playerRoot.add(playerMesh);

    expect(isCameraObstacle(playerMesh)).toBe(false);
  });

  it('rejects boundary sensors, killzones, and trigger volumes', () => {
    const sensorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(30, 1, 30),
      new THREE.MeshBasicMaterial()
    );
    sensorMesh.name = 'KillzoneSensor';
    expect(isCameraObstacle(sensorMesh)).toBe(false);

    sensorMesh.name = 'BoundarySensorNorth';
    expect(isCameraObstacle(sensorMesh)).toBe(false);

    sensorMesh.name = 'InteractionTrigger';
    expect(isCameraObstacle(sensorMesh)).toBe(false);

    sensorMesh.name = 'CameraGizmoHelper';
    expect(isCameraObstacle(sensorMesh)).toBe(false);
  });
});

describe('InputManager Camera Callback Wiring', () => {
  it('allows InputManager to trigger camera orbit and zoom callbacks', () => {
    const inputManager = new InputManager();
    let orbitDelta = { x: 0, y: 0 };
    let zoomDelta = 0;

    inputManager.onCameraOrbit = (dx, dy) => {
      orbitDelta = { x: dx, y: dy };
    };

    inputManager.onCameraZoom = (dz) => {
      zoomDelta = dz;
    };

    // Simulate touch orbit
    inputManager.touch.onOrbit?.(15, -10);
    expect(orbitDelta).toEqual({ x: 15, y: -10 });

    // Simulate touch pinch zoom
    inputManager.touch.onZoom?.(25);
    expect(zoomDelta).toBe(25);
  });

  it('updates camera yaw on InputManager and affects camera-relative movement calculations', () => {
    const inputManager = new InputManager();
    inputManager.attach(window);

    // Default yaw is 45°
    expect(inputManager.getCameraYaw()).toBeCloseTo(degToRad(CAMERA_DEFAULT_YAW_DEG));

    // Update yaw to 90° (Math.PI / 2)
    inputManager.setCameraYaw(Math.PI / 2);
    expect(inputManager.getCameraYaw()).toBeCloseTo(Math.PI / 2);

    // Provide joystick input forward (x=0, y=-1)
    inputManager.setJoystickInput(0, -1, true);
    const moveState = inputManager.update(16);

    // At yaw = 90°:
    // inputX = 0, inputZ = -1
    // worldX = inputX * cos(90) + inputZ * sin(90) = -1
    // worldZ = -inputX * sin(90) + inputZ * cos(90) = 0
    expect(moveState.moveVector.x).toBeCloseTo(-1, 4);
    expect(moveState.moveVector.z).toBeCloseTo(0, 4);

    inputManager.detach();
  });
});
