// Generates the whole city of Palm Harbor from a seed: the road graph, every block and its
// buildings, landmarks, street furniture, the beach and pier, the docks' quay and the outskirts.
import { SIDEWALK_W, WORLD_W } from '../core/config.js';
import { createRandom } from '../core/random.js';
import { buildRoadNetwork } from './roads.js';
import { NV, NH, RIVER_ROW, RIVER_Y0, RIVER_Y1, SAND_X1, QUAY_Y, QUAY_Y0, PIER, DISTRICTS, V_ROADS, blockRect, coastX, districtOfBlock, districtAt } from './layout.js';
import { fillDistrictLot, buildPark, buildMarket, buildSportsPark, newBuilding, CONTAINER_COLORS } from './buildings.js';
import { LANDMARKS, buildLandmark } from './landmarks.js';
import { buildStaticIndex } from './collision.js';

const SPECIAL_BLOCKS = { '3,4': [buildPark, 'Heron Park'], '4,0': [buildMarket, 'Plaza Marisol'], '9,3': [buildSportsPark, 'Flamingo Recreation Ground'] };

export function generateCity(seed) {
  const rng = createRandom((seed | 0) * 7919 + 101);
  const city = { seed, roads: buildRoadNetwork(), blocks: [], grid: [], buildings: [], props: [], decor: [], parking: [], places: {}, loops: [] };
  const landmarkOf = new Map(LANDMARKS.map((lm) => [lm.block.join(','), lm]));
  for (let i = 0; i < NV - 1; i++) {
    city.grid[i] = [];
    for (let j = 0; j < NH - 1; j++) {
      const r = blockRect(i, j);
      const district = districtOfBlock(i, j);
      const block = {
        i, j, ...r, district, ground: DISTRICTS[district].ground, decor: [], water: j === RIVER_ROW,
        inner: { x: r.x + SIDEWALK_W, y: r.y + SIDEWALK_W, w: r.w - SIDEWALK_W * 2, h: r.h - SIDEWALK_W * 2 },
      };
      city.blocks.push(block);
      city.grid[i][j] = block;
    }
  }
  for (const block of city.blocks) {
    if (block.water) continue;
    const key = `${block.i},${block.j}`;
    city.loops.push({ x: block.x + 8, y: block.y + 8, w: block.w - 16, h: block.h - 16, block });
    if (SPECIAL_BLOCKS[key]) {
      SPECIAL_BLOCKS[key][0](city, block, rng, SPECIAL_BLOCKS[key][1]);
      continue;
    }
    let rect = { ...block.inner };
    const lm = landmarkOf.get(key);
    if (lm) rect = buildLandmark(city, block, lm, rng);
    fillDistrictLot(city, block, rect, rng);
  }
  addStreetFurniture(city, rng);
  addBeach(city, rng);
  addQuay(city, rng);
  addOutskirts(city, rng);
  buildStaticIndex(city);
  return city;
}

