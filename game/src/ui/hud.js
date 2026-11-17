// The heads-up display during play: minimap with health and armour, wanted stars, cash, clock,
// weapon and ammo, the mission objective with its timer, the speedometer and radio, prompts,
// notifications, subtitles, banners and the red flash of taking damage.
import { cam } from '../render/camera.js';
import { districtAt } from '../city/layout.js';
import { roadAt } from '../city/roads.js';
import { rankOf } from '../game/state.js';
import { WEAPONS, ammoText } from '../combat/weapons.js';
import { mph } from '../vehicles/catalog.js';
import { STATIONS } from '../audio/radio.js';
import { hideTime } from '../crime/wanted.js';
import { objectiveText, escortHealth } from '../missions/director.js';
import { CAST } from '../missions/story.js';
import { drawMinimap } from './minimap.js';
import { C, ui, display, money, panel, outlined, richText, starPath, keyHint, bar, weaponIcon } from './theme.js';

const clockText = (clock) => `${String(Math.floor(clock)).padStart(2, '0')}:${String(Math.floor((clock % 1) * 60)).padStart(2, '0')}`;
const timeText = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function drawStars(ctx, G, right, y, u) {
  const W = G.wanted;
  const hiding = W.level > 0 && !W.spotted;
  const blink = hiding && Math.floor(G.time * 4) % 2 === 0;
  for (let k = 0; k < 5; k++) {
    const x = right - (4 - k) * 34 * u - 17 * u;
    const on = k < W.level;
    const pop = on && W.flash > 0 ? 1 + W.flash * 0.25 : 1;
    starPath(ctx, x, y, 15 * u * pop);
    ctx.fillStyle = on ? (blink ? '#8f8a6a' : C.gold) : 'rgba(14,10,30,0.55)';
    ctx.fill();
    ctx.strokeStyle = on ? '#3a2a00' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2 * u;
    ctx.stroke();
  }
  if (W.level > 0) {
    ctx.font = ui(11, u);
    ctx.textAlign = 'right';
    outlined(ctx, hiding ? 'OUT OF SIGHT' : 'PHPD IN PURSUIT', right, y + 31 * u, hiding ? C.green : C.red, 3 * u);
    if (hiding) bar(ctx, right - 150 * u, y + 37 * u, 150 * u, 7 * u, 1 - W.hiddenT / hideTime(W.level), C.green);
    ctx.textAlign = 'left';
  }
}

function drawStatus(ctx, G, u) {
  const p = G.player;
  const right = cam.w - 24 * u;
  drawStars(ctx, G, right, 38 * u, u);
  ctx.textAlign = 'right';
  ctx.font = display(34, u);
  outlined(ctx, money(G.money), right, 112 * u, '#9dffa8', 5 * u);
  ctx.font = ui(14, u);
  const rank = rankOf(G.xp);
  outlined(ctx, `${clockText(G.clock)}  ·  DAY ${G.day}  ·  ${rank.title.toUpperCase()}`, right, 134 * u, '#fff', 3.5 * u);
  // Weapon box.
  const w = WEAPONS[p.weapon];
  const bx = right - 150 * u;
  const by = 146 * u;
  panel(ctx, bx, by, 150 * u, 46 * u, 10 * u, C.ink, 'rgba(255,255,255,0.25)', 1.5 * u);
  weaponIcon(ctx, p.weapon, bx + 34 * u, by + 25 * u, 1.25 * u, '#fff');
  ctx.font = ui(11, u);
  ctx.fillStyle = C.dim;
  ctx.fillText(w.name.toUpperCase(), right - 10 * u, by + 17 * u);
  ctx.font = display(21, u);
  ctx.fillStyle = C.gold;
  ctx.fillText(w.melee ? '∞' : ammoText(p), right - 10 * u, by + 39 * u);
  ctx.textAlign = 'left';
}

function drawObjective(ctx, G, u) {
  const S = G.story;
  const J = G.job;
  const text = S.active ? objectiveText(G) : J?.text;
  if (!text) return 20 * u;
  const x = 22 * u;
  const y = 20 * u;
  const w = 430 * u;
  const title = S.active ? S.active.title : J.title;
  const color = S.active ? CAST[S.active.giver].color : C.gold;
  ctx.font = ui(16, u);
  // Measure the wrapped height first by drawing off-panel.
  const lines = Math.max(1, Math.ceil(ctx.measureText(text.replaceAll('~', '')).width / (w - 34 * u)));
  const timer = S.active ? S.timer : J.timer;
  const escort = S.active ? escortHealth(G) : null;
  const h = (38 + lines * 22 + (escort ? 24 : 0)) * u;
  panel(ctx, x, y, w, h, 12 * u, C.ink, null);
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 10 * u, 5 * u, h - 20 * u);
  ctx.font = ui(11.5, u);
  ctx.fillStyle = color;
  ctx.fillText(`${S.active ? 'MISSION' : 'JOB'}  ·  ${title.toUpperCase()}`, x + 18 * u, y + 22 * u);
  ctx.font = ui(16, u);
  richText(ctx, text, x + 18 * u, y + 45 * u, w - 34 * u, 22 * u, '#fff', C.gold);
  if (timer > 0) {
    const low = S.active && timer < 15;
    ctx.font = display(22, u);
    ctx.textAlign = 'right';
    ctx.fillStyle = low && Math.floor(G.time * 4) % 2 ? C.red : '#fff';
    ctx.fillText(timeText(timer), x + w - 12 * u, y + 25 * u);
    ctx.textAlign = 'left';
  }
  if (escort) {
    ctx.font = ui(11, u);
    ctx.fillStyle = C.dim;
    ctx.fillText(escort.name.toUpperCase(), x + 18 * u, y + h - 12 * u);
    bar(ctx, x + 150 * u, y + h - 22 * u, w - 170 * u, 11 * u, escort.value, escort.value > 0.4 ? C.teal : C.red);
  }
  return y + h + 10 * u;
}

