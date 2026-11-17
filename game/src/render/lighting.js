// Time-of-day lighting: the sun's direction and colour through day, golden hour, dusk and night,
// the light each wall face receives, shadow direction, and a light map (street lamps, headlights,
// sirens, fire) multiplied over the scene, followed by additive glows and a sunset colour wash.
import { cam, scaleAt, screenX, screenY } from './camera.js';
import { clamp, lerp } from '../core/math.js';

// hour, ambient r g b, warmth (sunset wash), night (0 day .. 1 night)
const KEYS = [
  [0, 84, 96, 150, 0, 1],
  [4.8, 84, 96, 150, 0, 1],
  [6.1, 236, 170, 150, 0.6, 0.35],
  [7.6, 255, 248, 236, 0.1, 0],
  [15.5, 255, 250, 240, 0, 0],
  [17.2, 255, 234, 204, 0.6, 0],
  [18.4, 255, 208, 170, 1, 0.1],
  [19.3, 206, 136, 160, 0.75, 0.55],
  [20.4, 104, 104, 160, 0.1, 1],
  [24, 84, 96, 150, 0, 1],
];

export const L = {
  ambient: [255, 255, 255], warm: 0, night: 0, key: -1,
  sunX: -1, sunY: 0, shadowX: 1, shadowY: 0, shadowAlpha: 0.3,
  face: { W: 1, E: 1, N: 1, S: 1 }, roof: 1, tint: [255, 196, 140],
};

const lights = [];
const beams = [];
const glows = [];
const sprites = new Map();
let lightmap = null;
let vignette = null;

export function computeLighting(clock) {
  const h = ((clock % 24) + 24) % 24;
  let k = 0;
  while (k < KEYS.length - 2 && h >= KEYS[k + 1][0]) k++;
  const a = KEYS[k];
  const b = KEYS[k + 1];
  const t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  L.ambient = [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
  L.warm = lerp(a[4], b[4], t);
  L.night = lerp(a[5], b[5], t);
  L.key = Math.round(h * 12);
  if (h > 5.5 && h < 19.6) {
    const theta = ((h - 6) / 12) * Math.PI;
    const elevation = Math.max(0.1, Math.sin(clamp(theta, 0.05, Math.PI - 0.05)));
    L.sunX = Math.cos(theta);
    L.sunY = Math.sin(theta) * 0.55 + 0.12;
    const len = clamp(0.3 / elevation, 0.3, 0.85);
    L.shadowX = -L.sunX * len;
    L.shadowY = -L.sunY * len;
    L.shadowAlpha = lerp(0.3 + L.warm * 0.14, 0.12, L.night);
    const lit = (nx, ny) => 0.7 + 0.42 * Math.max(0, nx * L.sunX + ny * L.sunY);
    L.face = { W: lit(-1, 0), E: lit(1, 0), N: lit(0, -1), S: lit(0, 1) };
  } else {
    L.sunX = -0.5;
    L.sunY = -0.5;
    L.shadowX = 0.2;
    L.shadowY = 0.2;
    L.shadowAlpha = 0.12;
    L.face = { W: 0.86, E: 0.78, N: 0.8, S: 0.84 };
  }
  L.roof = 1;
  return L;
}

/** True when lamps, headlights and lit windows should be on. */
export const lightsOn = () => L.night > 0.05 || L.warm > 0.85;
/** True when it is dark enough for windows to show as lit. */
export const windowsLit = () => L.night > 0.3;

export function beginLights() {
  lights.length = 0;
  beams.length = 0;
  glows.length = 0;
}

/** A pool of light on the ground (light map). */
export function addLight(x, y, radius, color, alpha = 1) {
  lights.push(x, y, radius, color, alpha);
}

/** A headlight cone on the ground (light map). */
export function addBeam(x, y, angle, length, color = '#fff2cc', alpha = 1) {
  beams.push(x, y, angle, length, color, alpha);
}

/** A glowing point at height z drawn additively over the lit scene. */
export function addGlow(x, y, z, radius, color, alpha = 1) {
  glows.push(x, y, z, radius, color, alpha);
}

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function glowSprite(color) {
  let s = sprites.get(color);
  if (s) return s;
  s = canvasOf(64, 64);
  const g = s.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, color);
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 1;
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  // Soften: redraw with falloff so the middle is not a hard disc.
  const soft = canvasOf(64, 64);
  const sg = soft.getContext('2d');
  const fall = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
  fall.addColorStop(0, 'rgba(255,255,255,1)');
  fall.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  fall.addColorStop(1, 'rgba(255,255,255,0)');
  sg.fillStyle = fall;
  sg.fillRect(0, 0, 64, 64);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = color;
  sg.fillRect(0, 0, 64, 64);
  sprites.set(color, soft);
  return soft;
}

