// Street furniture and greenery: palm trees and shade trees with leaning trunks and sprite
// crowns, street lamps, beach parasols, hydrants, bins, benches, moored boats and dock cranes.
import { cam, scaleAt, screenX, screenY, setPlane } from './camera.js';
import { L, lightsOn, addGlow, addLight } from './lighting.js';
import { createRandom } from '../core/random.js';
import { TAU } from '../core/math.js';

const cache = new Map();
const UMBRELLAS = [['#ff4f8b', '#ffffff'], ['#22b8cf', '#ffffff'], ['#ffd23f', '#ff8a3d'], ['#7d6bff', '#f4f4f4'], ['#2ecc71', '#fff7c2'], ['#ff6b4a', '#ffe9c9']];

function sprite(key, size, paint) {
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    paint(g);
    cache.set(key, c);
  }
  return c;
}

function palmCrown(v, shadow) {
  return sprite(`palm${v}${shadow}`, 128, (g) => {
    const rng = createRandom(77 + v * 13);
    const n = 8 + v;
    const greens = ['#2f9148', '#41a85a', '#5abd66', '#2a8042'];
    for (let i = 0; i < n; i++) {
      const r = rng.range(44, 60);
      g.save();
      g.rotate((i / n) * TAU + rng.range(-0.2, 0.2));
      g.fillStyle = shadow ? '#000' : greens[i % 4];
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(r * 0.45, -12, r, 0);
      g.quadraticCurveTo(r * 0.45, 9, 0, 0);
      g.fill();
      if (!shadow) {
        g.strokeStyle = 'rgba(16,70,34,0.4)';
        g.lineWidth = 1;
        g.beginPath();
        for (let t = 0.25; t < 0.95; t += 0.12) {
          g.moveTo(r * t, -1);
          g.lineTo(r * t + 5, -6 * (1 - t) - 2);
          g.moveTo(r * t, 1);
          g.lineTo(r * t + 5, 5 * (1 - t) + 1);
        }
        g.stroke();
        g.strokeStyle = 'rgba(214,244,150,0.6)';
        g.beginPath();
        g.moveTo(3, 0);
        g.quadraticCurveTo(r * 0.5, -2.5, r - 3, 0);
        g.stroke();
      }
      g.restore();
    }
    if (!shadow) {
      g.fillStyle = '#5f4226';
      g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill();
      g.fillStyle = '#8f6a3c';
      g.beginPath(); g.arc(-1, -1, 3.2, 0, 7); g.fill();
    }
  });
}

function treeCrown(v, shadow) {
  return sprite(`tree${v}${shadow}`, 96, (g) => {
    const rng = createRandom(31 + v * 7);
    const base = ['#2f8a45', '#3b9650', '#2a7d4a'][v];
    g.fillStyle = shadow ? '#000' : base;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      g.beginPath(); g.arc(Math.cos(a) * 24, Math.sin(a) * 24, 17 + rng() * 5, 0, 7); g.fill();
    }
    g.beginPath(); g.arc(0, 0, 30, 0, 7); g.fill();
    if (shadow) return;
    for (let i = 0; i < 16; i++) {
      const a = rng() * TAU;
      const r = rng() * 28;
      g.fillStyle = i % 3 ? 'rgba(120,200,110,0.4)' : 'rgba(20,70,40,0.3)';
      g.beginPath(); g.arc(Math.cos(a) * r - 5, Math.sin(a) * r - 3, 6 + rng() * 6, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(190,240,150,0.3)';
    g.beginPath(); g.arc(-12, -6, 13, 0, 7); g.fill();
  });
}

function umbrellaTop(v) {
  return sprite(`umb${v}`, 64, (g) => {
    const [a, b] = UMBRELLAS[v % UMBRELLAS.length];
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? a : b;
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, 30, (i / 8) * TAU, ((i + 1) / 8) * TAU);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,0.2)';
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(0, 0, 29, 0, 7); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(0, 0, 3, 0, 7); g.fill();
  });
}

export const isTallProp = (p) => p.kind === 'palm' || p.kind === 'tree' || p.kind === 'lamp' || p.kind === 'umbrella' || p.kind === 'crane';
const palmHeight = (p) => 50 + p.v * 8;

