// Draws every vehicle from above in two layers (body near the ground, cabin and roof a little
// higher, so cars lean with the perspective like the buildings do): hatchbacks, sedans, SUVs,
// pickups, muscle and sports cars, vans, box trucks, buses, taxis and police cars with light bars.
import { setPlane } from './camera.js';
import { L, lightsOn, addBeam, addGlow, addLight } from './lighting.js';
import { shadeHex } from '../core/math.js';

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintOf(v) {
  if (v.wreck) return ['#2b2a2e', '#1c1b1f', '#3a393e'];
  if (v._paintKey !== L.key) {
    v._paintKey = L.key;
    v._paint = [shadeHex(v.paint, 1, L.tint, L.warm * 0.12), shadeHex(v.paint, 0.66), shadeHex(v.paint, 1.22, [255, 255, 255], 0.25)];
  }
  return v._paint;
}

/** Where the glass starts and ends along the car, by body style: [rear, front] as fractions of the length. */
const CABIN = { hatchback: [-0.4, 0.16], sedan: [-0.27, 0.17], suv: [-0.4, 0.2], pickup: [-0.02, 0.24], muscle: [-0.3, 0.06], sports: [-0.3, 0.1], super: [-0.22, 0.16], van: [-0.44, 0.3], truck: [0.22, 0.4], bus: [-0.47, 0.44] };
const ROOF_Z = { van: 15, truck: 13, bus: 17, suv: 12, pickup: 11 };

export function drawVehicleShadow(ctx, v) {
  ctx.save();
  ctx.translate(v.x + L.shadowX * 7 + 1.5, v.y + L.shadowY * 7 + 1.5);
  ctx.rotate(v.angle);
  rounded(ctx, -v.spec.len / 2, -v.spec.wid / 2, v.spec.len, v.spec.wid, 5);
  ctx.fill();
  ctx.restore();
}

function drawBody(ctx, v, body, dark, light) {
  const { len, wid, kind } = v.spec;
  const hl = len / 2;
  const hw = wid / 2;
  // Wheels peek out at the corners.
  ctx.fillStyle = '#15151a';
  for (const wx of [hl * 0.58, -hl * 0.6]) {
    ctx.fillRect(wx - 4.5, -hw - 1, 9, 3);
    ctx.fillRect(wx - 4.5, hw - 2, 9, 3);
  }
  const nose = kind === 'sports' || kind === 'super' ? 8 : kind === 'van' || kind === 'bus' || kind === 'truck' ? 3 : 6;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-hl + 4, -hw);
  ctx.lineTo(hl - nose, -hw);
  ctx.quadraticCurveTo(hl, -hw, hl, -hw + nose);
  ctx.lineTo(hl, hw - nose);
  ctx.quadraticCurveTo(hl, hw, hl - nose, hw);
  ctx.lineTo(-hl + 4, hw);
  ctx.quadraticCurveTo(-hl, hw, -hl, hw - 4);
  ctx.lineTo(-hl, -hw + 4);
  ctx.quadraticCurveTo(-hl, -hw, -hl + 4, -hw);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.1;
  ctx.stroke();
  // A highlight down the sunny flank.
  ctx.fillStyle = light;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(-hl + 5, -hw + 1.2, len - 12, 1.6);
  ctx.globalAlpha = 1;
  if (v.spec.stripe && !v.wreck) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(-hl + 1, -3.2, len - 2, 2.2);
    ctx.fillRect(-hl + 1, 1, len - 2, 2.2);
  }
  if (v.spec.police && !v.wreck) {
    ctx.fillStyle = v.spec.armored ? '#3d5279' : '#1d3b78';
    ctx.fillRect(-hl * 0.25, -hw + 0.6, hl * 0.62, 2.6);
    ctx.fillRect(-hl * 0.25, hw - 3.2, hl * 0.62, 2.6);
    ctx.fillStyle = v.spec.armored ? '#27364f' : '#1d3b78';
    ctx.fillRect(hl * 0.5, -hw + 1, hl * 0.42, wid - 2);
  }
  if (kind === 'pickup') {
    ctx.fillStyle = dark;
    ctx.fillRect(-hl + 3, -hw + 2.5, hl * 0.86, wid - 5);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-hl + 5, -hw + 4.5, hl * 0.86 - 4, wid - 9);
  }
  if (kind === 'sports' || kind === 'super') {
    ctx.fillStyle = dark;
    ctx.fillRect(-hl + 1, -hw + 1.5, 3, wid - 3);
    if (kind === 'super') {
      ctx.fillRect(-hl * 0.42, -hw + 1, 6, 2.2);
      ctx.fillRect(-hl * 0.42, hw - 3.2, 6, 2.2);
    }
  }
  if (kind === 'muscle') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(hl * 0.36, -2.5, 7, 5);
  }
  // Lamps.
  const on = lightsOn() && !v.wreck && (v.driver || v.siren);
  ctx.fillStyle = v.wreck ? '#555' : on ? '#fffbe0' : '#e9e4c9';
  ctx.fillRect(hl - 2.2, -hw + 1.6, 2.2, 4.2);
  ctx.fillRect(hl - 2.2, hw - 5.8, 2.2, 4.2);
  ctx.fillStyle = v.wreck ? '#402' : v.braking ? '#ff3b30' : '#a5121f';
  ctx.fillRect(-hl, -hw + 1.6, 1.8, 4.4);
  ctx.fillRect(-hl, hw - 6, 1.8, 4.4);
}

