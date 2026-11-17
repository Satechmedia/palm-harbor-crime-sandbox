// Draws buildings as extruded boxes in top-down perspective: the walls that face the view
// centre with rows of windows, stepped tower tiers, hipped house roofs, ribbed warehouse roofs,
// fuel tanks, shop awnings and rooftop details (pools, helipads, signs, air conditioning).
import { cam, scaleAt, screenX, screenY, setPlane } from './camera.js';
import { L, lightsOn, windowsLit, addGlow } from './lighting.js';
import { shadeHex } from '../core/math.js';
import { hash2 } from '../core/random.js';
import { DISPLAY_FONT } from '../core/config.js';

const FACES = ['W', 'E', 'N', 'S'];

/** Wall and roof colours of a building under the current light, cached until the light changes. */
function shades(b) {
  if (b._key === L.key) return b._shade;
  const warm = L.warm * 0.3;
  const sh = { roof: shadeHex(b.sameRoof ? b.wall : b.roof, b.sameRoof ? 1.08 : 1, L.tint, warm * 0.5), trim: shadeHex(b.sameRoof ? b.wall : b.roof, 0.8) };
  for (const f of FACES) {
    const lit = L.face[f];
    sh[f] = shadeHex(b.wall, Math.min(1.18, lit), L.tint, lit > 0.9 ? warm : 0);
    sh[`${f}lit`] = lit > 0.9;
  }
  b._shade = sh;
  b._key = L.key;
  return sh;
}

