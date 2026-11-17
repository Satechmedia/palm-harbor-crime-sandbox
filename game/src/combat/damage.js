// Damage and its consequences: hurting and downing people, wearing down vehicles until they
// catch fire and blow up, and explosions that throw everything nearby.
import { clamp } from '../core/math.js';
import { addShake } from '../render/camera.js';
import { stampScorch } from '../render/ground.js';
import { spawnExplosion, spawnPuff, spawnSmoke, spawnDebris } from '../render/particles.js';
import { reportCrime } from '../crime/wanted.js';
import { scarePeople } from '../characters/pedestrians.js';
import { panicTraffic } from '../vehicles/traffic.js';
import { createPerson, LOOKS } from '../characters/people.js';
import { sfx } from '../audio/sound.js';

/** Hurts a person (or the player). `attacker` is who did it, `angle` the way the blow travels. */
export function hurtPerson(G, p, amount, attacker, angle = 0, cause = 'bullet') {
  if (p.dead) return;
  if (p.isPlayer) {
    if (G.mode !== 'play' || G.godmode) return;
    if (p.armor > 0 && cause !== 'car') {
      const soak = Math.min(p.armor, amount * 0.8);
      p.armor -= soak;
      amount -= soak;
    }
    p.hurtT = 0;
    addShake(3);
    sfx('hurt');
  }
  p.hp -= amount;
  p.hitT = 0.18;
  if (cause !== 'fist') spawnPuff(G, p.x, p.y, '#c4283a');
  const byPlayer = attacker && attacker.isPlayer;
  if (byPlayer && !p.isPlayer) {
    if (p.role === 'cop') reportCrime(G, 'copAssault', p.x, p.y);
    else if (p.role === 'civ') reportCrime(G, 'assault', p.x, p.y);
    if (p.role === 'civ') {
      p.state = 'flee';
      p.scareT = 10;
      p.fearX = attacker.x;
      p.fearY = attacker.y;
    } else p.alert = 12;
    scarePeople(G, p.x, p.y, 180);
  }
  if (p.hp > 0) return;
  p.hp = 0;
  p.dead = true;
  p.downT = 0;
  p.angle = angle;
  p.vx += Math.cos(angle) * 50;
  p.vy += Math.sin(angle) * 50;
  if (p.isPlayer) {
    G.onPlayerDown?.(false);
    return;
  }
  sfx('thud', { x: p.x, y: p.y });
  if (byPlayer) {
    G.stats.kills++;
    reportCrime(G, p.role === 'cop' ? 'copKill' : p.role === 'civ' ? 'kill' : 'shots', p.x, p.y);
    if (p.role === 'civ') G.pickups.push({ kind: 'cash', x: p.x, y: p.y, amount: G.rng.int(8, 60), t: 0 });
    else if (p.weapon && G.rng.chance(0.7)) G.pickups.push({ kind: 'ammo', x: p.x, y: p.y, weapon: p.weapon, amount: p.weapon === 'pistol' ? 16 : 30, t: 0 });
  }
  G.onPersonDown?.(p, attacker);
}

/** Wears a vehicle down. At zero it catches fire, the driver bails out, and it soon explodes. */
export function damageVehicle(G, v, amount, attacker, cause = 'crash') {
  if (v.wreck || amount <= 0) return;
  if (v.spec.armored && cause === 'bullet') amount *= 0.4;
  if (v.personal && v.driver === G.player) amount *= 1 - G.upgrades.armor * 0.15;
  if (v.driver === G.player && G.godmode) return;
  v.hp -= amount;
  v.lastAttacker = attacker ?? v.lastAttacker;
  if (attacker?.isPlayer && v.driver === 'ai') {
    if (v.ai?.type === 'traffic') v.ai.panicT = 8;
    if (v.spec.police) reportCrime(G, 'copAssault', v.x, v.y);
  }
  if (v.hp <= 0 && v.fire <= 0) {
    v.hp = 0;
    v.fire = 2.6;
    sfx('ignite', { x: v.x, y: v.y });
    if (v.driver === G.player) G.notesFire = true;
    if (v.driver === 'ai') bailOut(G, v);
  }
}

