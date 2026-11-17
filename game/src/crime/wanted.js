// The wanted level: crimes that someone sees add heat, heat becomes one to five stars, and the
// stars fall away only after the player stays out of the police's sight long enough.
import { hasLineOfSight } from '../city/collision.js';
import { notify, addXp } from '../game/state.js';
import { sfx } from '../audio/sound.js';

/** Heat each crime adds once it has been witnessed. */
const CRIME_HEAT = { theft: 5, ram: 5, carjack: 12, assault: 14, shots: 7, kill: 28, explosion: 34, copAssault: 42, copKill: 75 };
/** Heat needed for each star. */
export const STAR_HEAT = [0, 10, 48, 115, 210, 330];
const NEEDS_NO_WITNESS = new Set(['copAssault', 'copKill', 'explosion']);

function witnessed(G, x, y) {
  for (const p of G.people) {
    if (p.dead) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < (p.role === 'cop' ? 420 : 240)) return true;
  }
  for (const v of G.vehicles) if (v.spec.police && v.driver === 'ai' && Math.hypot(v.x - x, v.y - y) < 420) return true;
  return false;
}

export function levelOfHeat(heat) {
  let level = 0;
  while (level < 5 && heat >= STAR_HEAT[level + 1]) level++;
  return level;
}

/** Tells the police about a crime at (x, y). Unseen petty crime mostly goes unnoticed. */
export function reportCrime(G, kind, x, y) {
  const W = G.wanted;
  if (G.mode !== 'play' || W.frozen) return;
  let heat = CRIME_HEAT[kind] ?? 5;
  if (kind === 'shots' && W.level === 0 && !witnessed(G, x, y)) return;
  if (W.level === 0 && !NEEDS_NO_WITNESS.has(kind) && !witnessed(G, x, y)) heat *= 0.25;
  if (W.cap !== undefined && levelOfHeat(W.heat + heat) > W.cap) return;
  W.heat = Math.min(STAR_HEAT[5] + 60, W.heat + heat);
  W.hiddenT = 0;
  W.lastX = x;
  W.lastY = y;
  const level = levelOfHeat(W.heat);
  if (level > W.level) {
    W.level = level;
    W.flash = 1.4;
    sfx('star');
    if (level === 1) notify(G, 'PHPD is looking for you.', '#6fa8ff', '★');
    if (level === 3) notify(G, 'Roadblocks are going up.', '#ff8a5c', '★');
    if (level === 4) notify(G, 'Air unit Skylark is overhead.', '#ff8a5c', '★');
  }
}

/** Sets the stars directly (missions use this). */
export function setWanted(G, level) {
  const W = G.wanted;
  W.heat = Math.max(W.heat, STAR_HEAT[level] + 8);
  if (level > W.level) {
    W.flash = 1.4;
    sfx('star');
  }
  W.level = Math.max(W.level, level);
  W.hiddenT = 0;
  W.lastX = G.player.x;
  W.lastY = G.player.y;
}

export function clearWanted(G, quiet = false) {
  const W = G.wanted;
  if (W.level > 0 && !quiet) {
    notify(G, 'You lost the heat.', '#8dff9c', '✓');
    G.stats.copsLost++;
    addXp(G, 20 * W.level);
    sfx('clear');
  }
  W.level = 0;
  W.heat = 0;
  W.hiddenT = 0;
  W.spotted = false;
  W.bustT = 0;
}

/** Seconds out of sight needed to shake the current stars. */
export const hideTime = (level) => 8 + level * 4;

/** True when any officer, patrol car or the helicopter can see the player right now. */
function playerSpotted(G) {
  const p = G.player;
  if (G.helicopter && !G.helicopter.leaving && Math.hypot(G.helicopter.x - p.x, G.helicopter.y - p.y) < 300) return true;
  for (const v of G.vehicles) {
    if (!v.spec.police || v.driver !== 'ai') continue;
    const d = Math.hypot(v.x - p.x, v.y - p.y);
    if (d < 130 || (d < 460 && hasLineOfSight(G.city, v.x, v.y, p.x, p.y))) return true;
  }
  for (const o of G.people) {
    if (o.role !== 'cop' || o.dead) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d < 90 || (d < 400 && hasLineOfSight(G.city, o.x, o.y, p.x, p.y))) return true;
  }
  return false;
}

export function updateWanted(G, dt) {
  const W = G.wanted;
  if (W.flash > 0) W.flash -= dt;
  if (W.level === 0) {
    W.heat = Math.max(0, W.heat - dt * 0.6);
    W.spotted = false;
    return;
  }
  if (G.frame % 6 === 0) W.spotted = playerSpotted(G);
  if (W.spotted) {
    W.hiddenT = 0;
    W.lastX = G.player.x;
    W.lastY = G.player.y;
  } else {
    W.hiddenT += dt;
    if (W.hiddenT > hideTime(W.level)) clearWanted(G);
  }
}
