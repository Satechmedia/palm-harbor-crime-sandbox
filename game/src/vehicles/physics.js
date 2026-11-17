// Arcade car physics: throttle, braking, steering that tightens at low speed, sideways grip
// that lets go under the handbrake (drifts and skid marks), softer grip on sand and grass,
// bouncing off buildings, knocking over street furniture and shunting other cars.
import { VEHICLES } from './catalog.js';
import { clamp, approach, wrapAngle } from '../core/math.js';
import { pushOutOfStatics, keepOnLand } from '../city/collision.js';
import { surfaceAt, isSoftGround } from '../city/terrain.js';
import { stampSkid } from '../render/ground.js';
import { spawnSparks, spawnDust, spawnDebris, spawnSmoke } from '../render/particles.js';
import { addShake } from '../render/camera.js';
import { sfx } from '../audio/sound.js';
import { newId } from '../game/state.js';
import { damageVehicle } from '../combat/damage.js';

export function createVehicle(G, model, x, y, angle, paint) {
  const spec = VEHICLES[model];
  const v = {
    id: newId(G), model, spec, x, y, angle, vx: 0, vy: 0, spin: 0, steer: 0, speed: 0,
    hp: spec.hp, maxHp: spec.hp, paint: paint ?? G.rng.pick(spec.paints),
    driver: null, ai: null, siren: false, lights: false, horn: 0, wreck: false, fire: 0, smokeT: 0,
    skidL: null, skidR: null, slip: 0, throttle: 0, braking: false, tag: null, idleT: 0, stuckT: 0, parked: false,
  };
  G.vehicles.push(v);
  return v;
}

/** The three circles (front, middle, back) that stand in for a car's body. */
export function bodyCircles(v) {
  const c = Math.cos(v.angle);
  const s = Math.sin(v.angle);
  const o = v.spec.len * 0.5 - v.spec.wid * 0.5;
  return [[v.x + c * o, v.y + s * o], [v.x, v.y], [v.x - c * o, v.y - s * o]];
}

/** Advances one vehicle by dt under the controls { throttle, steer, handbrake }. */
export function stepVehicle(G, v, ctl, dt) {
  const spec = v.spec;
  const fx = Math.cos(v.angle);
  const fy = Math.sin(v.angle);
  let vf = v.vx * fx + v.vy * fy;
  let vl = -v.vx * fy + v.vy * fx;
  const surface = surfaceAt(G.city, v.x, v.y);
  const soft = isSoftGround(surface);
  const isPlayer = v.driver === G.player;
  const boost = isPlayer && v.personal ? 1 + G.upgrades.engine * 0.08 : 1;
  const top = spec.top * boost * (soft ? 0.72 : 1) * (v.hp < v.maxHp * 0.3 ? 0.8 : 1);
  const throttle = v.wreck ? 0 : clamp(ctl.throttle, -1, 1);
  v.throttle = throttle;
  v.braking = false;

  if (throttle > 0) {
    if (vf < -8) { vf = approach(vf, 0, 640 * dt); v.braking = true; }
    else vf += spec.accel * boost * throttle * dt * Math.max(0, 1 - (vf / top) ** 2);
  } else if (throttle < 0) {
    if (vf > 8) { vf = approach(vf, 0, 640 * dt); v.braking = true; }
    else if (vf > -top * 0.34) vf += spec.accel * 0.7 * throttle * dt;
  }
  vf -= vf * (soft ? 0.8 : 0.28) * dt;
  if (!throttle) vf = approach(vf, 0, 26 * dt);
  if (ctl.handbrake) vf = approach(vf, 0, 190 * dt);

  // Steering: the wheel eases toward the input and turns the car in proportion to its speed.
  v.steer = approach(v.steer, v.wreck ? 0 : clamp(ctl.steer, -1, 1), dt * 5.5);
  const speedFactor = clamp(vf / 110, -1, 1) * (1 - 0.42 * clamp(Math.abs(vf) / spec.top, 0, 1));
  const tires = isPlayer && v.personal ? 1 + G.upgrades.tires * 0.1 : 1;
  v.angle = wrapAngle(v.angle + v.steer * spec.turn * speedFactor * (ctl.handbrake ? 1.3 : 1) * dt + v.spin * dt);
  v.spin *= Math.max(0, 1 - 4 * dt);

  // Sideways grip.
  const grip = spec.grip * tires * (ctl.handbrake ? 0.22 : 1) * (soft ? 0.5 : 1);
  vl -= vl * Math.min(1, grip * dt);
  v.slip = Math.abs(vl);

  const nfx = Math.cos(v.angle);
  const nfy = Math.sin(v.angle);
  v.vx = nfx * vf - nfy * vl;
  v.vy = nfy * vf + nfx * vl;
  v.x += v.vx * dt;
  v.y += v.vy * dt;
  v.speed = vf;

  collideWithCity(G, v);
  if (keepOnLand(v, 20)) {
    v.vx *= 0.9;
    v.vy *= 0.9;
  }
  trailEffects(G, v, surface, soft, dt);
}

