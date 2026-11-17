// World-space signposting: pulsing rings and light pillars at objectives and shops, arrows over
// enemies and mission vehicles, pickups on the ground, golden pelicans and traffic signals.
import { cam, scaleAt, screenX, screenY, setPlane } from './camera.js';
import { addGlow, addLight } from './lighting.js';
import { signalState } from '../city/roads.js';
import { UI_FONT, DISPLAY_FONT } from '../core/config.js';

/** Rings painted on the street under every marker in view. */
export function drawGroundMarkers(ctx, G, markers, view) {
  setPlane(ctx, 0);
  for (const m of markers) {
    if (m.kind === 'enemy' || m.x < view.x0 - 80 || m.x > view.x1 + 80 || m.y < view.y0 - 80 || m.y > view.y1 + 80) continue;
    const pulse = 0.5 + 0.5 * Math.sin(G.time * 4 + m.x);
    ctx.strokeStyle = m.color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * (0.86 + pulse * 0.08), 0, 7);
    ctx.stroke();
    ctx.globalAlpha = 0.16 + pulse * 0.1;
    ctx.fillStyle = m.color;
    ctx.fill();
    ctx.globalAlpha = 1;
    addLight(m.x, m.y, m.r * 5, m.color, 0.35);
  }
}

export function drawPickups(ctx, G) {
  setPlane(ctx, 0);
  for (const k of G.pickups) {
    const bob = Math.sin(G.time * 5 + k.x) * 1.2;
    ctx.save();
    ctx.translate(k.x, k.y + bob);
    if (k.kind === 'cash') {
      ctx.rotate(0.3);
      ctx.fillStyle = '#1f8f4d';
      ctx.fillRect(-5, -3, 10, 6);
      ctx.fillStyle = '#b6f5c8';
      ctx.fillRect(-1.2, -1.8, 2.4, 3.6);
    } else if (k.kind === 'ammo') {
      ctx.fillStyle = '#6b5a2e';
      ctx.fillRect(-4.5, -3.5, 9, 7);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(-3, -1, 6, 2);
    } else {
      ctx.fillStyle = '#ff4d6d';
      ctx.fillRect(-4, -1.6, 8, 3.2);
      ctx.fillRect(-1.6, -4, 3.2, 8);
    }
    ctx.restore();
    addGlow(k.x, k.y, 2, 12, k.kind === 'cash' ? '#5dff95' : k.kind === 'ammo' ? '#ffd23f' : '#ff6d8a', 0.45);
  }
  for (const s of G.pelicans ?? []) {
    if (G.pelicansFound.includes(s.id) || Math.abs(s.x - cam.x) > 700 || Math.abs(s.y - cam.y) > 500) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.fillStyle = '#7a5a12';
    ctx.fillRect(-4, 2, 8, 3);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(0, -1, 3.4, 4.6, 0, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(1.4, -6, 2.3, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#ff9d1c';
    ctx.fillRect(2.8, -6.6, 5, 1.8);
    ctx.restore();
    addGlow(s.x, s.y, 6, 20 + Math.sin(G.time * 3) * 4, '#ffd23f', 0.7);
    addLight(s.x, s.y, 70, '#ffe08a', 0.5);
  }
}

/** Light pillars, letters and arrows floating over markers; drawn after the buildings. */
export function drawMarkerBeacons(ctx, G, markers) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const s0 = scaleAt(0);
  for (const m of markers) {
    const x = screenX(m.x, s0);
    const y = screenY(m.y, s0);
    if (x < -60 || y < -60 || x > cam.w + 60 || y > cam.h + 160) continue;
    const u = cam.scale * cam.zoom;
    if (m.kind === 'enemy' || m.kind === 'vehicle') {
      const bob = Math.sin(G.time * 6 + m.x) * 3 * u;
      const top = y - (m.kind === 'enemy' && m.r < 20 ? 20 : 34) * u + bob;
      ctx.fillStyle = m.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, top + 9 * u);
      ctx.lineTo(x - 6.5 * u, top);
      ctx.lineTo(x + 6.5 * u, top);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (m.hp !== undefined) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x - 20 * u, top - 8 * u, 40 * u, 5 * u);
        ctx.fillStyle = m.color;
        ctx.fillRect(x - 19 * u, top - 7 * u, 38 * u * Math.max(0, m.hp), 3 * u);
      }
      if (m.label) {
        ctx.font = `bold ${Math.round(11 * cam.scale)}px ${UI_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText(m.label, x + 1, top - (m.hp !== undefined ? 11 : 4) * u + 1);
        ctx.fillStyle = '#fff';
        ctx.fillText(m.label, x, top - (m.hp !== undefined ? 11 : 4) * u);
      }
      continue;
    }
    if (m.kind === 'next') continue;
    // A pillar of light rising from the ring.
    const s1 = scaleAt(150);
    const tx = screenX(m.x, s1);
    const ty = screenY(m.y, s1);
    const w = m.r * 0.5 * s0;
    const grad = ctx.createLinearGradient(x, y, tx, ty);
    grad.addColorStop(0, m.color);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(tx + w * 1.3, ty);
    ctx.lineTo(tx - w * 1.3, ty);
    ctx.fill();
    ctx.globalAlpha = 1;
    addGlow(m.x, m.y, 4, m.r * 1.6, m.color, 0.5);
    if (m.letter) {
      const r = 13 * cam.scale;
      const ly = y - 30 * u + Math.sin(G.time * 3 + m.x) * 2.5 * u;
      ctx.fillStyle = 'rgba(12,10,26,0.86)';
      ctx.beginPath();
      ctx.arc(x, ly, r, 0, 7);
      ctx.fill();
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 2.4 * cam.scale;
      ctx.stroke();
      ctx.fillStyle = m.color;
      ctx.font = `${Math.round(16 * cam.scale)}px ${DISPLAY_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.letter, x, ly + cam.scale);
      ctx.textBaseline = 'alphabetic';
    }
    if (m.label) {
      ctx.font = `bold ${Math.round(12 * cam.scale)}px ${UI_FONT}`;
      ctx.textAlign = 'center';
      const ly = y - (m.letter ? 50 : 26) * u;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillText(m.label, x + 1, ly + 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(m.label, x, ly);
    }
  }
  ctx.textAlign = 'left';
}

/** Signal heads at the corners of every lit junction in view. */
export function drawTrafficSignals(ctx, G, view) {
  const COLORS = { green: '#3dff7a', yellow: '#ffd23f', red: '#ff3b30' };
  setPlane(ctx, 26);
  for (const n of G.city.roads.nodes) {
    if (!n.signal || n.x < view.x0 - 100 || n.x > view.x1 + 100 || n.y < view.y0 - 100 || n.y > view.y1 + 100) continue;
    const h = COLORS[signalState(n, true, G.time)];
    const v = COLORS[signalState(n, false, G.time)];
    for (const [sx, sy, color] of [[-1, 1, h], [1, -1, h], [-1, -1, v], [1, 1, v]]) {
      const x = n.x + sx * (n.hx + 5);
      const y = n.y + sy * (n.hy + 5);
      ctx.fillStyle = '#1b1d24';
      ctx.fillRect(x - 2.6, y - 2.6, 5.2, 5.2);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 1.7, 0, 7);
      ctx.fill();
      addGlow(x, y, 26, 7, color, 0.75);
    }
  }
}
