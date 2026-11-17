// The Palm Harbor Police Department's response: patrol cars that hunt the player through the
// road graph and ram, officers who get out to arrest or shoot, armoured vans and roadblocks at
// three stars, and standing down when the heat is lost.
import { clamp } from '../core/math.js';
import { hasLineOfSight } from '../city/collision.js';
import { nearestNode, findPath } from '../city/roads.js';
import { cam, viewRect } from '../render/camera.js';
import { createVehicle, stepVehicle, vehicleAt } from '../vehicles/physics.js';
import { steerToward, obstacleAhead, unstick } from '../vehicles/driver.js';
import { joinTraffic } from '../vehicles/traffic.js';
import { createPerson, movePerson, LOOKS } from '../characters/people.js';
import { fireWeapon, WEAPONS } from '../combat/weapons.js';
import { say } from '../game/state.js';
import { sfx } from '../audio/sound.js';

/** Patrol cars in pursuit at each star count. */
const UNITS = [0, 2, 3, 4, 5, 6];
const BARKS = ['Driver, pull over!', 'Suspect is heading through {zone}!', 'All units, converge!', 'Stop the vehicle. Now!', 'Dispatch, we need backup!'];

function spawnPursuer(G) {
  const p = G.player;
  const view = viewRect(120);
  const nodes = G.city.roads.nodes;
  for (let tries = 0; tries < 10; tries++) {
    const n = G.rng.pick(nodes);
    const d = Math.hypot(n.x - p.x, n.y - p.y);
    if (d < 520 || d > 1150 || !n.links.length) continue;
    if (n.x > view.x0 && n.x < view.x1 && n.y > view.y0 && n.y < view.y1) continue;
    if (vehicleAt(G, n.x, n.y, 40)) continue;
    const heavy = G.wanted.level >= 3 && G.rng.chance(0.3);
    const v = createVehicle(G, heavy ? 'rhino' : 'interceptor', n.x, n.y, Math.atan2(p.y - n.y, p.x - n.x));
    v.driver = 'ai';
    v.siren = true;
    v.ai = { type: 'police', crew: heavy ? 3 : 2, pathT: 0, path: null, barkT: G.rng.range(3, 9), heavy };
    return v;
  }
  return null;
}

/** Officers step out of a stopped patrol car. */
function deployCrew(G, v) {
  for (let k = 0; k < v.ai.crew; k++) {
    const side = (k % 2 ? -1 : 1) * (v.spec.wid * 0.5 + 8);
    const o = createPerson(G, v.x + Math.sin(v.angle) * side - Math.cos(v.angle) * k * 6, v.y - Math.cos(v.angle) * side - Math.sin(v.angle) * k * 6, 'cop', v.ai.heavy ? LOOKS.swat : LOOKS.cop);
    o.weapon = v.ai.heavy ? 'rifle' : G.wanted.level >= 4 ? 'smg' : 'pistol';
    o.hp = o.maxHp = v.ai.heavy ? 120 : 70;
  }
  v.ai.crew = 0;
  sfx('door', { x: v.x, y: v.y });
}

function drivePursuit(G, v, dt) {
  const ai = v.ai;
  const p = G.player;
  const W = G.wanted;
  const tx0 = W.spotted ? p.x : W.lastX;
  const ty0 = W.spotted ? p.y : W.lastY;
  const d = Math.hypot(tx0 - v.x, ty0 - v.y);
  const pSpeed = Math.hypot(p.vx, p.vy);
  let tx = tx0;
  let ty = ty0;
  let want = v.spec.top * 0.95;
  const direct = d < 380 && hasLineOfSight(G.city, v.x, v.y, tx0, ty0);
  if (direct) {
    const lead = clamp(d / 420, 0, 0.6);
    tx += p.vx * lead;
    ty += p.vy * lead;
    if (d < 110 && pSpeed < 70) {
      want = 0;
      if (ai.crew > 0 && Math.abs(v.speed) < 40) deployCrew(G, v);
    }
  } else {
    ai.pathT -= dt;
    if (ai.pathT <= 0 || !ai.path) {
      ai.pathT = 1;
      ai.path = findPath(G.city.roads, nearestNode(G.city.roads, v.x, v.y).id, nearestNode(G.city.roads, tx0, ty0).id);
    }
    const nodes = G.city.roads.nodes;
    let k = 0;
    if (ai.path.length > 1 && Math.hypot(nodes[ai.path[0]].x - v.x, nodes[ai.path[0]].y - v.y) < 90) k = 1;
    if (ai.path.length > k) {
      tx = nodes[ai.path[k]].x;
      ty = nodes[ai.path[k]].y;
    }
    want = 330;
  }
  const gap = obstacleAhead(G, v, 50, p.vehicle ?? p);
  if (gap < 30 && !direct) want = Math.min(want, 120);
  let ctl = steerToward(v, tx, ty, want);
  if (want > 0) ctl = unstick(v, ctl, dt);
  stepVehicle(G, v, ctl, dt);
  ai.barkT -= dt;
  if (ai.barkT <= 0 && direct && d < 300) {
    ai.barkT = G.rng.range(9, 18);
    say(G, 'PHPD', G.rng.pick(BARKS).replace('{zone}', G.zoneNow ?? 'the city'), 2.6);
  }
}

