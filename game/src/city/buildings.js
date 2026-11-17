// Fills a city block with what its district is made of: glass towers downtown, pastel hotels by
// the beach, painted shops in the old town, houses with pools in the suburbs, and warehouses,
// container yards and fuel tanks at the docks. Everything is described as data for the renderer.

export const PALETTES = {
  downtown: {
    walls: ['#9fb8cf', '#7d9cba', '#cfd9e0', '#5f86a8', '#c2ad94', '#8fb0aa', '#e0d6c4', '#6c93a0', '#b3c4d8', '#a79fc0'],
    roofs: ['#8d949c', '#a3a8ab', '#7b828a', '#b5b0a6', '#99a0a8'],
  },
  beach: {
    walls: ['#ffc2d4', '#b4f0df', '#fff0c2', '#9fe0f5', '#ffc09a', '#fbf3e6', '#dcc2ff', '#ffe58f', '#ff9eb5', '#8fe6d6'],
    roofs: ['#f6f1e7', '#ece4d6', '#dcf1ea', '#f9ddd3', '#e6eef5'],
  },
  oldtown: {
    walls: ['#e8795a', '#f5bd4e', '#38bfae', '#d94a5e', '#f7a35c', '#86cdea', '#edc867', '#cf7658', '#b26bd1', '#5fc27a'],
    roofs: ['#b9553c', '#cd6d4a', '#ab472f', '#dccfb8', '#a05a44', '#c9bca4'],
  },
  suburbs: {
    walls: ['#f8f0e2', '#f5dbc6', '#e1ead7', '#fbe4ae', '#e6d5ec', '#d9ebf4', '#f7cfc4'],
    roofs: ['#b9553c', '#8c5a44', '#6d7d8c', '#a54a3a', '#59656d', '#c57c52', '#3f6b78'],
  },
  docks: {
    walls: ['#8b9ba5', '#a59d90', '#7f9188', '#9e8c84', '#6f818e', '#b0a48c'],
    roofs: ['#7e8c95', '#9aa6aa', '#8c7a6e', '#6a7b87', '#a96d4f', '#5d7a8a'],
  },
};

export const CONTAINER_COLORS = ['#c9412f', '#2f89c6', '#2cae62', '#e98024', '#f2c511', '#8f48b0', '#18a48a', '#e8edf0', '#d65a7a'];

/** Made-up brands painted on rooftop signs. */
export const BRANDS = ['ZEPHYR COLA', 'KORALINE', 'NOVABANK', 'SUNDROP', 'PELICANO', 'AZURA', 'MIRAMARE', 'TIKI FM', 'ONDA', 'ORCHID', 'CABANA 9', 'LAGUNA AIR', 'MANGO MOBILE', 'HOTEL IBIS ROSA', 'PALMETTO'];
const SIGN_COLORS = ['#ff4f8b', '#36e0d0', '#ffd23f', '#ff8a3d', '#b98cff', '#7dff9a'];

export function newBuilding(city, spec) {
  const b = { id: city.buildings.length, kind: 'box', tiers: [], roofItems: [], floorH: 14, winW: 6, winGap: 4, roofStyle: 'flat', ...spec };
  if (!b.tiers.length && b.kind === 'box') b.tiers.push({ x: b.x, y: b.y, w: b.w, h: b.h, z0: 0, z1: b.z });
  city.buildings.push(b);
  return b;
}

/** Cuts a rectangle into lots no larger than maxSize, leaving alleys of `gap` between them. */
export function splitLots(rect, rng, maxSize, gap = 8, out = []) {
  const { x, y, w, h } = rect;
  if (w <= maxSize && h <= maxSize) {
    out.push(rect);
    return out;
  }
  if (w >= h) {
    const cut = Math.round(w * rng.range(0.4, 0.6));
    splitLots({ x, y, w: cut - gap / 2, h }, rng, maxSize, gap, out);
    splitLots({ x: x + cut + gap / 2, y, w: w - cut - gap / 2, h }, rng, maxSize, gap, out);
  } else {
    const cut = Math.round(h * rng.range(0.4, 0.6));
    splitLots({ x, y, w, h: cut - gap / 2 }, rng, maxSize, gap, out);
    splitLots({ x, y: y + cut + gap / 2, w, h: h - cut - gap / 2 }, rng, maxSize, gap, out);
  }
  return out;
}

