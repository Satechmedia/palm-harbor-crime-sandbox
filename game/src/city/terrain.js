// What is underfoot at a point of the map: road, pavement, sand, grass, wood, concrete or water.
// Cars grip less on sand and grass, footsteps and tyre dust follow the surface.
import { V_ROADS, H_ROADS, RIVER_Y0, RIVER_Y1, QUAY_Y, QUAY_Y0, SAND_X1, PIER, coastX, gridIndex } from './layout.js';
import { roadAt } from './roads.js';

export function onPier(x, y) {
  return x > PIER.x && x < PIER.x + PIER.w + 12 && y > PIER.y && y < PIER.y + PIER.h;
}

export function isWater(x, y) {
  if (roadAt(x, y, true)) return false;
  if (x < coastX(y)) return !onPier(x, y);
  return (y > RIVER_Y0 && y < RIVER_Y1) || y > QUAY_Y;
}

export function surfaceAt(city, x, y) {
  if (roadAt(x, y)) return 'road';
  if (onPier(x, y)) return 'wood';
  if (isWater(x, y)) return 'water';
  if (x < SAND_X1) return 'sand';
  const i = gridIndex(V_ROADS, 'x', x);
  const j = gridIndex(H_ROADS, 'y', y);
  if (i < 0 || j < 0) return y > QUAY_Y0 ? 'concrete' : x < V_ROADS[0].x ? 'pave' : 'grass';
  const block = city.grid[i][j];
  const r = block.inner;
  if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return block.ground;
  return 'pave';
}

export const isSoftGround = (surface) => surface === 'sand' || surface === 'grass';
