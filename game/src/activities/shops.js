// The services of Palm Harbor and their counters: Brassworks Arms (weapons, ammo, armour),
// Fresh Coat (respray that clears the heat), Taco Tide (food), Bravo Motors (sell cars and tune
// your own) and the Seabreeze Motel (save, sleep, wardrobe).
import { tapped, mouse } from '../core/input.js';
import { notify, addMoney } from '../game/state.js';
import { WEAPONS, WEAPON_ORDER } from '../combat/weapons.js';
import { clearWanted } from '../crime/wanted.js';
import { createVehicle, vehicleAt } from '../vehicles/physics.js';
import { sfx } from '../audio/sound.js';

const SHIRTS = ['#ff5a7a', '#36e0d0', '#ffd23f', '#f4f1e8', '#7d6bff', '#2ecc71', '#16161c'];
const UPGRADES = [['engine', 'Engine tune', 'More power and top speed'], ['armor', 'Armour plating', 'Takes 15% less damage a level'], ['tires', 'Grip tyres', 'Sharper cornering']];

/** Where each counter stands: the landmark's own ring, except the garage's, which sits beside the mission ring. */
export function shopPoints(G) {
  const P = G.city.places;
  const g = P.garage;
  const service = g.horizontal ? { x: g.yard.x + g.yard.w * 0.3, y: g.y } : { x: g.x, y: g.yard.y + g.yard.h * 0.3 };
  const list = [
    { id: 'gunshop', ...P.gunshop }, { id: 'spray', ...P.spray }, { id: 'diner', ...P.diner }, { id: 'safehouse', ...P.safehouse },
  ];
  if (G.story.done.length >= 1) list.push({ id: 'garage', name: 'Bravo Motors Service', letter: '⚙', color: '#ffd23f', x: service.x, y: service.y });
  return list;
}

function item(label, price, note, buy, can = () => true) {
  return { label, price, note, buy, can };
}

/** The menu of a counter, built for what the player owns and drives right now. */
export function shopItems(G, id) {
  const p = G.player;
  const v = p.vehicle;
  const items = [];
  if (id === 'gunshop') {
    for (const wid of WEAPON_ORDER) {
      const w = WEAPONS[wid];
      if (w.melee) continue;
      if (w.unlock > G.story.done.length) {
        items.push(item(w.name, 0, `Unlocks after mission ${w.unlock}`, null, () => false));
      } else if (p.weapons[wid] === undefined) {
        items.push(item(w.name, w.price, `${w.pack} rounds included`, () => { p.weapons[wid] = w.pack; p.weapon = wid; }));
      } else items.push(item(`${w.name} ammo`, w.packPrice, `+${w.pack} rounds (you have ${p.weapons[wid]})`, () => { p.weapons[wid] += w.pack; }));
    }
    items.push(item('Body armour', 300, 'Soaks up 80% of bullet damage', () => { p.armor = 100; }, () => p.armor < 100));
  } else if (id === 'spray') {
    const price = 150 + G.wanted.level * 75;
    items.push(item('Respray and repair', price, v ? 'New paint, new plates: the police lose you' : 'Bring a vehicle', () => {
      v.paint = G.rng.pick(v.spec.paints.filter((c) => c !== v.paint).concat(['#7d6bff', '#2ecc71']));
      v._paintKey = -1;
      v.hp = v.maxHp;
      v.fire = 0;
      v.stolen = true;
      clearWanted(G);
      sfx('spray');
    }, () => !!v));
  } else if (id === 'diner') {
    items.push(item('Tide taco', 15, 'Restores 50 health', () => { p.hp = Math.min(p.maxHp, p.hp + 50); }, () => p.hp < p.maxHp));
    items.push(item('Fiesta platter', 40, 'Restores all health', () => { p.hp = p.maxHp; }, () => p.hp < p.maxHp));
  } else if (id === 'safehouse') {
    items.push(item('Save game', 0, 'Writes your progress to this browser', () => { G.onSave?.(); }));
    items.push(item('Sleep until morning', 0, 'Rest to 8:00 and heal', () => { if (G.clock > 8) G.day++; G.clock = 8; p.hp = p.maxHp; G.onSave?.(); }));
    items.push(item('Sleep until sunset', 0, 'Rest to 17:30 and heal', () => { if (G.clock > 17.5) G.day++; G.clock = 17.5; p.hp = p.maxHp; G.onSave?.(); }));
    items.push(item('Change shirt', 0, 'Cycle through your wardrobe', () => { p.look = { ...p.look, shirt: SHIRTS[(SHIRTS.indexOf(p.look.shirt) + 1) % SHIRTS.length] }; }));
  } else if (id === 'garage') {
    if (v && !v.personal && !v.tag && !v.spec.police) {
      const value = Math.round((v.spec.value * (0.4 + 0.6 * (v.hp / v.maxHp))) / 10) * 10;
      items.push(item(`Sell this ${v.spec.name}`, -value, 'Tía asks no questions', () => {
        p.vehicle = null;
        v.driver = null;
        G.vehicles.splice(G.vehicles.indexOf(v), 1);
        p.x += 30;
      }));
    }
    for (const [key, label, note] of UPGRADES) {
      const level = G.upgrades[key];
      items.push(item(`${label} ${'I'.repeat(Math.min(3, level + 1))}`, 1500 * (level + 1), level >= 3 ? 'Fully upgraded' : `${note} (your Brava 440)`, () => { G.upgrades[key]++; }, () => level < 3));
    }
    items.push(item('Bring my Brava 440 round', 100, 'Your own car, delivered to the forecourt', () => { spawnPersonalCar(G, p.x + 44, p.y, 0); }));
  }
  return items;
}

