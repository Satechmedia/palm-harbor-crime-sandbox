// Saving and loading: story progress, money, weapons, upgrades, statistics, the clock and the
// settings go to localStorage. A save always puts the player back at the Seabreeze Motel.
import { SAVE_KEY, SETTINGS_KEY } from '../core/config.js';
import { MISSIONS } from '../missions/story.js';

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function saveGame(G) {
  const p = G.player;
  const weapons = {};
  for (const [id, n] of Object.entries(p.weapons)) weapons[id] = n === Infinity ? -1 : n;
  const data = {
    v: 1, seed: G.seed, money: G.money, xp: G.xp, day: G.day, clock: G.clock, done: G.story.done, weapons, weapon: p.weapon,
    armor: p.armor, shirt: p.look.shirt, upgrades: G.upgrades, stats: G.stats, pelicans: G.pelicansFound, radio: G.radio.station, savedAt: Date.now(),
  };
  try {
    storage()?.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** The saved game as plain data, or null when there is none (or it cannot be read). */
export function readSave() {
  try {
    const raw = storage()?.getItem(SAVE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && data.v === 1 && Array.isArray(data.done) ? data : null;
  } catch {
    return null;
  }
}

/** Copies saved data onto a freshly created game. */
export function applySave(G, data) {
  const p = G.player;
  G.money = data.money ?? G.money;
  G.xp = data.xp ?? 0;
  G.day = data.day ?? 1;
  G.clock = data.clock ?? G.clock;
  G.story.done = data.done.filter((id) => MISSIONS.some((m) => m.id === id));
  G.upgrades = { ...G.upgrades, ...data.upgrades };
  G.stats = { ...G.stats, ...data.stats };
  G.pelicansFound = data.pelicans ?? [];
  G.radio.station = data.radio ?? 0;
  p.weapons = {};
  for (const [id, n] of Object.entries(data.weapons ?? { fists: -1 })) p.weapons[id] = n < 0 ? Infinity : n;
  p.weapon = p.weapons[data.weapon] !== undefined ? data.weapon : 'fists';
  p.armor = data.armor ?? 0;
  if (data.shirt) p.look = { ...p.look, shirt: data.shirt };
}

export function eraseSave() {
  try {
    storage()?.removeItem(SAVE_KEY);
  } catch { /* nothing to erase */ }
}

/** A one-line summary of a save for the title screen. */
export function describeSave(data) {
  const done = data.done.length;
  const title = done >= MISSIONS.length ? 'Story complete' : `Mission ${done + 1}: ${MISSIONS[done].title}`;
  return `${title}  ·  $${data.money.toLocaleString('en-US')}  ·  Day ${data.day}`;
}

export function saveSettings(settings) {
  try {
    storage()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* settings stay for this session only */ }
}

export function loadSettings(settings) {
  try {
    Object.assign(settings, JSON.parse(storage()?.getItem(SETTINGS_KEY) ?? '{}'));
  } catch { /* defaults */ }
  return settings;
}
