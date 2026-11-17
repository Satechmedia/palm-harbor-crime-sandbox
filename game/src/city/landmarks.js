// The named places of Palm Harbor: the safehouse motel, the story's haunts, the hospital and
// police station you wake up at, and the shops. Each claims one side of a block, builds its
// own building with a rooftop sign and a forecourt, and records a marker point in city.places.
import { newBuilding } from './buildings.js';

export const LANDMARKS = [
  { id: 'safehouse', name: 'Seabreeze Motel', block: [0, 3], side: 'W', frac: 0.52, z: 34, wall: '#63d8cf', roof: '#f6f1e7', sign: 'SEABREEZE MOTEL', signColor: '#ff4f8b', letter: 'H', color: '#7dff9a', extra: 'pool' },
  { id: 'garage', name: 'Bravo Motors', block: [2, 1], side: 'S', frac: 0.56, z: 30, wall: '#f5bd4e', roof: '#c9553a', sign: 'BRAVO MOTORS', signColor: '#ffffff', roofStyle: 'ribbed', letter: 'T', color: '#ffd23f' },
  { id: 'records', name: 'Tidewater Records', block: [1, 5], side: 'N', frac: 0.5, z: 46, wall: '#ee5fa7', roof: '#3b2a4f', sign: 'TIDEWATER RECORDS', signColor: '#36e0d0', letter: 'J', color: '#ff7ad9' },
  { id: 'hospital', name: 'Saint Coral Medical', block: [5, 1], side: 'S', frac: 0.62, z: 74, wall: '#f4f6f8', roof: '#dfe6ec', sign: 'SAINT CORAL MEDICAL', signColor: '#e2374d', extra: 'cross', letter: '+', color: '#ff5d6c' },
  { id: 'police', name: 'PHPD Central', block: [4, 3], side: 'W', frac: 0.55, z: 66, wall: '#6f88ac', roof: '#46566d', sign: 'PHPD CENTRAL', signColor: '#cfe3ff', extra: 'helipad', letter: 'P', color: '#6fa8ff' },
  { id: 'casino', name: 'The Gilded Pelican', block: [5, 4], side: 'N', frac: 0.66, z: 300, wall: '#d9ae4c', roof: '#2c2333', sign: 'GILDED PELICAN', signColor: '#ffd23f', tower: true, letter: 'V', color: '#ffb000' },
  { id: 'gunshop', name: 'Brassworks Arms', block: [3, 6], side: 'E', frac: 0.42, z: 28, wall: '#5d6f59', roof: '#39453a', sign: 'BRASSWORKS', signColor: '#ffd23f', letter: 'G', color: '#ff9b3d' },
  { id: 'spray', name: 'Fresh Coat Garage', block: [7, 4], side: 'W', frac: 0.42, z: 26, wall: '#ff8a5c', roof: '#2f405e', sign: 'FRESH COAT', signColor: '#7dff9a', roofStyle: 'ribbed', letter: 'S', color: '#7de3ff' },
  { id: 'coldstore', name: 'Pier 9 Cold Storage', block: [6, 9], side: 'S', frac: 0.55, z: 46, wall: '#8fa6b3', roof: '#5d7a8a', sign: 'PIER 9', signColor: '#ffffff', roofStyle: 'ribbed', letter: 'M', color: '#4de1c1' },
  { id: 'depot', name: 'Kite Parcel Depot', block: [9, 8], side: 'N', frac: 0.5, z: 36, wall: '#f4d35e', roof: '#374b69', sign: 'KITE PARCEL', signColor: '#f4d35e', roofStyle: 'ribbed', letter: 'K', color: '#f4d35e' },
  { id: 'villa', name: 'Villa Vex', block: [10, 1], side: 'N', frac: 0.7, z: 40, wall: '#fff4e0', roof: '#b9553c', sign: '', signColor: '#fff', extra: 'pool', letter: 'V', color: '#ffb000' },
  { id: 'diner', name: 'Taco Tide', block: [1, 2], side: 'W', frac: 0.38, z: 22, wall: '#ffd23f', roof: '#e2374d', sign: 'TACO TIDE', signColor: '#ffffff', letter: 'F', color: '#ffd23f' },
  { id: 'cabs', name: 'Sol Cab Company', block: [3, 2], side: 'S', frac: 0.45, z: 32, wall: '#ffcf33', roof: '#3a3a44', sign: 'SOL CAB CO', signColor: '#ffcf33', roofStyle: 'ribbed', letter: 'C', color: '#ffcf33' },
];

/**
 * Builds a landmark on one side of a block's inner rectangle and returns the rectangle left
 * over for ordinary buildings.
 */
