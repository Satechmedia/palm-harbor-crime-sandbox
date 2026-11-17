// Particles and other short-lived effects: tyre smoke, dust, sparks, debris, muzzle flashes,
// bullet tracers, fire, explosions with shockwaves, a burst hydrant's fountain, and the
// floating "+$50" texts. Systems call the spawn functions; the scene draws them in two layers.
import { cam, scaleAt, screenX, screenY } from './camera.js';
import { addGlow, addLight } from './lighting.js';
import { UI_FONT } from '../core/config.js';

const MAX = 520;
const push = (G, p) => {
  if (G.particles.length < MAX) G.particles.push(p);
};
const rnd = (a, b) => a + Math.random() * (b - a);

export function spawnSmoke(G, x, y, o = {}) {
  push(G, { kind: 'smoke', x, y, z: o.z ?? 3, vx: rnd(-8, 8), vy: rnd(-8, 8), vz: o.rise ?? 10, life: o.life ?? 1, max: o.life ?? 1, size: o.size ?? 8, color: o.color ?? '#ddd', alpha: o.alpha ?? 0.5 });
}

export function spawnDust(G, x, y, color) {
  push(G, { kind: 'smoke', x, y, z: 2, vx: rnd(-14, 14), vy: rnd(-14, 14), vz: 6, life: 0.8, max: 0.8, size: 7, color, alpha: 0.45 });
}

export function spawnPuff(G, x, y, color) {
  for (let k = 0; k < 3; k++) push(G, { kind: 'smoke', x, y, z: 6, vx: rnd(-30, 30), vy: rnd(-30, 30), vz: 8, life: 0.35, max: 0.35, size: 3.5, color, alpha: 0.7 });
}

export function spawnSparks(G, x, y, count, angle) {
  for (let k = 0; k < count; k++) {
    const a = angle + rnd(-0.9, 0.9);
    const s = rnd(90, 260);
    push(G, { kind: 'spark', x, y, z: 5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(10, 60), life: rnd(0.15, 0.4), max: 0.4, size: 1.4, color: '#ffd98a' });
  }
}

export function spawnDebris(G, x, y, count, color) {
  for (let k = 0; k < count; k++) {
    const a = rnd(0, 6.283);
    const s = rnd(40, 190);
    push(G, { kind: 'debris', x, y, z: 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(40, 130), life: rnd(0.6, 1.2), max: 1.2, size: rnd(1.5, 3.2), color, rot: rnd(0, 6) });
  }
}

export function spawnMuzzle(G, x, y, angle) {
  push(G, { kind: 'muzzle', x, y, z: 7, vx: 0, vy: 0, vz: 0, life: 0.06, max: 0.06, size: 9, angle });
}

export function addTracer(G, x0, y0, x1, y1, color) {
  if (G.tracers.length < 80) G.tracers.push({ x0, y0, x1, y1, color, t: 0 });
}

export function spawnExplosion(G, x, y, radius) {
  push(G, { kind: 'flash', x, y, z: 10, vx: 0, vy: 0, vz: 0, life: 0.35, max: 0.35, size: radius * 1.5 });
  push(G, { kind: 'ring', x, y, z: 2, vx: 0, vy: 0, vz: 0, life: 0.45, max: 0.45, size: radius * 1.25 });
  for (let k = 0; k < 16; k++) {
    const a = rnd(0, 6.283);
    const s = rnd(20, radius * 1.5);
    G.particles.push({ kind: 'fire', x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, z: 8, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(30, 110), life: rnd(0.4, 0.85), max: 0.85, size: rnd(10, 22) });
  }
  for (let k = 0; k < 14; k++) {
    const a = rnd(0, 6.283);
    const s = rnd(10, radius * 0.9);
    G.particles.push({ kind: 'smoke', x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 10, z: 12, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rnd(40, 90), life: rnd(1.2, 2.4), max: 2.4, size: rnd(14, 26), color: k % 3 ? '#26242a' : '#5a5560', alpha: 0.7 });
  }
  spawnDebris(G, x, y, 12, '#2a2a2e');
  spawnSparks(G, x, y, 14, rnd(0, 6.283));
}

export function updateParticles(G, dt) {
  const list = G.particles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) {
      list[i] = list[list.length - 1];
      list.pop();
      continue;
    }
    if (p.kind === 'geyser') {
      if (G.frame % 2 === 0) push(G, { kind: 'smoke', x: p.x, y: p.y, z: 4, vx: rnd(-22, 22), vy: rnd(-22, 22), vz: rnd(60, 120), life: 0.7, max: 0.7, size: 4, color: '#bfe9ff', alpha: 0.75 });
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z = Math.max(0, p.z + p.vz * dt);
    if (p.kind === 'debris' || p.kind === 'spark') {
      p.vz -= 320 * dt;
      if (p.z <= 0) {
        p.vx *= 0.5;
        p.vy *= 0.5;
        p.vz *= -0.35;
      }
    } else {
      p.vx *= 1 - 2.2 * dt;
      p.vy *= 1 - 2.2 * dt;
    }
  }
  for (let i = G.tracers.length - 1; i >= 0; i--) if ((G.tracers[i].t += dt) > 0.09) G.tracers.splice(i, 1);
  for (let i = G.floaters.length - 1; i >= 0; i--) if ((G.floaters[i].t += dt) > 1.6) G.floaters.splice(i, 1);
}

