import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FarmBeds } from './FarmBeds';
import { resetUiStore } from '../../state/uiStore';

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drei-html">{children}</div>
  ),
}));

vi.mock('@react-three/rapier', () => ({
  RigidBody: ({ children }: { children: React.ReactNode }) => (
    <group data-testid="rigid-body">{children}</group>
  ),
  CylinderCollider: () => <mesh data-testid="cylinder-collider" />,
  CuboidCollider: () => <mesh data-testid="cuboid-collider" />,
}));

/**
 * Fires a pointerUp carrying a custom R3F `point` intersection, which
 * testing-library's fireEvent cannot inject as an event property.
 */
function fireR3FPointerUp(
  element: Element,
  init: { clientX: number; clientY: number; point?: { x: number; y: number; z: number } }
) {
  const event = new PointerEvent('pointerup', {
    bubbles: true,
    clientX: init.clientX,
    clientY: init.clientY,
  });
  Object.defineProperty(event, 'point', { value: init.point });
  element.dispatchEvent(event);
}

describe('FarmBeds', () => {
  beforeEach(() => {
    resetUiStore();
  });

  it('renders exactly four continuous soil surfaces', () => {
    render(<FarmBeds plantingEnabled onPlantAt={vi.fn()} />);
    for (const bedId of [
      'north-west',
      'north-east',
      'south-west',
      'south-east',
    ] as const) {
      expect(screen.getByTestId(`farm-bed-${bedId}-soil`)).toBeInTheDocument();
    }
  });

  it('forwards the exact R3F soil intersection as a placement', () => {
    const onPlantAt = vi.fn();
    render(<FarmBeds plantingEnabled onPlantAt={onPlantAt} />);
    const soil = screen.getByTestId('farm-bed-north-west-soil');

    fireEvent.pointerDown(soil, { clientX: 100, clientY: 120 });
    fireR3FPointerUp(soil, {
      clientX: 104,
      clientY: 123,
      point: { x: -4.1374, y: 0.2, z: -3.0126 },
    });

    expect(onPlantAt).toHaveBeenCalledTimes(1);
    expect(onPlantAt).toHaveBeenCalledWith({
      bedId: 'north-west',
      localX: -0.337,
      localZ: 0.487,
    });
  });

  it('does not plant after a camera drag greater than six pixels', () => {
    const onPlantAt = vi.fn();
    render(<FarmBeds plantingEnabled onPlantAt={onPlantAt} />);
    const soil = screen.getByTestId('farm-bed-south-east-soil');
    fireEvent.pointerDown(soil, { clientX: 10, clientY: 10 });
    fireR3FPointerUp(soil, {
      clientX: 17,
      clientY: 10,
      point: { x: 3.8, y: 0.2, z: 3.5 },
    });
    expect(onPlantAt).not.toHaveBeenCalled();
  });

  it('allows a drag within the six-pixel tolerance', () => {
    const onPlantAt = vi.fn();
    render(<FarmBeds plantingEnabled onPlantAt={onPlantAt} />);
    const soil = screen.getByTestId('farm-bed-south-east-soil');
    fireEvent.pointerDown(soil, { clientX: 10, clientY: 10 });
    fireR3FPointerUp(soil, {
      clientX: 16,
      clientY: 10,
      point: { x: 3.8, y: 0.2, z: 3.5 },
    });
    expect(onPlantAt).toHaveBeenCalledWith({
      bedId: 'south-east',
      localX: 0,
      localZ: 0,
    });
  });

  it('ignores taps on frame or corridor points', () => {
    const onPlantAt = vi.fn();
    render(<FarmBeds plantingEnabled onPlantAt={onPlantAt} />);
    const soil = screen.getByTestId('farm-bed-north-west-soil');

    // Corridor center (0, 0) lies outside every bed.
    fireEvent.pointerDown(soil, { clientX: 50, clientY: 50 });
    fireR3FPointerUp(soil, {
      clientX: 50,
      clientY: 50,
      point: { x: 0, y: 0.2, z: 0 },
    });
    expect(onPlantAt).not.toHaveBeenCalled();
  });

  it('does nothing when planting is disabled or callback missing', () => {
    const onPlantAt = vi.fn();
    const { rerender } = render(<FarmBeds plantingEnabled={false} onPlantAt={onPlantAt} />);
    const soil = screen.getByTestId('farm-bed-north-west-soil');
    fireEvent.pointerDown(soil, { clientX: 1, clientY: 1 });
    fireR3FPointerUp(soil, {
      clientX: 1,
      clientY: 1,
      point: { x: -3.8, y: 0.2, z: -3.5 },
    });
    expect(onPlantAt).not.toHaveBeenCalled();

    rerender(<FarmBeds plantingEnabled />);
    const soilAgain = screen.getByTestId('farm-bed-north-west-soil');
    fireEvent.pointerDown(soilAgain, { clientX: 2, clientY: 2 });
    fireR3FPointerUp(soilAgain, {
      clientX: 2,
      clientY: 2,
      point: { x: -3.8, y: 0.2, z: -3.5 },
    });
    expect(onPlantAt).not.toHaveBeenCalled();
  });

  it('does not plant on pointerUp without a preceding pointerDown', () => {
    const onPlantAt = vi.fn();
    render(<FarmBeds plantingEnabled onPlantAt={onPlantAt} />);
    const soil = screen.getByTestId('farm-bed-north-west-soil');
    fireR3FPointerUp(soil, {
      clientX: 5,
      clientY: 5,
      point: { x: -3.8, y: 0.2, z: -3.5 },
    });
    expect(onPlantAt).not.toHaveBeenCalled();
  });
});
