// Paints the ground of the city into cached square tiles: ocean and sand, the river and the
// harbour, sidewalks, asphalt with lane markings and crosswalks, and every block's lawns, car
// parks, pools and courts. Skid marks and scorch marks are stamped into the same tiles.
import { CHUNK, LANE_W, SIDEWALK_W, WORLD_W, WORLD_H } from '../core/config.js';
import { createRandom, hash2 } from '../core/random.js';
import { coastX, RIVER_Y0, RIVER_Y1, QUAY_Y, SAND_X1 } from '../city/layout.js';

const GROUND = { beach: '#ead9b8', downtown: '#c4c4c8', oldtown: '#e0c8a2', docks: '#b6b1a8', suburbs: '#80c96d' };
const GRASS = '#80c96d';
const WALK = '#d9d2c5';
const ASPHALT = '#4c4f5c';
const TOWELS = ['#ff4f8b', '#36c9e0', '#ffd23f', '#ff8a3d', '#7d6bff', '#f4f4f4'];

const chunks = new Map();
let cityRef = null;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function paintTerrain(g, B) {
  g.fillStyle = GRASS;
  g.fillRect(B.x0, B.y0, CHUNK, CHUNK);
  // Darker tufts so the open grass is not one flat colour.
  for (let gy = Math.floor(B.y0 / 64); gy * 64 < B.y1; gy++) {
    for (let gx = Math.floor(B.x0 / 64); gx * 64 < B.x1; gx++) {
      const h = hash2(gx, gy, 5);
      g.fillStyle = h < 0.5 ? 'rgba(60,140,70,0.16)' : 'rgba(170,220,120,0.14)';
      g.beginPath();
      g.ellipse(gx * 64 + h * 64, gy * 64 + hash2(gx, gy, 9) * 64, 20 + h * 26, 12 + h * 14, h * 3, 0, 7);
      g.fill();
    }
  }
  if (B.y1 > QUAY_Y) {
    g.fillStyle = '#12789f';
    g.fillRect(B.x0, QUAY_Y, CHUNK, B.y1 - QUAY_Y);
  }
  if (B.y1 > RIVER_Y0 && B.y0 < RIVER_Y1) {
    g.fillStyle = '#1b9cc4';
    g.fillRect(B.x0, RIVER_Y0, CHUNK, RIVER_Y1 - RIVER_Y0);
    g.fillStyle = 'rgba(70,200,225,0.35)';
    g.fillRect(B.x0, RIVER_Y0 + 60, CHUNK, RIVER_Y1 - RIVER_Y0 - 120);
    if (B.x1 > SAND_X1) {
      g.fillStyle = '#8d877c';
      g.fillRect(Math.max(B.x0, SAND_X1), RIVER_Y0, CHUNK, 6);
      g.fillRect(Math.max(B.x0, SAND_X1), RIVER_Y1 - 6, CHUNK, 6);
      g.fillStyle = 'rgba(8,50,80,0.3)';
      g.fillRect(Math.max(B.x0, SAND_X1), RIVER_Y0 + 6, CHUNK, 7);
    }
  }
  if (B.x0 > SAND_X1 + 20) return;
  // Sand, the boardwalk, then the ocean in bands from the surf out to deep water.
  const inRiver = (y) => y > RIVER_Y0 && y < RIVER_Y1;
  g.fillStyle = '#f3e0a8';
  if (B.y0 < RIVER_Y0) g.fillRect(B.x0, B.y0, SAND_X1 - B.x0, Math.min(B.y1, RIVER_Y0) - B.y0);
  if (B.y1 > RIVER_Y1) g.fillRect(B.x0, Math.max(B.y0, RIVER_Y1), SAND_X1 - B.x0, Math.min(B.y1, QUAY_Y) - Math.max(B.y0, RIVER_Y1));
  const sandRng = createRandom(B.x0 * 31 + B.y0 * 17 + 3);
  for (let k = 0; k < 260; k++) {
    const x = B.x0 + sandRng() * CHUNK;
    const y = B.y0 + sandRng() * CHUNK;
    if (x > SAND_X1 || inRiver(y) || y > QUAY_Y) continue;
    g.fillStyle = sandRng.chance(0.5) ? 'rgba(255,250,220,0.5)' : 'rgba(200,170,110,0.35)';
    g.fillRect(x, y, 2, 1.5);
  }
  g.fillStyle = '#d2b07c';
  if (B.y0 < RIVER_Y0) g.fillRect(SAND_X1, B.y0, 12, Math.min(B.y1, RIVER_Y0) - B.y0);
  if (B.y1 > RIVER_Y1) g.fillRect(SAND_X1, Math.max(B.y0, RIVER_Y1), 12, Math.min(B.y1, QUAY_Y) - Math.max(B.y0, RIVER_Y1));
  g.strokeStyle = 'rgba(120,84,48,0.35)';
  g.lineWidth = 1;
  g.beginPath();
  for (let y = Math.ceil(B.y0 / 7) * 7; y < B.y1; y += 7) {
    if (inRiver(y) || y > QUAY_Y) continue;
    g.moveTo(SAND_X1, y);
    g.lineTo(SAND_X1 + 12, y);
  }
  g.stroke();
  const coastPath = (off, close) => {
    g.beginPath();
    if (close) g.moveTo(B.x0 - 4, B.y0 - 4);
    for (let y = B.y0 - 4; y <= B.y1 + 4; y += 8) {
      const x = coastX(y) + off;
      if (!close && y === B.y0 - 4) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    if (close) {
      g.lineTo(B.x0 - 4, B.y1 + 4);
      g.closePath();
    }
  };
  g.strokeStyle = 'rgba(190,156,104,0.5)';
  g.lineWidth = 30;
  coastPath(8, false);
  g.stroke();
  for (const [off, color] of [[2, '#8be9dd'], [-9, '#4fd0d6'], [-44, '#28b3cd'], [-110, '#1898c2'], [-205, '#107fad'], [-330, '#0c6c9b']]) {
    g.fillStyle = color;
    coastPath(off, true);
    g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 2.5;
  coastPath(2, false);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.4)';
  g.lineWidth = 2;
  g.setLineDash([26, 18]);
  coastPath(-20, false);
  g.stroke();
  g.setLineDash([]);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function paintDecor(g, d) {
  switch (d.t) {
    case 'lot': {
      g.fillStyle = '#5b5e6a';
      g.fillRect(d.x, d.y, d.w, d.h);
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = 1.5;
      g.beginPath();
      if (d.plain) {
        const horizontal = d.w >= d.h;
        const n = Math.floor((horizontal ? d.w : d.h) * 0.5 / 26);
        for (let k = 0; k <= n; k++) {
          if (horizontal) { g.moveTo(d.x + 10 + k * 26, d.y + 6); g.lineTo(d.x + 10 + k * 26, d.y + d.h - 6); }
          else { g.moveTo(d.x + 6, d.y + 10 + k * 26); g.lineTo(d.x + d.w - 6, d.y + 10 + k * 26); }
        }
      } else {
        const n = Math.floor((d.w - 12) / 26);
        const x0 = d.x + 6 + (d.w - 12 - n * 26) / 2;
        const rows = d.h > 112 ? [d.y + 6, d.y + d.h - 52] : [d.y + d.h / 2 - 23];
        for (const ry of rows) for (let k = 0; k <= n; k++) { g.moveTo(x0 + k * 26, ry); g.lineTo(x0 + k * 26, ry + 46); }
      }
      g.stroke();
      break;
    }
    case 'tiles': {
      g.fillStyle = '#e6dac4';
      if (d.round) { g.beginPath(); g.arc(d.x + d.w / 2, d.y + d.h / 2, d.w / 2, 0, 7); g.fill(); break; }
      g.fillRect(d.x, d.y, d.w, d.h);
      g.strokeStyle = 'rgba(150,120,90,0.25)';
      g.lineWidth = 1;
      g.beginPath();
      for (let x = d.x; x <= d.x + d.w; x += 12) { g.moveTo(x, d.y); g.lineTo(x, d.y + d.h); }
      for (let y = d.y; y <= d.y + d.h; y += 12) { g.moveTo(d.x, y); g.lineTo(d.x + d.w, y); }
      g.stroke();
      break;
    }
    case 'fountain': {
      g.fillStyle = '#cbc3b4';
      g.beginPath(); g.arc(d.x, d.y, d.r, 0, 7); g.fill();
      g.fillStyle = '#58cfe4';
      g.beginPath(); g.arc(d.x, d.y, d.r - 4, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(d.x, d.y, d.r * 0.3, 0, 7); g.fill();
      break;
    }
    case 'lawn': {
      g.fillStyle = '#86d073';
      g.fillRect(d.x, d.y, d.w, d.h);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      for (let x = d.x; x < d.x + d.w; x += 16) g.fillRect(x, d.y, 8, d.h);
      break;
    }
    case 'pool': {
      g.fillStyle = '#f6f2e8';
      roundRect(g, d.x - 3, d.y - 3, d.w + 6, d.h + 6, 6);
      g.fill();
      g.fillStyle = '#35cfe8';
      roundRect(g, d.x, d.y, d.w, d.h, 4);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.45)';
      g.lineWidth = 1;
      g.beginPath();
      for (let y = d.y + 4; y < d.y + d.h - 2; y += 5) { g.moveTo(d.x + 4, y); g.quadraticCurveTo(d.x + d.w / 2, y + 2.5, d.x + d.w - 4, y); }
      g.stroke();
      break;
    }
    case 'pond': {
      g.fillStyle = '#3faec9';
      g.beginPath(); g.ellipse(d.x + d.w / 2, d.y + d.h / 2, d.w / 2, d.h / 2, 0.3, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = 2;
      g.stroke();
      break;
    }
    case 'path': g.fillStyle = '#e4d6b4'; g.fillRect(d.x, d.y, d.w, d.h); break;
    case 'drive': {
      g.fillStyle = '#bdb6aa';
      g.fillRect(d.x, d.y, d.w, d.h);
      g.strokeStyle = 'rgba(0,0,0,0.12)';
      g.lineWidth = 1;
      g.strokeRect(d.x + 0.5, d.y + 0.5, d.w - 1, d.h - 1);
      break;
    }
    case 'yard': {
      g.fillStyle = '#a8a49b';
      g.fillRect(d.x, d.y, d.w, d.h);
      g.strokeStyle = '#e2b92e';
      g.lineWidth = 2;
      g.setLineDash([10, 8]);
      g.strokeRect(d.x + 3, d.y + 3, d.w - 6, d.h - 6);
      g.setLineDash([]);
      break;
    }
    case 'court': {
      const tennis = d.sport === 'tennis';
      g.fillStyle = tennis ? '#3d9f6c' : '#c96c4c';
      g.fillRect(d.x, d.y, d.w, d.h);
      if (tennis) { g.fillStyle = '#2f8fb7'; g.fillRect(d.x + 12, d.y + 8, d.w - 24, d.h - 16); }
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 1.5;
      g.strokeRect(d.x + (tennis ? 12 : 4), d.y + (tennis ? 8 : 4), d.w - (tennis ? 24 : 8), d.h - (tennis ? 16 : 8));
      g.beginPath();
      g.moveTo(d.x + d.w / 2, d.y + 4); g.lineTo(d.x + d.w / 2, d.y + d.h - 4);
      if (!tennis) { g.moveTo(d.x + d.w / 2 + 9, d.y + d.h / 2); g.arc(d.x + d.w / 2, d.y + d.h / 2, 9, 0, 7); }
      g.stroke();
      break;
    }
    case 'stall': g.fillStyle = ['#8a5a3a', '#a06a44', '#6f4a34', '#946242', '#7d5238'][d.v]; g.fillRect(d.x, d.y, d.w, d.h); break;
    case 'towel': {
      g.save();
      g.translate(d.x, d.y);
      g.rotate(d.a);
      g.fillStyle = TOWELS[d.v];
      g.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(-d.w / 2, -2, d.w, 4);
      g.restore();
      break;
    }
    case 'volley': {
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 1.5;
      g.strokeRect(d.x, d.y, d.w, d.h);
      g.strokeStyle = '#3a3a44';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(d.x + d.w / 2, d.y - 4); g.lineTo(d.x + d.w / 2, d.y + d.h + 4); g.stroke();
      break;
    }
    case 'pier': {
      g.fillStyle = 'rgba(8,40,70,0.25)';
      g.fillRect(d.x + 5, d.y + 6, d.w, d.h);
      g.fillStyle = '#c3955f';
      g.fillRect(d.x, d.y, d.w + 12, d.h);
      g.strokeStyle = 'rgba(96,62,32,0.45)';
      g.lineWidth = 1;
      g.beginPath();
      for (let x = d.x + 6; x < d.x + d.w + 12; x += 7) { g.moveTo(x, d.y); g.lineTo(x, d.y + d.h); }
      g.stroke();
      g.fillStyle = '#8c6238';
      g.fillRect(d.x, d.y, d.w + 12, 3);
      g.fillRect(d.x, d.y + d.h - 3, d.w + 12, 3);
      g.fillRect(d.x, d.y, 3, d.h);
      break;
    }
    case 'quay': {
      g.fillStyle = '#bcb6aa';
      g.fillRect(d.x, d.y, d.w, d.h);
      g.fillStyle = '#6a6c74';
      g.fillRect(d.x, d.y + d.h * 0.52, d.w, 2);
      g.fillRect(d.x, d.y + d.h * 0.52 + 12, d.w, 2);
      for (let x = Math.floor(d.x / 16) * 16; x < d.x + d.w; x += 16) {
        g.fillStyle = (x / 16) % 2 ? '#e8c02c' : '#2c2c34';
        g.fillRect(x, d.y + d.h - 7, 16, 7);
      }
      g.fillStyle = '#3a3c46';
      for (let x = Math.floor(d.x / 90) * 90 + 40; x < d.x + d.w; x += 90) { g.beginPath(); g.arc(x, d.y + d.h - 14, 3.5, 0, 7); g.fill(); }
      break;
    }
    case 'ship': {
      g.fillStyle = 'rgba(6,36,60,0.35)';
      g.fillRect(d.x + 8, d.y + 10, d.w, d.h);
      g.fillStyle = '#2f3644';
      g.beginPath();
      g.moveTo(d.x + 40, d.y); g.lineTo(d.x + d.w - 16, d.y); g.lineTo(d.x + d.w, d.y + 14); g.lineTo(d.x + d.w, d.y + d.h - 14);
      g.lineTo(d.x + d.w - 16, d.y + d.h); g.lineTo(d.x + 40, d.y + d.h); g.lineTo(d.x, d.y + d.h / 2);
      g.closePath();
      g.fill();
      g.fillStyle = '#a2463a';
      g.beginPath();
      g.moveTo(d.x + 46, d.y + 7); g.lineTo(d.x + d.w - 18, d.y + 7); g.lineTo(d.x + d.w - 7, d.y + 18); g.lineTo(d.x + d.w - 7, d.y + d.h - 18);
      g.lineTo(d.x + d.w - 18, d.y + d.h - 7); g.lineTo(d.x + 46, d.y + d.h - 7); g.lineTo(d.x + 14, d.y + d.h / 2);
      g.closePath();
      g.fill();
      break;
    }
    case 'ring': {
      g.strokeStyle = d.color;
      g.globalAlpha = 0.35;
      g.lineWidth = 3;
      g.beginPath(); g.arc(d.x, d.y, d.r, 0, 7); g.stroke();
      g.globalAlpha = 1;
      break;
    }
    default: break;
  }
}

function paintRoads(g, city, B) {
  const S = SIDEWALK_W;
  const { nodes, segs } = city.roads;
  const hitSeg = (s, pad) => (s.horiz
    ? s.x2 > B.x0 - pad && s.x1 < B.x1 + pad && s.y1 + s.hw + pad > B.y0 && s.y1 - s.hw - pad < B.y1
    : s.y2 > B.y0 - pad && s.y1 < B.y1 + pad && s.x1 + s.hw + pad > B.x0 && s.x1 - s.hw - pad < B.x1);
  const hitNode = (n, pad) => n.x + n.hx + pad > B.x0 && n.x - n.hx - pad < B.x1 && n.y + n.hy + pad > B.y0 && n.y - n.hy - pad < B.y1;
  const vs = segs.filter((s) => hitSeg(s, S + 4));
  const vn = nodes.filter((n) => hitNode(n, S + 4));
  // Sidewalks under everything.
  g.fillStyle = WALK;
  for (const s of vs) {
    if (s.horiz) g.fillRect(s.x1, s.y1 - s.hw - S, s.x2 - s.x1, (s.hw + S) * 2);
    else g.fillRect(s.x1 - s.hw - S, s.y1, (s.hw + S) * 2, s.y2 - s.y1);
  }
  for (const n of vn) g.fillRect(n.x - n.hx - S, n.y - n.hy - S, (n.hx + S) * 2, (n.hy + S) * 2);
  g.strokeStyle = 'rgba(120,110,96,0.3)';
  g.lineWidth = 1;
  g.beginPath();
  for (const s of vs) {
    if (s.horiz) {
      for (let x = Math.ceil(Math.max(s.x1, B.x0) / 16) * 16; x < Math.min(s.x2, B.x1); x += 16) {
        g.moveTo(x, s.y1 - s.hw - S); g.lineTo(x, s.y1 - s.hw);
        g.moveTo(x, s.y1 + s.hw); g.lineTo(x, s.y1 + s.hw + S);
      }
    } else {
      for (let y = Math.ceil(Math.max(s.y1, B.y0) / 16) * 16; y < Math.min(s.y2, B.y1); y += 16) {
        g.moveTo(s.x1 - s.hw - S, y); g.lineTo(s.x1 - s.hw, y);
        g.moveTo(s.x1 + s.hw, y); g.lineTo(s.x1 + s.hw + S, y);
      }
    }
  }
  g.stroke();
  // Bridge railings.
  g.fillStyle = '#7d776c';
  for (const s of vs) {
    if (!s.bridge) continue;
    g.fillRect(s.x1 - s.hw - S, s.y1, 3, s.y2 - s.y1);
    g.fillRect(s.x1 + s.hw + S - 3, s.y1, 3, s.y2 - s.y1);
  }
  // Asphalt.
  g.fillStyle = ASPHALT;
  for (const s of vs) {
    if (s.horiz) g.fillRect(s.x1 - 1, s.y1 - s.hw, s.x2 - s.x1 + 2, s.hw * 2);
    else g.fillRect(s.x1 - s.hw, s.y1 - 1, s.hw * 2, s.y2 - s.y1 + 2);
  }
  for (const n of vn) g.fillRect(n.x - n.hx, n.y - n.hy, n.hx * 2, n.hy * 2);
  // Worn patches and manholes.
  for (const s of vs) {
    const len = s.horiz ? s.x2 - s.x1 : s.y2 - s.y1;
    for (let k = 0; k < 5; k++) {
      const t = hash2(s.id, k, 2) * len;
      const o = (hash2(s.id, k, 3) - 0.5) * s.hw * 1.6;
      const x = s.horiz ? s.x1 + t : s.x1 + o;
      const y = s.horiz ? s.y1 + o : s.y1 + t;
      g.fillStyle = k % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.09)';
      g.beginPath();
      g.ellipse(x, y, s.horiz ? 26 : 9, s.horiz ? 9 : 26, 0, 0, 7);
      g.fill();
      if (k === 0) { g.fillStyle = '#3c3e48'; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); }
    }
  }
  // Kerb lines.
  g.strokeStyle = 'rgba(245,240,228,0.5)';
  g.lineWidth = 1.5;
  g.beginPath();
  for (const s of vs) {
    if (s.horiz) {
      g.moveTo(s.x1, s.y1 - s.hw + 2.5); g.lineTo(s.x2, s.y1 - s.hw + 2.5);
      g.moveTo(s.x1, s.y1 + s.hw - 2.5); g.lineTo(s.x2, s.y1 + s.hw - 2.5);
    } else {
      g.moveTo(s.x1 - s.hw + 2.5, s.y1); g.lineTo(s.x1 - s.hw + 2.5, s.y2);
      g.moveTo(s.x1 + s.hw - 2.5, s.y1); g.lineTo(s.x1 + s.hw - 2.5, s.y2);
    }
  }
  g.stroke();
  // Centre lines: a dashed yellow on streets, a double yellow with white lane dashes on avenues.
  const line = (s, off, a, b) => {
    if (s.horiz) { g.moveTo(s.x1 + a, s.y1 + off); g.lineTo(s.x2 - b, s.y1 + off); }
    else { g.moveTo(s.x1 + off, s.y1 + a); g.lineTo(s.x1 + off, s.y2 - b); }
  };
  g.strokeStyle = '#f0c232';
  g.lineWidth = 2;
  g.setLineDash([14, 12]);
  g.beginPath();
  for (const s of vs) if (s.lanes === 1) line(s, 0, 24, 24);
  g.stroke();
  g.setLineDash([]);
  g.beginPath();
  for (const s of vs) if (s.lanes === 2) { line(s, -2.2, 24, 24); line(s, 2.2, 24, 24); }
  g.stroke();
  g.strokeStyle = 'rgba(245,240,228,0.8)';
  g.setLineDash([12, 14]);
  g.beginPath();
  for (const s of vs) if (s.lanes === 2) { line(s, -LANE_W, 24, 24); line(s, LANE_W, 24, 24); }
  g.stroke();
  g.setLineDash([]);
  // Crosswalks and stop lines at both ends of every segment.
  g.fillStyle = 'rgba(245,240,228,0.88)';
  for (const s of vs) {
    for (let o = -s.hw + 4; o < s.hw - 4; o += 8) {
      if (s.horiz) { g.fillRect(s.x1 + 2, s.y1 + o, 12, 4); g.fillRect(s.x2 - 14, s.y1 + o, 12, 4); }
      else { g.fillRect(s.x1 + o, s.y1 + 2, 4, 12); g.fillRect(s.x1 + o, s.y2 - 14, 4, 12); }
    }
    if (s.horiz) { g.fillRect(s.x2 - 20, s.y1 + 2, 3, s.hw - 4); g.fillRect(s.x1 + 17, s.y1 - s.hw + 2, 3, s.hw - 4); }
    else { g.fillRect(s.x1 - s.hw + 2, s.y2 - 20, s.hw - 4, 3); g.fillRect(s.x1 + 2, s.y1 + 17, s.hw - 4, 3); }
  }
}

function paintChunk(g, city, cx, cy) {
  const B = { x0: cx * CHUNK, y0: cy * CHUNK, x1: (cx + 1) * CHUNK, y1: (cy + 1) * CHUNK };
  g.setTransform(1, 0, 0, 1, -B.x0, -B.y0);
  paintTerrain(g, B);
  const hit = (r) => r.x < B.x1 && r.x + r.w > B.x0 && r.y < B.y1 && r.y + r.h > B.y0;
  for (const d of city.decor) if (d.t === 'quay' && hit(d)) paintDecor(g, d);
  for (const block of city.blocks) {
    if (block.water || !hit(block)) continue;
    const r = block.inner;
    g.fillStyle = block.ground === 'grass' ? GRASS : GROUND[block.district];
    g.fillRect(r.x, r.y, r.w, r.h);
    if (block.ground !== 'grass') {
      g.strokeStyle = 'rgba(0,0,0,0.05)';
      g.lineWidth = 1;
      g.beginPath();
      for (let x = r.x + 20; x < r.x + r.w; x += 20) { g.moveTo(x, r.y); g.lineTo(x, r.y + r.h); }
      for (let y = r.y + 20; y < r.y + r.h; y += 20) { g.moveTo(r.x, y); g.lineTo(r.x + r.w, y); }
      g.stroke();
    }
    for (const d of block.decor) paintDecor(g, d);
  }
  paintRoads(g, city, B);
  for (const d of city.decor) {
    if (d.t === 'quay') continue;
    const r = d.w ? d : { x: d.x - 20, y: d.y - 20, w: 40, h: 40 };
    if (hit({ x: r.x - 14, y: r.y - 14, w: r.w + 28, h: r.h + 28 })) paintDecor(g, d);
  }
  // Fine grain over everything.
  const rng = createRandom(cx * 7349 + cy * 911 + 7);
  for (let k = 0; k < 700; k++) {
    g.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    g.fillRect(B.x0 + rng() * CHUNK, B.y0 + rng() * CHUNK, 1 + rng() * 2, 1 + rng() * 2);
  }
}

export function resetGround(city) {
  cityRef = city;
  chunks.clear();
}

function getChunk(cx, cy, build) {
  const key = cx * 1000 + cy;
  let c = chunks.get(key);
  if (!c && build) {
    const canvas = makeCanvas(CHUNK, CHUNK);
    c = { canvas, g: canvas.getContext('2d'), cx, cy, used: 0 };
    paintChunk(c.g, cityRef, cx, cy);
    chunks.set(key, c);
    if (chunks.size > 70) {
      let oldest = null;
      for (const [k, v] of chunks) if (!oldest || v.used < oldest[1].used) oldest = [k, v];
      chunks.delete(oldest[0]);
    }
  }
  return c;
}

/** Draws the ground tiles covering `view` (ctx already on plane 0). Builds at most `budget` new tiles a frame. */
export function drawGround(ctx, view, frame, budget = 3) {
  const c0 = Math.max(0, Math.floor(view.x0 / CHUNK));
  const c1 = Math.min(Math.ceil(WORLD_W / CHUNK) - 1, Math.floor(view.x1 / CHUNK));
  const r0 = Math.max(0, Math.floor(view.y0 / CHUNK));
  const r1 = Math.min(Math.ceil(WORLD_H / CHUNK) - 1, Math.floor(view.y1 / CHUNK));
  ctx.fillStyle = '#0c6c9b';
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const chunk = getChunk(c, r, budget > 0);
      if (!chunk) {
        ctx.fillStyle = c * CHUNK < coastX(r * CHUNK) - 300 ? '#0c6c9b' : '#8f9a8c';
        ctx.fillRect(c * CHUNK, r * CHUNK, CHUNK, CHUNK);
        continue;
      }
      if (chunk.used === 0) budget--;
      chunk.used = frame + 1;
      ctx.drawImage(chunk.canvas, c * CHUNK, r * CHUNK, CHUNK + 0.5, CHUNK + 0.5);
    }
  }
}