/** Which sides of a lot look onto the street (the lot touches the block's inner edge there). */
function streetSides(block, lot) {
  const s = [];
  if (lot.y - block.inner.y < 12) s.push('N');
  if (block.inner.y + block.inner.h - (lot.y + lot.h) < 12) s.push('S');
  if (lot.x - block.inner.x < 12) s.push('W');
  if (block.inner.x + block.inner.w - (lot.x + lot.w) < 12) s.push('E');
  return s;
}

function addRoofItems(b, t, rng, district) {
  const items = b.roofItems;
  const area = t.w * t.h;
  const m = 7;
  if (t.w < 34 || t.h < 34) return;
  const spot = (w, h) => ({ x: t.x + m + rng() * Math.max(1, t.w - m * 2 - w), y: t.y + m + rng() * Math.max(1, t.h - m * 2 - h), w, h });
  if (district === 'downtown' && area > 6500 && rng.chance(0.3)) {
    items.push({ t: 'helipad', x: t.x + t.w / 2, y: t.y + t.h / 2, r: Math.min(t.w, t.h) * 0.3 });
  } else if (district === 'beach' && area > 4500 && rng.chance(0.55)) {
    const pw = t.w * rng.range(0.4, 0.6);
    const ph = t.h * rng.range(0.3, 0.45);
    items.push({ t: 'pool', x: t.x + (t.w - pw) / 2, y: t.y + m + 2, w: pw, h: ph });
    items.push({ t: 'garden', x: t.x + m, y: t.y + t.h - m - 12, w: t.w - m * 2, h: 10 });
  } else if (district !== 'docks' && rng.chance(0.3)) {
    items.push({ t: 'solar', ...spot(Math.min(40, t.w * 0.45), Math.min(26, t.h * 0.35)) });
  }
  const n = area > 9000 ? 3 : area > 3500 ? 2 : 1;
  for (let k = 0; k < n; k++) items.push({ t: 'ac', ...spot(rng.range(9, 16), rng.range(7, 12)) });
  if (rng.chance(0.5)) items.push({ t: 'hut', ...spot(14, 12) });
  if (rng.chance(0.25)) items.push({ t: 'tank', ...spot(12, 12) });
  if (b.z > 170 && rng.chance(0.65)) items.push({ t: 'antenna', x: t.x + t.w * rng.range(0.3, 0.7), y: t.y + t.h * rng.range(0.3, 0.7), z: rng.range(26, 50) });
  if (district !== 'docks' && t.w > 70 && rng.chance(0.3)) {
    const text = rng.pick(BRANDS);
    const size = Math.min(13, (t.w - 12) / (text.length * 0.62));
    items.push({ t: 'sign', x: t.x + t.w / 2, y: t.y + t.h - 10, text, size, color: rng.pick(SIGN_COLORS) });
  }
}

