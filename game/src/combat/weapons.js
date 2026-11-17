// The weapons of Palm Harbor and what happens when one is fired: fists, pistol, SMG, shotgun,
// rifle and a rocket launcher. Bullets are instant rays that stop at the first wall, car or
// person; rockets fly and explode.
import { rayCircle } from '../core/math.js';
import { raycastStatics } from '../city/collision.js';
import { bodyCircles } from '../vehicles/physics.js';
import { addTracer, spawnSparks, spawnPuff, spawnMuzzle, spawnSmoke } from '../render/particles.js';
import { hurtPerson, damageVehicle, explode } from './damage.js';
import { reportCrime } from '../crime/wanted.js';
import { scarePeople } from '../characters/pedestrians.js';
import { panicTraffic } from '../vehicles/traffic.js';
import { addShake } from '../render/camera.js';
import { sfx } from '../audio/sound.js';

export const WEAPONS = {
  fists: { name: 'Fists', melee: true, damage: 15, rate: 0.36, range: 22, price: 0, icon: 'fist' },
  pistol: { name: 'Kestrel 9', damage: 19, rate: 0.26, spread: 0.03, range: 520, pellets: 1, price: 250, pack: 48, packPrice: 60, sound: 'pistol', driveBy: true, icon: 'pistol', unlock: 0 },
  smg: { name: 'Wasp SMG', damage: 11, rate: 0.08, spread: 0.075, range: 470, pellets: 1, auto: true, price: 900, pack: 120, packPrice: 140, sound: 'smg', driveBy: true, icon: 'smg', unlock: 3 },
  shotgun: { name: 'Boomer 12', damage: 10, rate: 0.75, spread: 0.2, range: 300, pellets: 8, price: 1400, pack: 24, packPrice: 120, sound: 'shotgun', icon: 'shotgun', unlock: 4 },
  rifle: { name: 'Longshore AR', damage: 23, rate: 0.115, spread: 0.028, range: 720, pellets: 1, auto: true, price: 2800, pack: 90, packPrice: 220, sound: 'rifle', icon: 'rifle', unlock: 6 },
  launcher: { name: 'Hammerhead', rocket: true, damage: 0, rate: 1.3, spread: 0, range: 900, price: 6000, pack: 4, packPrice: 600, sound: 'launch', icon: 'launcher', unlock: 8 },
};
export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'rifle', 'launcher'];

/**
 * The first thing a ray from (ox, oy) meets within `range`: { dist, person | vehicle | wall }.
 * The shooter and the car the shooter sits in are transparent.
 */
export function castShot(G, shooter, ox, oy, dx, dy, range) {
  const wall = raycastStatics(G.city, ox, oy, dx, dy, range);
  const hit = { dist: wall.dist, wall: wall.hit !== null };
  const own = shooter.vehicle ?? null;
  for (const v of G.vehicles) {
    if (v === own) continue;
    if (Math.abs(v.x - ox) > range + 50 || Math.abs(v.y - oy) > range + 50) continue;
    for (const c of bodyCircles(v)) {
      const d = rayCircle(ox, oy, dx, dy, c[0], c[1], v.spec.wid * 0.5);
      if (d < hit.dist) {
        hit.dist = d;
        hit.vehicle = v;
        hit.person = null;
        hit.wall = false;
      }
    }
  }
  const testPerson = (p) => {
    if (p === shooter || p.dead || p.vehicle) return;
    const d = rayCircle(ox, oy, dx, dy, p.x, p.y, 7.5);
    if (d < hit.dist) {
      hit.dist = d;
      hit.person = p;
      hit.vehicle = null;
      hit.wall = false;
    }
  };
  for (const p of G.people) testPerson(p);
  testPerson(G.player);
  return hit;
}

function punch(G, shooter, w, angle) {
  shooter.punchT = 0.22;
  shooter.angle = angle;
  const targets = shooter.isPlayer ? G.people : [G.player];
  let landed = false;
  for (const p of targets) {
    if (p.dead || p.vehicle) continue;
    const dx = p.x - shooter.x;
    const dy = p.y - shooter.y;
    const d = Math.hypot(dx, dy);
    if (d > w.range || Math.cos(Math.atan2(dy, dx) - angle) < 0.35) continue;
    hurtPerson(G, p, w.damage, shooter, angle, 'fist');
    p.vx += Math.cos(angle) * 90;
    p.vy += Math.sin(angle) * 90;
    landed = true;
    break;
  }
  sfx(landed ? 'punch' : 'swish', { x: shooter.x, y: shooter.y });
}

/** Fires weapon `id` from a person (the player, an officer or a gangster) along `angle`. */
export function fireWeapon(G, shooter, id, angle, accuracy = 1) {
  const w = WEAPONS[id];
  if (w.melee) return punch(G, shooter, w, angle);
  const byPlayer = shooter.isPlayer;
  const ox = shooter.x + Math.cos(angle) * (shooter.vehicle ? 4 : 11);
  const oy = shooter.y + Math.sin(angle) * (shooter.vehicle ? 4 : 11);
  if (!shooter.vehicle) shooter.angle = angle;
  spawnMuzzle(G, ox, oy, angle);
  sfx(w.sound, { x: ox, y: oy, vol: byPlayer ? 1 : 0.7 });
  if (byPlayer) {
    addShake(w.pellets > 1 ? 4 : w.rocket ? 5 : 1.3);
    reportCrime(G, 'shots', ox, oy);
    scarePeople(G, ox, oy, 330);
    panicTraffic(G, ox, oy, 260);
  }
  if (w.rocket) {
    G.rockets.push({ x: ox, y: oy, vx: Math.cos(angle) * 620, vy: Math.sin(angle) * 620, angle, life: w.range / 620, owner: shooter });
    return;
  }
  for (let k = 0; k < w.pellets; k++) {
    const a = angle + (G.rng() - 0.5) * 2 * w.spread * accuracy;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const hit = castShot(G, shooter, ox, oy, dx, dy, w.range);
    const hx = ox + dx * hit.dist;
    const hy = oy + dy * hit.dist;
    addTracer(G, ox, oy, hx, hy, byPlayer ? '#fff2b0' : '#ffb07a');
    if (hit.person) hurtPerson(G, hit.person, w.damage * (byPlayer ? 1 : 0.55), shooter, a, 'bullet');
    else if (hit.vehicle) {
      damageVehicle(G, hit.vehicle, w.damage * (byPlayer ? 0.55 : 0.3), shooter, 'bullet');
      spawnSparks(G, hx, hy, 3, a + Math.PI);
      if (k === 0) sfx('ricochet', { x: hx, y: hy, vol: 0.5 });
    } else if (hit.wall) spawnPuff(G, hx, hy, '#d8d2c4');
  }
}

/** Flies the rockets in the air; each one explodes on the first thing it meets. */
export function updateRockets(G, dt) {
  for (let i = G.rockets.length - 1; i >= 0; i--) {
    const r = G.rockets[i];
    const step = 620 * dt;
    const hit = castShot(G, r.owner, r.x, r.y, Math.cos(r.angle), Math.sin(r.angle), step + 4);
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    r.life -= dt;
    spawnSmoke(G, r.x, r.y, { size: 5, life: 0.7, color: '#f1ece4', alpha: 0.6 });
    if (hit.dist <= step + 3 || r.life <= 0) {
      explode(G, r.x, r.y, 92, r.owner);
      G.rockets.splice(i, 1);
    }
  }
}

/** A weapon's readout for the HUD and the shop: name and rounds left. */
export function ammoText(player) {
  const n = player.weapons[player.weapon];
  return n === Infinity || n === undefined ? '' : String(n);
}
