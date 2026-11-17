// Staged scenes for the screenshots (?shot=name): each puts the real game into a telling
// moment (a five-car police chase, a walk on the boardwalk, a firefight on the quay, the title
// screen), lets the simulation run for a moment, and leaves the frame to be captured.
// Each scene's `cam` is the world point at the exact centre of the frame (an offset from the
// player when `track` is set) and the zoom; the camera re-centres itself when the window resizes.
import { QUAY_Y0 } from '../city/layout.js';
import { MISSIONS, missionById } from '../missions/story.js';
import { jumpToStep } from '../missions/director.js';
import { createVehicle } from '../vehicles/physics.js';
import { populateTraffic } from '../vehicles/traffic.js';
import { populatePedestrians, scarePeople } from '../characters/pedestrians.js';
import { createPerson, LOOKS } from '../characters/people.js';
import { enterVehicle } from '../characters/player.js';
import { spawnPatrolAt } from '../ai/police.js';
import { createHelicopter } from '../ai/helicopter.js';
import { STAR_HEAT } from '../crime/wanted.js';
import { shopPoints, openShop, spawnPersonalCar } from '../activities/shops.js';
import { notify } from '../game/state.js';

function clearArea(G, x, y, r) {
  G.vehicles = G.vehicles.filter((v) => Math.hypot(v.x - x, v.y - y) > r || v.driver === G.player);
}

/** A car already at speed, with no one deciding where it goes for the moment of the picture. */
function carAt(G, model, x, y, angle, speed, paint, panic = 9) {
  clearArea(G, x, y, 50);
  const v = createVehicle(G, model, x, y, angle, paint);
  v.vx = Math.cos(angle) * speed;
  v.vy = Math.sin(angle) * speed;
  v.speed = speed;
  v.driver = 'ai';
  v.ai = { type: 'traffic', cruise: speed, panicT: panic, waitT: 0, len: 9999, line: { sx: x, sy: y, dx: Math.cos(angle), dy: Math.sin(angle), ex: x + Math.cos(angle) * 9999, ey: y + Math.sin(angle) * 9999 }, seg: G.city.roads.segs[0], dir: 1, lane: 0 };
  return v;
}

function pursuer(G, model, x, y, angle, speed) {
  clearArea(G, x, y, 50);
  const v = spawnPatrolAt(G, x, y, angle, model);
  v.vx = Math.cos(angle) * speed;
  v.vy = Math.sin(angle) * speed;
  v.speed = speed;
  return v;
}

function setProgress(G, done, money, xp) {
  G.story.done = MISSIONS.slice(0, done).map((m) => m.id);
  G.money = money;
  G.xp = xp;
  G.stats.missions = done;
}

function setHeat(G, level) {
  const W = G.wanted;
  W.level = level;
  W.heat = STAR_HEAT[level] + 10;
  W.spotted = true;
  W.lastX = G.player.x;
  W.lastY = G.player.y;
}

