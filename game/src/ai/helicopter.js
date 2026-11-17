// Skylark, the police helicopter: arrives at four stars, circles above the player with a
// searchlight that keeps the police from losing sight, and opens fire at five.
import { damp, wrapAngle, angleDiff } from '../core/math.js';
import { hurtPerson, damageVehicle } from '../combat/damage.js';
import { addTracer, spawnPuff } from '../render/particles.js';
import { sfx } from '../audio/sound.js';

export function createHelicopter(G, x, y) {
  G.helicopter = { x, y, z: 190, vx: 0, vy: 0, angle: 0, rotor: 0, orbit: 0, fireT: 3, leaving: false, lightX: x, lightY: y };
  return G.helicopter;
}

export function updateHelicopter(G, dt) {
  const W = G.wanted;
  let h = G.helicopter;
  const p = G.player;
  if (!h) {
    if (W.level >= 4 && !G.shot) createHelicopter(G, p.x - 900, p.y - 700);
    return;
  }
  h.rotor += dt * 34;
  if (W.level < 4 && !h.keep) h.leaving = true;
  else if (W.level >= 4) h.leaving = false;
  h.orbit += dt * 0.5;
  const tx = h.leaving ? h.x + 400 : p.x + p.vx * 0.6 + Math.cos(h.orbit) * 120;
  const ty = h.leaving ? h.y - 300 : p.y + p.vy * 0.6 + Math.sin(h.orbit) * 90;
  const k = damp(1.6, dt);
  h.vx += ((tx - h.x) * 1.4 - h.vx) * k;
  h.vy += ((ty - h.y) * 1.4 - h.vy) * k;
  h.x += h.vx * dt;
  h.y += h.vy * dt;
  const face = h.leaving ? Math.atan2(h.vy, h.vx) : Math.atan2(p.y - h.y, p.x - h.x);
  h.angle = wrapAngle(h.angle + angleDiff(h.angle, face) * damp(3, dt));
  h.lightX += (p.x - h.lightX) * damp(4, dt);
  h.lightY += (p.y - h.lightY) * damp(4, dt);
  if (h.leaving && Math.hypot(h.x - p.x, h.y - p.y) > 1500) {
    G.helicopter = null;
    return;
  }
  h.fireT -= dt;
  if (W.level >= 5 && !h.leaving && h.fireT <= 0 && !p.dead && G.mode === 'play') {
    h.fireT = 0.16 + (G.rng.chance(0.2) ? 1.6 : 0);
    const ax = p.x + G.rng.range(-34, 34);
    const ay = p.y + G.rng.range(-34, 34);
    addTracer(G, h.x, h.y, ax, ay, '#ffd0a0');
    spawnPuff(G, ax, ay, '#d8d2c4');
    sfx('smg', { x: h.x, y: h.y, vol: 0.5 });
    if (Math.hypot(ax - p.x, ay - p.y) < 14) {
      if (p.vehicle) damageVehicle(G, p.vehicle, 6, null, 'bullet');
      else hurtPerson(G, p, 7, null, 0, 'bullet');
    }
  }
}
