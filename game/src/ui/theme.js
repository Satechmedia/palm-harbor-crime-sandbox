// The look of the interface: its colours and the small drawing helpers every screen shares
// (rounded panels, outlined text, text with ~highlighted~ words, stars, key caps, bars).
import { UI_FONT, DISPLAY_FONT } from '../core/config.js';

export const C = { pink: '#ff4f8b', teal: '#36e0d0', gold: '#ffd23f', ink: 'rgba(14,10,30,0.78)', ink2: 'rgba(14,10,30,0.55)', white: '#ffffff', dim: '#b9b4cf', green: '#8dff9c', red: '#ff5d6c', blue: '#6fa8ff' };

export const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
export const ui = (px, u, weight = 'bold') => `${weight} ${Math.round(px * u)}px ${UI_FONT}`;
export const display = (px, u) => `${Math.round(px * u)}px ${DISPLAY_FONT}`;

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function panel(ctx, x, y, w, h, r, fill = C.ink, stroke = null, lineWidth = 2) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/** Text with a dark outline so it reads over any street. */
export function outlined(ctx, text, x, y, fill = '#fff', width = 4) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(8,6,20,0.85)';
  ctx.lineWidth = width;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/**
 * Draws text in which ~words between tildes~ take the highlight colour, wrapped to maxWidth.
 * Returns the y of the line after the last one.
 */
export function richText(ctx, text, x, y, maxWidth, lineHeight, base, highlight, outline = 0) {
  let hot = false;
  const words = [];
  for (const part of text.split('~')) {
    for (const w of part.split(' ')) if (w) words.push([w, hot]);
    hot = !hot;
  }
  let cx = x;
  const space = ctx.measureText(' ').width;
  for (const [w, isHot] of words) {
    const width = ctx.measureText(w).width;
    if (cx + width > x + maxWidth && cx > x) {
      cx = x;
      y += lineHeight;
    }
    if (outline) outlined(ctx, w, cx, y, isHot ? highlight : base, outline);
    else {
      ctx.fillStyle = isHot ? highlight : base;
      ctx.fillText(w, cx, y);
    }
    cx += width + space;
  }
  return y + lineHeight;
}

export function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.44 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** A keyboard key cap with a label after it. Returns the width used. */
export function keyHint(ctx, key, label, x, y, u) {
  ctx.font = ui(13, u);
  const kw = Math.max(22 * u, ctx.measureText(key).width + 12 * u);
  panel(ctx, x, y - 16 * u, kw, 22 * u, 5 * u, '#f4f1e8');
  ctx.fillStyle = '#1b1530';
  ctx.textAlign = 'center';
  ctx.fillText(key, x + kw / 2, y);
  ctx.textAlign = 'left';
  ctx.font = ui(14, u);
  outlined(ctx, label, x + kw + 8 * u, y, '#fff', 3.5 * u);
  return kw + 8 * u + ctx.measureText(label).width + 18 * u;
}

export function bar(ctx, x, y, w, h, value, color, back = 'rgba(0,0,0,0.55)') {
  panel(ctx, x, y, w, h, h / 2, back);
  if (value > 0.01) panel(ctx, x + 1.5, y + 1.5, Math.max(h - 3, (w - 3) * Math.min(1, value)), h - 3, (h - 3) / 2, color);
}

/** A top-down silhouette of each weapon for the HUD and the shop. */
export function weaponIcon(ctx, id, x, y, s, color = '#fff') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  if (id === 'fists') {
    roundRect(ctx, -9, -8, 18, 14, 5);
    ctx.fill();
    ctx.fillRect(-12, -2, 5, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let k = 0; k < 3; k++) ctx.fillRect(-4.5 + k * 4.5, -8, 1.2, 8);
  } else if (id === 'pistol') {
    ctx.fillRect(-12, -6, 24, 6);
    ctx.fillRect(-12, -1, 7, 11);
    ctx.fillRect(-4, 0, 5, 3);
  } else if (id === 'smg') {
    ctx.fillRect(-15, -6, 26, 6);
    ctx.fillRect(-9, -1, 6, 10);
    ctx.fillRect(2, 0, 4, 12);
    ctx.fillRect(11, -5, 6, 3);
  } else if (id === 'shotgun') {
    ctx.fillRect(-18, -5, 36, 4);
    ctx.fillRect(-2, 0, 14, 3);
    ctx.fillRect(-18, -2, 9, 8);
  } else if (id === 'rifle') {
    ctx.fillRect(-18, -5, 30, 5);
    ctx.fillRect(12, -4, 8, 2.4);
    ctx.fillRect(-18, -1, 8, 7);
    ctx.fillRect(-5, 0, 5, 8);
    ctx.fillRect(3, 0, 4, 11);
  } else {
    ctx.fillRect(-18, -6, 34, 8);
    ctx.fillRect(16, -8, 4, 12);
    ctx.fillRect(-6, 2, 5, 8);
    ctx.fillRect(-20, -7, 4, 10);
  }
  ctx.restore();
}