/** Street lamps on alternating sides of every road, palms and trees opposite them, hydrants and bins. */
function addStreetFurniture(city, rng) {
  for (const seg of city.roads.segs) {
    const len = seg.horiz ? seg.x2 - seg.x1 : seg.y2 - seg.y1;
    const at = (t, side, off) => (seg.horiz ? [seg.x1 + t, seg.y1 + side * off] : [seg.x1 + side * off, seg.y1 + t]);
    const n = Math.max(1, Math.floor(len / 124));
    for (let k = 0; k < n; k++) {
      const t = ((k + 0.5) / n) * len;
      const side = k % 2 ? 1 : -1;
      const [x, y] = at(t, side, seg.hw + 5);
      city.props.push({ kind: 'lamp', x, y, ax: seg.horiz ? 0 : -side, ay: seg.horiz ? -side : 0, solid: true, breakable: true, r: 2.5 });
      if (seg.bridge) continue;
      const [px, py] = at(t, -side, seg.hw + 9);
      const d = districtAt(px, py).id;
      if (d === 'beach' || (seg.lanes === 2 && d !== 'docks')) {
        if (rng.chance(0.88)) city.props.push({ kind: 'palm', x: px, y: py, v: rng.int(0, 2), solid: true, r: 4 });
      } else if (d === 'suburbs' || d === 'downtown') {
        if (rng.chance(0.5)) city.props.push({ kind: 'tree', x: px, y: py, v: rng.int(0, 2), solid: true, r: 4, small: true });
      } else if (d === 'oldtown' && rng.chance(0.45)) city.props.push({ kind: 'palm', x: px, y: py, v: rng.int(0, 2), solid: true, r: 4 });
    }
    if (seg.bridge) continue;
    if (rng.chance(0.55)) {
      const [x, y] = at(rng.range(20, len - 20), rng.sign(), seg.hw + 4);
      city.props.push({ kind: 'hydrant', x, y, solid: true, breakable: true, r: 2.5 });
    }
    if (rng.chance(0.5)) {
      const [x, y] = at(rng.range(20, len - 20), rng.sign(), seg.hw + 11);
      city.props.push({ kind: 'bin', x, y, solid: true, breakable: true, r: 3 });
    }
    const d = districtAt(seg.x1, seg.y1).id;
    if ((d === 'oldtown' || d === 'beach') && rng.chance(0.6)) {
      const side = rng.sign();
      for (let k = 0; k < 3; k++) {
        const [x, y] = at(len * 0.3 + k * 26, side, seg.hw + 26);
        city.props.push({ kind: 'umbrella', x, y, v: rng.int(0, 5) });
      }
    }
  }
}

/** Palms along the boardwalk, parasols and towels on the sand, lifeguard huts, the pier and its boats. */
function addBeach(city, rng) {
  const inRiver = (y) => y > RIVER_Y0 - 30 && y < RIVER_Y1 + 30;
  const nearPier = (y) => y > PIER.y - 30 && y < PIER.y + PIER.h + 30;
  for (let y = 290; y < QUAY_Y0 - 20; y += rng.range(44, 66)) {
    if (inRiver(y) || nearPier(y)) continue;
    city.props.push({ kind: 'palm', x: SAND_X1 + 5, y, v: rng.int(0, 2), solid: true, r: 4 });
    if (rng.chance(0.4)) city.props.push({ kind: 'palm', x: rng.range(coastX(y) + 90, SAND_X1 - 24), y: y + rng.range(-16, 16), v: rng.int(0, 2), solid: true, r: 4 });
  }
  for (let y = 330; y < RIVER_Y0 - 40; y += rng.range(30, 46)) {
    if (nearPier(y)) continue;
    const n = rng.int(1, 2);
    for (let k = 0; k < n; k++) {
      const x = rng.range(coastX(y) + 34, SAND_X1 - 34);
      city.props.push({ kind: 'umbrella', x, y: y + rng.range(-8, 8), v: rng.int(0, 5) });
      city.decor.push({ t: 'towel', x: x + rng.range(8, 16), y: y + rng.range(-6, 10), w: 9, h: 18, v: rng.int(0, 5), a: rng.range(-0.4, 0.4) });
      if (rng.chance(0.5)) city.decor.push({ t: 'towel', x: x - rng.range(16, 24), y: y + rng.range(-6, 10), w: 9, h: 18, v: rng.int(0, 5), a: rng.range(-0.4, 0.4) });
    }
  }
  for (const y of [520, 1120, 2260]) {
    const x = coastX(y) + 96;
    newBuilding(city, { x, y, w: 22, h: 22, z: 20, wall: '#fbf3e6', roof: '#e2374d', district: 'beach', noWindows: true, roofItems: [{ t: 'cross', x: x + 11, y: y + 11, r: 7, white: true }] });
  }
  city.decor.push({ t: 'volley', x: coastX(900) + 70, y: 880, w: 70, h: 36 });
  city.decor.push({ t: 'volley', x: coastX(2000) + 80, y: 1980, w: 70, h: 36 });
  city.decor.push({ t: 'pier', ...PIER });
  for (let x = PIER.x + 30; x < PIER.x + PIER.w - 10; x += 92) {
    city.props.push({ kind: 'lamp', x, y: PIER.y + 4, ax: 0, ay: 1, solid: false });
    city.props.push({ kind: 'bench', x: x + 40, y: PIER.y + PIER.h - 7, a: 0 });
  }
  for (const [bx, side, v] of [[340, -1, 2], [410, 1, 1], [470, -1, 0], [545, 1, 2]]) {
    city.props.push({ kind: 'boat', x: bx, y: side < 0 ? PIER.y - 20 : PIER.y + PIER.h + 20, a: side < 0 ? 0 : Math.PI, v });
  }
  for (const [bx, by, a, v] of [[180, 900, 1.2, 1], [240, 2300, -1.9, 2], [140, 3300, 1.5, 0], [300, 520, 0.4, 0]]) city.props.push({ kind: 'boat', x: bx, y: by, a, v });
  for (const [bx, a, v] of [[1260, 0.05, 0], [2180, 3.1, 1], [3600, 0, 2], [4250, 3.2, 0], [5050, 0.1, 1]]) city.props.push({ kind: 'boat', x: bx, y: (RIVER_Y0 + RIVER_Y1) / 2 + rng.range(-70, 70), a, v });
}

