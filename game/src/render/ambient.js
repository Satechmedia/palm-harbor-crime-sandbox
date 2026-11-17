// Life above the streets: cloud shadows that drift across the city by day, and gulls that
// wheel over the beach, the river and the harbour.
import { WORLD_W, WORLD_H } from '../core/config.js';
import { hash2 } from '../core/random.js';
import { coastX, RIVER_Y0, RIVER_Y1 } from '../city/layout.js';
import { cam, scaleAt, screenX, screenY } from './camera.js';
import { L } from './lighting.js';

/** Soft shadows of passing clouds on the ground (ctx on plane 0). Fainter toward night. */
export function drawCloudShadows(ctx, time, view) {
  const strength = 0.075 * (1 - L.night);
  if (strength < 0.01) return;
  ctx.fillStyle = `rgba(30,20,70,${strength})`;
  for (let k = 0; k < 9; k++) {
    const speed = 16 + hash2(k, 3) * 12;
    const span = WORLD_W + 1600;
    const x = ((hash2(k, 1) * span + time * speed) % span) - 800;
    const y = hash2(k, 2) * WORLD_H;
    const rx = 260 + hash2(k, 4) * 240;
    const ry = 150 + hash2(k, 5) * 130;
    if (x + rx * 1.6 < view.x0 || x - rx * 1.6 > view.x1 || y + ry * 1.6 < view.y0 || y - ry * 1.6 > view.y1) continue;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0.2, 0, 7);
    ctx.ellipse(x + rx * 0.6, y + ry * 0.35, rx * 0.7, ry * 0.75, -0.1, 0, 7);
    ctx.ellipse(x - rx * 0.55, y - ry * 0.2, rx * 0.6, ry * 0.6, 0.4, 0, 7);
    ctx.fill();
  }
}

/** Where gull k is at `time`: each circles its own patch of shore or water. */
function gullAt(k, time) {
  const onRiver = k % 4 === 3;
  const cy = onRiver ? (RIVER_Y0 + RIVER_Y1) / 2 : 400 + hash2(k, 11) * 3500;
  const cx = onRiver ? 1200 + hash2(k, 12) * 3800 : coastX(cy) + 40 + hash2(k, 13) * 260;
  const r = 60 + hash2(k, 14) * 90;
  const a = time * (0.35 + hash2(k, 15) * 0.3) * (k % 2 ? 1 : -1) + hash2(k, 16) * 6.283;
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.7, heading: a + (k % 2 ? 1 : -1) * Math.PI / 2, flap: Math.sin(time * 7 + k) };
}

/** Gulls, drawn in screen space high above the rooftops with a small shadow below. */
export function drawGulls(ctx, time) {
  if (L.night > 0.7) return;
  const s0 = scaleAt(0);
  const s1 = scaleAt(140);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = 'round';
  for (let k = 0; k < 28; k++) {
    const g = gullAt(k, time);
    const x = screenX(g.x, s1);
    const y = screenY(g.y, s1);
    if (x < -30 || y < -30 || x > cam.w + 30 || y > cam.h + 30) continue;
    const w = (7 + g.flap * 1.5) * s1;
    const c = Math.cos(g.heading);
    const s = Math.sin(g.heading);
    const wing = (px, py, color, width, scale) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(px - s * w * scale - c * w * 0.35 * scale, py + c * w * scale - s * w * 0.35 * scale);
      ctx.lineTo(px + c * w * 0.25 * scale, py + s * w * 0.25 * scale);
      ctx.lineTo(px + s * w * scale - c * w * 0.35 * scale, py - c * w * scale - s * w * 0.35 * scale);
      ctx.stroke();
    };
    wing(screenX(g.x + L.shadowX * 140, s0), screenY(g.y + L.shadowY * 140, s0), `rgba(20,10,50,${0.22 * (1 - L.night)})`, 2.2 * s0, s0 / s1);
    wing(x, y, '#fdfdfd', 2 * s1, 1);
  }
  ctx.lineCap = 'butt';
}
