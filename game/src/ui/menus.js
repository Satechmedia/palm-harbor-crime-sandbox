// Menus: the title screen over the living city, the pause menu with its city map, progress,
// controls and settings pages, the shop counters, and the screens for going down or being arrested.
import { tapped, mouse } from '../core/input.js';
import { GAME_TITLE, GAME_TAGLINE } from '../core/config.js';
import { cam } from '../render/camera.js';
import { rankOf } from '../game/state.js';
import { MISSIONS, CAST } from '../missions/story.js';
import { drawFullMap } from './minimap.js';
import { drawPortrait } from './dialogue.js';
import { C, ui, display, money, panel, outlined, keyHint, bar, starPath } from './theme.js';
import { sfx } from '../audio/sound.js';

const CONTROLS = [
  ['W A S D', 'Walk · steer, accelerate, brake'], ['MOUSE', 'Aim · left button fires'], ['F', 'Get in or out of a vehicle · carjack'], ['SHIFT', 'Sprint'],
  ['SPACE', 'Handbrake (drift)'], ['Q · 1-6', 'Switch weapon (also the wheel)'], ['E', 'Use a shop counter · talk'], ['T', 'Start a taxi or parcel job'],
  ['R', 'Next radio station · retry a mission'], ['H', 'Horn'], ['M · TAB', 'City map'], ['ESC · P', 'Pause'],
];

function mainItems(G, hooks) {
  const M = G.menu;
  if (M.screen === 'title') {
    const items = [];
    if (hooks.saveInfo) items.push({ label: 'CONTINUE', sub: hooks.saveInfo, act: hooks.continueGame });
    items.push({ label: 'NEW GAME', sub: 'Dez Okoro walks out of prison into a heatwave', act: hooks.newGame });
    items.push({ label: 'CONTROLS', sub: 'Keyboard and mouse', act: () => (M.page = 'controls') });
    items.push({ label: 'SETTINGS', sub: 'Sound, music, graphics', act: () => (M.page = 'settings') });
    return items;
  }
  const busy = G.story.active || G.wanted.level > 0;
  return [
    { label: 'RESUME', act: hooks.resume },
    { label: 'CITY MAP', act: () => (M.page = 'map') },
    { label: 'PROGRESS', act: () => (M.page = 'stats') },
    { label: 'CONTROLS', act: () => (M.page = 'controls') },
    { label: 'SETTINGS', act: () => (M.page = 'settings') },
    { label: 'SAVE GAME', sub: busy ? 'Not during a mission or a chase' : '', act: busy ? null : hooks.save },
    { label: 'QUIT TO TITLE', act: hooks.quit },
  ];
}

function settingItems(G, hooks) {
  const S = G.settings;
  const step = (key, d) => {
    S[key] = Math.min(1, Math.max(0, Math.round((S[key] + d) * 10) / 10));
    hooks.settingsChanged();
  };
  return [
    { label: 'SOUND', value: S.sound, change: (d) => step('sound', d * 0.1) },
    { label: 'MUSIC', value: S.music, change: (d) => step('music', d * 0.1) },
    { label: 'GRAPHICS', text: S.quality ? 'HIGH · LIGHTING ON' : 'FAST · LIGHTING OFF', change: () => { S.quality = S.quality ? 0 : 1; hooks.settingsChanged(); } },
    { label: 'CAMERA SHAKE', text: S.shake ? 'ON' : 'OFF', change: () => { S.shake = S.shake ? 0 : 1; hooks.settingsChanged(); } },
  ];
}