/** A roadblock: two patrol cars parked across the road ahead of the player, with officers behind them. */
function placeRoadblock(G) {
  const p = G.player;
  const speed = Math.hypot(p.vx, p.vy);
  if (!p.vehicle || speed < 120) return false;
  const ax = p.x + (p.vx / speed) * 700;
  const ay = p.y + (p.vy / speed) * 700;
  const node = nearestNode(G.city.roads, ax, ay);
  const view = viewRect(100);
  if (node.x > view.x0 && node.x < view.x1 && node.y > view.y0 && node.y < view.y1) return false;
  const horiz = Math.abs(p.vx) > Math.abs(p.vy);
  const sign = horiz ? Math.sign(node.x - p.x) : Math.sign(node.y - p.y);
  const half = horiz ? node.hy : node.hx;
  for (const off of [-0.5, 0.5]) {
    const x = horiz ? node.x - sign * (node.hx + 30) : node.x + off * half * 1.3;
    const y = horiz ? node.y + off * half * 1.3 : node.y - sign * (node.hy + 30);
    if (vehicleAt(G, x, y, 30)) continue;
    const v = createVehicle(G, 'interceptor', x, y, (horiz ? Math.PI / 2 : 0) + off * 0.5);
    v.driver = 'ai';
    v.siren = true;
    v.ai = { type: 'roadblock', crew: 1, life: 40 };
    deployCrew(G, v);
  }
  return true;
}

/** Runs every police vehicle and decides how many should be after the player. */
export function updatePolice(G, dt) {
  const W = G.wanted;
  let pursuers = 0;
  for (const v of G.vehicles) {
    const ai = v.ai;
    if (!ai) continue;
    if (ai.type === 'police') {
      if (W.level === 0) {
        v.siren = false;
        joinTraffic(G, v);
        continue;
      }
      pursuers++;
      drivePursuit(G, v, dt);
    } else if (ai.type === 'roadblock') {
      ai.life -= dt;
      stepVehicle(G, v, { throttle: 0, steer: 0, handbrake: true }, dt);
      if (W.level === 0 || ai.life < 0) {
        v.siren = false;
        joinTraffic(G, v);
      }
    } else if (ai.type === 'traffic' && v.spec.police && W.level > 0 && W.spotted && Math.hypot(v.x - G.player.x, v.y - G.player.y) < 500) {
      v.ai = { type: 'police', crew: 2, pathT: 0, path: null, barkT: 2 };
      v.siren = true;
    }
  }
  if (W.level === 0) return;
  W.spawnT = (W.spawnT ?? 0) - dt;
  if (pursuers < UNITS[W.level] * (G.shot ? 0 : 1) && W.spawnT <= 0) {
    W.spawnT = 2.2 - W.level * 0.25;
    spawnPursuer(G);
  }
  W.blockT = (W.blockT ?? 10) - dt;
  if (W.level >= 3 && W.blockT <= 0 && !G.shot) W.blockT = placeRoadblock(G) ? 16 : 3;
}

/** One officer on foot: closes in, arrests at one star, opens fire from two. */
export function updateOfficer(G, o, dt) {
  const W = G.wanted;
  const p = G.player;
  o.fireT -= dt;
  if (W.level === 0 && !(o.alert > 0)) {
    // Stand down and walk off.
    o.keep = false;
    movePerson(G, o, o.x - p.x, o.y - p.y, 30, dt);
    return;
  }
  if (o.alert > 0) o.alert -= dt;
  const dx = p.x - o.x;
  const dy = p.y - o.y;
  const d = Math.hypot(dx, dy);
  const aim = Math.atan2(dy, dx);
  const sees = d < 420 && hasLineOfSight(G.city, o.x, o.y, p.x, p.y);
  const lethal = W.level >= 2 || o.alert > 0;
  const hold = lethal ? 150 : 14;
  if (d > hold || !sees) movePerson(G, o, dx, dy, d > 220 ? 128 : 100, dt, sees ? aim : null);
  else movePerson(G, o, -dy * (o.id % 2 ? 1 : -1), dx * (o.id % 2 ? 1 : -1), lethal ? 22 : 0, dt, aim);
  if (lethal && sees && d < 330 && o.fireT <= 0 && !p.dead) {
    const w = WEAPONS[o.weapon ?? 'pistol'];
    o.fireT = w.rate * (w.auto ? 2.2 : 3) + G.rng.range(0.1, 0.7);
    fireWeapon(G, o, o.weapon ?? 'pistol', aim, 2.6);
  }
  // Arrest: an officer at arm's length of a player who is on foot or stopped.
  const slow = Math.hypot(p.vx, p.vy) < 40;
  if (d < 26 && slow && !p.dead && W.level > 0 && W.level <= 2) {
    W.bustT += dt * 2;
    if (W.bustT > 1.5) G.onPlayerDown?.(true);
  }
}

/** Called once a step: the arrest meter drains when no officer is holding the player. */
export function coolArrest(G, dt) {
  G.wanted.bustT = Math.max(0, G.wanted.bustT - dt);
}

/** Puts a patrol car in pursuit at a point (screenshot scenes and missions). */
export function spawnPatrolAt(G, x, y, angle, model = 'interceptor') {
  const v = createVehicle(G, model, x, y, angle);
  v.driver = 'ai';
  v.siren = true;
  v.ai = { type: 'police', crew: 2, pathT: 0, path: null, barkT: 4, heavy: model === 'rhino' };
  return v;
}

export const policeNear = (G, radius) => G.vehicles.some((v) => v.spec.police && v.driver === 'ai' && Math.hypot(v.x - cam.x, v.y - cam.y) < radius);