function drawNotes(ctx, G, top, u) {
  let y = top + 8 * u;
  for (const n of G.notes) {
    const a = Math.min(1, n.t * 5, (6 - n.t) * 2);
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.font = ui(13.5, u);
    const text = `${n.icon ? `${n.icon}  ` : ''}${n.text}`;
    const w = ctx.measureText(text).width + 24 * u;
    panel(ctx, 22 * u, y, w, 26 * u, 8 * u, C.ink2);
    ctx.fillStyle = n.color;
    ctx.fillText(text, 34 * u, y + 18 * u);
    y += 31 * u;
  }
  ctx.globalAlpha = 1;
}

function drawVitals(ctx, G, u, targets, places) {
  const p = G.player;
  const size = 196 * u;
  const x = 22 * u;
  const y = cam.h - size - 46 * u;
  drawMinimap(ctx, G, x, y, size, u, targets, places);
  bar(ctx, x, y + size + 7 * u, size * 0.58, 13 * u, p.hp / p.maxHp, p.hp < 30 ? C.red : '#63e07a');
  bar(ctx, x + size * 0.6, y + size + 7 * u, size * 0.4, 13 * u, p.armor / 100, '#5aa9ff');
  ctx.font = ui(9.5, u);
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillText('HEALTH', x + 8 * u, y + size + 17.5 * u);
  ctx.fillText('ARMOUR', x + size * 0.6 + 8 * u, y + size + 17.5 * u);
  // Where you are.
  const d = districtAt(p.x, p.y);
  G.zoneNow = d.name;
  const road = roadAt(p.x, p.y, true);
  ctx.font = display(19, u);
  outlined(ctx, d.name.toUpperCase(), x + size + 14 * u, cam.h - 46 * u, d.color, 4 * u);
  ctx.font = ui(13, u);
  outlined(ctx, road ? road.name : d.blurb, x + size + 14 * u, cam.h - 27 * u, '#fff', 3.5 * u);
}

function drawDriving(ctx, G, u) {
  const v = G.player.vehicle;
  if (!v) return;
  const right = cam.w - 24 * u;
  const base = cam.h - 30 * u;
  ctx.textAlign = 'right';
  ctx.font = display(58, u);
  outlined(ctx, String(mph(v.speed)), right - 56 * u, base, '#fff', 6 * u);
  ctx.font = ui(15, u);
  outlined(ctx, 'MPH', right, base - 4 * u, C.teal, 3.5 * u);
  ctx.font = ui(15, u);
  outlined(ctx, v.spec.name.toUpperCase(), right, base - 62 * u, v.personal ? C.gold : '#fff', 3.5 * u);
  bar(ctx, right - 170 * u, base - 54 * u, 170 * u, 9 * u, v.hp / v.maxHp, v.hp < v.maxHp * 0.35 ? C.red : '#ffb347');
  const st = G.radio.on ? STATIONS[G.radio.station] : null;
  ctx.font = ui(12.5, u);
  outlined(ctx, st ? `♪ ${st.name}  ·  ${st.genre}` : '♪ Radio off', right, base - 82 * u, st ? C.pink : C.dim, 3 * u);
  ctx.textAlign = 'left';
}

function drawPrompts(ctx, G, u, prompts) {
  let y = cam.h - 150 * u;
  for (const [key, label] of prompts) {
    ctx.font = ui(14, u);
    const w = 30 * u + ctx.measureText(label).width + 30 * u;
    keyHint(ctx, key, label, cam.w / 2 - w / 2, y, u);
    y -= 30 * u;
  }
}

function drawSubtitle(ctx, G, u) {
  const s = G.subtitle;
  if (!s || G.dialogue) return;
  const who = CAST[s.who] ?? { name: s.who, color: C.blue };
  ctx.font = ui(18, u);
  ctx.textAlign = 'center';
  ctx.globalAlpha = Math.min(1, s.t * 6, (s.life - s.t) * 3);
  const full = `${who.name}:  ${s.text}`;
  const w = ctx.measureText(full).width;
  const x = cam.w / 2 - w / 2;
  const y = cam.h - 92 * u;
  ctx.textAlign = 'left';
  outlined(ctx, `${who.name}:`, x, y, who.color, 4.5 * u);
  outlined(ctx, s.text, x + ctx.measureText(`${who.name}:  `).width, y, '#fff', 4.5 * u);
  ctx.globalAlpha = 1;
}

