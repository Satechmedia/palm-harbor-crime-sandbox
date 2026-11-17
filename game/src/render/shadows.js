// Long sun shadows: every building tier throws the hull of its footprint slid along the sun's
// direction, all filled as one shape so overlapping shadows never darken twice.
import { L } from './lighting.js';
import { convexHull, TAU } from '../core/math.js';

function addHull(ctx, points) {
  const hull = convexHull(points);
  if (hull.length < 3) return;
  // Wind every hull the same way so the non-zero fill rule unions them.
  let area = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  if (area < 0) hull.reverse();
  ctx.moveTo(hull[0][0], hull[0][1]);
  for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i][0], hull[i][1]);
  ctx.closePath();
}

/** Fills the shadows of the given buildings on plane 0. */
export function drawBuildingShadows(ctx, buildings) {
  const sx = L.shadowX;
  const sy = L.shadowY;
  ctx.fillStyle = `rgba(26,14,64,${L.shadowAlpha})`;
  ctx.beginPath();
  for (const b of buildings) {
    if (b.offshore && b.z < 30) continue;
    if (b.kind === 'tank') {
      const pts = [];
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        const x = b.cx + Math.cos(a) * b.r;
        const y = b.cy + Math.sin(a) * b.r;
        pts.push([x, y], [x + sx * b.z, y + sy * b.z]);
      }
      addHull(ctx, pts);
      continue;
    }
    for (const t of b.tiers) {
      const top = t.z1 + (b.roofStyle === 'hip' ? b.ridgeH * 0.5 : 0);
      const pts = [];
      for (const z of [t.z0, top]) {
        const ox = sx * z;
        const oy = sy * z;
        pts.push([t.x + ox, t.y + oy], [t.x + t.w + ox, t.y + oy], [t.x + t.w + ox, t.y + t.h + oy], [t.x + ox, t.y + t.h + oy]);
      }
      addHull(ctx, pts);
    }
  }
  ctx.fill();
}

/** How far (world units) the longest visible shadow can reach: used to widen the culling box. */
export const shadowReach = () => 330 * Math.max(Math.abs(L.shadowX), Math.abs(L.shadowY));
