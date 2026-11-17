// People: how a person is made (looks, health, role), how anyone on foot moves and bumps into
// walls, and what happens when a car meets a pedestrian.
import { clamp, damp, wrapAngle, angleDiff } from '../core/math.js';
import { pushOutOfStatics, keepOnLand } from '../city/collision.js';
import { newId } from '../game/state.js';
import { bodyCircles } from '../vehicles/physics.js';
import { hurtPerson } from '../combat/damage.js';

const SKINS = ['#f2c9a5', '#e0a878', '#c68a5a', '#9c6540', '#6e4428', '#f7d9bd'];
const SHIRTS = ['#ff4f8b', '#36c9e0', '#ffd23f', '#f4f1e8', '#ff7a45', '#7d6bff', '#2ecc71', '#e2374d', '#f39bd0', '#1f6fd6', '#fdf0c4', '#12b5a6'];
const PANTS = ['#2b3a55', '#4a4f5c', '#c9b79a', '#f4f1e8', '#3a6ea8', '#7a4b2a', '#1f1f28'];
const HAIR = ['#1c1410', '#3b2414', '#6b4423', '#c9a24a', '#8a8a8a', '#b5422c', '#101018'];
const HATS = ['#f4f1e8', '#e2374d', '#f5bd4e', '#2b2f3a'];

/** A random set of clothes and features for a passer-by. */
export function randomLook(rng) {
  return {
    skin: rng.pick(SKINS), shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS), hair: rng.pick(HAIR),
    hat: rng.chance(0.16) ? rng.pick(HATS) : null, bald: rng.chance(0.08), bag: rng.chance(0.14),
  };
}

/** The fixed outfits of the cast: the player, the police, and the two crews of the story. */
export const LOOKS = {
  player: { skin: '#b97a4e', shirt: '#ff5a7a', pants: '#27364f', hair: '#16100c', hat: null, jacket: '#f4f1e8' },
  cop: { skin: '#d9a273', shirt: '#2c4a86', pants: '#1c2a47', hair: '#1c1410', hat: '#1c2a47', badge: true },
  swat: { skin: '#d9a273', shirt: '#22262e', pants: '#22262e', hair: '#1c1410', hat: '#30353f', badge: true },
  eel: { skin: '#e0a878', shirt: '#12e0c0', pants: '#1f1f28', hair: '#101018', hat: null, stripe: '#ff2fa0' },
  guard: { skin: '#c68a5a', shirt: '#1c1c22', pants: '#1c1c22', hair: '#101018', hat: null, stripe: '#ffd23f' },
};

export function createPerson(G, x, y, role = 'civ', look = null) {
  const tough = role !== 'civ';
  const p = {
    id: newId(G), x, y, vx: 0, vy: 0, angle: G.rng.range(-3.14, 3.14), r: 5.5, role, look: look ?? randomLook(G.rng),
    hp: tough ? 70 : 40, maxHp: tough ? 70 : 40, state: 'walk', dead: false, downT: 0, walkT: G.rng.range(0, 6),
    weapon: null, fireT: 0, hitT: 0, hitCarT: 0, vehicle: null, tag: null, pace: G.rng.range(34, 48), scareT: 0, punchT: 0,
  };
  G.people.push(p);
  return p;
}

/**
 * Walks a person along (dx, dy) at `speed`: eases the velocity, turns the body to face the
 * way it goes (or `faceAngle`), and keeps it out of walls and the sea.
 */
export function movePerson(G, p, dx, dy, speed, dt, faceAngle = null) {
  const len = Math.hypot(dx, dy);
  const tx = len > 0.01 ? (dx / len) * speed : 0;
  const ty = len > 0.01 ? (dy / len) * speed : 0;
  const k = damp(12, dt);
  p.vx += (tx - p.vx) * k;
  p.vy += (ty - p.vy) * k;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  const moving = Math.hypot(p.vx, p.vy);
  if (moving > 6) p.walkT += dt * (5 + moving * 0.085);
  const face = faceAngle ?? (moving > 8 ? Math.atan2(p.vy, p.vx) : p.angle);
  p.angle = wrapAngle(p.angle + angleDiff(p.angle, face) * damp(14, dt));
  const hit = pushOutOfStatics(G.city, p, p.r);
  keepOnLand(p, 4);
  return hit;
}

/** Cars shove people aside at a crawl and run them down at speed. */
export function collidePeopleWithVehicles(G, dt) {
  const everyone = G.player.vehicle ? G.people : [...G.people, G.player];
  for (const p of everyone) if (p.hitCarT > 0) p.hitCarT -= dt;
  for (const v of G.vehicles) {
    const speed = Math.hypot(v.vx, v.vy);
    const reach = v.spec.len * 0.5 + 10;
    for (const p of everyone) {
      if (p.vehicle || Math.abs(p.x - v.x) > reach || Math.abs(p.y - v.y) > reach) continue;
      for (const c of bodyCircles(v)) {
        const dx = p.x - c[0];
        const dy = p.y - c[1];
        const rr = p.r + v.spec.wid * 0.5;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.01;
        p.x += (dx / d) * (rr - d);
        p.y += (dy / d) * (rr - d);
        const into = v.vx * (dx / d) + v.vy * (dy / d);
        if (!p.dead && speed > 85 && into > 40 && p.hitCarT <= 0) {
          p.hitCarT = 0.5;
          p.vx = v.vx * 0.9 + (dx / d) * 60;
          p.vy = v.vy * 0.9 + (dy / d) * 60;
          hurtPerson(G, p, clamp((speed - 60) * 0.3, 8, 120), v.driver === G.player ? G.player : null, Math.atan2(v.vy, v.vx), 'car');
          v.vx *= 0.94;
          v.vy *= 0.94;
        }
        break;
      }
    }
  }
}

/** The nearest living person to a point matching `filter`, within `radius`. */
export function nearestPerson(G, x, y, radius, filter) {
  let best = null;
  let bestD = radius;
  for (const p of G.people) {
    if (p.dead || p.vehicle || (filter && !filter(p))) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