function drawBanner(ctx, G, u) {
  const b = G.story.banner;
  if (!b) return;
  const a = Math.min(1, b.t * 4, (b.life - b.t) * 2);
  const slide = (1 - Math.min(1, b.t * 5)) * 40 * u;
  ctx.globalAlpha = Math.max(0, a);
  ctx.textAlign = 'center';
  const y = cam.h * (b.big ? 0.36 : 0.3);
  const size = b.big ? 78 : 56;
  ctx.font = display(size, u);
  const w = ctx.measureText(b.title).width + 120 * u;
  const grad = ctx.createLinearGradient(cam.w / 2 - w / 2, 0, cam.w / 2 + w / 2, 0);
  grad.addColorStop(0, 'rgba(14,10,30,0)');
  grad.addColorStop(0.2, 'rgba(14,10,30,0.72)');
  grad.addColorStop(0.8, 'rgba(14,10,30,0.72)');
  grad.addColorStop(1, 'rgba(14,10,30,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(cam.w / 2 - w / 2, y - size * 0.95 * u, w, (size + 52) * u);
  outlined(ctx, b.title, cam.w / 2 + slide, y, b.color, 8 * u);
  ctx.font = ui(19, u);
  outlined(ctx, b.sub, cam.w / 2 - slide, y + 32 * u, '#fff', 4.5 * u);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

function drawDamage(ctx, G, u) {
  const p = G.player;
  const hurt = Math.max(0, 1 - p.hurtT * 2.5);
  const low = p.hp < 30 ? 0.25 + 0.15 * Math.sin(G.time * 6) : 0;
  const a = Math.max(hurt * 0.55, low);
  if (a > 0.01) {
    const g = ctx.createRadialGradient(cam.w / 2, cam.h / 2, cam.h * 0.35, cam.w / 2, cam.h / 2, cam.w * 0.62);
    g.addColorStop(0, 'rgba(255,0,40,0)');
    g.addColorStop(1, `rgba(255,0,40,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cam.w, cam.h);
  }
  if (G.wanted.bustT > 0.1) {
    ctx.textAlign = 'center';
    ctx.font = display(26, u);
    outlined(ctx, 'HANDS UP! MOVE TO BREAK FREE', cam.w / 2, cam.h * 0.24, C.blue, 5 * u);
    bar(ctx, cam.w / 2 - 120 * u, cam.h * 0.24 + 10 * u, 240 * u, 10 * u, G.wanted.bustT / 1.5, C.blue);
    ctx.textAlign = 'left';
  }
}

function drawZoneCard(ctx, G, u) {
  const z = G.zoneName;
  if (!z.text || z.t > 3.2) return;
  const a = Math.min(1, z.t * 4, (3.2 - z.t) * 2);
  ctx.globalAlpha = Math.max(0, a);
  ctx.textAlign = 'center';
  ctx.font = display(40, u);
  outlined(ctx, z.text.toUpperCase(), cam.w / 2, 86 * u, z.color ?? '#fff', 6 * u);
  if (z.sub) {
    ctx.font = ui(15, u);
    outlined(ctx, z.sub, cam.w / 2, 110 * u, '#fff', 4 * u);
  }
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

/** The mouse crosshair while armed. */
function drawCrosshair(ctx, G, u, mouse) {
  if (G.player.weapon === 'fists' && !G.player.vehicle) return;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 9 * u, 0, 7);
  ctx.moveTo(mouse.x - 15 * u, mouse.y); ctx.lineTo(mouse.x - 5 * u, mouse.y);
  ctx.moveTo(mouse.x + 5 * u, mouse.y); ctx.lineTo(mouse.x + 15 * u, mouse.y);
  ctx.moveTo(mouse.x, mouse.y - 15 * u); ctx.lineTo(mouse.x, mouse.y - 5 * u);
  ctx.moveTo(mouse.x, mouse.y + 5 * u); ctx.lineTo(mouse.x, mouse.y + 15 * u);
  ctx.stroke();
}

/**
 * Draws the whole HUD. `targets` are objective points, `places` shop letters for the minimap,
 * `prompts` the [key, label] hints for what the player can do right here.
 */
export function drawHud(ctx, G, targets, places, prompts, mouse) {
  const u = cam.scale;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textBaseline = 'alphabetic';
  drawDamage(ctx, G, u);
  if (!G.dialogue) drawVitals(ctx, G, u, targets, places);
  drawStatus(ctx, G, u);
  const top = drawObjective(ctx, G, u);
  drawNotes(ctx, G, top, u);
  drawDriving(ctx, G, u);
  if (!G.dialogue) drawPrompts(ctx, G, u, prompts);
  drawSubtitle(ctx, G, u);
  drawZoneCard(ctx, G, u);
  drawBanner(ctx, G, u);
  if (G.mode === 'play' && !G.shot?.noCrosshair) drawCrosshair(ctx, G, u, mouse);
}