/** Runs `paint(g)` in world coordinates on every built tile within `radius` of a point. */
export function stampGround(x, y, radius, paint) {
  if (!cityRef) return;
  for (let r = Math.floor((y - radius) / CHUNK); r <= Math.floor((y + radius) / CHUNK); r++) {
    for (let c = Math.floor((x - radius) / CHUNK); c <= Math.floor((x + radius) / CHUNK); c++) {
      const chunk = chunks.get(c * 1000 + r);
      if (!chunk) continue;
      chunk.g.setTransform(1, 0, 0, 1, -c * CHUNK, -r * CHUNK);
      paint(chunk.g);
    }
  }
}

/** A tyre mark between two points. */
export function stampSkid(x0, y0, x1, y1, width, alpha) {
  stampGround((x0 + x1) / 2, (y0 + y1) / 2, 30, (g) => {
    g.strokeStyle = `rgba(18,18,22,${alpha})`;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  });
}

/** A soot mark left by an explosion or a burning wreck. */
export function stampScorch(x, y, radius) {
  stampGround(x, y, radius, (g) => {
    const grad = g.createRadialGradient(x, y, radius * 0.15, x, y, radius);
    grad.addColorStop(0, 'rgba(12,10,10,0.7)');
    grad.addColorStop(1, 'rgba(12,10,10,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, radius, 0, 7);
    g.fill();
  });
}
