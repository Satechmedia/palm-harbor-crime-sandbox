// Civilian traffic: cars appear on the lanes around the player, follow them, stop at red
// lights and behind one another, pick a turn at every junction, panic at gunfire and are
// recycled when far away. Also fills the car parks with parked cars as the player comes near.
import { MAX_TRAFFIC, DESPAWN_RADIUS } from '../core/config.js';
import { clamp } from '../core/math.js';
import { laneLine, signalState } from '../city/roads.js';
import { districtAt } from '../city/layout.js';
import { viewRect, cam } from '../render/camera.js';
import { VEHICLES, TRAFFIC_MIX } from './catalog.js';
import { createVehicle, stepVehicle, vehicleAt } from './physics.js';
import { steerToward, obstacleAhead, unstick } from './driver.js';
import { sfx } from '../audio/sound.js';

function enterSegment(v, seg, dir, lane) {
  const line = laneLine(seg, dir, lane);
  v.ai.seg = seg;
  v.ai.dir = dir;
  v.ai.lane = Math.min(lane, seg.lanes - 1);
  v.ai.line = line;
  v.ai.len = Math.abs(line.ex - line.sx) + Math.abs(line.ey - line.sy);
}

/** Puts one civilian car on a random lane near the player. Returns it, or null when no room was found. */
export function spawnTrafficCar(G, allowVisible = false, model = null) {
  const segs = G.city.roads.segs;
  const view = viewRect(70);
  for (let tries = 0; tries < 8; tries++) {
    const seg = G.rng.pick(segs);
    const dir = G.rng.sign();
    const lane = G.rng.int(0, seg.lanes - 1);
    const line = laneLine(seg, dir, lane);
    const len = Math.abs(line.ex - line.sx) + Math.abs(line.ey - line.sy);
    const t = G.rng.range(10, Math.max(12, len - 30));
    const x = line.sx + line.dx * t;
    const y = line.sy + line.dy * t;
    const d = Math.hypot(x - cam.x, y - cam.y);
    if (d > 1250) continue;
    const visible = x > view.x0 && x < view.x1 && y > view.y0 && y < view.y1;
    if (visible && !allowVisible) continue;
    if (vehicleAt(G, x, y, 34)) continue;
    const mix = TRAFFIC_MIX[districtAt(x, y).id];
    const v = createVehicle(G, model ?? G.rng.pick(mix), x, y, Math.atan2(line.dy, line.dx));
    v.driver = 'ai';
    v.ai = { type: 'traffic', cruise: G.rng.range(150, 200), panicT: 0, waitT: 0 };
    enterSegment(v, seg, dir, lane);
    v.vx = line.dx * v.ai.cruise * 0.8;
    v.vy = line.dy * v.ai.cruise * 0.8;
    v.speed = v.ai.cruise * 0.8;
    return v;
  }
  return null;
}

/** Hands a car (a patrol car standing down, say) to the traffic system on the nearest lane. */
export function joinTraffic(G, v) {
  let best = null;
  let bestD = Infinity;
  for (const seg of G.city.roads.segs) {
    const cx = clamp(v.x, Math.min(seg.x1, seg.x2), Math.max(seg.x1, seg.x2));
    const cy = clamp(v.y, Math.min(seg.y1, seg.y2), Math.max(seg.y1, seg.y2));
    const d = Math.hypot(cx - v.x, cy - v.y);
    if (d < bestD) {
      bestD = d;
      best = seg;
    }
  }
  const heading = best.horiz ? Math.cos(v.angle) : Math.sin(v.angle);
  v.ai = { type: 'traffic', cruise: 170, panicT: 0, waitT: 0 };
  v.keep = false;
  enterSegment(v, best, heading >= 0 ? 1 : -1, 0);
}

function chooseNextSegment(G, v) {
  const ai = v.ai;
  const node = G.city.roads.nodes[ai.dir > 0 ? ai.seg.b : ai.seg.a];
  const options = node.links.filter((l) => l.seg !== ai.seg);
  if (!options.length) {
    enterSegment(v, ai.seg, -ai.dir, ai.lane);
    return;
  }
  const weighted = [];
  for (const l of options) {
    const straight = l.seg.horiz === ai.seg.horiz;
    for (let k = 0; k < (straight ? 3 : 1); k++) weighted.push(l);
  }
  const link = G.rng.pick(weighted);
  ai.turning = link.seg.horiz !== ai.seg.horiz;
  enterSegment(v, link.seg, link.dir, ai.turning ? G.rng.int(0, link.seg.lanes - 1) : ai.lane);
}