function drawCabin(ctx, v, body, dark, light, time) {
  const { len, wid, kind } = v.spec;
  const hw = wid / 2 - 1.6;
  const [r0, r1] = CABIN[kind];
  const x0 = r0 * len;
  const x1 = r1 * len;
  const glass = v.wreck ? '#3b3b40' : L.night > 0.5 ? '#182236' : '#1e3350';
  if (kind === 'truck') {
    // Cab up front, a white refrigerated box behind.
    ctx.fillStyle = '#eef2f4';
    rounded(ctx, -len / 2 + 1, -wid / 2 + 0.5, len * 0.66, wid - 1, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let x = -len / 2 + 6; x < len * 0.15; x += 5) { ctx.moveTo(x, -wid / 2 + 1); ctx.lineTo(x, wid / 2 - 1); }
    ctx.stroke();
    ctx.fillStyle = '#36c9e0';
    ctx.fillRect(-len * 0.3, -2, len * 0.3, 4);
  }
  ctx.fillStyle = glass;
  rounded(ctx, x0, -hw, x1 - x0, hw * 2, 3.5);
  ctx.fill();
  // The roof sits inside the glass, leaving a windscreen in front and a rear window behind.
  const front = kind === 'van' || kind === 'bus' ? 5 : kind === 'truck' ? 4 : 6.5;
  const rear = kind === 'van' || kind === 'bus' || kind === 'truck' ? 0.5 : kind === 'pickup' ? 2 : 5;
  const rx0 = x0 + rear;
  const rx1 = x1 - front;
  ctx.fillStyle = kind === 'bus' ? '#f4f1e8' : body;
  rounded(ctx, rx0, -hw + 1.8, Math.max(2, rx1 - rx0), hw * 2 - 3.6, 2.5);
  ctx.fill();
  ctx.fillStyle = light;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(rx0 + 2, -hw + 2.8, Math.max(1, rx1 - rx0 - 4), 1.6);
  ctx.globalAlpha = 1;
  // Glare on the windscreen.
  if (!v.wreck) {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x1 - front + 1.2, -hw + 3, 1.4, hw * 0.8);
  }
  if (kind === 'bus') {
    ctx.fillStyle = body;
    ctx.fillRect(rx0 + 3, -2.5, rx1 - rx0 - 6, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-len * 0.2, -4.5, 9, 9);
    ctx.fillRect(len * 0.1, -4.5, 9, 9);
  }
  if (kind === 'suv') {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx0 + 2, -hw + 3.4); ctx.lineTo(rx1 - 2, -hw + 3.4);
    ctx.moveTo(rx0 + 2, hw - 3.4); ctx.lineTo(rx1 - 2, hw - 3.4);
    ctx.stroke();
  }
  if (v.spec.taxi && !v.wreck) {
    ctx.fillStyle = '#1b1b20';
    ctx.fillRect((rx0 + rx1) / 2 - 2, -5, 4, 10);
    ctx.fillStyle = v.fare ? '#7dff9a' : '#fff3a0';
    ctx.fillRect((rx0 + rx1) / 2 - 1.2, -4, 2.4, 8);
    // A chequered band across the back of the roof.
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? '#1b1b20' : '#fff7d6';
      ctx.fillRect(rx0 + 1.5, -hw + 2.4 + k * ((hw * 2 - 4.8) / 6), 2.4, (hw * 2 - 4.8) / 6);
    }
  }
  if (v.model === 'kitevan' && !v.wreck) {
    ctx.fillStyle = '#374b69';
    ctx.beginPath();
    ctx.moveTo(-6, 0); ctx.lineTo(0, -5); ctx.lineTo(7, 0); ctx.lineTo(0, 5);
    ctx.fill();
  }
  if (v.spec.police && !v.wreck) {
    const cx = (rx0 + rx1) / 2;
    const flip = v.siren && Math.floor(time * 7 + v.id) % 2 === 0;
    ctx.fillStyle = '#16161c';
    ctx.fillRect(cx - 2.4, -hw + 2.5, 4.8, hw * 2 - 5);
    ctx.fillStyle = v.siren ? (flip ? '#ff3030' : '#5a1010') : '#c22';
    ctx.fillRect(cx - 1.6, -hw + 3.2, 3.2, hw - 3.8);
    ctx.fillStyle = v.siren ? (flip ? '#10205a' : '#3a7bff') : '#2452c9';
    ctx.fillRect(cx - 1.6, 0.6, 3.2, hw - 3.8);
  }
}