function addTower(city, block, lot, rng) {
  const district = block.district;
  const pal = PALETTES[district];
  const inset = district === 'beach' ? rng.range(8, 14) : rng.range(3, 6);
  const x = lot.x + inset;
  const y = lot.y + inset;
  const w = lot.w - inset * 2;
  const h = lot.h - inset * 2;
  if (w < 24 || h < 24) return null;
  let z = district === 'downtown' ? rng.range(80, 230) : district === 'beach' ? rng.range(46, 140) : rng.range(26, 56);
  if (district === 'downtown' && rng.chance(0.3)) z = rng.range(220, 320);
  const b = newBuilding(city, {
    x, y, w, h, z, district, wall: rng.pick(pal.walls), roof: rng.pick(pal.roofs),
    floorH: district === 'oldtown' ? 13 : 14, winW: rng.pick([5, 6, 8, 10]), winGap: rng.pick([3, 4, 5]),
    tiers: [{ x, y, w, h, z0: 0, z1: z }],
  });
  if (z > 100 && w > 64 && h > 64 && rng.chance(0.75)) {
    const zp = z * rng.range(0.2, 0.42);
    const k = rng.range(8, 15);
    b.tiers = [{ x, y, w, h, z0: 0, z1: zp }, { x: x + k, y: y + k, w: w - k * 2, h: h - k * 2, z0: zp, z1: z }];
    if (z > 210 && rng.chance(0.55)) {
      const k2 = k + rng.range(8, 14);
      const zt = z + rng.range(18, 36);
      b.tiers.push({ x: x + k2, y: y + k2, w: w - k2 * 2, h: h - k2 * 2, z0: z, z1: zt });
      b.z = zt;
    }
  }
  addRoofItems(b, b.tiers[b.tiers.length - 1], rng, district);
  if (district === 'oldtown' || (district === 'beach' && rng.chance(0.6))) {
    const col = rng.pick(['#e23d5b', '#1ea9a0', '#f29f2c', '#2f7fd1', '#f2f2f2', '#d94f9a']);
    b.awnings = streetSides(block, lot).map((side) => ({ side, col }));
  }
  return b;
}

/** A surface car park with painted stalls; its spots feed the parked-car spawner. */
export function addParkingLot(city, block, lot, rng, fill = 0.6) {
  block.decor.push({ t: 'lot', x: lot.x, y: lot.y, w: lot.w, h: lot.h });
  const n = Math.floor((lot.w - 12) / 26);
  const rows = lot.h > 112 ? [lot.y + 29, lot.y + lot.h - 29] : [lot.y + lot.h / 2];
  for (const ry of rows) {
    for (let k = 0; k < n; k++) {
      city.parking.push({ x: lot.x + 6 + (k + 0.5) * 26 + (lot.w - 12 - n * 26) / 2, y: ry, angle: rng.sign() * Math.PI / 2, chance: fill });
    }
  }
}

function addPlaza(city, block, lot, rng) {
  block.decor.push({ t: 'tiles', x: lot.x, y: lot.y, w: lot.w, h: lot.h });
  const cx = lot.x + lot.w / 2;
  const cy = lot.y + lot.h / 2;
  block.decor.push({ t: 'fountain', x: cx, y: cy, r: 17 });
  city.props.push({ kind: 'fountain', x: cx, y: cy, r: 17, solid: true });
  for (const [ox, oy] of [[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]]) {
    city.props.push({ kind: block.district === 'downtown' ? 'tree' : 'palm', x: lot.x + lot.w * ox, y: lot.y + lot.h * oy, v: rng.int(0, 2), solid: true, r: 4 });
  }
  for (let k = 0; k < 3; k++) {
    city.props.push({ kind: 'umbrella', x: lot.x + rng.range(18, lot.w - 18), y: lot.y + rng.range(18, lot.h - 18), v: rng.int(0, 5) });
  }
}

function addPoolGarden(city, block, lot, rng) {
  block.decor.push({ t: 'lawn', x: lot.x, y: lot.y, w: lot.w, h: lot.h });
  const pw = lot.w * 0.55;
  const ph = lot.h * 0.4;
  block.decor.push({ t: 'pool', x: lot.x + (lot.w - pw) / 2, y: lot.y + (lot.h - ph) / 2, w: pw, h: ph });
  for (let k = 0; k < 5; k++) {
    const edge = rng.chance(0.5);
    city.props.push({
      kind: rng.chance(0.6) ? 'palm' : 'umbrella', v: rng.int(0, 5), solid: false, r: 4,
      x: lot.x + (edge ? rng.range(8, lot.w - 8) : rng.pick([10, lot.w - 10])),
      y: lot.y + (edge ? rng.pick([10, lot.h - 10]) : rng.range(8, lot.h - 8)),
    });
  }
}

