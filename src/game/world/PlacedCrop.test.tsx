import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlacedCrop } from './PlacedCrop';
import { createPlacedPlot } from '../../test/farmFixtures';

vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

vi.mock('../farming/CropRenderer', () => ({
  CropRenderer: () => <mesh data-testid="crop-renderer-mesh" />,
}));

describe('PlacedCrop', () => {
  it('renders a crop from placement rather than row and col', () => {
    const plot = createPlacedPlot('plot-7-7', {
      bedId: 'north-west',
      localX: 0.125,
      localZ: -0.875,
    });
    render(<PlacedCrop plot={plot} onCropInteract={vi.fn()} />);
    const node = screen.getByTestId('placed-crop-plot-7-7');
    expect(node).toHaveAttribute('position', '-3.675,0.24,-4.375');
  });

  it('returns null for an empty slot', () => {
    const plot = {
      id: 'plot-0-0',
      row: 0,
      col: 0,
      crop: null,
      hydratedUntilUtcMs: 0,
    };
    const { container } = render(<PlacedCrop plot={plot} onCropInteract={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('forwards the slot id on crop click', () => {
    const onCropInteract = vi.fn();
    const plot = createPlacedPlot('plot-3-2', {
      bedId: 'south-east',
      localX: 1,
      localZ: 1,
    });
    render(<PlacedCrop plot={plot} onCropInteract={onCropInteract} />);
    fireEvent.click(screen.getByTestId('placed-crop-plot-3-2'));
    expect(onCropInteract).toHaveBeenCalledWith('plot-3-2');
  });

  it('places every bed correctly in world space', () => {
    const cases = [
      ['north-east', 0, 0, '3.8,0.24,-3.5'],
      ['south-west', 0, 0, '-3.8,0.24,3.5'],
      ['south-east', -2.55, 2.25, '1.25,0.24,5.75'],
    ] as const;
    for (const [bedId, localX, localZ, position] of cases) {
      const plot = createPlacedPlot('plot-0-0', { bedId, localX, localZ });
      const { unmount } = render(<PlacedCrop plot={plot} onCropInteract={vi.fn()} />);
      expect(screen.getByTestId('placed-crop-plot-0-0')).toHaveAttribute('position', position);
      unmount();
    }
  });
});