export const SCENES = {
  /** Cover: stealing the Aurelia V with four stars, a roadblock ahead and Skylark overhead, at sunset. */
  chase(G) {
    const p = G.player;
    G.clock = 17.7;
    setProgress(G, 8, 18450, 2750);
    p.weapons = { fists: Infinity, pistol: 62, smg: 148, shotgun: 18, rifle: 90 };
    p.weapon = 'smg';
    p.armor = 64;
    p.hp = 81;
    p.x = 2395;
    p.y = 1722;
    populateTraffic(G, 16);
    populatePedestrians(G, 46);
    clearArea(G, 2400, 1700, 330);
    const car = createVehicle(G, 'aurelia', 2395, 1722, -0.22, '#ff2f8e');
    car.tag = 'aurelia';
    car.hp = car.maxHp * 0.62;
    enterVehicle(G, car, true);
    car.vx = 400;
    car.vy = 46;
    jumpToStep(G, missionById('vex_appeal'), 5, false);
    setHeat(G, 4);
    pursuer(G, 'interceptor', 2262, 1716, 0.06, 400);
    pursuer(G, 'interceptor', 2206, 1744, -0.12, 390);
    pursuer(G, 'interceptor', 2290, 1680, 0.2, 380);
    pursuer(G, 'rhino', 2120, 1716, 0, 360);
    pursuer(G, 'interceptor', 2587, 1470, Math.PI / 2, 240);
    // A roadblock past the Grand Paseo junction, officers already shooting.
    for (const [x, y, a] of [[2700, 1684, 1.25], [2706, 1738, 1.9]]) {
      const v = pursuer(G, 'interceptor', x, y, a, 0);
      v.ai = { type: 'roadblock', crew: 0, life: 99 };
    }
    for (const [x, y] of [[2676, 1668], [2680, 1756], [2722, 1712]]) {
      const o = createPerson(G, x, y, 'cop', LOOKS.cop);
      o.weapon = 'smg';
      o.fireT = (30.5 + (x % 3)) / 60;
    }
    carAt(G, 'solcab', 2520, 1687, Math.PI + 0.25, 150);
    carAt(G, 'harborbus', 2613, 1840, -Math.PI / 2, 60);
    carAt(G, 'calypso', 2470, 1740, 0.5, 120, '#36c9e0');
    const wreck = createVehicle(G, 'tortuga', 2455, 1650, 0.9, '#7d6bff');
    wreck.hp = 0;
    wreck.fire = 0.2;
    const h = createHelicopter(G, 2640, 1640);
    h.keep = true;
    h.lightX = p.x;
    h.lightY = p.y;
    h.orbit = 5.5;
    scarePeople(G, p.x, p.y, 500);
    notify(G, 'Roadblocks are going up.', '#ff8a5c', '★');
    notify(G, 'Air unit Skylark is overhead.', '#ff8a5c', '★');
    G.subtitle = { who: 'vex', text: 'That is MY car, Okoro!', t: 1, life: 99 };
    G.zoneName.t = 9;
    return { cam: [70, 17, 1.56], track: true, steps: 34, keys: ['KeyW', 'Space'], aim: [2700, 1700] };
  },

  /** On foot on the Coral Strand boardwalk at midday: pedestrians, traffic, a taxi to take, a hidden pelican. */
  beach(G) {
    const p = G.player;
    G.clock = 11.2;
    setProgress(G, 2, 1340, 420);
    p.weapons = { fists: Infinity, pistol: 36 };
    p.x = 786;
    p.y = 1622;
    p.angle = 0.4;
    G.shot.peds = 1.6;
    populateTraffic(G, 20);
    populatePedestrians(G, 60);
    clearArea(G, 812, 1600, 60);
    carAt(G, 'marlin', 837, 1470, Math.PI / 2, 150, '#e2374d', 0);
    carAt(G, 'pico', 863, 1790, -Math.PI / 2, 140, '#36c9e0', 0);
    carAt(G, 'harborbus', 889, 1545, -Math.PI / 2, 110, '#ff8fb3', 0);
    carAt(G, 'tortuga', 1010, 1713, 0, 130, '#f4f1e8', 0);
    const cab = createVehicle(G, 'solcab', 813, 1650, Math.PI / 2);
    cab.parked = true;
    G.pelicans[0] = { x: 742, y: 1640, id: 0 };
    G.pelicansFound = [3, 7];
    for (const [x, y, a] of [[770, 1590, 2], [760, 1668, -1], [792, 1560, 1.6], [730, 1610, 0.3], [700, 1660, 2.4], [765, 1700, 0], [640, 1705, 3], [560, 1690, 0.2]]) {
      const b = createPerson(G, x, y);
      b.state = 'idle';
      b.angle = a;
      b.idleT = 99;
    }
    notify(G, 'Golden pelican 2 of 20', '#ffd23f', '✦');
    notify(G, 'Juno Tide has work for you at Tidewater Records.', '#ff7ad9', 'J');
    G.zoneName = { text: 'Coral Strand', sub: 'Pastel hotels and the boardwalk', color: '#ff8fb3', t: 0.6 };
    return { cam: [770, 1662, 1.75], steps: 30, keys: [], aim: [900, 1700] };
  },

  /** Mission "Harbor Lights": a night firefight with the Neon Eels on the Port Calypso quay. */
  docks(G) {
    const p = G.player;
    G.clock = 21.4;
    setProgress(G, 5, 6120, 1500);
    p.weapons = { fists: Infinity, pistol: 40, smg: 96, shotgun: 21 };
    p.weapon = 'smg';
    p.armor = 45;
    p.hp = 68;
    p.x = 3120;
    p.y = QUAY_Y0 + 52;
    populateTraffic(G, 10);
    clearArea(G, 3200, QUAY_Y0 + 40, 260);
    jumpToStep(G, missionById('harbor_lights'), 1, true);
    for (const e of G.people.filter((q) => q.tag === 'yard').slice(0, 3)) {
      e.dead = true;
      e.hp = 0;
      e.downT = 4;
    }
    for (const e of G.people) if (e.tag === 'yard' && !e.dead) e.alert = 9;
    const truck = createVehicle(G, 'mule', 3262, QUAY_Y0 + 36, 0.5, '#12e0c0');
    truck.hp = 0;
    truck.fire = 0.42;
    spawnPersonalCar(G, 3060, QUAY_Y0 + 80, -0.4);
    setHeat(G, 2);
    pursuer(G, 'interceptor', 3020, QUAY_Y0 - 30, 0.1, 120);
    G.subtitle = { who: 'mako', text: 'The ledger is under crane three. Do not shoot the ledger!', t: 1, life: 99 };
    return { cam: [3205, QUAY_Y0 + 70, 1.62], steps: 46, keys: [], aim: [3250, QUAY_Y0 + 70], fire: true };
  },

  /** The start screen over the city at dusk. */
  title(G) {
    G.clock = 18.7;
    G.mode = 'title';
    populateTraffic(G, 24);
    populatePedestrians(G, 50);
    carAt(G, 'marlin', 1010, 1713, 0, 160, '#e2374d', 0);
    carAt(G, 'solcab', 1190, 1739, 0, 150, null, 0);
    carAt(G, 'tortuga', 1290, 1687, Math.PI, 150, '#36c9e0', 0);
    carAt(G, 'harborbus', 1130, 1661, Math.PI, 120, '#ff8fb3', 0);
    carAt(G, 'brava', 863, 1560, -Math.PI / 2, 140, '#ff7a45', 0);
    return { cam: [1010, 1695, 1.12], steps: 60, title: true, saveInfo: 'Saved game  ·  Mission 4: Bad Reception  ·  $2,350  ·  Day 3' };
  },

  /** Not a submitted screenshot: the first moments of a new game outside the motel. */
  start(G) {
    const home = G.city.places.safehouse;
    spawnPersonalCar(G, home.x, home.y - 46, Math.PI / 2);
    populateTraffic(G, 14);
    populatePedestrians(G, 26);
    notify(G, 'Follow the T on the map to Tía at Bravo Motors.', '#ffd23f', 'T');
    return { cam: [0, 0, 1.75], track: true, steps: 90, keys: [] };
  },

  /** Not a submitted screenshot: a conversation, to check the dialogue box. */
  talk(G) {
    const at = G.city.places.garage;
    G.player.x = at.x;
    G.player.y = at.y;
    G.clock = 17.6;
    populateTraffic(G, 14);
    populatePedestrians(G, 30);
    jumpToStep(G, MISSIONS[0], 0, true);
    G.dialogue.t = 9;
    return { cam: [at.x, at.y, 1.9], steps: 2 };
  },

  /** Not a submitted screenshot: a shop counter. */
  shop(G) {
    const s = shopPoints(G).find((q) => q.id === 'gunshop');
    G.player.x = s.x;
    G.player.y = s.y;
    setProgress(G, 5, 3200, 1500);
    populatePedestrians(G, 20);
    return { cam: [s.x, s.y, 1.8], steps: 2, after: () => openShop(G, s) };
  },

  /** Not a submitted screenshot: the pause menu with the city map. */
  pause(G) {
    setProgress(G, 3, 2350, 700);
    populateTraffic(G, 14);
    return { cam: [G.player.x, G.player.y, 1.6], steps: 2, after: () => { G.mode = 'pause'; G.menu = { screen: 'pause', page: 'main', sel: 0, sub: 0, t: 0 }; } };
  },
};