/** Ground-level props, drawn on plane 0 in world units. */
export function drawPropLow(ctx, p, time) {
  switch (p.kind) {
    case 'hydrant':
      ctx.fillStyle = p.down ? '#8a2a2a' : '#e2373c';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff8a80';
      ctx.beginPath(); ctx.arc(p.x - 0.8, p.y - 0.8, 1.3, 0, 7); ctx.fill();
      break;
    case 'bin':
      ctx.fillStyle = '#2e5d4b';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.6, 0, 7); ctx.fill();
      ctx.fillStyle = '#4c8f76';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 7); ctx.fill();
      break;
    case 'bench':
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a ?? 0);
      ctx.fillStyle = '#7a5232';
      ctx.fillRect(-9, -3, 18, 6);
      ctx.fillStyle = '#a3754a';
      ctx.fillRect(-9, -3, 18, 2);
      ctx.restore();
      break;
    case 'boat': {
      ctx.save();
      ctx.translate(p.x + Math.sin(time * 0.7 + p.x) * 1.5, p.y + Math.cos(time * 0.6 + p.y) * 1.5);
      ctx.rotate(p.a + Math.sin(time * 0.5 + p.x) * 0.03);
      const len = [36, 62, 46][p.v];
      const wid = [13, 19, 14][p.v];
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(-4, 0, len * 0.62, wid * 0.8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#f7f5ef';
      ctx.beginPath();
      ctx.moveTo(len / 2, 0);
      ctx.quadraticCurveTo(len * 0.3, -wid / 2, -len / 2, -wid / 2 + 1);
      ctx.lineTo(-len / 2, wid / 2 - 1);
      ctx.quadraticCurveTo(len * 0.3, wid / 2, len / 2, 0);
      ctx.fill();
      ctx.fillStyle = ['#18a4b8', '#22324e', '#c9713a'][p.v];
      ctx.fillRect(-len * 0.42, -wid * 0.3, len * 0.5, wid * 0.6);
      ctx.fillStyle = p.v === 1 ? '#dfeaf0' : '#f7f5ef';
      ctx.fillRect(-len * 0.3, -wid * 0.2, len * 0.28, wid * 0.4);
      if (p.v === 2) {
        ctx.fillStyle = '#fffdf4';
        ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-14, -15); ctx.lineTo(-14, 0); ctx.fill();
        ctx.fillStyle = '#5a4030';
        ctx.fillRect(-15, -1, 22, 2);
      }
      ctx.restore();
      break;
    }
    case 'lamp':
      if (p.down) {
        ctx.strokeStyle = '#59606a';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + (p.fx ?? 1) * 40, p.y + (p.fy ?? 0) * 40); ctx.stroke();
      } else {
        ctx.fillStyle = '#4a5058';
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 7); ctx.fill();
      }
      break;
    default: break;
  }
}