function addHouse(city, x, y, w, h, rng) {
  const pal = PALETTES.suburbs;
  return newBuilding(city, {
    x, y, w, h, z: rng.range(20, 26), roofStyle: 'hip', ridgeH: rng.range(10, 15), district: 'suburbs',
    wall: rng.pick(pal.walls), roof: rng.pick(pal.roofs), floorH: 12, winW: 6, winGap: 8,
  });
}

function fillSuburb(city, block, rect, rng) {
  const cols = Math.max(1, Math.floor(rect.w / 86));
  const cw = rect.w / cols;
  const rows = rect.h > 170 ? 2 : 1;
  const rh = rect.h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = { x: rect.x + c * cw, y: rect.y + r * rh, w: cw, h: rh };
      const front = rows === 2 ? (r === 0 ? 'N' : 'S') : cell.y + cell.h / 2 < block.y + block.h / 2 ? 'N' : 'S';
      if (rng.chance(0.06)) {
        for (let k = 0; k < 3; k++) city.props.push({ kind: 'tree', x: cell.x + rng.range(14, cw - 14), y: cell.y + rng.range(14, rh - 14), v: rng.int(0, 2), solid: true, r: 5 });
        continue;
      }
      const yard = Math.min(48, rh * 0.36);
      const hw = cw - rng.range(20, 28);
      const hd = Math.min(rh - yard - 22, rng.range(50, 62));
      const hx = cell.x + (cw - hw) / 2;
      const hy = front === 'N' ? cell.y + yard : cell.y + rh - yard - hd;
      addHouse(city, hx, hy, hw, hd, rng);
      const left = rng.chance(0.5);
      const dx = left ? cell.x + 8 : cell.x + cw - 32;
      const dy = front === 'N' ? cell.y : cell.y + rh - yard;
      block.decor.push({ t: 'drive', x: dx, y: dy, w: 24, h: yard });
      city.parking.push({ x: dx + 12, y: dy + yard / 2, angle: (front === 'N' ? 1 : -1) * Math.PI / 2, chance: 0.5 });
      const backY = front === 'N' ? hy + hd + 5 : cell.y + 5;
      const backH = rh - yard - hd - 10;
      if (backH > 18 && rng.chance(0.4)) {
        block.decor.push({ t: 'pool', x: hx + rng.range(4, 14), y: backY + 2, w: Math.min(34, hw - 24), h: Math.min(18, backH - 4) });
      } else if (backH > 12) {
        city.props.push({ kind: 'tree', x: hx + rng.range(10, hw - 10), y: backY + backH / 2, v: rng.int(0, 2), solid: true, r: 5 });
      }
      if (rng.chance(0.6)) {
        city.props.push({ kind: rng.chance(0.5) ? 'palm' : 'tree', x: left ? cell.x + cw - 16 : cell.x + 16, y: front === 'N' ? cell.y + yard * 0.45 : cell.y + rh - yard * 0.45, v: rng.int(0, 2), solid: true, r: 4 });
      }
    }
  }
}

function addWarehouse(city, block, lot, rng) {
  const pal = PALETTES.docks;
  const b = newBuilding(city, {
    x: lot.x + 4, y: lot.y + 4, w: lot.w - 8, h: lot.h - 8, z: rng.range(34, 58), roofStyle: 'ribbed', noWindows: true,
    district: 'docks', wall: rng.pick(pal.walls), roof: rng.pick(pal.roofs),
  });
  const n = Math.floor(b.w / 50);
  for (let k = 0; k < n; k++) b.roofItems.push({ t: 'skylight', x: b.x + 18 + k * 50, y: b.y + b.h * 0.3, w: 10, h: b.h * 0.4 });
  return b;
}

