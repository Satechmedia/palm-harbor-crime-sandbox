// The player: walking, sprinting and aiming on foot, getting into parked cars and pulling
// drivers out of moving ones, driving, shooting from the window, and waking up at the hospital
// or the police station after going down.
import { held, tapped, moveAxis, mouse } from '../core/input.js';
import { clamp } from '../core/math.js';
import { screenToWorld, snapCamera } from '../render/camera.js';
import { notify, addMoney, newId } from '../game/state.js';
import { LOOKS, createPerson, movePerson } from './people.js';
import { stepVehicle, vehicleAt } from '../vehicles/physics.js';
import { WEAPONS, WEAPON_ORDER, fireWeapon } from '../combat/weapons.js';
import { reportCrime, clearWanted } from '../crime/wanted.js';
import { sfx } from '../audio/sound.js';

export function createPlayer(G, x, y) {
  G.player = {
    id: newId(G), isPlayer: true, role: 'player', name: 'Dez Okoro', x, y, vx: 0, vy: 0, angle: 0, r: 5.5, look: LOOKS.player,
    hp: 100, maxHp: 100, armor: 0, dead: false, walkT: 0, hitT: 0, hitCarT: 0, punchT: 0, fireT: 0, hurtT: 9,
    weapons: { fists: Infinity }, weapon: 'fists', vehicle: null, enterT: 0, sprinting: false, aimAngle: 0,
  };
  return G.player;
}