/** Draws the particles in screen space. `high` selects the layer above the rooftops' feet (z > 24). */
export function drawParticles(ctx, G, high) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const p of G.particles) {
    if (p.kind === 'geyser' || p.z > 24 !== high) continue;
    const s = scaleAt(Math.min(p.z, 400));
    const x = screenX(p.x, s);
    const y = screenY(p.y, s);
    if (x < -80 || y < -80 || x > cam.w + 80 || y > cam.h + 80) continue;
    const t = p.life / p.max;
    if (p.kind === 'smoke') {
      ctx.globalAlpha = p.alpha * Math.min(1, t * 1.6);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, p.size * (1.7 - t * 0.9) * s, 0, 7);
      ctx.fill();
    } else if (p.kind === 'spark') {
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - p.vx * 0.03 * s, y - p.vy * 0.03 * s);
      ctx.stroke();
      addGlow(p.x, p.y, p.z, 5, '#ffb347', 0.5 * t);
    } else if (p.kind === 'debris') {
      ctx.globalAlpha = Math.min(1, t * 3);
      ctx.fillStyle = p.color;
      ctx.fillRect(x - p.size * s, y - p.size * s, p.size * 2 * s, p.size * 2 * s);
    } else if (p.kind === 'fire') {
      ctx.globalAlpha = Math.min(1, t * 1.5);
      ctx.fillStyle = t > 0.6 ? '#fff3b0' : t > 0.3 ? '#ffa62b' : '#e8451f';
      ctx.beginPath();
      ctx.arc(x, y, p.size * (0.5 + t * 0.6) * s, 0, 7);
      ctx.fill();
      addGlow(p.x, p.y, p.z, p.size * 2.2, '#ff8a2b', 0.5 * t);
      addLight(p.x, p.y, p.size * 8, '#ffb060', 0.1 * t);
    } else if (p.kind === 'flash') {
      addGlow(p.x, p.y, p.z, p.size * (1.2 - t * 0.4), '#ffe6a8', t);
      addLight(p.x, p.y, p.size * 3, '#ffd9a0', t * 0.8);
    } else if (p.kind === 'ring') {
      ctx.globalAlpha = t * 0.7;
      ctx.strokeStyle = '#fff6da';
      ctx.lineWidth = 4 * s * t + 1;
      ctx.beginPath();
      ctx.arc(x, y, p.size * (1 - t) * s, 0, 7);
      ctx.stroke();
    } else if (p.kind === 'muzzle') {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(p.angle) * 13 * s, y + Math.sin(p.angle) * 13 * s);
      ctx.lineTo(x + Math.cos(p.angle + 2.3) * 4.5 * s, y + Math.sin(p.angle + 2.3) * 4.5 * s);
      ctx.lineTo(x + Math.cos(p.angle - 2.3) * 4.5 * s, y + Math.sin(p.angle - 2.3) * 4.5 * s);
      ctx.fill();
      addGlow(p.x, p.y, 7, 26, '#ffd27a', 0.9);
      addLight(p.x, p.y, 120, '#ffe0a0', 0.45);
    }
  }
  ctx.globalAlpha = 1;
  if (high) return;
  const s = scaleAt(7);
  ctx.lineCap = 'round';
  for (const t of G.tracers) {
    const k = 1 - t.t / 0.09;
    ctx.globalAlpha = k;
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    const fx = t.x0 + (t.x1 - t.x0) * (1 - k) * 0.6;
    const fy = t.y0 + (t.y1 - t.y0) * (1 - k) * 0.6;
    ctx.moveTo(screenX(fx, s), screenY(fy, s));
    ctx.lineTo(screenX(t.x1, s), screenY(t.y1, s));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = 'butt';
}

/** The rising "+$120" style texts, drawn over the lit scene. */
export function drawFloaters(ctx, G) {
  const s = scaleAt(0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(15 * cam.scale)}px ${UI_FONT}`;
  for (const f of G.floaters) {
    ctx.globalAlpha = Math.min(1, (1.6 - f.t) * 2);
    const x = screenX(f.x, s);
    const y = screenY(f.y, s) - f.t * 30 * cam.scale;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(f.text, x + 1.5, y + 1.5);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, x, y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}
