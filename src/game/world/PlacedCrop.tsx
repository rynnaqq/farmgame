import React from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { PlotData } from '../../state/storeTypes';
import { CropRenderer } from '../farming/CropRenderer';
import { FARM_BEDS, placementToWorldPoint } from './farmLayout';

export interface PlacedCropProps {
  plot: PlotData;
  onCropInteract?: (plotId: string) => void;
}

/**
 * PlacedCrop renders a single crop at its saved free placement (never at the
 * logical row/col slot) and forwards Water/Harvest interactions by slot id.
 */
export const PlacedCrop: React.FC<PlacedCropProps> = ({ plot, onCropInteract }) => {
  if (!plot.crop) return null;
  const bed = FARM_BEDS[plot.crop.placement.bedId];
  const point = placementToWorldPoint(plot.crop.placement, bed.soilHeight + 0.02);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onCropInteract?.(plot.id);
  };

  return (
    <group
      name={'PlacedCrop-' + plot.id}
      data-testid={'placed-crop-' + plot.id}
      position={[point.x, point.y, point.z]}
      onClick={handleClick}
    >
      <CropRenderer crop={plot.crop} />
    </group>
  );
};