function collideWithCity(G, v) {
  const circles = bodyCircles(v);
  const r = v.spec.wid * 0.5;
  for (let k = 0; k < 3; k++) {
    const p = { x: circles[k][0], y: circles[k][1] };
    const hit = pushOutOfStatics(G.city, p, r);
    if (!hit) continue;
    const speed = Math.hypot(v.vx, v.vy);
    const prop = hit.circle?.prop;
    if (prop && hit.circle.breakable && speed > 70) {
      prop.down = true;
      spawnDebris(G, prop.x, prop.y, 5, prop.kind === 'hydrant' ? '#e2373c' : '#8a8f98');
      if (prop.kind === 'hydrant') G.particles.push({ kind: 'geyser', x: prop.x, y: prop.y, life: 6, max: 6 });
      sfx('clank', { x: v.x, y: v.y });
      v.vx *= 0.93;
      v.vy *= 0.93;
      continue;
    }
    v.x += p.x - circles[k][0];
    v.y += p.y - circles[k][1];
    const vn = v.vx * hit.nx + v.vy * hit.ny;
    if (vn < 0) {
      v.vx -= 1.35 * vn * hit.nx;
      v.vy -= 1.35 * vn * hit.ny;
      v.vx *= 0.96;
      v.vy *= 0.96;
      if (k !== 1) {
        const ox = circles[k][0] - v.x;
        const oy = circles[k][1] - v.y;
        v.spin += clamp((ox * hit.ny - oy * hit.nx) * -vn * 0.0009, -3, 3);
      }
      if (-vn > 110) {
        damageVehicle(G, v, (-vn - 90) * 0.09, null);
        spawnSparks(G, p.x - hit.nx * r, p.y - hit.ny * r, 6, Math.atan2(hit.ny, hit.nx));
        sfx('crash', { x: v.x, y: v.y, vol: clamp(-vn / 400, 0.3, 1) });
        if (v.driver === G.player) addShake(clamp(-vn / 40, 2, 10));
      }
    }
  }
}

function trailEffects(G, v, surface, soft, dt) {
  const moving = Math.abs(v.speed) > 60;
  const skidding = !soft && surface !== 'wood' && moving && (v.slip > 62 || (v.braking && Math.abs(v.speed) > 150));
  const c = Math.cos(v.angle);
  const s = Math.sin(v.angle);
  const back = -v.spec.len * 0.32;
  const half = v.spec.wid * 0.38;
  const lx = v.x + c * back - s * half;
  const ly = v.y + s * back + c * half;
  const rx = v.x + c * back + s * half;
  const ry = v.y + s * back - c * half;
  if (skidding && v.skidL) {
    stampSkid(v.skidL[0], v.skidL[1], lx, ly, 2.6, 0.32);
    stampSkid(v.skidR[0], v.skidR[1], rx, ry, 2.6, 0.32);
    if (G.frame % 3 === 0) spawnSmoke(G, (lx + rx) / 2, (ly + ry) / 2, { size: 7, life: 0.7, color: '#e8e4dc', alpha: 0.35 });
    if (v.driver === G.player && G.frame % 14 === 0) sfx('skid', { vol: 0.35 });
  }
  v.skidL = skidding ? [lx, ly] : null;
  v.skidR = skidding ? [rx, ry] : null;
  if (soft && moving && G.frame % 4 === 0) spawnDust(G, (lx + rx) / 2, (ly + ry) / 2, surface === 'sand' ? '#e6d2a6' : '#7fae62');
  // A damaged engine smokes, then burns, then blows.
  if (v.hp < v.maxHp * 0.45 && !v.wreck) {
    v.smokeT -= dt;
    if (v.smokeT <= 0) {
      v.smokeT = 0.09;
      const hx = v.x + c * v.spec.len * 0.3;
      const hy = v.y + s * v.spec.len * 0.3;
      spawnSmoke(G, hx, hy, { size: 6, life: 1.1, color: v.hp < v.maxHp * 0.2 ? '#2a2a2e' : '#b9b9bd', alpha: 0.5, rise: 26 });
    }
  }
}

