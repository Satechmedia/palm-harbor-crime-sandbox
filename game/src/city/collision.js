// Static collision for the city: a uniform grid of building rectangles and solid props, with
// circle push-out for people and cars, ray casts for bullets and line of sight for the police.
import { WORLD_W, WORLD_H } from '../core/config.js';
import { circleRectHit, rayRect, rayCircle } from '../core/math.js';
import { RIVER_Y0, RIVER_Y1, QUAY_Y, BRIDGE_COLS, V_ROADS, halfWidth, coastX, PIER } from './layout.js';
import { SIDEWALK_W } from '../core/config.js';

const CELL = 200;

export function buildStaticIndex(city) {
  const cols = Math.ceil(WORLD_W / CELL);
  const rows = Math.ceil(WORLD_H / CELL);
  const grid = Array.from({ length: cols * rows }, () => ({ rects: [], circles: [] }));
  const index = { cols, rows, grid, rects: [], circles: [] };
  const addRect = (rect) => {
    index.rects.push(rect);
    const c0 = Math.max(0, Math.floor(rect.x / CELL));
    const c1 = Math.min(cols - 1, Math.floor((rect.x + rect.w) / CELL));
    const r0 = Math.max(0, Math.floor(rect.y / CELL));
    const r1 = Math.min(rows - 1, Math.floor((rect.y + rect.h) / CELL));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) grid[r * cols + c].rects.push(rect);
  };
  const addCircle = (circle) => {
    index.circles.push(circle);
    const c = Math.min(cols - 1, Math.max(0, Math.floor(circle.x / CELL)));
    const r = Math.min(rows - 1, Math.max(0, Math.floor(circle.y / CELL)));
    grid[r * cols + c].circles.push(circle);
  };
  for (const b of city.buildings) {
    if (b.offshore) continue;
    if (b.kind === 'tank') addCircle({ x: b.cx, y: b.cy, r: b.r, building: b });
    else addRect({ x: b.x, y: b.y, w: b.w, h: b.h, building: b, low: b.z < 20 });
  }
  // The river is a low wall between its bridges, the harbour a low wall past the quay.
  let x = 0;
  for (const i of BRIDGE_COLS) {
    const x0 = V_ROADS[i].x - halfWidth(V_ROADS[i]) - SIDEWALK_W;
    addRect({ x, y: RIVER_Y0 + 4, w: x0 - x, h: RIVER_Y1 - RIVER_Y0 - 8, low: true, water: true });
    x = V_ROADS[i].x + halfWidth(V_ROADS[i]) + SIDEWALK_W;
  }
  addRect({ x, y: RIVER_Y0 + 4, w: WORLD_W - x, h: RIVER_Y1 - RIVER_Y0 - 8, low: true, water: true });
  addRect({ x: 0, y: QUAY_Y, w: WORLD_W, h: WORLD_H - QUAY_Y, low: true, water: true });
  for (const p of city.props) if (p.solid) addCircle({ x: p.x, y: p.y, r: p.r ?? 4, prop: p, breakable: !!p.breakable });
  city.index = index;
}

function cellsAround(index, x, y, r, visit) {
  const c0 = Math.max(0, Math.floor((x - r) / CELL));
  const c1 = Math.min(index.cols - 1, Math.floor((x + r) / CELL));
  const r0 = Math.max(0, Math.floor((y - r) / CELL));
  const r1 = Math.min(index.rows - 1, Math.floor((y + r) / CELL));
  for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) visit(index.grid[rr * index.cols + cc]);
}

/**
 * Pushes a circle (entity with x, y) out of every static thing it overlaps. Returns the deepest
 * contact as { nx, ny, depth, rect | circle }, or null. Broken props no longer collide.
 */
export function pushOutOfStatics(city, e, radius) {
  let deepest = null;
  cellsAround(city.index, e.x, e.y, radius + 4, (cell) => {
    for (const rect of cell.rects) {
      const hit = circleRectHit(e.x, e.y, radius, rect);
      if (!hit) continue;
      e.x += hit.nx * hit.depth;
      e.y += hit.ny * hit.depth;
      if (!deepest || hit.depth > deepest.depth) deepest = { ...hit, rect };
    }
    for (const c of cell.circles) {
      if (c.prop && c.prop.down) continue;
      const dx = e.x - c.x;
      const dy = e.y - c.y;
      const rr = radius + c.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 0.001;
      const depth = rr - d;
      e.x += (dx / d) * depth;
      e.y += (dy / d) * depth;
      if (!deepest || depth > deepest.depth) deepest = { nx: dx / d, ny: dy / d, depth, circle: c };
    }
  });
  return deepest;
}

/** Distance along a ray to the first wall or solid prop (low walls and water do not stop it). */
export function raycastStatics(city, ox, oy, dx, dy, maxDist) {
  let best = maxDist;
  let hit = null;
  const steps = Math.max(1, Math.ceil(maxDist / 140));
  const seen = new Set();
  for (let s = 0; s <= steps; s++) {
    const t = (s / steps) * maxDist;
    if (t - 160 > best) break;
    cellsAround(city.index, ox + dx * t, oy + dy * t, 100, (cell) => {
      if (seen.has(cell)) return;
      seen.add(cell);
      for (const rect of cell.rects) {
        if (rect.low) continue;
        const d = rayRect(ox, oy, dx, dy, rect);
        if (d < best) {
          best = d;
          hit = rect;
        }
      }
      for (const c of cell.circles) {
        if (c.prop && (c.prop.down || c.r < 4)) continue;
        const d = rayCircle(ox, oy, dx, dy, c.x, c.y, c.r);
        if (d < best) {
          best = d;
          hit = c;
        }
      }
    });
  }
  return { dist: best, hit };
}

export function hasLineOfSight(city, ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay);
  if (d < 1) return true;
  return raycastStatics(city, ax, ay, (bx - ax) / d, (by - ay) / d, d).hit === null;
}

/** Keeps an entity on dry land or the pier, and inside the map. Returns true when it was moved. */
export function keepOnLand(e, margin = 26) {
  const x0 = e.x;
  const y0 = e.y;
  const shore = coastX(e.y) - margin;
  if (e.x < shore) {
    const top = PIER.y + 5;
    const bottom = PIER.y + PIER.h - 5;
    const onPier = e.y >= top && e.y <= bottom && e.x >= PIER.x + 5;
    if (!onPier) {
      const px = Math.max(e.x, PIER.x + 5);
      const py = Math.min(bottom, Math.max(top, e.y));
      if (Math.hypot(px - e.x, py - e.y) < shore - e.x) {
        e.x = px;
        e.y = py;
      } else e.x = shore;
    }
  }
  e.x = Math.min(WORLD_W - 50, Math.max(60, e.x));
  e.y = Math.min(WORLD_H - 60, Math.max(50, e.y));
  return e.x !== x0 || e.y !== y0;
}