/** Lane-following for one civilian car. */
export function driveTraffic(G, v, dt) {
  const ai = v.ai;
  let line = ai.line;
  let s = (v.x - line.sx) * line.dx + (v.y - line.sy) * line.dy;
  if (s > ai.len - 2) {
    chooseNextSegment(G, v);
    line = ai.line;
    s = (v.x - line.sx) * line.dx + (v.y - line.sy) * line.dy;
  }
  if (s > 20) ai.turning = false;
  const look = Math.max(s + 44 + Math.abs(v.speed) * 0.22, 16);
  const tx = line.sx + line.dx * look;
  const ty = line.sy + line.dy * look;
  ai.panicT = Math.max(0, ai.panicT - dt);
  let want = ai.panicT > 0 ? ai.cruise * 1.9 : ai.turning ? 95 : ai.cruise;
  const toEnd = ai.len - s;
  if (ai.panicT <= 0 && s > 0 && toEnd < 64 && toEnd > 3) {
    const node = G.city.roads.nodes[ai.dir > 0 ? ai.seg.b : ai.seg.a];
    const light = signalState(node, ai.seg.horiz, G.time);
    if (light === 'red' || (light === 'yellow' && toEnd > 30)) want = toEnd < 16 ? 0 : Math.min(want, toEnd * 2.2);
  }
  const gap = obstacleAhead(G, v, 30 + Math.abs(v.speed) * 0.5);
  if (gap < Infinity && ai.waitT < 3.5) {
    want = gap < 12 ? 0 : Math.min(want, gap * 2.4);
    if (gap < 12) {
      ai.waitT += dt;
      if (ai.waitT > 2.5 && !ai.honked && G.rng.chance(0.3)) {
        ai.honked = true;
        v.horn = 0.5;
        sfx('horn', { x: v.x, y: v.y, vol: 0.5 });
      }
    }
  } else if (gap === Infinity) {
    ai.waitT = Math.max(0, ai.waitT - dt * 3);
    ai.honked = false;
  } else if ((ai.waitT += dt) > 6) ai.waitT = 0;
  let ctl = steerToward(v, tx, ty, want);
  if (want > 0 && ai.panicT > 0) ctl = unstick(v, ctl, dt);
  stepVehicle(G, v, ctl, dt);
}

/** Gunfire or a crash nearby: drivers floor it and stop obeying the lights. */
export function panicTraffic(G, x, y, radius) {
  for (const v of G.vehicles) {
    if (v.ai?.type !== 'traffic') continue;
    if (Math.hypot(v.x - x, v.y - y) < radius) v.ai.panicT = 6;
  }
}

function prepareParking(G) {
  const models = ['pico', 'calypso', 'tortuga', 'mule', 'brava', 'marlin', 'calypso', 'pico', 'kitevan'];
  for (const spot of G.city.parking) {
    spot.active = G.rng.chance(spot.chance ?? 0.5);
    spot.model = spot.place === 'cabs' ? 'solcab' : spot.place === 'depot' ? 'kitevan' : spot.place === 'police' ? 'interceptor' : spot.place === 'coldstore' ? 'mule' : G.rng.pick(models);
    spot.car = null;
  }
  G.city.parkingReady = true;
}

function updateParking(G) {
  if (!G.city.parkingReady) prepareParking(G);
  const k0 = G.city.parkCursor = ((G.city.parkCursor ?? 0) + 24) % G.city.parking.length;
  for (let n = 0; n < 24; n++) {
    const spot = G.city.parking[(k0 + n) % G.city.parking.length];
    if (!spot.active) continue;
    const d = Math.hypot(spot.x - cam.x, spot.y - cam.y);
    if (!spot.car && d < 1150 && !vehicleAt(G, spot.x, spot.y, 16)) {
      const v = createVehicle(G, spot.model, spot.x, spot.y, spot.angle);
      v.parked = true;
      v.spot = spot;
      spot.car = v;
    }
  }
}

/** Keeps the streets around the camera busy and removes what has been left far behind. */
export function updateTraffic(G, dt) {
  updateParking(G);
  const night = G.clock > 22 || G.clock < 5.5;
  const want = Math.round(MAX_TRAFFIC * (night ? 0.7 : 1) * (G.shot?.traffic ?? 1));
  let moving = 0;
  for (const v of G.vehicles) if (v.ai?.type === 'traffic') moving++;
  if (moving < want && G.frame % 6 === 0) spawnTrafficCar(G);
  for (let i = G.vehicles.length - 1; i >= 0; i--) {
    const v = G.vehicles[i];
    if (v.driver === G.player || v.tag || v.personal || v.keep) continue;
    const d = Math.hypot(v.x - cam.x, v.y - cam.y);
    const gone = d > DESPAWN_RADIUS || (v.wreck && (v.wreckT += dt) > 45 && d > 700);
    if (!gone) continue;
    if (v.spot) {
      v.spot.car = null;
      if (!v.parked) v.spot.active = false;
    }
    G.vehicles.splice(i, 1);
  }
}

/** Fills the streets at once (a new game, a loaded save or a screenshot scene). */
export function populateTraffic(G, count) {
  for (let k = 0; k < count * 3 && count > 0; k++) if (spawnTrafficCar(G, true)) count--;
  for (let k = 0; k < G.city.parking.length / 24 + 1; k++) updateParking(G);
}

export const isCivilianCar = (v) => !VEHICLES[v.model].police;
