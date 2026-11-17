// Animated water: drifting glints on the ocean, river and harbour, and surf that laps the sand.
import { hash2 } from '../core/random.js';
import { coastX, RIVER_Y0, RIVER_Y1, QUAY_Y, BRIDGE_COLS, V_ROADS, PIER, halfWidth } from '../city/layout.js';
import { L } from './lighting.js';

const BRIDGES = BRIDGE_COLS.map((i) => [V_ROADS[i].x - halfWidth(V_ROADS[i]) - 18, V_ROADS[i].x + halfWidth(V_ROADS[i]) + 18]);

function isOpenWater(x, y, ships) {
  if (x < coastX(y) - 8) return !(x > PIER.x - 6 && y > PIER.y - 6 && y < PIER.y + PIER.h + 6);
  if (y > RIVER_Y0 + 8 && y < RIVER_Y1 - 8) return !BRIDGES.some((b) => x > b[0] && x < b[1]);
  if (y > QUAY_Y + 6) return !ships.some((s) => x > s.x - 4 && x < s.x + s.w + 4 && y > s.y - 4 && y < s.y + s.h + 4);
  return false;
}

/** Draws glints and surf for the visible water (ctx on plane 0). */
export function drawWater(ctx, view, time, city) {
  const ships = city.ships ?? (city.ships = city.decor.filter((d) => d.t === 'ship'));
  const CW = 58;
  const CH = 34;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = L.warm > 0.4 ? 'rgba(255,236,200,0.6)' : 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  for (let gy = Math.floor(view.y0 / CH); gy * CH < view.y1; gy++) {
    for (let gx = Math.floor(view.x0 / CW); gx * CW < view.x1; gx++) {
      const h = hash2(gx, gy, 1);
      const phase = Math.sin(time * 1.4 + h * 40);
      if (phase < 0.1) continue;
      const x = gx * CW + h * CW + Math.sin(time * 0.6 + h * 20) * 7;
      const y = gy * CH + hash2(gx, gy, 2) * CH;
      if (!isOpenWater(x, y, ships)) continue;
      const len = (5 + h * 12) * phase;
      ctx.moveTo(x - len, y);
      ctx.lineTo(x + len, y);
    }
  }
  ctx.stroke();
  if (view.x0 < 720) {
    for (const [off, alpha, speed] of [[7, 0.55, 1.1], [-26, 0.3, 0.8]]) {
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      let started = false;
      for (let y = Math.floor(view.y0 / 14) * 14; y < view.y1 + 14; y += 14) {
        if ((y > RIVER_Y0 && y < RIVER_Y1) || y > QUAY_Y) { started = false; continue; }
        const x = coastX(y) + off + Math.sin(time * speed + y * 0.02) * 5 + Math.sin(time * 0.5) * 4;
        if (started) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        started = true;
      }
      ctx.stroke();
    }
  }
  ctx.lineCap = 'butt';
}