export function buildLandmark(city, block, lm, rng) {
  const r = block.inner;
  const gap = 8;
  const horizontal = lm.side === 'N' || lm.side === 'S';
  const lot = { ...r };
  const rest = { ...r };
  if (horizontal) {
    lot.h = Math.round(r.h * lm.frac);
    rest.h = r.h - lot.h - gap;
    if (lm.side === 'N') rest.y = r.y + lot.h + gap;
    else lot.y = r.y + r.h - lot.h;
  } else {
    lot.w = Math.round(r.w * lm.frac);
    rest.w = r.w - lot.w - gap;
    if (lm.side === 'W') rest.x = r.x + lot.w + gap;
    else lot.x = r.x + r.w - lot.w;
  }
  const yd = 58;
  const body = { x: lot.x + 3, y: lot.y + 3, w: lot.w - 6, h: lot.h - 6 };
  const yard = { ...lot };
  if (lm.side === 'N') { body.y += yd; body.h -= yd; yard.h = yd; }
  if (lm.side === 'S') { body.h -= yd; yard.y = lot.y + lot.h - yd; yard.h = yd; }
  if (lm.side === 'W') { body.x += yd; body.w -= yd; yard.w = yd; }
  if (lm.side === 'E') { body.w -= yd; yard.x = lot.x + lot.w - yd; yard.w = yd; }

  const b = newBuilding(city, {
    ...body, z: lm.z, wall: lm.wall, roof: lm.roof, district: block.district, roofStyle: lm.roofStyle ?? 'flat',
    name: lm.name, landmark: lm.id, winW: 8, winGap: 4, noWindows: lm.roofStyle === 'ribbed',
    tiers: [{ ...body, z0: 0, z1: lm.z }],
  });
  if (lm.tower) {
    b.tiers = [
      { ...body, z0: 0, z1: 60 },
      { x: body.x + 14, y: body.y + 12, w: body.w - 28, h: body.h - 24, z0: 60, z1: 250 },
      { x: body.x + 30, y: body.y + 26, w: body.w - 60, h: body.h - 52, z0: 250, z1: lm.z },
    ];
    b.roofItems.push({ t: 'antenna', x: body.x + body.w / 2, y: body.y + body.h / 2, z: 60 });
    b.gold = true;
  }
  const top = b.tiers[b.tiers.length - 1];
  if (lm.sign) {
    const rot = top.h > top.w * 1.25;
    const size = Math.min(16, ((rot ? top.h : top.w) - 10) / (lm.sign.length * 0.56));
    b.roofItems.push({ t: 'sign', x: top.x + top.w / 2 + (rot && lm.extra ? top.w * 0.3 : 0), y: top.y + top.h / 2 + (!rot && lm.extra ? top.h * 0.32 : 0), text: lm.sign, size, color: lm.signColor, big: true, rot });
  }
  if (lm.extra === 'cross') b.roofItems.push({ t: 'cross', x: top.x + top.w / 2, y: top.y + top.h * 0.36, r: Math.min(top.w, top.h) * 0.24 });
  if (lm.extra === 'helipad') b.roofItems.push({ t: 'helipad', x: top.x + top.w / 2, y: top.y + top.h * 0.36, r: Math.min(top.w, top.h) * 0.24 });
  if (lm.extra === 'pool') b.roofItems.push(top.h > top.w * 1.25 ? { t: 'pool', x: top.x + top.w * 0.14, y: top.y + top.h * 0.2, w: top.w * 0.36, h: top.h * 0.6 } : { t: 'pool', x: top.x + top.w * 0.2, y: top.y + top.h * 0.14, w: top.w * 0.6, h: top.h * 0.3 });
  b.roofItems.push({ t: 'ac', x: top.x + 6, y: top.y + 6, w: 12, h: 9 });

  block.decor.push({ t: 'lot', x: yard.x, y: yard.y, w: yard.w, h: yard.h, plain: true });
  let mx;
  let my;
  if (horizontal) {
    const n = Math.max(1, Math.floor(yard.w * 0.5 / 26));
    for (let k = 0; k < n; k++) city.parking.push({ x: yard.x + 10 + (k + 0.5) * 26, y: yard.y + yard.h / 2, angle: rng.sign() * Math.PI / 2, chance: 0.6, place: lm.id });
    mx = yard.x + yard.w * 0.76;
    my = yard.y + yard.h / 2;
  } else {
    const n = Math.max(1, Math.floor(yard.h * 0.5 / 26));
    for (let k = 0; k < n; k++) city.parking.push({ x: yard.x + yard.w / 2, y: yard.y + 10 + (k + 0.5) * 26, angle: rng.chance(0.5) ? 0 : Math.PI, chance: 0.6, place: lm.id });
    mx = yard.x + yard.w / 2;
    my = yard.y + yard.h * 0.76;
  }
  block.decor.push({ t: 'ring', x: mx, y: my, r: 15, color: lm.color });
  city.places[lm.id] = { id: lm.id, name: lm.name, x: mx, y: my, bx: body.x + body.w / 2, by: body.y + body.h / 2, letter: lm.letter, color: lm.color, yard, horizontal };
  return rest;
}
