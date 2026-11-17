// The hostile crews of the story (the Neon Eels and Lucian Vex's guards): gunmen who hold a
// spot until they notice the player, then strafe and shoot, and drivers who chase and ram.
import { hasLineOfSight } from '../city/collision.js';
import { createPerson, movePerson, LOOKS } from '../characters/people.js';
import { createVehicle, stepVehicle } from '../vehicles/physics.js';
import { steerToward, unstick } from '../vehicles/driver.js';
import { fireWeapon, WEAPONS } from '../combat/weapons.js';

/** Spawns `count` gunmen around a point, all carrying `tag` so a mission can count them. */
export function spawnCrew(G, x, y, count, tag, weapon = 'pistol', look = LOOKS.eel, spread = 46) {
  const crew = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * 6.283 + G.rng.range(-0.4, 0.4);
    const r = count > 1 ? G.rng.range(spread * 0.4, spread) : 0;
    const p = createPerson(G, x + Math.cos(a) * r, y + Math.sin(a) * r, 'gang', look);
    p.tag = tag;
    p.weapon = weapon;
    p.homeX = p.x;
    p.homeY = p.y;
    p.hp = p.maxHp = 60;
    p.keep = true;
    crew.push(p);
  }
  return crew;
}

export function updateGangster(G, g, dt) {
  const p = G.player;
  g.fireT -= dt;
  if (g.alert > 0) g.alert -= dt;
  const dx = p.x - g.x;
  const dy = p.y - g.y;
  const d = Math.hypot(dx, dy);
  const sees = d < 380 && !p.dead && hasLineOfSight(G.city, g.x, g.y, p.x, p.y);
  if (sees) g.alert = 9;
  if (!(g.alert > 0)) {
    // Idle: shuffle around the post.
    g.idleT = (g.idleT ?? 0) - dt;
    if (g.idleT < 0) {
      g.idleT = G.rng.range(2, 6);
      g.gx = g.homeX + G.rng.range(-26, 26);
      g.gy = g.homeY + G.rng.range(-26, 26);
    }
    const gd = Math.hypot(g.gx - g.x, g.gy - g.y);
    movePerson(G, g, g.gx - g.x, g.gy - g.y, gd > 4 ? 26 : 0, dt);
    return;
  }
  const aim = Math.atan2(dy, dx);
  const w = WEAPONS[g.weapon];
  const hold = w.melee ? 12 : 150;
  const strafe = g.id % 2 ? 1 : -1;
  if (d > hold + 40 || !sees) movePerson(G, g, dx, dy, 105, dt, sees ? aim : null);
  else if (d < hold - 50) movePerson(G, g, -dx, -dy, 60, dt, aim);
  else movePerson(G, g, -dy * strafe, dx * strafe, 34, dt, aim);
  if (sees && d < w.range * 0.8 && g.fireT <= 0) {
    g.fireT = w.rate * (w.auto ? 2.5 : 2.8) + G.rng.range(0.15, 0.8);
    fireWeapon(G, g, g.weapon, aim, 2.8);
  }
}

/** A car full of trouble that chases the player (or a tagged vehicle) and rams it. */
export function spawnChaser(G, x, y, model, tag, paint, look = LOOKS.eel) {
  const p = G.player;
  const v = createVehicle(G, model, x, y, Math.atan2(p.y - y, p.x - x), paint);
  v.driver = 'ai';
  v.tag = tag;
  v.ai = { type: 'chaser', role: 'gang', look, weapon: 'smg', crewTag: tag, fireT: 2 };
  return v;
}

export function driveChaser(G, v, dt) {
  const p = G.player;
  const d = Math.hypot(p.x - v.x, p.y - v.y);
  const lead = Math.min(0.5, d / 500);
  let ctl = steerToward(v, p.x + p.vx * lead, p.y + p.vy * lead, v.spec.top);
  ctl = unstick(v, ctl, dt);
  stepVehicle(G, v, ctl, dt);
  v.ai.fireT -= dt;
  if (d < 260 && v.ai.fireT <= 0 && !p.dead && hasLineOfSight(G.city, v.x, v.y, p.x, p.y)) {
    v.ai.fireT = 0.5 + G.rng.range(0, 0.6);
    fireWeapon(G, { x: v.x, y: v.y, vehicle: v, role: 'gang' }, 'smg', Math.atan2(p.y - v.y, p.x - v.x), 3);
  }
}

/** A car that runs for a destination along the roads (the quarry of a chase mission). */
export function driveRunner(G, v, dt) {
  const ai = v.ai;
  if (ai.loop && ai.leg >= ai.route.length) ai.leg = 0;
  const target = ai.route[ai.leg];
  if (!target) {
    stepVehicle(G, v, { throttle: 0, steer: 0, handbrake: true }, dt);
    return;
  }
  if (Math.hypot(target[0] - v.x, target[1] - v.y) < 70) ai.leg++;
  let ctl = steerToward(v, target[0], target[1], ai.speed ?? 330);
  ctl = unstick(v, ctl, dt);
  stepVehicle(G, v, ctl, dt);
}
