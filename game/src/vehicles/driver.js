// The hands and feet of every computer driver: turns "go to this point at this speed" into
// throttle and steering, sees what is in the way ahead, and backs out when it gets stuck.
import { clamp, angleDiff } from '../core/math.js';

/** Controls that steer vehicle v toward (tx, ty) and hold `wantSpeed`. */
export function steerToward(v, tx, ty, wantSpeed) {
  const turn = angleDiff(v.angle, Math.atan2(ty - v.y, tx - v.x));
  const steer = clamp(turn * 2.2, -1, 1);
  const want = wantSpeed * (1 - 0.55 * clamp(Math.abs(turn) / 1.2, 0, 1));
  let throttle;
  if (v.speed < want - 12) throttle = 1;
  else if (v.speed > want + 30) throttle = -1;
  else if (v.speed > want + 6) throttle = 0;
  else throttle = 0.35;
  if (wantSpeed <= 0) throttle = v.speed > 6 ? -1 : 0;
  return { throttle, steer, handbrake: wantSpeed <= 0 && Math.abs(v.speed) < 12 };
}

/**
 * Distance to the nearest car or person inside the lane ahead of v (a box `range` long),
 * or Infinity. `ignore` is left out (a pursuer does not brake for its quarry).
 */
export function obstacleAhead(G, v, range, ignore = null) {
  const c = Math.cos(v.angle);
  const s = Math.sin(v.angle);
  const half = v.spec.wid * 0.5 + 2;
  const nose = v.spec.len * 0.5;
  let best = Infinity;
  const test = (x, y, pad) => {
    const dx = x - v.x;
    const dy = y - v.y;
    const along = dx * c + dy * s - nose;
    if (along < -4 || along > range + pad) return;
    if (Math.abs(-dx * s + dy * c) > half + pad * 0.3) return;
    if (along - pad < best) best = Math.max(0, along - pad);
  };
  for (const o of G.vehicles) {
    if (o === v || o === ignore) continue;
    if (Math.abs(o.x - v.x) > range + 80 || Math.abs(o.y - v.y) > range + 80) continue;
    // Oncoming traffic keeps to its own lane: only what travels our way or stands still is in the way.
    if (Math.abs(o.speed) > 30 && Math.cos(o.angle - v.angle) < -0.4) continue;
    const oc = Math.cos(o.angle) * o.spec.len * 0.3;
    const os = Math.sin(o.angle) * o.spec.len * 0.3;
    test(o.x + oc, o.y + os, 11);
    test(o.x - oc, o.y - os, 11);
  }
  for (const p of G.people) if (!p.dead && !p.vehicle && p !== ignore) test(p.x, p.y, 4);
  const pl = G.player;
  if (pl && pl !== ignore && !pl.vehicle) test(pl.x, pl.y, 4);
  return best;
}

/**
 * Wraps a driver's controls with a way out of jams: when the car has wanted to move and has
 * not for a while, it reverses with opposite lock for a moment.
 */
export function unstick(v, ctl, dt) {
  const ai = v.ai;
  if (ai.reverseT > 0) {
    ai.reverseT -= dt;
    return { throttle: -1, steer: -ctl.steer, handbrake: false };
  }
  if (ctl.throttle > 0 && Math.abs(v.speed) < 14) ai.jamT = (ai.jamT ?? 0) + dt;
  else ai.jamT = 0;
  if (ai.jamT > 1.1) {
    ai.jamT = 0;
    ai.reverseT = 0.9;
  }
  return ctl;
}