function addContainerYard(city, block, lot, rng) {
  block.decor.push({ t: 'yard', x: lot.x, y: lot.y, w: lot.w, h: lot.h });
  const horizontal = lot.w >= lot.h;
  const cl = 46;
  const cwid = 16;
  const along = Math.floor(((horizontal ? lot.w : lot.h) - 10) / (cl + 6));
  const across = Math.floor(((horizontal ? lot.h : lot.w) - 10) / (cwid + 4));
  for (let a = 0; a < along; a++) {
    for (let c = 0; c < across; c++) {
      if (c % 3 === 2 || rng.chance(0.25)) continue;
      const px = 8 + a * (cl + 6);
      const py = 8 + c * (cwid + 4);
      const x = horizontal ? lot.x + px : lot.x + py;
      const y = horizontal ? lot.y + py : lot.y + px;
      newBuilding(city, {
        x, y, w: horizontal ? cl : cwid, h: horizontal ? cwid : cl, z: 16 * rng.int(1, 3), roofStyle: 'ribbed', noWindows: true,
        container: true, district: 'docks', wall: rng.pick(CONTAINER_COLORS), roof: '#000000', sameRoof: true,
      });
    }
  }
}

function addTankFarm(city, block, lot, rng) {
  block.decor.push({ t: 'yard', x: lot.x, y: lot.y, w: lot.w, h: lot.h });
  const r = Math.min(44, Math.min(lot.w, lot.h) / 4 - 4);
  if (r < 14) return;
  for (const [ox, oy] of [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]]) {
    if (rng.chance(0.2)) continue;
    const cx = lot.x + lot.w * ox;
    const cy = lot.y + lot.h * oy;
    newBuilding(city, { kind: 'tank', x: cx - r, y: cy - r, w: r * 2, h: r * 2, cx, cy, r, z: rng.range(38, 62), district: 'docks', wall: rng.pick(['#e8e4da', '#cfd8dc', '#d9c9a8']), roof: '#f2efe8' });
  }
}

/** Fills one free rectangle of a block with its district's kind of buildings. */
export function fillDistrictLot(city, block, rect, rng) {
  const d = block.district;
  if (rect.w < 40 || rect.h < 40) return;
  if (d === 'suburbs') {
    fillSuburb(city, block, rect, rng);
    return;
  }
  const maxSize = { downtown: 150, beach: 150, oldtown: 100, docks: 215 }[d];
  for (const lot of splitLots(rect, rng, maxSize, d === 'docks' ? 12 : 8)) {
    if (lot.w < 34 || lot.h < 34) continue;
    const roll = rng();
    if (d === 'downtown') {
      if (roll < 0.8) addTower(city, block, lot, rng);
      else if (roll < 0.91) addParkingLot(city, block, lot, rng);
      else addPlaza(city, block, lot, rng);
    } else if (d === 'beach') {
      if (roll < 0.72) addTower(city, block, lot, rng);
      else if (roll < 0.84) addParkingLot(city, block, lot, rng);
      else addPoolGarden(city, block, lot, rng);
    } else if (d === 'oldtown') {
      if (roll < 0.86) addTower(city, block, lot, rng);
      else if (roll < 0.94) addParkingLot(city, block, lot, rng);
      else addPlaza(city, block, lot, rng);
    } else if (roll < 0.5) addWarehouse(city, block, lot, rng);
    else if (roll < 0.78) addContainerYard(city, block, lot, rng);
    else if (roll < 0.9) addTankFarm(city, block, lot, rng);
    else addParkingLot(city, block, lot, rng, 0.4);
  }
}

