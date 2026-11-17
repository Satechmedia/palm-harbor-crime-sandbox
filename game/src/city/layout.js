// The street plan of Palm Harbor: named avenues and streets on an uneven grid, the coastline,
// the Calypso River, the pier, and the five districts the blocks between the roads belong to.
import { LANE_W, SIDEWALK_W } from '../core/config.js';

/** North-south roads, west to east. `lanes` is lanes per direction. */
export const V_ROADS = [
  { x: 850, lanes: 2, name: 'Coral Boulevard' },
  { x: 1200, lanes: 1, name: 'Pelican Way' },
  { x: 1550, lanes: 2, name: 'Meridian Avenue' },
  { x: 1900, lanes: 1, name: 'Lime Street' },
  { x: 2250, lanes: 1, name: 'Tangerine Street' },
  { x: 2600, lanes: 2, name: 'Grand Paseo' },
  { x: 2950, lanes: 1, name: 'Marlin Street' },
  { x: 3300, lanes: 2, name: 'Flamingo Avenue' },
  { x: 3700, lanes: 1, name: 'Hibiscus Lane' },
  { x: 4100, lanes: 1, name: 'Mango Lane' },
  { x: 4500, lanes: 2, name: 'Sunrise Parkway' },
  { x: 4900, lanes: 1, name: 'Egret Lane' },
  { x: 5300, lanes: 1, name: 'Cypress Road' },
];

/** East-west roads, north to south. */
export const H_ROADS = [
  { y: 300, lanes: 1, name: 'Northshore Drive' },
  { y: 650, lanes: 2, name: 'Marisol Avenue' },
  { y: 1000, lanes: 1, name: 'Calle Rosa' },
  { y: 1350, lanes: 1, name: 'Banyan Street' },
  { y: 1700, lanes: 2, name: 'Heron Boulevard' },
  { y: 2050, lanes: 1, name: 'Starfish Street' },
  { y: 2400, lanes: 1, name: 'Sandpiper Street' },
  { y: 2750, lanes: 2, name: 'Riverside Drive' },
  { y: 3150, lanes: 2, name: 'Harbor Street' },
  { y: 3500, lanes: 1, name: 'Anchor Street' },
  { y: 3850, lanes: 2, name: 'Wharf Road' },
];

export const NV = V_ROADS.length;
export const NH = H_ROADS.length;
export const halfWidth = (road) => road.lanes * LANE_W;

/** The row of blocks that is the Calypso River, and the roads that bridge it. */
export const RIVER_ROW = 7;
export const BRIDGE_COLS = [0, 2, 5, 7, 10];
export const RIVER_Y0 = H_ROADS[RIVER_ROW].y + halfWidth(H_ROADS[RIVER_ROW]) + SIDEWALK_W;
export const RIVER_Y1 = H_ROADS[RIVER_ROW + 1].y - halfWidth(H_ROADS[RIVER_ROW + 1]) - SIDEWALK_W;

/** East edge of the beach sand (the boardwalk of Coral Boulevard starts here). */
export const SAND_X1 = V_ROADS[0].x - halfWidth(V_ROADS[0]) - SIDEWALK_W - 12;
/** South of this line the docks' quay drops into the harbour. */
export const QUAY_Y0 = H_ROADS[NH - 1].y + halfWidth(H_ROADS[NH - 1]) + SIDEWALK_W;
export const QUAY_Y = 4075;
/** The Heron Boulevard pier, reaching into the ocean. */
export const PIER = { x: 300, y: 1670, w: SAND_X1 - 300, h: 60 };

/** Where the ocean meets the sand at height y. */
export function coastX(y) {
  return 545 + Math.sin(y * 0.0021) * 42 + Math.sin(y * 0.0063 + 1.3) * 16;
}

/** The kerb-to-kerb rectangle of the block east of road i and south of road j (its sidewalk included). */
export function blockRect(i, j) {
  const a = V_ROADS[i];
  const b = V_ROADS[i + 1];
  const c = H_ROADS[j];
  const d = H_ROADS[j + 1];
  const x = a.x + halfWidth(a);
  const y = c.y + halfWidth(c);
  return { x, y, w: b.x - halfWidth(b) - x, h: d.y - halfWidth(d) - y };
}

export const DISTRICTS = {
  beach: { id: 'beach', name: 'Coral Strand', blurb: 'Pastel hotels and the boardwalk', color: '#ff8fb3', ground: 'pave' },
  downtown: { id: 'downtown', name: 'Meridian', blurb: 'Glass towers and banks', color: '#7fb6ff', ground: 'pave' },
  oldtown: { id: 'oldtown', name: 'Marisol', blurb: 'The old town and its market', color: '#ffb84d', ground: 'pave' },
  suburbs: { id: 'suburbs', name: 'Flamingo Heights', blurb: 'Lawns, pools and quiet money', color: '#8fe08a', ground: 'grass' },
  docks: { id: 'docks', name: 'Port Calypso', blurb: 'Containers, cranes and cold storage', color: '#c9b79a', ground: 'concrete' },
};

export function districtOfBlock(i, j) {
  if (j >= RIVER_ROW) return 'docks';
  if (i <= 1) return 'beach';
  if (i >= 7) return 'suburbs';
  if (j <= 1) return 'oldtown';
  return 'downtown';
}

export function districtAt(x, y) {
  if (y > RIVER_Y0 - 40) return DISTRICTS.docks;
  if (x < V_ROADS[2].x - 26) return DISTRICTS.beach;
  if (x > V_ROADS[7].x + 26) return DISTRICTS.suburbs;
  if (y < H_ROADS[2].y - 13) return DISTRICTS.oldtown;
  return DISTRICTS.downtown;
}

/** Index of the block column (or row) a coordinate falls in, or -1 outside the grid. */
export function gridIndex(roads, key, value) {
  for (let k = 0; k < roads.length - 1; k++) if (value >= roads[k][key] && value < roads[k + 1][key]) return k;
  return -1;
}
