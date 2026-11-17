// The minimap and the full city map: a small painted map of Palm Harbor (districts, roads,
// river, pier, quay), the GPS route to the current objective, and blips for objectives, shops,
// the police and the player.
import { WORLD_W, WORLD_H } from '../core/config.js';
import { V_ROADS, H_ROADS, NV, NH, RIVER_ROW, BRIDGE_COLS, RIVER_Y0, RIVER_Y1, QUAY_Y, QUAY_Y0, SAND_X1, PIER, DISTRICTS, coastX, halfWidth } from '../city/layout.js';
import { nearestNode, findPath } from '../city/roads.js';
import { C, ui, display, roundRect, outlined } from './theme.js';

const MS = 0.14;
const TINT = { beach: '#5a3d58', downtown: '#333a52', oldtown: '#5b4636', suburbs: '#2f5540', docks: '#44474f' };
let mapCanvas = null;

function paintMap(city) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(WORLD_W * MS);
  c.height = Math.ceil(WORLD_H * MS);
  const g = c.getContext('2d');
  g.scale(MS, MS);
  g.fillStyle = '#143f5e';
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  // Land east of the coast, sand along it.
  g.fillStyle = '#263027';
  g.beginPath();
  g.moveTo(WORLD_W, 0);
  for (let y = 0; y <= WORLD_H; y += 40) g.lineTo(coastX(y), y);
  g.lineTo(WORLD_W, WORLD_H);
  g.fill();
  g.fillStyle = '#c9b88c';
  g.beginPath();
  for (let y = 0; y <= QUAY_Y0; y += 40) g.lineTo(coastX(y), y);
  g.lineTo(SAND_X1, QUAY_Y0);
  g.lineTo(SAND_X1, 0);
  g.fill();
  for (const b of city.blocks) {
    if (b.water) continue;
    g.fillStyle = TINT[b.district];
    g.fillRect(b.x, b.y, b.w, b.h);
  }
  g.fillStyle = 'rgba(255,255,255,0.1)';
  for (const b of city.buildings) if (!b.offshore && b.kind === 'box') g.fillRect(b.x, b.y, b.w, b.h);
  g.fillStyle = '#143f5e';
  g.fillRect(0, RIVER_Y0, WORLD_W, RIVER_Y1 - RIVER_Y0);
  g.fillRect(0, QUAY_Y, WORLD_W, WORLD_H - QUAY_Y);
  g.fillStyle = '#6a6d78';
  g.fillRect(SAND_X1, QUAY_Y0, WORLD_W - SAND_X1, QUAY_Y - QUAY_Y0);
  g.fillStyle = '#9a7a52';
  g.fillRect(PIER.x, PIER.y, PIER.w, PIER.h);
  g.fillStyle = '#8f93a6';
  const x0 = V_ROADS[0].x;
  const x1 = V_ROADS[NV - 1].x;
  for (const r of H_ROADS) g.fillRect(x0 - 26, r.y - halfWidth(r), x1 - x0 + 52, halfWidth(r) * 2);
  for (let i = 0; i < NV; i++) {
    const r = V_ROADS[i];
    const w = halfWidth(r) * 2;
    if (BRIDGE_COLS.includes(i)) g.fillRect(r.x - w / 2, H_ROADS[0].y, w, H_ROADS[NH - 1].y - H_ROADS[0].y);
    else {
      g.fillRect(r.x - w / 2, H_ROADS[0].y, w, H_ROADS[RIVER_ROW].y - H_ROADS[0].y);
      g.fillRect(r.x - w / 2, H_ROADS[RIVER_ROW + 1].y, w, H_ROADS[NH - 1].y - H_ROADS[RIVER_ROW + 1].y);
    }
  }
  return c;
}

const mapOf = (city) => mapCanvas ?? (mapCanvas = paintMap(city));

/** The GPS: road junctions from the player to a target, recomputed a few times a second. */
function routeTo(G, target) {
  const R = G.route ?? (G.route = { t: -1, pts: [] });
  if (G.time - R.t < 0.4 && R.tx === target.x && R.ty === target.y) return R.pts;
  R.t = G.time;
  R.tx = target.x;
  R.ty = target.y;
  const p = G.player;
  const roads = G.city.roads;
  const path = findPath(roads, nearestNode(roads, p.x, p.y).id, nearestNode(roads, target.x, target.y).id);
  R.pts = [[p.x, p.y], ...path.map((id) => [roads.nodes[id].x, roads.nodes[id].y]), [target.x, target.y]];
  if (R.pts.length > 3) {
    // Skip the first junction when it lies behind the player.
    const [a, b] = [R.pts[1], R.pts[2]];
    if (Math.hypot(b[0] - p.x, b[1] - p.y) < Math.hypot(b[0] - a[0], b[1] - a[1])) R.pts.splice(1, 1);
  }
  return R.pts;
}

function blip(ctx, x, y, m, u) {
  const r = (m.letter ? 8 : 5.5) * u;
  ctx.beginPath();
  if (m.kind === 'enemy') ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
  else ctx.arc(x, y, r, 0, 7);
  ctx.fillStyle = m.letter ? 'rgba(12,10,26,0.9)' : m.color;
  ctx.fill();
  ctx.strokeStyle = m.letter ? m.color : 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1.6 * u;
  ctx.stroke();
  if (m.letter) {
    ctx.fillStyle = m.color;
    ctx.font = ui(10.5, u);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.letter, x, y + 0.5 * u);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }
}

/**
 * The radar in the corner. `targets` are objective points (the first gets a route), `places`
 * are the shop letters.
 */
