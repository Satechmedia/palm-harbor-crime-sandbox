// The one game object every system reads and writes: the city, the player, every vehicle and
// person, the clock, the money, the heat and the story progress. Also the small helpers that
// almost every system needs (notifications, cash, experience and ranks).
import { START_CLOCK } from '../core/config.js';
import { createRandom } from '../core/random.js';
import { generateCity } from '../city/generator.js';

export const RANKS = [
  { xp: 0, title: 'Drifter' },
  { xp: 300, title: 'Hustler' },
  { xp: 900, title: 'Wheelman' },
  { xp: 1800, title: 'Fixer' },
  { xp: 3200, title: 'Harbor Shark' },
  { xp: 5200, title: 'Sun King' },
];

export function createGame(seed = 1) {
  const city = generateCity(seed);
  return {
    seed, city, rng: createRandom(seed * 31 + 7),
    mode: 'title', time: 0, clock: START_CLOCK, day: 1, frame: 0, slowmo: 0,
    player: null, vehicles: [], people: [], pickups: [], markers: [],
    particles: [], tracers: [], floaters: [], rockets: [], helicopter: null, pelicans: [],
    down: null, menu: { screen: 'title', page: 'main', sel: 0, sub: 0, t: 0 },
    wanted: { level: 0, heat: 0, seenT: 0, hiddenT: 0, flash: 0, lastX: 0, lastY: 0, spotted: false, bustT: 0 },
    money: 250, xp: 0,
    stats: { missions: 0, carsStolen: 0, distance: 0, kills: 0, copsLost: 0, fares: 0, parcels: 0, pelicans: 0, bestSprint: 0, playTime: 0, busted: 0, flatlined: 0, earned: 0 },
    story: { done: [], active: null, step: 0, stepT: 0, timer: 0, data: {}, failed: null, banner: null },
    job: null, pelicansFound: [], upgrades: { engine: 0, armor: 0, tires: 0 },
    notes: [], subtitle: null, dialogue: null, shop: null, zoneName: { text: '', t: 0 }, radio: { station: 0, on: true },
    nextId: 1, settings: { sound: 0.8, music: 0.5, quality: 1, shake: 1 }, shot: null,
  };
}

/** A line in the notification feed at the left of the screen. */
export function notify(G, text, color = '#ffffff', icon = '') {
  G.notes.unshift({ text, color, icon, t: 0 });
  if (G.notes.length > 5) G.notes.length = 5;
}

export function addMoney(G, amount, x, y) {
  G.money = Math.max(0, G.money + amount);
  if (amount > 0) G.stats.earned += amount;
  const p = G.player;
  G.floaters.push({ x: x ?? p.x, y: (y ?? p.y) - 14, text: `${amount < 0 ? '-' : '+'}$${Math.abs(amount)}`, color: amount < 0 ? '#ff6b6b' : '#8dff9c', t: 0 });
}

export function rankOf(xp) {
  let k = 0;
  while (k < RANKS.length - 1 && xp >= RANKS[k + 1].xp) k++;
  return { index: k, ...RANKS[k], next: RANKS[k + 1]?.xp ?? null };
}

export function addXp(G, amount) {
  const before = rankOf(G.xp).index;
  G.xp += amount;
  const now = rankOf(G.xp);
  if (now.index > before) {
    notify(G, `Rank up: ${now.title}`, '#ffd23f', '★');
    G.story.banner = { title: 'RANK UP', sub: now.title.toUpperCase(), color: '#ffd23f', t: 0, life: 3.2 };
  }
}

/** A short line of speech at the bottom of the screen. */
export function say(G, who, text, life = 4.5) {
  G.subtitle = { who, text, t: 0, life };
}

export const newId = (G) => G.nextId++;