/** A whole block of lawn, paths, trees, a fountain and a sports court. */
export function buildPark(city, block, rng, name) {
  const r = block.inner;
  block.ground = 'grass';
  block.name = name;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  block.decor.push({ t: 'path', x: r.x, y: cy - 7, w: r.w, h: 14 });
  block.decor.push({ t: 'path', x: cx - 7, y: r.y, w: 14, h: r.h });
  block.decor.push({ t: 'tiles', x: cx - 34, y: cy - 34, w: 68, h: 68, round: true });
  block.decor.push({ t: 'fountain', x: cx, y: cy, r: 20 });
  city.props.push({ kind: 'fountain', x: cx, y: cy, r: 20, solid: true });
  block.decor.push({ t: 'court', x: r.x + 14, y: r.y + 14, w: 92, h: 52, sport: 'basket' });
  block.decor.push({ t: 'pond', x: r.x + r.w - 78, y: r.y + r.h - 62, w: 62, h: 44 });
  for (let k = 0; k < 20; k++) {
    const x = r.x + rng.range(10, r.w - 10);
    const y = r.y + rng.range(10, r.h - 10);
    if (Math.abs(x - cx) < 20 || Math.abs(y - cy) < 20) continue;
    if (x < r.x + 116 && y < r.y + 76) continue;
    if (x > r.x + r.w - 90 && y > r.y + r.h - 72) continue;
    city.props.push({ kind: rng.chance(0.3) ? 'palm' : 'tree', x, y, v: rng.int(0, 2), solid: true, r: 5 });
  }
  for (const [ox, oy] of [[-46, -18], [46, 18], [-18, 46], [18, -46]]) city.props.push({ kind: 'bench', x: cx + ox, y: cy + oy, a: Math.atan2(oy, ox) });
}

/** The old town's market square: paving, stalls under parasols, a fountain. */
export function buildMarket(city, block, rng, name) {
  const r = block.inner;
  block.name = name;
  block.decor.push({ t: 'tiles', x: r.x, y: r.y, w: r.w, h: r.h });
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  block.decor.push({ t: 'fountain', x: cx, y: cy, r: 22 });
  city.props.push({ kind: 'fountain', x: cx, y: cy, r: 22, solid: true });
  for (let gx = 0; gx < 6; gx++) {
    for (let gy = 0; gy < 5; gy++) {
      const x = r.x + 24 + gx * (r.w - 48) / 5;
      const y = r.y + 24 + gy * (r.h - 48) / 4;
      if (Math.hypot(x - cx, y - cy) < 50 || rng.chance(0.25)) continue;
      block.decor.push({ t: 'stall', x: x - 9, y: y - 6, w: 18, h: 12, v: rng.int(0, 4) });
      city.props.push({ kind: 'umbrella', x, y, v: rng.int(0, 5) });
    }
  }
  for (const [ox, oy] of [[0.04, 0.04], [0.96, 0.04], [0.04, 0.96], [0.96, 0.96]]) city.props.push({ kind: 'palm', x: r.x + r.w * ox, y: r.y + r.h * oy, v: rng.int(0, 2), solid: true, r: 4 });
}

/** A suburban recreation ground: tennis courts, a playground lawn and shade trees. */
export function buildSportsPark(city, block, rng, name) {
  const r = block.inner;
  block.ground = 'grass';
  block.name = name;
  block.decor.push({ t: 'court', x: r.x + 16, y: r.y + 16, w: 100, h: 54, sport: 'tennis' });
  block.decor.push({ t: 'court', x: r.x + 16, y: r.y + 84, w: 100, h: 54, sport: 'tennis' });
  block.decor.push({ t: 'pool', x: r.x + r.w - 110, y: r.y + 20, w: 90, h: 46 });
  block.decor.push({ t: 'path', x: r.x, y: r.y + r.h * 0.66, w: r.w, h: 12 });
  for (let k = 0; k < 16; k++) {
    const x = r.x + rng.range(12, r.w - 12);
    const y = r.y + rng.range(r.h * 0.7, r.h - 12);
    city.props.push({ kind: 'tree', x, y, v: rng.int(0, 2), solid: true, r: 5 });
  }
}