/** Draws one vehicle and registers its lights (headlamps, tail lamps, sirens) with the light map. */
export function drawVehicle(ctx, v, time) {
  const [body, dark, light] = paintOf(v);
  setPlane(ctx, 4);
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);
  drawBody(ctx, v, body, dark, light);
  setPlane(ctx, ROOF_Z[v.spec.kind] ?? 10);
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);
  drawCabin(ctx, v, body, dark, light, time);
  if (v.wreck) return;
  const c = Math.cos(v.angle);
  const s = Math.sin(v.angle);
  const hl = v.spec.len / 2;
  if (lightsOn() && (v.driver || v.siren)) {
    addBeam(v.x + c * hl, v.y + s * hl, v.angle, 210, '#fff2cc', 0.5 + L.night * 0.4);
    const side = v.spec.wid / 2 - 4;
    addGlow(v.x + c * hl - s * side, v.y + s * hl + c * side, 4, 7, '#fff6d0', 0.8);
    addGlow(v.x + c * hl + s * side, v.y + s * hl - c * side, 4, 7, '#fff6d0', 0.8);
    addGlow(v.x - c * hl - s * side, v.y - s * hl + c * side, 4, v.braking ? 9 : 5, '#ff2a2a', v.braking ? 0.9 : 0.6);
    addGlow(v.x - c * hl + s * side, v.y - s * hl - c * side, 4, v.braking ? 9 : 5, '#ff2a2a', v.braking ? 0.9 : 0.6);
  } else if (v.braking) {
    const side = v.spec.wid / 2 - 4;
    addGlow(v.x - c * hl - s * side, v.y - s * hl + c * side, 4, 6, '#ff2a2a', 0.6);
    addGlow(v.x - c * hl + s * side, v.y - s * hl - c * side, 4, 6, '#ff2a2a', 0.6);
  }
  if (v.siren) {
    const flip = Math.floor(time * 7 + v.id) % 2 === 0;
    const color = flip ? '#ff2a2a' : '#3a6bff';
    addGlow(v.x, v.y - (flip ? 4 : -4), 12, 26, color, 0.95);
    addLight(v.x, v.y, 210, color, 0.34 + L.night * 0.22);
  }
}