/** Pushes overlapping vehicles apart and trades their momentum; hard knocks cost hit points. */
export function collideVehicles(G) {
  const list = G.vehicles;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      const reach = (a.spec.len + b.spec.len) * 0.5 + 4;
      if (Math.abs(a.x - b.x) > reach || Math.abs(a.y - b.y) > reach) continue;
      const ca = bodyCircles(a);
      const cb = bodyCircles(b);
      const rr = (a.spec.wid + b.spec.wid) * 0.5;
      for (const pa of ca) {
        for (const pb of cb) {
          const dx = pb[0] - pa[0];
          const dy = pb[1] - pa[1];
          const d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr || d2 < 1e-6) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const depth = rr - d;
          const ma = a.spec.len * a.spec.wid * (a.parked ? 1 : 1);
          const mb = b.spec.len * b.spec.wid;
          const share = mb / (ma + mb);
          a.x -= nx * depth * share; a.y -= ny * depth * share;
          b.x += nx * depth * (1 - share); b.y += ny * depth * (1 - share);
          pa[0] -= nx * depth * share; pa[1] -= ny * depth * share;
          pb[0] += nx * depth * (1 - share); pb[1] += ny * depth * (1 - share);
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel >= 0) continue;
          const jimp = -1.25 * rel;
          a.vx -= jimp * share * nx; a.vy -= jimp * share * ny;
          b.vx += jimp * (1 - share) * nx; b.vy += jimp * (1 - share) * ny;
          a.spin += clamp(((pa[0] - a.x) * ny - (pa[1] - a.y) * nx) * rel * 0.0007 * share, -2.5, 2.5);
          b.spin -= clamp(((pb[0] - b.x) * ny - (pb[1] - b.y) * nx) * rel * 0.0007 * (1 - share), -2.5, 2.5);
          a.parked = false;
          b.parked = false;
          if (-rel > 80) {
            const dmg = (-rel - 60) * 0.07;
            const byPlayer = a.driver === G.player ? a : b.driver === G.player ? b : null;
            damageVehicle(G, a, dmg * share * 1.6, byPlayer === b ? G.player : null, 'ram');
            damageVehicle(G, b, dmg * (1 - share) * 1.6, byPlayer === a ? G.player : null, 'ram');
            spawnSparks(G, pa[0] + nx * a.spec.wid * 0.5, pa[1] + ny * a.spec.wid * 0.5, 7, Math.atan2(ny, nx) + 1.57);
            sfx('crash', { x: a.x, y: a.y, vol: clamp(-rel / 380, 0.3, 1) });
            if (byPlayer) {
              addShake(clamp(-rel / 45, 2, 9));
              G.hitByPlayer?.(byPlayer === a ? b : a, -rel);
            }
          }
        }
      }
    }
  }
}

/** True when a circle touches any vehicle (used to find room to spawn or to step out of a car). */
export function vehicleAt(G, x, y, r, except = null) {
  for (const v of G.vehicles) {
    if (v === except) continue;
    if (Math.abs(v.x - x) > 60 || Math.abs(v.y - y) > 60) continue;
    for (const p of bodyCircles(v)) if (Math.hypot(p[0] - x, p[1] - y) < r + v.spec.wid * 0.5) return v;
  }
  return null;
}