/** Keyboard and mouse handling for the title and pause menus. */
export function updateMenu(G, dt, hooks) {
  const M = G.menu;
  M.t += dt;
  const back = tapped('Escape', 'Backspace') || (M.screen === 'pause' && tapped('KeyP'));
  if (M.page !== 'main') {
    if (back || (M.page !== 'settings' && (tapped('Enter', 'Space') || mouse.clicked)) || (M.page === 'map' && tapped('KeyM', 'Tab'))) {
      M.page = 'main';
      sfx('menu');
      return;
    }
    if (M.page === 'settings') {
      const items = settingItems(G, hooks);
      if (tapped('KeyW', 'ArrowUp')) M.sub = (M.sub - 1 + items.length) % items.length;
      if (tapped('KeyS', 'ArrowDown')) M.sub = (M.sub + 1) % items.length;
      const d = (tapped('KeyD', 'ArrowRight', 'Enter', 'Space') ? 1 : 0) - (tapped('KeyA', 'ArrowLeft') ? 1 : 0);
      if (d) {
        items[M.sub].change(d);
        sfx('click');
      }
    }
    return;
  }
  const items = mainItems(G, hooks);
  if (back && M.screen === 'pause') return hooks.resume();
  if (tapped('KeyW', 'ArrowUp')) { M.sel = (M.sel - 1 + items.length) % items.length; sfx('click'); }
  if (tapped('KeyS', 'ArrowDown')) { M.sel = (M.sel + 1) % items.length; sfx('click'); }
  let hover = -1;
  (M.rects ?? []).forEach((r, i) => {
    if (mouse.x > r[0] && mouse.x < r[0] + r[2] && mouse.y > r[1] && mouse.y < r[1] + r[3]) hover = i;
  });
  if (hover >= 0 && mouse.moved) M.sel = hover;
  M.sel = Math.min(M.sel, items.length - 1);
  if (tapped('Enter', 'Space') || (mouse.clicked && hover >= 0)) {
    const it = items[M.sel];
    if (it.act) {
      sfx('menu');
      M.sub = 0;
      it.act();
    } else sfx('empty');
  }
}

function drawLogo(ctx, x, y, u, t) {
  // A setting sun cut by horizon lines, the title across it.
  const r = 92 * u;
  const cx = x + 250 * u;
  const cy = y - 20 * u;
  const sun = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  sun.addColorStop(0, '#ffe066');
  sun.addColorStop(0.55, '#ff7a45');
  sun.addColorStop(1, '#ff2f8e');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(12,8,30,0.9)';
  for (let k = 0; k < 5; k++) ctx.fillRect(cx - r, cy - (8 + k * 15) * u - (k * 0.7 + 2) * u, r * 2, (1.5 + k * 0.9) * u);
  // Palm silhouettes either side.
  ctx.strokeStyle = '#120a26';
  ctx.fillStyle = '#120a26';
  for (const [px, lean, hgt] of [[cx - r - 26 * u, 14, 150], [cx + r + 20 * u, -10, 122]]) {
    ctx.lineWidth = 6 * u;
    ctx.beginPath();
    ctx.moveTo(px, cy + 6 * u);
    ctx.quadraticCurveTo(px + lean * u, cy - hgt * 0.5 * u, px + lean * 1.6 * u, cy - hgt * u);
    ctx.stroke();
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.55 + Math.sin(t * 0.8 + k) * 0.03;
      ctx.beginPath();
      ctx.ellipse(px + lean * 1.6 * u + Math.cos(a) * 26 * u, cy - hgt * u + Math.sin(a) * 26 * u + 10 * u, 30 * u, 6 * u, a + 0.5 * Math.sign(k - 3), 0, 7);
      ctx.fill();
    }
  }
  ctx.font = display(112, u);
  ctx.textAlign = 'left';
  const grad = ctx.createLinearGradient(0, y - 60 * u, 0, y + 30 * u);
  grad.addColorStop(0, '#fff6c9');
  grad.addColorStop(0.5, '#ffd23f');
  grad.addColorStop(1, '#ff4f8b');
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#120a26';
  ctx.lineWidth = 14 * u;
  ctx.strokeText(GAME_TITLE, x, y + 44 * u);
  ctx.fillStyle = grad;
  ctx.fillText(GAME_TITLE, x, y + 44 * u);
  ctx.save();
  ctx.translate(x + 290 * u, y + 92 * u);
  ctx.rotate(-0.06);
  ctx.font = `italic ${display(56, u)}`;
  ctx.strokeStyle = '#120a26';
  ctx.lineWidth = 10 * u;
  ctx.strokeText(GAME_TAGLINE, 0, 0);
  ctx.shadowColor = '#36e0d0';
  ctx.shadowBlur = 22 * u;
  ctx.fillStyle = '#7ff5ea';
  ctx.fillText(GAME_TAGLINE, 0, 0);
  ctx.restore();
}