/** Tall props, drawn in screen space so they lean with the perspective. */
export function drawPropHigh(ctx, p) {
  const s0 = scaleAt(0);
  const bx = screenX(p.x, s0);
  const by = screenY(p.y, s0);
  if (p.kind === 'palm') {
    const s1 = scaleAt(palmHeight(p));
    const lean = (p.v - 1) * 5;
    const tx = screenX(p.x + lean, s1);
    const ty = screenY(p.y + lean * 0.6, s1);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#7d5c3a';
    ctx.lineWidth = 4.6 * s0;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo((bx + tx) / 2 + lean * s0 * 0.4, (by + ty) / 2, tx, ty); ctx.stroke();
    ctx.strokeStyle = '#a98558';
    ctx.lineWidth = 1.8 * s0;
    ctx.beginPath(); ctx.moveTo(bx - s0, by); ctx.quadraticCurveTo((bx + tx) / 2 + lean * s0 * 0.4 - s0, (by + ty) / 2, tx - s0, ty); ctx.stroke();
    ctx.lineCap = 'butt';
    const r = 33 * s1;
    ctx.drawImage(palmCrown(p.v, false), tx - r, ty - r, r * 2, r * 2);
  } else if (p.kind === 'tree') {
    const s1 = scaleAt(p.small ? 20 : 28);
    const r = (p.small ? 15 : 23) * s1;
    ctx.drawImage(treeCrown(p.v, false), screenX(p.x, s1) - r, screenY(p.y, s1) - r, r * 2, r * 2);
  } else if (p.kind === 'umbrella') {
    const s1 = scaleAt(17);
    const r = 14 * s1;
    ctx.drawImage(umbrellaTop(p.v), screenX(p.x, s1) - r, screenY(p.y, s1) - r, r * 2, r * 2);
  } else if (p.kind === 'lamp') {
    if (p.down) return;
    const s1 = scaleAt(44);
    const tx = screenX(p.x, s1);
    const ty = screenY(p.y, s1);
    const hx = screenX(p.x + p.ax * 11, s1);
    const hy = screenY(p.y + p.ay * 11, s1);
    ctx.strokeStyle = '#59606a';
    ctx.lineWidth = 1.8 * s0;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
    const on = lightsOn();
    ctx.fillStyle = on ? '#fff3c4' : '#c9ced4';
    ctx.beginPath(); ctx.arc(hx, hy, 2.6 * s1, 0, 7); ctx.fill();
    if (on) {
      addGlow(p.x + p.ax * 11, p.y + p.ay * 11, 44, 11, '#ffdf9a', 0.6);
      addLight(p.x + p.ax * 16, p.y + p.ay * 16, 130, '#ffd9a0', 0.16 + L.night * 0.3);
    }
  } else if (p.kind === 'crane') {
    const z = 120;
    const s1 = scaleAt(z);
    const color = p.v ? '#e8b021' : '#e2603a';
    ctx.strokeStyle = '#7a5a20';
    ctx.lineWidth = 4 * s0;
    ctx.beginPath();
    for (const [ox, oy] of [[-30, -22], [30, -22], [-30, 22], [30, 22]]) {
      ctx.moveTo(screenX(p.x + ox, s0), screenY(p.y + oy, s0));
      ctx.lineTo(screenX(p.x + ox, s1), screenY(p.y + oy, s1));
    }
    ctx.stroke();
    setPlane(ctx, z);
    ctx.fillStyle = color;
    ctx.fillRect(p.x - 34, p.y - 26, 68, 8);
    ctx.fillRect(p.x - 34, p.y + 18, 68, 8);
    ctx.fillRect(p.x - 8, p.y - 70, 16, 250);
    ctx.strokeStyle = 'rgba(60,30,0,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let y = p.y - 70; y < p.y + 180; y += 16) { ctx.moveTo(p.x - 8, y); ctx.lineTo(p.x + 8, y + 16); ctx.moveTo(p.x + 8, y); ctx.lineTo(p.x - 8, y + 16); }
    ctx.stroke();
    ctx.fillStyle = '#f4f1e8';
    ctx.fillRect(p.x - 12, p.y + 30, 24, 20);
    ctx.fillStyle = '#2b3a55';
    ctx.fillRect(p.x - 9, p.y + 40, 18, 7);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}

/** The shadow a tall prop throws on the ground (plane 0, world units). */
export function drawPropShadow(ctx, p) {
  if (p.kind === 'palm') {
    const h = palmHeight(p);
    const ox = p.x + L.shadowX * h;
    const oy = p.y + L.shadowY * h;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ox, oy); ctx.stroke();
    ctx.drawImage(palmCrown(p.v, true), ox - 31, oy - 31, 62, 62);
  } else if (p.kind === 'tree') {
    const h = p.small ? 20 : 28;
    const r = p.small ? 15 : 23;
    ctx.drawImage(treeCrown(p.v, true), p.x + L.shadowX * h - r, p.y + L.shadowY * h - r, r * 2, r * 2);
  } else if (p.kind === 'umbrella') {
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(p.x + L.shadowX * 17, p.y + L.shadowY * 17, 13, 0, 7); ctx.fill();
  } else if (p.kind === 'lamp' && !p.down) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + L.shadowX * 44, p.y + L.shadowY * 44); ctx.stroke();
  } else if (p.kind === 'crane') {
    ctx.fillStyle = '#000';
    ctx.fillRect(p.x - 8 + L.shadowX * 120, p.y - 70 + L.shadowY * 120, 16, 250);
    ctx.fillRect(p.x - 34 + L.shadowX * 120, p.y - 26 + L.shadowY * 120, 68, 52);
  }
}

export function propReach(p) {
  return p.kind === 'crane' ? 260 : p.kind === 'palm' ? 90 : 60;
}


