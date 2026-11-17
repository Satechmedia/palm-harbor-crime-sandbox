// Small geometry helpers: scalars, angles, circle/rectangle tests and ray casts.

export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax, ay, bx, by) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay);

/** Moves `v` toward `target` by at most `step`. */
export function approach(v, target, step) {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

/** The signed shortest turn from angle `a` to angle `b`. */
export function angleDiff(a, b) {
  return wrapAngle(b - a);
}

/** Frame-rate independent smoothing factor for `rate` per second. */
export function damp(rate, dt) {
  return 1 - Math.exp(-rate * dt);
}

/**
 * Pushes a circle out of an axis-aligned rectangle. Returns null when they do not touch,
 * else the unit normal pointing out of the rectangle and how deep the circle sits in it.
 */
export function circleRectHit(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  let dx = cx - nx;
  let dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }
  // Centre is inside: leave by the nearest side.
  const left = cx - rect.x;
  const right = rect.x + rect.w - cx;
  const top = cy - rect.y;
  const bottom = rect.y + rect.h - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { nx: -1, ny: 0, depth: left + r };
  if (m === right) return { nx: 1, ny: 0, depth: right + r };
  if (m === top) return { nx: 0, ny: -1, depth: top + r };
  return { nx: 0, ny: 1, depth: bottom + r };
}

/** Distance along a ray (unit direction) to an axis-aligned rectangle, or Infinity. */
export function rayRect(ox, oy, dx, dy, rect) {
  let t0 = 0;
  let t1 = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (ox < rect.x || ox > rect.x + rect.w) return Infinity;
  } else {
    let a = (rect.x - ox) / dx;
    let b = (rect.x + rect.w - ox) / dx;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
  }
  if (Math.abs(dy) < 1e-9) {
    if (oy < rect.y || oy > rect.y + rect.h) return Infinity;
  } else {
    let a = (rect.y - oy) / dy;
    let b = (rect.y + rect.h - oy) / dy;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
  }
  return t0 <= t1 ? t0 : Infinity;
}

/** Distance along a ray (unit direction) to a circle, or Infinity. */
export function rayCircle(ox, oy, dx, dy, cx, cy, r) {
  const fx = cx - ox;
  const fy = cy - oy;
  const along = fx * dx + fy * dy;
  if (along < 0) return Infinity;
  const off2 = fx * fx + fy * fy - along * along;
  if (off2 > r * r) return Infinity;
  return Math.max(0, along - Math.sqrt(r * r - off2));
}

/** Convex hull (monotone chain) of [x, y] points, wound clockwise on a y-down canvas. */
export function convexHull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Multiplies a #rrggbb colour by `factor` and blends it toward `tint` ([r, g, b]) by `amount`. */
export function shadeHex(hex, factor, tint = null, amount = 0) {
  const n = parseInt(hex.slice(1), 16);
  let r = ((n >> 16) & 255) * factor;
  let g = ((n >> 8) & 255) * factor;
  let b = (n & 255) * factor;
  if (tint) {
    r += (tint[0] - r) * amount;
    g += (tint[1] - g) * amount;
    b += (tint[2] - b) * amount;
  }
  return `rgb(${clamp(r, 0, 255) | 0},${clamp(g, 0, 255) | 0},${clamp(b, 0, 255) | 0})`;
}
