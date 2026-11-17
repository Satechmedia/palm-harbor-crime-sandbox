// Conversations: letterbox bars, a drawn portrait of whoever speaks, their name and a line
// that types itself out. Space, Enter or a click moves on.
import { tapped, mouse } from '../core/input.js';
import { cam } from '../render/camera.js';
import { CAST } from '../missions/story.js';
import { C, ui, display, panel, roundRect, richText, keyHint } from './theme.js';
import { sfx } from '../audio/sound.js';

/** A bust of a cast member, drawn from their colours and hairstyle. */
export function drawPortrait(ctx, id, x, y, size) {
  const who = CAST[id] ?? CAST.phpd;
  const s = size / 100;
  ctx.save();
  roundRect(ctx, x, y, size, size, 14 * s);
  ctx.clip();
  const bg = ctx.createLinearGradient(x, y, x, y + size);
  bg.addColorStop(0, who.color);
  bg.addColorStop(1, '#2a1b4a');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, size, size);
  // A low sun behind the shoulder.
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.arc(x + 76 * s, y + 30 * s, 22 * s, 0, 7);
  ctx.fill();
  ctx.translate(x + 50 * s, y);
  ctx.scale(s, s);
  const hairBack = who.style === 'long' || who.style === 'bob' || who.style === 'puffs';
  if (hairBack) {
    ctx.fillStyle = who.hair;
    if (who.style === 'puffs') {
      ctx.beginPath(); ctx.arc(-24, 30, 15, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(24, 30, 15, 0, 7); ctx.fill();
    } else {
      roundRect(ctx, -25, 22, 50, who.style === 'long' ? 62 : 40, 16);
      ctx.fill();
    }
  }
  ctx.fillStyle = who.shirt;
  ctx.beginPath();
  ctx.ellipse(0, 108, 42, 30, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = who.skin;
  ctx.fillRect(-8, 64, 16, 20);
  ctx.beginPath();
  ctx.ellipse(0, 48, 19, 24, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(6, 50, 13, 22, 0, -1.2, 1.4);
  ctx.fill();
  ctx.fillStyle = who.hair;
  if (who.style === 'cap') {
    roundRect(ctx, -21, 20, 42, 16, 8);
    ctx.fill();
    ctx.fillRect(-24, 32, 48, 5);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-4, 23, 8, 7);
  } else if (who.style === 'bun') {
    ctx.beginPath(); ctx.arc(0, 18, 9, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 33, 20, 11, 0, Math.PI, 0); ctx.fill();
  } else if (who.style === 'slick') {
    ctx.beginPath(); ctx.ellipse(0, 34, 20, 13, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(-20, 32, 6, 14);
  } else {
    ctx.beginPath(); ctx.ellipse(0, 36, 20, 15, 0, Math.PI, 0); ctx.fill();
    if (who.style === 'fade') ctx.fillRect(-19, 34, 38, 4);
  }
  if (who.beard) {
    ctx.beginPath();
    ctx.ellipse(0, 62, 14, 11, 0, 0, Math.PI);
    ctx.fill();
  }
  if (who.shades) {
    ctx.fillStyle = '#14102a';
    roundRect(ctx, -17, 42, 15, 9, 3); ctx.fill();
    roundRect(ctx, 2, 42, 15, 9, 3); ctx.fill();
    ctx.fillRect(-3, 44, 6, 2);
  } else {
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(-11, 45, 5, 3);
    ctx.fillRect(6, 45, 5, 3);
    if (who.glasses) {
      ctx.strokeStyle = '#f4f1e8';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-15, 41, 12, 10);
      ctx.strokeRect(3, 41, 12, 10);
    }
  }
  ctx.fillStyle = 'rgba(90,20,30,0.7)';
  ctx.fillRect(-5, 61, 10, 2);
  ctx.restore();
  roundRect(ctx, x, y, size, size, 14 * s);
  ctx.strokeStyle = who.color;
  ctx.lineWidth = 3 * s;
  ctx.stroke();
}

export function updateDialogue(G, dt) {
  const D = G.dialogue;
  if (!D) return;
  D.t += dt;
  const line = D.lines[D.i];
  const typed = D.t * 48 >= line[1].length;
  if (D.t > 0.2 && (tapped('Space', 'Enter', 'KeyE', 'KeyF') || mouse.clicked)) {
    if (!typed) D.t = 99;
    else {
      D.i++;
      D.t = 0;
      sfx('click');
      if (D.i >= D.lines.length) G.dialogue = null;
    }
  }
}

export function drawDialogue(ctx, G) {
  const D = G.dialogue;
  if (!D) return;
  const u = cam.scale;
  const [id, text] = D.lines[D.i];
  const who = CAST[id];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0a0716';
  ctx.fillRect(0, 0, cam.w, 44 * u);
  ctx.fillRect(0, cam.h - 44 * u, cam.w, 44 * u);
  const w = Math.min(860 * u, cam.w - 60 * u);
  const h = 138 * u;
  const x = cam.w / 2 - w / 2;
  const y = cam.h - h - 62 * u;
  panel(ctx, x, y, w, h, 16 * u, 'rgba(14,10,30,0.9)', who.color, 2.5 * u);
  drawPortrait(ctx, id, x + 14 * u, y + 14 * u, 110 * u);
  ctx.font = display(24, u);
  ctx.fillStyle = who.color;
  ctx.fillText(who.name.toUpperCase(), x + 142 * u, y + 38 * u);
  ctx.font = ui(18, u, 'normal');
  const shown = text.slice(0, Math.floor(D.t * 48));
  richText(ctx, shown, x + 142 * u, y + 66 * u, w - 164 * u, 25 * u, '#fff', C.gold);
  ctx.font = ui(11, u);
  ctx.fillStyle = C.dim;
  ctx.textAlign = 'right';
  ctx.fillText(`${D.i + 1} / ${D.lines.length}`, x + w - 16 * u, y + 24 * u);
  ctx.textAlign = 'left';
  keyHint(ctx, 'SPACE', 'Continue', x + w - 150 * u, y + h - 14 * u, u * 0.85);
}