function drawList(ctx, G, items, x, y, u, lineH, big) {
  const M = G.menu;
  M.rects = [];
  items.forEach((it, i) => {
    const sel = i === M.sel;
    const iy = y + i * lineH;
    M.rects.push([x - 14 * u, iy - lineH * 0.56, 470 * u, lineH * 0.92]);
    if (sel) {
      const g = ctx.createLinearGradient(x - 14 * u, 0, x + 440 * u, 0);
      g.addColorStop(0, 'rgba(255,79,139,0.92)');
      g.addColorStop(1, 'rgba(255,79,139,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 14 * u, iy - lineH * 0.56, 460 * u, lineH * 0.92);
      ctx.fillStyle = C.gold;
      ctx.fillRect(x - 14 * u, iy - lineH * 0.56, 5 * u, lineH * 0.92);
    }
    ctx.font = display(big ? 34 : 27, u);
    outlined(ctx, it.label, x + (sel ? 10 : 0) * u, iy, it.act === null ? '#8a84a8' : '#fff', 5 * u);
    if (it.sub) {
      ctx.font = ui(12.5, u, 'normal');
      outlined(ctx, it.sub, x + (sel ? 10 : 0) * u + (big ? 0 : 190 * u), iy + (big ? 26 : -3) * u, sel ? '#fff' : C.dim, 3 * u);
    }
  });
}

function drawControls(ctx, x, y, u) {
  ctx.font = display(40, u);
  outlined(ctx, 'CONTROLS', x, y, C.gold, 6 * u);
  CONTROLS.forEach(([key, label], i) => {
    keyHint(ctx, key, label, x + (i % 2) * 430 * u, y + 46 * u + Math.floor(i / 2) * 40 * u, u * 1.05);
  });
}

function drawSettings(ctx, G, hooks, x, y, u) {
  ctx.font = display(40, u);
  outlined(ctx, 'SETTINGS', x, y, C.gold, 6 * u);
  settingItems(G, hooks).forEach((it, i) => {
    const iy = y + 58 * u + i * 50 * u;
    const sel = i === G.menu.sub;
    if (sel) panel(ctx, x - 14 * u, iy - 28 * u, 620 * u, 42 * u, 8 * u, 'rgba(255,79,139,0.55)');
    ctx.font = display(25, u);
    outlined(ctx, it.label, x, iy, '#fff', 4.5 * u);
    if (it.value !== undefined) bar(ctx, x + 260 * u, iy - 16 * u, 260 * u, 16 * u, it.value, C.teal);
    else {
      ctx.font = ui(16, u);
      outlined(ctx, `◀  ${it.text}  ▶`, x + 260 * u, iy - 2 * u, C.teal, 4 * u);
    }
  });
  ctx.font = ui(13, u, 'normal');
  outlined(ctx, 'A / D change  ·  ESC back', x, y + 280 * u, C.dim, 3 * u);
}

function drawStats(ctx, G, x, y, u) {
  const rank = rankOf(G.xp);
  ctx.font = display(40, u);
  outlined(ctx, 'PROGRESS', x, y, C.gold, 6 * u);
  ctx.font = ui(15, u);
  outlined(ctx, `${rank.title.toUpperCase()}  ·  ${G.xp} XP${rank.next ? `  ·  next rank at ${rank.next}` : ''}`, x, y + 26 * u, '#fff', 3.5 * u);
  bar(ctx, x, y + 34 * u, 380 * u, 9 * u, rank.next ? (G.xp - rank.xp) / (rank.next - rank.xp) : 1, C.pink);
  MISSIONS.forEach((m, i) => {
    const done = G.story.done.includes(m.id);
    const next = i === G.story.done.length;
    const iy = y + 70 * u + i * 27 * u;
    ctx.font = ui(15, u);
    outlined(ctx, `${done ? '✓' : next ? '▶' : '·'}  ${i + 1}. ${done || next ? m.title : '???'}`, x, iy, done ? C.green : next ? C.gold : '#8a84a8', 3.5 * u);
    if (done || next) {
      ctx.font = ui(12, u, 'normal');
      outlined(ctx, `${CAST[m.giver].name} · ${done || next ? m.blurb : ''}`, x + 200 * u, iy, C.dim, 3 * u);
    }
  });
  const s = G.stats;
  const rows = [['Cash earned', money(s.earned)], ['Cars stolen', s.carsStolen], ['Miles driven', (s.distance / 7200).toFixed(1)], ['Chases escaped', s.copsLost], ['Taxi fares', s.fares], ['Parcels', s.parcels], ['Golden pelicans', `${G.pelicansFound.length} / ${G.pelicans?.length ?? 20}`], ['Best Sunset Sprint', s.bestSprint ? `${s.bestSprint.toFixed(1)}s` : '—'], ['Arrests · hospital', `${s.busted} · ${s.flatlined}`]];
  rows.forEach(([k, v], i) => {
    const iy = y + 70 * u + i * 27 * u;
    ctx.font = ui(14, u, 'normal');
    outlined(ctx, k, x + 640 * u, iy, C.dim, 3 * u);
    ctx.font = ui(15, u);
    ctx.textAlign = 'right';
    outlined(ctx, String(v), x + 930 * u, iy, '#fff', 3.5 * u);
    ctx.textAlign = 'left';
  });
}

/** Draws the title or pause menu over the (dimmed) world. */
export function drawMenu(ctx, G, hooks, targets, places) {
  const M = G.menu;
  const u = cam.scale;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const title = M.screen === 'title';
  const shade = ctx.createLinearGradient(0, 0, cam.w, 0);
  shade.addColorStop(0, 'rgba(14,8,34,0.94)');
  shade.addColorStop(title ? 0.5 : 1, title ? 'rgba(14,8,34,0.55)' : 'rgba(14,8,34,0.9)');
  shade.addColorStop(1, title ? 'rgba(14,8,34,0.05)' : 'rgba(14,8,34,0.86)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, cam.w, cam.h);
  const x = 70 * u;
  if (M.page === 'controls') return drawControls(ctx, x, 120 * u, u);
  if (M.page === 'settings') return drawSettings(ctx, G, hooks, x, 120 * u, u);
  if (M.page === 'stats') return drawStats(ctx, G, x, 96 * u, u);
  if (M.page === 'map') {
    drawFullMap(ctx, G, 40 * u, 30 * u, cam.w - 330 * u, cam.h - 60 * u, u, targets, places);
    const lx = cam.w - 270 * u;
    ctx.font = display(34, u);
    outlined(ctx, 'PALM HARBOR', lx, 70 * u, C.gold, 5 * u);
    ctx.font = ui(13, u);
    const legend = [...targets.slice(0, 1).map((t) => [t, t.label || 'Objective']), ...places.map((s) => [s, s.name])];
    legend.forEach(([s, name], i) => {
      const ly = 108 * u + i * 30 * u;
      ctx.fillStyle = 'rgba(12,10,26,0.9)';
      ctx.beginPath();
      ctx.arc(lx + 10 * u, ly - 5 * u, 10 * u, 0, 7);
      ctx.fill();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2 * u;
      ctx.stroke();
      ctx.fillStyle = s.color;
      ctx.textAlign = 'center';
      ctx.fillText(s.letter ?? '●', lx + 10 * u, ly);
      ctx.textAlign = 'left';
      outlined(ctx, name, lx + 30 * u, ly, '#fff', 3 * u);
    });
    return;
  }
  const items = mainItems(G, hooks);
  if (title) {
    drawLogo(ctx, x, 190 * u, u, M.t);
    drawList(ctx, G, items, x + 6 * u, 372 * u, u, 74 * u, true);
    ctx.font = ui(13, u, 'normal');
    outlined(ctx, 'W / S choose  ·  ENTER select  ·  an original open-world crime game  ·  keyboard and mouse', x, cam.h - 30 * u, C.dim, 3 * u);
    // What is in the box.
    const fx = cam.w - 330 * u;
    const fy = cam.h - 190 * u;
    panel(ctx, fx, fy, 300 * u, 160 * u, 14 * u, 'rgba(14,10,30,0.72)', 'rgba(255,255,255,0.2)', 1.5 * u);
    drawPortrait(ctx, 'dez', fx + 14 * u, fy + 14 * u, 64 * u);
    ctx.font = display(20, u);
    ctx.fillStyle = C.pink;
    ctx.fillText('DEZ OKORO', fx + 90 * u, fy + 38 * u);
    ctx.font = ui(12, u, 'normal');
    ctx.fillStyle = '#fff';
    ctx.fillText('Getaway driver. Three years inside.', fx + 90 * u, fy + 58 * u);
    ctx.fillText('One score to settle with Lucian Vex.', fx + 90 * u, fy + 74 * u);
    ctx.fillStyle = C.dim;
    ['10 story missions · 5 districts · day and night', 'Steal 14 vehicles · 5-star PHPD pursuits', 'Taxi fares · parcel rounds · street racing', 'Shops, upgrades, ranks and 20 hidden pelicans'].forEach((line, i) => ctx.fillText(line, fx + 16 * u, fy + 100 * u + i * 16 * u));
    return;
  }
  ctx.font = display(64, u);
  outlined(ctx, 'PAUSED', x, 130 * u, C.gold, 8 * u);
  ctx.font = ui(15, u);
  const next = MISSIONS[G.story.done.length];
  outlined(ctx, `${money(G.money)}  ·  Day ${G.day}  ·  ${rankOf(G.xp).title}  ·  ${next ? `Next: ${next.title}` : 'Story complete'}`, x, 158 * u, '#fff', 3.5 * u);
  drawList(ctx, G, items, x + 6 * u, 230 * u, u, 54 * u, false);
  drawFullMap(ctx, G, cam.w - 560 * u, 90 * u, 520 * u, 420 * u, u, targets, places);
  // The wanted level, for the record.
  for (let k = 0; k < 5; k++) {
    starPath(ctx, cam.w - 540 * u + k * 30 * u, cam.h - 150 * u, 12 * u);
    ctx.fillStyle = k < G.wanted.level ? C.gold : 'rgba(255,255,255,0.18)';
    ctx.fill();
  }
}

export function drawShop(ctx, G) {
  const S = G.shop;
  const u = cam.scale;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(14,8,34,0.55)';
  ctx.fillRect(0, 0, cam.w, cam.h);
  const w = 560 * u;
  const h = (150 + S.items.length * 52) * u;
  const x = cam.w / 2 - w / 2;
  const y = cam.h / 2 - h / 2;
  panel(ctx, x, y, w, h, 18 * u, 'rgba(14,10,30,0.94)', S.color, 3 * u);
  ctx.font = display(38, u);
  ctx.fillStyle = S.color;
  ctx.fillText(S.name.toUpperCase(), x + 26 * u, y + 52 * u);
  ctx.font = display(26, u);
  ctx.textAlign = 'right';
  ctx.fillStyle = S.flash > 0 ? '#fff' : '#9dffa8';
  ctx.fillText(money(G.money), x + w - 26 * u, y + 50 * u);
  ctx.textAlign = 'left';
  S.hover = -1;
  S.items.forEach((it, i) => {
    const iy = y + 78 * u + i * 52 * u;
    const ok = it.buy && it.can() && it.price <= G.money;
    if (mouse.x > x + 14 * u && mouse.x < x + w - 14 * u && mouse.y > iy && mouse.y < iy + 46 * u) S.hover = i;
    if (i === S.sel) panel(ctx, x + 14 * u, iy, w - 28 * u, 46 * u, 10 * u, 'rgba(255,79,139,0.5)', C.pink, 1.5 * u);
    ctx.font = ui(17, u);
    ctx.fillStyle = ok ? '#fff' : '#8a84a8';
    ctx.fillText(it.label, x + 30 * u, iy + 21 * u);
    ctx.font = ui(12, u, 'normal');
    ctx.fillStyle = C.dim;
    ctx.fillText(it.note, x + 30 * u, iy + 38 * u);
    ctx.font = display(22, u);
    ctx.textAlign = 'right';
    ctx.fillStyle = !it.buy ? '#8a84a8' : it.price < 0 ? '#9dffa8' : it.price > G.money ? C.red : C.gold;
    ctx.fillText(!it.buy ? 'LOCKED' : it.price < 0 ? `+${money(-it.price)}` : it.price === 0 ? 'FREE' : money(it.price), x + w - 30 * u, iy + 30 * u);
    ctx.textAlign = 'left';
  });
  let hx = x + 26 * u;
  hx += keyHint(ctx, 'W S', 'Choose', hx, y + h - 24 * u, u * 0.9);
  hx += keyHint(ctx, 'ENTER', 'Buy', hx, y + h - 24 * u, u * 0.9);
  keyHint(ctx, 'ESC', 'Leave', hx, y + h - 24 * u, u * 0.9);
}

/** The screen shown while the player is down: red for the hospital, blue for the cells. */
export function drawDownScreen(ctx, G) {
  const D = G.down;
  const u = cam.scale;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const a = Math.min(1, D.t * 1.2);
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.fillRect(0, 0, cam.w, cam.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = D.arrested ? `rgba(10,30,90,${a * 0.45})` : `rgba(90,0,20,${a * 0.45})`;
  ctx.fillRect(0, 0, cam.w, cam.h);
  ctx.textAlign = 'center';
  ctx.font = display(120, u);
  ctx.globalAlpha = Math.min(1, D.t * 2);
  outlined(ctx, D.arrested ? 'CUFFED' : 'FLATLINED', cam.w / 2, cam.h * 0.48, D.arrested ? '#7fb2ff' : '#ff4d5e', 10 * u);
  ctx.font = ui(20, u);
  outlined(ctx, D.arrested ? 'PHPD Central is holding a cell for you' : 'Saint Coral Medical has a bed with your name on it', cam.w / 2, cam.h * 0.48 + 40 * u, '#fff', 4.5 * u);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}
