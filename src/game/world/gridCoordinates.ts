import {
  PLOT_SIZE,
  PLOT_TOTAL_SIZE,
  MAX_GRID_SIZE,
} from '../core/constants';
import type { PlotId } from '../../state/storeTypes';

// ==========================================
// Coordinate Helper Functions
// ==========================================

export function getPlotPosition(
  row: number,
  col: number,
  gridSize: number = MAX_GRID_SIZE,
  yOffset: number = 0.05
): [number, number, number] {
  const colOffset = (col - (gridSize - 1) / 2) * PLOT_TOTAL_SIZE;
  const rowOffset = (row - (gridSize - 1) / 2) * PLOT_TOTAL_SIZE;
  return [colOffset, yOffset, rowOffset];
}

export interface GridBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  width: number;
  depth: number;
}

export function getGridBounds(gridSize: number = MAX_GRID_SIZE): GridBounds {
  const totalSpan = (gridSize - 1) * PLOT_TOTAL_SIZE + PLOT_SIZE;
  const halfSpan = totalSpan / 2;
  return {
    minX: -halfSpan,
    maxX: halfSpan,
    minZ: -halfSpan,
    maxZ: halfSpan,
    width: totalSpan,
    depth: totalSpan,
  };
}

export function isPlotUnlocked(
  row: number,
  col: number,
  currentGridSize: number
): boolean {
  return (
    row >= 0 && row < currentGridSize && col >= 0 && col < currentGridSize
  );
}

export function getPlotId(row: number, col: number): PlotId {
  return `plot-${row}-${col}`;
}

export function parsePlotId(
  plotId: string
): { row: number; col: number } | null {
  const match = /^plot-(\d+)-(\d+)$/.exec(plotId);
  if (!match) return null;
  return {
    row: parseInt(match[1], 10),
    col: parseInt(match[2], 10),
  };
}

export interface LockedPlotSlot {
  id: PlotId;
  row: number;
  col: number;
  position: [number, number, number];
  requiredGridSize: 6 | 8;
}

export function getLockedPlotSlots(
  currentGridSize: number,
  maxGridSize: number = MAX_GRID_SIZE
): LockedPlotSlot[] {
  const slots: LockedPlotSlot[] = [];

  for (let r = 0; r < maxGridSize; r++) {
    for (let c = 0; c < maxGridSize; c++) {
      if (!isPlotUnlocked(r, c, currentGridSize)) {
        const requiredGridSize: 6 | 8 = r < 6 && c < 6 ? 6 : 8;
        slots.push({
          id: getPlotId(r, c),
          row: r,
          col: c,
          position: getPlotPosition(r, c, maxGridSize),
          requiredGridSize,
        });
      }
    }
  }

  return slots;
}

export function worldToGridCoords(
  x: number,
  z: number,
  gridSize: number = MAX_GRID_SIZE
): { row: number; col: number } | null {
  const col = Math.round(x / PLOT_TOTAL_SIZE + (gridSize - 1) / 2);
  const row = Math.round(z / PLOT_TOTAL_SIZE + (gridSize - 1) / 2);

  if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
    const [plotX, , plotZ] = getPlotPosition(row, col, gridSize);
    if (
      Math.abs(x - plotX) <= PLOT_SIZE / 2 &&
      Math.abs(z - plotZ) <= PLOT_SIZE / 2
    ) {
      return { row, col };
    }
  }

  return null;
}

export function getPlotDistance(
  pos1: [number, number, number] | { x: number; z: number },
  pos2: [number, number, number] | { x: number; z: number }
): number {
  const x1 = Array.isArray(pos1) ? pos1[0] : pos1.x;
  const z1 = Array.isArray(pos1) ? pos1[2] : pos1.z;
  const x2 = Array.isArray(pos2) ? pos2[0] : pos2.x;
  const z2 = Array.isArray(pos2) ? pos2[2] : pos2.z;
  const dx = x1 - x2;
  const dz = z1 - z2;
  return Math.sqrt(dx * dx + dz * dz);
}