export function drawMinimap(ctx, G, x, y, size, u, targets, places) {
  const p = G.player;
  const map = mapOf(G.city);
  const span = p.vehicle ? 1500 : 1050;
  const k = size / span;
  const toX = (wx) => x + size / 2 + (wx - p.x) * k;
  const toY = (wy) => y + size / 2 + (wy - p.y) * k;
  ctx.save();
  roundRect(ctx, x, y, size, size, 16 * u);
  ctx.clip();
  ctx.fillStyle = '#143f5e';
  ctx.fillRect(x, y, size, size);
  ctx.drawImage(map, (p.x - span / 2) * MS, (p.y - span / 2) * MS, span * MS, span * MS, x, y, size, size);
  const main = targets.find((t) => t.kind !== 'next');
  if (main && Math.hypot(main.x - p.x, main.y - p.y) > 90) {
    const pts = routeTo(G, main);
    ctx.strokeStyle = main.color;
    ctx.lineWidth = 3.4 * u;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach((pt, i) => (i ? ctx.lineTo(toX(pt[0]), toY(pt[1])) : ctx.moveTo(toX(pt[0]), toY(pt[1]))));
    ctx.stroke();
  }
  const edge = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const pad = 9 * u;
  for (const s of places) {
    const sx = toX(s.x);
    const sy = toY(s.y);
    if (sx < x || sy < y || sx > x + size || sy > y + size) continue;
    blip(ctx, sx, sy, s, u * 0.82);
  }
  const flash = Math.floor(G.time * 5) % 2 === 0;
  for (const v of G.vehicles) {
    if (!v.spec.police || v.driver !== 'ai' || !v.siren) continue;
    blip(ctx, edge(toX(v.x), x + pad, x + size - pad), edge(toY(v.y), y + pad, y + size - pad), { color: flash ? '#ff3b3b' : '#4f8dff' }, u);
  }
  for (const o of G.people) if (o.role === 'cop' && !o.dead && G.wanted.level > 0) blip(ctx, toX(o.x), toY(o.y), { color: flash ? '#4f8dff' : '#ff3b3b' }, u * 0.7);
  if (G.helicopter) blip(ctx, edge(toX(G.helicopter.x), x + pad, x + size - pad), edge(toY(G.helicopter.y), y + pad, y + size - pad), { color: '#ffffff', letter: '✈' }, u * 0.8);
  for (const t of targets) blip(ctx, edge(toX(t.x), x + pad, x + size - pad), edge(toY(t.y), y + pad, y + size - pad), t, u);
  // The player: an arrow pointing the way they face.
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate(p.vehicle ? p.vehicle.angle : p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#14102a';
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.moveTo(9 * u, 0);
  ctx.lineTo(-6 * u, -6 * u);
  ctx.lineTo(-3 * u, 0);
  ctx.lineTo(-6 * u, 6 * u);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x, y, size, size, 16 * u);
  ctx.strokeStyle = G.wanted.level > 0 ? (flash ? '#ff4d5e' : '#4f8dff') : 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3 * u;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = ui(10, u);
  ctx.textAlign = 'center';
  outlined(ctx, 'N', x + size / 2, y + 13 * u, '#fff', 3 * u);
  ctx.textAlign = 'left';
}

/** The whole city with district names and a legend, for the pause screen. */
export function drawFullMap(ctx, G, x, y, w, h, u, targets, places) {
  const map = mapOf(G.city);
  const k = Math.min(w / WORLD_W, h / WORLD_H);
  const ox = x + (w - WORLD_W * k) / 2;
  const oy = y + (h - WORLD_H * k) / 2;
  ctx.save();
  roundRect(ctx, ox, oy, WORLD_W * k, WORLD_H * k, 12 * u);
  ctx.clip();
  ctx.drawImage(map, ox, oy, WORLD_W * k, WORLD_H * k);
  ctx.textAlign = 'center';
  ctx.font = display(17, u);
  const names = [[DISTRICTS.beach, 1020, 1000], [DISTRICTS.oldtown, 2600, 480], [DISTRICTS.downtown, 2420, 1900], [DISTRICTS.suburbs, 4500, 1500], [DISTRICTS.docks, 3100, 3500]];
  for (const [d, wx, wy] of names) outlined(ctx, d.name.toUpperCase(), ox + wx * k, oy + wy * k, d.color, 4 * u);
  ctx.font = ui(10, u, 'normal');
  outlined(ctx, 'Calypso River', ox + 3900 * k, oy + 2960 * k, '#9fd4ff', 3 * u);
  outlined(ctx, 'Heron Pier', ox + 520 * k, oy + 1650 * k, '#ffe2b0', 3 * u);
  ctx.textAlign = 'left';
  for (const s of places) blip(ctx, ox + s.x * k, oy + s.y * k, s, u * 0.95);
  for (const s of G.pelicans ?? []) if (G.pelicansFound.includes(s.id)) blip(ctx, ox + s.x * k, oy + s.y * k, { color: '#ffd23f' }, u * 0.5);
  for (const t of targets) blip(ctx, ox + t.x * k, oy + t.y * k, t, u * 1.2);
  const p = G.player;
  ctx.translate(ox + p.x * k, oy + p.y * k);
  ctx.rotate(p.vehicle ? p.vehicle.angle : p.angle);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = C.pink;
  ctx.lineWidth = 2.5 * u;
  ctx.beginPath();
  ctx.moveTo(11 * u, 0);
  ctx.lineTo(-7 * u, -7 * u);
  ctx.lineTo(-3 * u, 0);
  ctx.lineTo(-7 * u, 7 * u);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
  roundRect(ctx, ox, oy, WORLD_W * k, WORLD_H * k, 12 * u);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2.5 * u;
  ctx.stroke();
}