function drawWall(ctx, b, t, sh, face, ax, ay, bx, by) {
  const s0 = scaleAt(t.z0);
  const s1 = scaleAt(t.z1);
  ctx.fillStyle = sh[face];
  ctx.beginPath();
  ctx.moveTo(screenX(ax, s0), screenY(ay, s0));
  ctx.lineTo(screenX(bx, s0), screenY(by, s0));
  ctx.lineTo(screenX(bx, s1), screenY(by, s1));
  ctx.lineTo(screenX(ax, s1), screenY(ay, s1));
  ctx.closePath();
  ctx.fill();
  if (b.noWindows) {
    if (!b.container) return;
    // Container ribs: a darker band along the side.
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    return;
  }
  const floors = Math.max(1, Math.round((t.z1 - t.z0) / b.floorH));
  const lean = face === 'W' || face === 'E' ? Math.abs(ax - cam.x) : Math.abs(ay - cam.y);
  const lw = ((lean * (s1 - s0)) / floors) * 0.52;
  if (lw < 0.9) return;
  const sm = (s0 + s1) / 2;
  const period = (b.winW + b.winGap) * sm;
  const night = windowsLit();
  ctx.lineWidth = lw;
  ctx.setLineDash([b.winW * sm, b.winGap * sm]);
  ctx.lineDashOffset = -b.winGap * sm * 0.5;
  ctx.strokeStyle = b.gold ? 'rgba(90,50,10,0.55)' : sh[`${face}lit`] && L.warm > 0.3 ? `rgba(255,224,170,${0.35 + L.warm * 0.4})` : 'rgba(22,40,72,0.5)';
  ctx.beginPath();
  for (let k = 0; k < floors; k++) {
    const s = scaleAt(t.z0 + ((k + 0.5) / floors) * (t.z1 - t.z0));
    ctx.moveTo(screenX(ax, s), screenY(ay, s));
    ctx.lineTo(screenX(bx, s), screenY(by, s));
  }
  ctx.stroke();
  if (night) {
    // Some windows are lit: three interleaved dash rhythms so the pattern does not look ruled.
    ctx.strokeStyle = b.gold ? 'rgba(255,214,120,0.95)' : 'rgba(255,226,150,0.9)';
    for (let group = 0; group < 3; group++) {
      const every = [2, 3, 5][group];
      ctx.setLineDash([b.winW * sm, period * every - b.winW * sm]);
      ctx.lineDashOffset = -b.winGap * sm * 0.5 - period * Math.floor(hash2(b.id, group, face.charCodeAt(0)) * every);
      ctx.beginPath();
      for (let k = group; k < floors; k += 3) {
        const s = scaleAt(t.z0 + ((k + 0.5) / floors) * (t.z1 - t.z0));
        ctx.moveTo(screenX(ax, s), screenY(ay, s));
        ctx.lineTo(screenX(bx, s), screenY(by, s));
      }
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
}

function drawRoofItems(ctx, b, top) {
  for (const it of b.roofItems) {
    switch (it.t) {
      case 'ac':
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(it.x + 2, it.y + 2, it.w, it.h);
        ctx.fillStyle = '#d3d8dc';
        ctx.fillRect(it.x, it.y, it.w, it.h);
        ctx.fillStyle = '#8f979d';
        ctx.beginPath(); ctx.arc(it.x + it.w / 2, it.y + it.h / 2, Math.min(it.w, it.h) * 0.3, 0, 7); ctx.fill();
        break;
      case 'hut':
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(it.x + 2.5, it.y + 2.5, it.w, it.h);
        ctx.fillStyle = '#b9b3a8';
        ctx.fillRect(it.x, it.y, it.w, it.h);
        ctx.fillStyle = '#8a857c';
        ctx.fillRect(it.x + 2, it.y + 2, it.w - 4, 3);
        break;
      case 'tank':
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.arc(it.x + 8, it.y + 8, 6, 0, 7); ctx.fill();
        ctx.fillStyle = '#9b6a4a';
        ctx.beginPath(); ctx.arc(it.x + 6, it.y + 6, 6, 0, 7); ctx.fill();
        ctx.fillStyle = '#b98660';
        ctx.beginPath(); ctx.arc(it.x + 5, it.y + 5, 3, 0, 7); ctx.fill();
        break;
      case 'pool':
        ctx.fillStyle = '#f8f4ea';
        ctx.fillRect(it.x - 3, it.y - 3, it.w + 6, it.h + 6);
        ctx.fillStyle = '#35cfe8';
        ctx.fillRect(it.x, it.y, it.w, it.h);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(it.x + 3, it.y + 3, it.w * 0.4, 2);
        break;
      case 'garden':
        ctx.fillStyle = '#5fb866';
        ctx.fillRect(it.x, it.y, it.w, it.h);
        ctx.fillStyle = '#3f9a4e';
        for (let x = it.x + 5; x < it.x + it.w - 3; x += 11) { ctx.beginPath(); ctx.arc(x, it.y + it.h / 2, 3.6, 0, 7); ctx.fill(); }
        break;
      case 'solar':
        ctx.fillStyle = '#27456f';
        ctx.fillRect(it.x, it.y, it.w, it.h);
        ctx.strokeStyle = 'rgba(190,220,255,0.55)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let x = it.x; x <= it.x + it.w + 0.1; x += it.w / 4) { ctx.moveTo(x, it.y); ctx.lineTo(x, it.y + it.h); }
        ctx.moveTo(it.x, it.y + it.h / 2); ctx.lineTo(it.x + it.w, it.y + it.h / 2);
        ctx.stroke();
        break;
      case 'skylight':
        ctx.fillStyle = 'rgba(190,230,245,0.75)';
        ctx.fillRect(it.x, it.y, it.w, it.h);
        ctx.strokeStyle = 'rgba(60,80,100,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(it.x, it.y, it.w, it.h);
        break;
      case 'helipad':
      case 'cross': {
        ctx.fillStyle = it.t === 'cross' ? (it.white ? '#e2374d' : '#ffffff') : '#5b616b';
        ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, 7); ctx.fill();
        ctx.strokeStyle = it.t === 'cross' ? (it.white ? '#fff' : '#e2374d') : '#f2c230';
        ctx.lineWidth = Math.max(1.5, it.r * 0.14);
        if (it.t === 'helipad') { ctx.beginPath(); ctx.arc(it.x, it.y, it.r * 0.82, 0, 7); ctx.stroke(); ctx.strokeStyle = '#fff'; }
        const k = it.r * 0.42;
        ctx.lineWidth = it.t === 'cross' ? it.r * 0.36 : Math.max(1.5, it.r * 0.16);
        ctx.beginPath();
        if (it.t === 'cross') { ctx.moveTo(it.x - k * 1.3, it.y); ctx.lineTo(it.x + k * 1.3, it.y); ctx.moveTo(it.x, it.y - k * 1.3); ctx.lineTo(it.x, it.y + k * 1.3); }
        else { ctx.moveTo(it.x - k, it.y - k); ctx.lineTo(it.x - k, it.y + k); ctx.moveTo(it.x + k, it.y - k); ctx.lineTo(it.x + k, it.y + k); ctx.moveTo(it.x - k, it.y); ctx.lineTo(it.x + k, it.y); }
        ctx.stroke();
        break;
      }
      case 'sign': {
        ctx.font = `${it.size}px ${DISPLAY_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = ctx.measureText(it.text).width + 8;
        ctx.save();
        ctx.translate(it.x, it.y);
        if (it.rot) ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = 'rgba(20,16,34,0.85)';
        ctx.fillRect(-w / 2, -it.size * 0.75, w, it.size * 1.5);
        ctx.fillStyle = it.color;
        ctx.fillText(it.text, 0, it.size * 0.06);
        ctx.restore();
        if (lightsOn()) addGlow(it.x, it.y, top.z1, w * 0.6, it.color, 0.3);
        break;
      }
      default: break;
    }
  }
}

function drawHipRoof(ctx, b, sh) {
  const o = 3;
  const x0 = b.x - o;
  const y0 = b.y - o;
  const x1 = b.x + b.w + o;
  const y1 = b.y + b.h + o;
  const se = scaleAt(b.z);
  const sr = scaleAt(b.z + b.ridgeH);
  const alongX = b.w >= b.h;
  const k = (alongX ? b.h : b.w) * 0.5;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const ra = alongX ? [x0 + k, cy] : [cx, y0 + k];
  const rb = alongX ? [x1 - k, cy] : [cx, y1 - k];
  const E = (x, y) => [screenX(x, se), screenY(y, se)];
  const R = (p) => [screenX(p[0], sr), screenY(p[1], sr)];
  const poly = (pts, face) => {
    ctx.fillStyle = shadeHex(b.roof, Math.min(1.2, L.face[face] * 1.02), L.tint, L.face[face] > 0.9 ? L.warm * 0.3 : 0);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  };
  if (alongX) {
    poly([E(x0, y0), E(x1, y0), R(rb), R(ra)], 'N');
    poly([E(x0, y1), E(x1, y1), R(rb), R(ra)], 'S');
    poly([E(x0, y0), E(x0, y1), R(ra)], 'W');
    poly([E(x1, y0), E(x1, y1), R(rb)], 'E');
  } else {
    poly([E(x0, y0), E(x0, y1), R(rb), R(ra)], 'W');
    poly([E(x1, y0), E(x1, y1), R(rb), R(ra)], 'E');
    poly([E(x0, y0), E(x1, y0), R(ra)], 'N');
    poly([E(x0, y1), E(x1, y1), R(rb)], 'S');
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const a = R(ra);
  const c = R(rb);
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.stroke();
}

function drawTank(ctx, b) {
  const steps = 6;
  for (let k = 0; k <= steps; k++) {
    const s = scaleAt((b.z * k) / steps);
    ctx.fillStyle = shadeHex(b.wall, 0.72 + 0.05 * k, L.tint, L.warm * 0.2);
    ctx.beginPath();
    ctx.arc(screenX(b.cx, s), screenY(b.cy, s), b.r * s, 0, 7);
    ctx.fill();
  }
  const s = scaleAt(b.z);
  ctx.fillStyle = shadeHex(b.roof, 1, L.tint, L.warm * 0.25);
  ctx.beginPath();
  ctx.arc(screenX(b.cx, s), screenY(b.cy, s), b.r * s * 0.93, 0, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(screenX(b.cx, s), screenY(b.cy, s), b.r * s * 0.5, 0, 7);
  ctx.moveTo(screenX(b.cx - b.r * 0.93, s), screenY(b.cy, s));
  ctx.lineTo(screenX(b.cx + b.r * 0.93, s), screenY(b.cy, s));
  ctx.stroke();
}

function drawAwnings(ctx, b) {
  setPlane(ctx, 13);
  const d = 8;
  for (const a of b.awnings) {
    const horizontal = a.side === 'N' || a.side === 'S';
    const x = a.side === 'W' ? b.x - d : a.side === 'E' ? b.x + b.w : b.x + 3;
    const y = a.side === 'N' ? b.y - d : a.side === 'S' ? b.y + b.h : b.y + 3;
    const w = horizontal ? b.w - 6 : d;
    const h = horizontal ? d : b.h - 6;
    ctx.fillStyle = a.col;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    if (horizontal) for (let k = 0; k < w - 5; k += 12) ctx.fillRect(x + k + 6, y, 6, h);
    else for (let k = 0; k < h - 5; k += 12) ctx.fillRect(x, y + k + 6, w, 6);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Draws one building. The caller sorts buildings far-from-centre first so near ones overlap them. */
export function drawBuilding(ctx, b) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (b.kind === 'tank') {
    drawTank(ctx, b);
    return;
  }
  const sh = shades(b);
  if (b.awnings && b.awnings.length) drawAwnings(ctx, b);
  for (const t of b.tiers) {
    const x0 = t.x;
    const x1 = t.x + t.w;
    const y0 = t.y;
    const y1 = t.y + t.h;
    if (x0 > cam.x) drawWall(ctx, b, t, sh, 'W', x0, y0, x0, y1);
    if (x1 < cam.x) drawWall(ctx, b, t, sh, 'E', x1, y0, x1, y1);
    if (y0 > cam.y) drawWall(ctx, b, t, sh, 'N', x0, y0, x1, y0);
    if (y1 < cam.y) drawWall(ctx, b, t, sh, 'S', x0, y1, x1, y1);
    if (b.roofStyle === 'hip') continue;
    const s1 = scaleAt(t.z1);
    ctx.fillStyle = sh.roof;
    ctx.fillRect(screenX(x0, s1), screenY(y0, s1), t.w * s1, t.h * s1);
    ctx.strokeStyle = sh.trim;
    ctx.lineWidth = Math.max(1, 2.2 * s1);
    ctx.strokeRect(screenX(x0, s1) + ctx.lineWidth / 2, screenY(y0, s1) + ctx.lineWidth / 2, t.w * s1 - ctx.lineWidth, t.h * s1 - ctx.lineWidth);
  }
  if (b.roofStyle === 'hip') {
    drawHipRoof(ctx, b, sh);
    return;
  }
  const top = b.tiers[b.tiers.length - 1];
  setPlane(ctx, top.z1);
  if (b.roofStyle === 'ribbed') {
    ctx.strokeStyle = 'rgba(0,0,0,0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (b.w >= b.h) for (let x = b.x + 4; x < b.x + b.w; x += b.container ? 4 : 8) { ctx.moveTo(x, b.y + 1); ctx.lineTo(x, b.y + b.h - 1); }
    else for (let y = b.y + 4; y < b.y + b.h; y += b.container ? 4 : 8) { ctx.moveTo(b.x + 1, y); ctx.lineTo(b.x + b.w - 1, y); }
    ctx.stroke();
    if (!b.container) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (b.w >= b.h) { ctx.moveTo(b.x, b.y + b.h / 2); ctx.lineTo(b.x + b.w, b.y + b.h / 2); }
      else { ctx.moveTo(b.x + b.w / 2, b.y); ctx.lineTo(b.x + b.w / 2, b.y + b.h); }
      ctx.stroke();
    }
  }
  if (b.roofItems.length) drawRoofItems(ctx, b, top);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const it of b.roofItems) {
    if (it.t !== 'antenna') continue;
    const s0 = scaleAt(top.z1);
    const s1 = scaleAt(top.z1 + it.z);
    ctx.strokeStyle = '#d9dde2';
    ctx.lineWidth = 1.6 * cam.scale;
    ctx.beginPath();
    ctx.moveTo(screenX(it.x, s0), screenY(it.y, s0));
    ctx.lineTo(screenX(it.x, s1), screenY(it.y, s1));
    ctx.stroke();
    ctx.fillStyle = '#ff4040';
    ctx.beginPath();
    ctx.arc(screenX(it.x, s1), screenY(it.y, s1), 2.2 * cam.scale, 0, 7);
    ctx.fill();
    addGlow(it.x, it.y, top.z1 + it.z, 12, '#ff3030', 0.7);
  }
}

/** Distance from the view centre to the nearest point of a building's footprint (the sort key). */
export function buildingDepth(b) {
  const dx = Math.max(b.x - cam.x, 0, cam.x - (b.x + b.w));
  const dy = Math.max(b.y - cam.y, 0, cam.y - (b.y + b.h));
  return dx * dx + dy * dy;
}