/** The vehicle the player could get into right now, or null. */
export function enterableVehicle(G) {
  const p = G.player;
  let best = null;
  let bestD = Infinity;
  for (const v of G.vehicles) {
    if (v.wreck || v.fire > 0) continue;
    const d = Math.hypot(v.x - p.x, v.y - p.y) - v.spec.len * 0.5;
    if (d < 20 && d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

export function enterVehicle(G, v, quiet = false) {
  const p = G.player;
  if (v.driver === 'ai' || (v.driver && v.driver !== p)) {
    // Pull the driver out onto the street.
    const cop = v.spec.police;
    const out = createPerson(G, v.x + Math.sin(v.angle) * (v.spec.wid * 0.5 + 8), v.y - Math.cos(v.angle) * (v.spec.wid * 0.5 + 8), cop ? 'cop' : 'civ', cop ? LOOKS.cop : null);
    if (cop) out.weapon = 'pistol';
    else {
      out.state = 'flee';
      out.scareT = 12;
      out.fearX = v.x;
      out.fearY = v.y;
    }
    if (!quiet) reportCrime(G, cop ? 'copAssault' : 'carjack', v.x, v.y);
  }
  if (!v.stolen && !v.personal && !quiet) {
    v.stolen = true;
    G.stats.carsStolen++;
    if (v.parked) reportCrime(G, 'theft', v.x, v.y);
  }
  v.driver = p;
  v.ai = null;
  v.parked = false;
  v.siren = false;
  p.vehicle = v;
  p.enterT = 0.35;
  G.zoneName = { text: v.spec.name, sub: v.personal ? 'Your ride' : v.spec.police ? 'Hot property' : 'Borrowed', t: 0 };
  if (!quiet) sfx('door');
  G.onEnterVehicle?.(v);
}

export function exitVehicle(G) {
  const p = G.player;
  const v = p.vehicle;
  if (!v) return;
  const side = v.spec.wid * 0.5 + 8;
  for (const dir of [1, -1]) {
    const x = v.x + Math.sin(v.angle) * side * dir;
    const y = v.y - Math.cos(v.angle) * side * dir;
    if (dir === 1 && vehicleAt(G, x, y, 5, v)) continue;
    p.x = x;
    p.y = y;
    break;
  }
  p.vx = v.vx * 0.3;
  p.vy = v.vy * 0.3;
  p.angle = v.angle;
  p.vehicle = null;
  p.enterT = 0.35;
  v.driver = null;
  sfx('door');
}

function switchWeapon(G, p) {
  const owned = WEAPON_ORDER.filter((id) => p.weapons[id] !== undefined);
  let k = owned.indexOf(p.weapon);
  if (mouse.wheel < 0) k = (k - 1 + owned.length) % owned.length;
  if (tapped('KeyQ') || mouse.wheel > 0) k = (k + 1) % owned.length;
  for (let n = 0; n < WEAPON_ORDER.length; n++) if (tapped(`Digit${n + 1}`) && p.weapons[WEAPON_ORDER[n]] !== undefined) k = owned.indexOf(WEAPON_ORDER[n]);
  if (owned[k] !== p.weapon) {
    p.weapon = owned[k];
    sfx('click');
  }
}

function tryFire(G, p, fromCar) {
  let id = p.weapon;
  if (fromCar && !WEAPONS[id].driveBy) id = p.weapons.smg !== undefined ? 'smg' : p.weapons.pistol !== undefined ? 'pistol' : null;
  if (!id) return;
  const w = WEAPONS[id];
  const wants = w.auto ? mouse.down : mouse.clicked || (mouse.down && p.fireT < -0.12);
  if (!wants || p.fireT > 0) return;
  if (p.weapons[id] <= 0) {
    if (mouse.clicked) sfx('empty');
    if (!fromCar) p.weapon = 'fists';
    return;
  }
  p.fireT = w.rate;
  if (!w.melee) p.weapons[id]--;
  fireWeapon(G, p, id, p.aimAngle);
}

/** One step of the player, on foot or at the wheel. `locked` freezes the controls (cutscenes). */
export function updatePlayer(G, dt, locked = false) {
  const p = G.player;
  p.fireT -= dt;
  p.hurtT += dt;
  if (p.hitT > 0) p.hitT -= dt;
  if (p.punchT > 0) p.punchT -= dt;
  if (p.enterT > 0) p.enterT -= dt;
  if (p.hurtT > 7 && p.hp < 50 && !p.dead) p.hp = Math.min(50, p.hp + dt * 4);
  const [mx, my] = screenToWorld(mouse.x, mouse.y);
  const v = p.vehicle;
  if (v) {
    p.x = v.x;
    p.y = v.y;
    p.vx = v.vx;
    p.vy = v.vy;
    p.angle = v.angle;
    p.aimAngle = Math.atan2(my - v.y, mx - v.x);
    const ctl = locked ? { throttle: 0, steer: 0, handbrake: true } : {
      throttle: (held('KeyW', 'ArrowUp') ? 1 : 0) - (held('KeyS', 'ArrowDown') ? 1 : 0),
      steer: (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0),
      handbrake: held('Space'),
    };
    stepVehicle(G, v, ctl, dt);
    G.stats.distance += Math.abs(v.speed) * dt;
    if (locked) return;
    if (tapped('KeyH')) {
      v.horn = 0.4;
      sfx('horn', { vol: 0.7 });
    }
    switchWeapon(G, p);
    tryFire(G, p, true);
    if (tapped('KeyF', 'Enter') && p.enterT <= 0 && Math.abs(v.speed) < 90) exitVehicle(G);
    return;
  }
  if (locked) {
    movePerson(G, p, 0, 0, 0, dt);
    return;
  }
  const axis = moveAxis();
  p.aimAngle = Math.atan2(my - p.y, mx - p.x);
  p.sprinting = held('ShiftLeft', 'ShiftRight') && (axis.x || axis.y);
  const armed = p.weapon !== 'fists';
  const aiming = armed && (mouse.down || p.fireT > -1.2);
  movePerson(G, p, axis.x, axis.y, p.sprinting ? 150 : 96, dt, aiming || p.punchT > 0 ? p.aimAngle : null);
  switchWeapon(G, p);
  tryFire(G, p, false);
  if (tapped('KeyF', 'Enter') && p.enterT <= 0) {
    const car = enterableVehicle(G);
    if (car) enterVehicle(G, car);
  }
}

/** After going down: wake at the hospital (or the police station when arrested), lighter in the wallet. */
export function respawnPlayer(G, arrested) {
  const p = G.player;
  const place = G.city.places[arrested ? 'police' : 'hospital'];
  if (p.vehicle) {
    p.vehicle.driver = null;
    p.vehicle = null;
  }
  p.x = place.x;
  p.y = place.y;
  p.vx = p.vy = 0;
  p.hp = p.maxHp;
  p.dead = false;
  p.hurtT = 9;
  const fee = Math.min(G.money, arrested ? 150 + G.wanted.level * 60 : 200);
  if (fee > 0) addMoney(G, -fee);
  if (arrested) {
    for (const id of Object.keys(p.weapons)) if (id !== 'fists') p.weapons[id] = Math.floor(p.weapons[id] * 0.5);
    notify(G, 'Bail posted. They kept half your ammo.', '#6fa8ff');
    G.stats.busted++;
  } else {
    notify(G, `Patched up at ${place.name}.`, '#ff8a9a');
    G.stats.flatlined++;
  }
  clearWanted(G, true);
  G.clock = (G.clock + 3) % 24;
  snapCamera(p.x, p.y, 1.4);
}

export const playerSpeed = (G) => (G.player.vehicle ? Math.abs(G.player.vehicle.speed) : Math.hypot(G.player.vx, G.player.vy));
export const clampHealth = (p) => (p.hp = clamp(p.hp, 0, p.maxHp));