/** The computer driver of a doomed car jumps out and runs (or, for police, keeps fighting on foot). */
export function bailOut(G, v) {
  const side = v.spec.wid * 0.5 + 8;
  const cop = v.spec.police;
  const p = createPerson(G, v.x + Math.sin(v.angle) * side, v.y - Math.cos(v.angle) * side, v.ai?.role ?? (cop ? 'cop' : 'civ'), v.ai?.look ?? (cop ? LOOKS.cop : null));
  if (p.role === 'civ') {
    p.state = 'flee';
    p.scareT = 12;
    p.fearX = v.x;
    p.fearY = v.y;
  } else {
    p.weapon = v.ai?.weapon ?? 'pistol';
    p.tag = v.ai?.crewTag ?? null;
    p.alert = 20;
  }
  v.driver = null;
  v.ai = null;
  v.siren = false;
  return p;
}

/** Burning cars count down and explode; wrecks smoulder. */
export function updateFires(G, dt) {
  for (const v of G.vehicles) {
    if (v.wreck) {
      if (v.wreckT < 14 && G.frame % 5 === 0) spawnSmoke(G, v.x + G.rng.range(-8, 8), v.y + G.rng.range(-6, 6), { size: 9, life: 1.6, color: '#1d1c20', alpha: 0.55, rise: 34 });
      continue;
    }
    if (v.fire <= 0) continue;
    v.fire -= dt;
    if (G.frame % 2 === 0) G.particles.push({ kind: 'fire', x: v.x + G.rng.range(-10, 10), y: v.y + G.rng.range(-8, 8), vx: G.rng.range(-12, 12), vy: G.rng.range(-12, 12), z: 6, vz: 30, life: 0.5, max: 0.5, size: G.rng.range(6, 11) });
    if (v.fire <= 0) {
      v.wreck = true;
      v.wreckT = 0;
      v.siren = false;
      const attacker = v.lastAttacker;
      if (v.driver === G.player) {
        G.player.vehicle = null;
        v.driver = null;
        hurtPerson(G, G.player, 400, null, v.angle, 'blast');
      }
      v.driver = null;
      v.ai = null;
      explode(G, v.x, v.y, 96, attacker);
      G.onVehicleDestroyed?.(v, attacker);
    }
  }
}

/** A blast at (x, y): fire, smoke, a scorch mark, a shockwave and damage that falls off with distance. */
export function explode(G, x, y, radius, attacker) {
  spawnExplosion(G, x, y, radius);
  stampScorch(x, y, radius * 0.6);
  sfx('boom', { x, y });
  const dp = Math.hypot(G.player.x - x, G.player.y - y);
  addShake(clamp(16 - dp / 40, 2, 16));
  G.slowmo = Math.max(G.slowmo, dp < 300 ? 0.25 : 0);
  scarePeople(G, x, y, 420, 10);
  panicTraffic(G, x, y, 380);
  if (attacker?.isPlayer) reportCrime(G, 'explosion', x, y);
  const everyone = [...G.people, G.player];
  for (const p of everyone) {
    if (p.dead || p.vehicle) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > radius) continue;
    const a = Math.atan2(p.y - y, p.x - x);
    p.vx += Math.cos(a) * 220;
    p.vy += Math.sin(a) * 220;
    hurtPerson(G, p, 130 * (1 - d / radius) + 12, attacker, a, 'blast');
  }
  for (const v of G.vehicles) {
    if (v.wreck) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (d > radius + 20 || d < 1) continue;
    const k = 1 - d / (radius + 20);
    v.vx += ((v.x - x) / d) * 260 * k;
    v.vy += ((v.y - y) / d) * 260 * k;
    v.spin += (G.rng() - 0.5) * 5 * k;
    damageVehicle(G, v, 150 * k, attacker, 'blast');
  }
  for (const c of G.city.index.circles) {
    if (!c.prop || c.prop.down || !c.breakable) continue;
    if (Math.hypot(c.x - x, c.y - y) < radius * 0.8) {
      c.prop.down = true;
      spawnDebris(G, c.x, c.y, 3, '#8a8f98');
    }
  }
}