/** The working waterfront: gantry cranes, stacked containers on the quay and moored freighters. */
function addQuay(city, rng) {
  city.decor.push({ t: 'quay', x: SAND_X1, y: QUAY_Y0, w: WORLD_W - SAND_X1, h: QUAY_Y - QUAY_Y0 });
  for (const x of [1500, 2350, 3200, 4050, 4900]) city.props.push({ kind: 'crane', x, y: QUAY_Y - 48, v: rng.int(0, 1) });
  for (let x = 980; x < 5500; x += rng.range(70, 150)) {
    if (rng.chance(0.3)) continue;
    const stack = rng.int(1, 3);
    for (let k = 0; k < stack; k++) {
      newBuilding(city, { x, y: QUAY_Y0 + 22 + k * 20, w: 46, h: 16, z: 16 * rng.int(1, 3), roofStyle: 'ribbed', noWindows: true, container: true, district: 'docks', wall: rng.pick(CONTAINER_COLORS), sameRoof: true });
    }
  }
  for (const [sx, len] of [[1750, 520], [3350, 600], [4500, 460]]) {
    city.decor.push({ t: 'ship', x: sx, y: QUAY_Y + 22, w: len, h: 96 });
    for (let x = sx + 60; x < sx + len - 110; x += 52) {
      for (let row = 0; row < 3; row++) {
        if (rng.chance(0.2)) continue;
        newBuilding(city, { x, y: QUAY_Y + 34 + row * 22, w: 46, h: 16, z: 22 + 16 * rng.int(0, 2), roofStyle: 'ribbed', noWindows: true, container: true, offshore: true, district: 'docks', wall: rng.pick(CONTAINER_COLORS), sameRoof: true });
      }
    }
    newBuilding(city, { x: sx + len - 96, y: QUAY_Y + 36, w: 50, h: 68, z: 58, wall: '#f2efe8', roof: '#d9d4c8', offshore: true, district: 'docks', winW: 5, winGap: 4 });
  }
}

/** Woods beyond the last roads, north and east, that close the map off. */
function addOutskirts(city, rng) {
  const east = V_ROADS[NV - 1].x + 46;
  for (let k = 0; k < 190; k++) city.props.push({ kind: rng.chance(0.25) ? 'palm' : 'tree', x: rng.range(SAND_X1 + 20, WORLD_W - 30), y: rng.range(40, 250), v: rng.int(0, 2), solid: true, r: 5 });
  for (let k = 0; k < 230; k++) city.props.push({ kind: rng.chance(0.2) ? 'palm' : 'tree', x: rng.range(east, WORLD_W - 30), y: rng.range(250, QUAY_Y0 - 10), v: rng.int(0, 2), solid: true, r: 5 });
}