/** The player's own car: tuned by the garage's upgrades, never recycled. */
export function spawnPersonalCar(G, x, y, angle) {
  for (let i = G.vehicles.length - 1; i >= 0; i--) if (G.vehicles[i].personal && G.vehicles[i].driver !== G.player) G.vehicles.splice(i, 1);
  let px = x;
  for (let k = 0; k < 4 && vehicleAt(G, px, y, 14); k++) px += 30;
  const v = createVehicle(G, 'brava', px, y, angle, '#ff7a45');
  v.personal = true;
  v.stolen = true;
  v.hp = v.maxHp = 120 + G.upgrades.armor * 30;
  return v;
}

/** The counter the player is standing at (or parked at), or null. */
export function shopNearby(G) {
  const p = G.player;
  for (const s of shopPoints(G)) {
    const drive = s.id === 'spray' || s.id === 'garage';
    if (p.vehicle && !drive) continue;
    if (Math.hypot(s.x - p.x, s.y - p.y) < (p.vehicle ? 30 : 20) && Math.hypot(p.vx, p.vy) < 60) return s;
  }
  return null;
}

export function openShop(G, shop) {
  G.shop = { id: shop.id, name: shop.name, color: shop.color, sel: 0, items: shopItems(G, shop.id), flash: 0 };
  G.mode = 'shop';
  sfx('menu');
}

/** Menu navigation and buying while a counter is open. */
export function updateShop(G, dt) {
  const S = G.shop;
  S.flash = Math.max(0, S.flash - dt);
  const n = S.items.length;
  if (tapped('KeyW', 'ArrowUp')) { S.sel = (S.sel - 1 + n) % n; sfx('click'); }
  if (tapped('KeyS', 'ArrowDown')) { S.sel = (S.sel + 1) % n; sfx('click'); }
  if (S.hover !== undefined && S.hover >= 0 && mouse.moved) S.sel = S.hover;
  if (tapped('Escape', 'KeyF', 'Backspace')) {
    G.shop = null;
    G.mode = 'play';
    sfx('menu');
    return;
  }
  if (tapped('Enter', 'KeyE', 'Space') || (mouse.clicked && S.hover >= 0)) {
    const it = S.items[S.sel];
    if (!it.buy || !it.can()) sfx('empty');
    else if (it.price > G.money) {
      sfx('empty');
      notify(G, 'Not enough cash.', '#ff6b6b');
    } else {
      if (it.price) addMoney(G, -it.price);
      it.buy();
      sfx(it.price < 0 ? 'cash' : 'buy');
      S.flash = 0.3;
      if (!G.player.vehicle && (S.id === 'garage' || S.id === 'spray') && S.items.length === 1) { G.shop = null; G.mode = 'play'; return; }
      S.items = shopItems(G, S.id);
      S.sel = Math.min(S.sel, S.items.length - 1);
      if (S.id === 'spray') { G.shop = null; G.mode = 'play'; }
    }
  }
}