function beamSprite(color) {
  const key = `beam${color}`;
  let s = sprites.get(key);
  if (s) return s;
  s = canvasOf(128, 96);
  const g = s.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.filter = 'blur(5px)';
  g.beginPath();
  g.moveTo(4, 42);
  g.lineTo(120, 8);
  g.lineTo(120, 88);
  g.lineTo(4, 54);
  g.closePath();
  g.fill();
  sprites.set(key, s);
  return s;
}

/** Multiplies the light map over the drawn world, then adds glows, the sunset wash and a vignette. */
export function applyLighting(ctx, quality = 1) {
  const s = scaleAt(0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const dark = L.ambient[0] < 250 || L.ambient[1] < 244 || L.ambient[2] < 232;
  if (dark && quality > 0) {
    const lw = Math.ceil(cam.w / 2);
    const lh = Math.ceil(cam.h / 2);
    if (!lightmap || lightmap.width !== lw || lightmap.height !== lh) lightmap = canvasOf(lw, lh);
    const g = lightmap.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = `rgb(${L.ambient[0] | 0},${L.ambient[1] | 0},${L.ambient[2] | 0})`;
    g.fillRect(0, 0, lw, lh);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < lights.length; i += 5) {
      const r = (lights[i + 2] * s) / 2;
      const x = screenX(lights[i], s) / 2;
      const y = screenY(lights[i + 1], s) / 2;
      if (x < -r || y < -r || x > lw + r || y > lh + r) continue;
      g.globalAlpha = lights[i + 4];
      g.drawImage(glowSprite(lights[i + 3]), x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < beams.length; i += 6) {
      const len = (beams[i + 3] * s) / 2;
      g.globalAlpha = beams[i + 5];
      g.setTransform(1, 0, 0, 1, screenX(beams[i], s) / 2, screenY(beams[i + 1], s) / 2);
      g.rotate(beams[i + 2]);
      g.drawImage(beamSprite(beams[i + 4]), 0, -len * 0.375, len, len * 0.75);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(lightmap, 0, 0, cam.w, cam.h);
  }
  if (L.warm > 0.02 && quality > 0) {
    // Golden hour: the west glows orange, the east falls toward violet.
    ctx.globalCompositeOperation = 'soft-light';
    const wash = ctx.createLinearGradient(0, 0, cam.w, cam.h * 0.25);
    wash.addColorStop(0, `rgba(255,138,30,${0.62 * L.warm})`);
    wash.addColorStop(0.55, `rgba(255,110,120,${0.36 * L.warm})`);
    wash.addColorStop(1, `rgba(110,50,200,${0.46 * L.warm})`);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, cam.w, cam.h);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < glows.length; i += 6) {
    const gs = scaleAt(glows[i + 2]);
    const r = glows[i + 3] * gs;
    const x = screenX(glows[i], gs);
    const y = screenY(glows[i + 1], gs);
    if (x < -r || y < -r || x > cam.w + r || y > cam.h + r) continue;
    ctx.globalAlpha = glows[i + 5];
    ctx.drawImage(glowSprite(glows[i + 4]), x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (!vignette || vignette.width !== Math.ceil(cam.w / 4)) {
    vignette = canvasOf(Math.ceil(cam.w / 4), Math.ceil(cam.h / 4));
    const g = vignette.getContext('2d');
    const grad = g.createRadialGradient(vignette.width / 2, vignette.height / 2, vignette.height * 0.45, vignette.width / 2, vignette.height / 2, vignette.width * 0.72);
    grad.addColorStop(0, 'rgba(10,6,30,0)');
    grad.addColorStop(1, 'rgba(10,6,30,0.5)');
    g.fillStyle = grad;
    g.fillRect(0, 0, vignette.width, vignette.height);
  }
  ctx.drawImage(vignette, 0, 0, cam.w, cam.h);
}
