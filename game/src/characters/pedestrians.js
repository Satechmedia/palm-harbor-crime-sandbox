// Pedestrians: they stroll the sidewalks block by block, cross at corners, sunbathe on the
// beach, run from gunfire and reckless cars, cower, and are recycled far from the camera.
import { MAX_PEDESTRIANS, DESPAWN_RADIUS } from '../core/config.js';
import { coastX, SAND_X1, RIVER_Y0 } from '../city/layout.js';
import { cam, viewRect } from '../render/camera.js';
import { createPerson, movePerson } from './people.js';
import { updateOfficer } from '../ai/police.js';
import { updateGangster } from '../ai/gangs.js';

const cornerOf = (loop, k) => [loop.x + (k === 1 || k === 2 ? loop.w : 0), loop.y + (k >= 2 ? loop.h : 0)];

function indexLoops(city) {
  for (const loop of city.loops) loop.block.loop = loop;
  city.loopsReady = true;
}

/** Puts a stroller on the sidewalk of a block near the camera. */
export function spawnPedestrian(G, allowVisible = false) {
  const city = G.city;
  if (!city.loopsReady) indexLoops(city);
  const view = viewRect(40);
  for (let tries = 0; tries < 8; tries++) {
    // One in six near the shore is a beachgoer standing on the sand.
    if (cam.x < 1500 && cam.y < RIVER_Y0 && G.rng.chance(0.17)) {
      const y = cam.y + G.rng.range(-600, 600);
      const x = G.rng.range(coastX(y) + 20, SAND_X1 - 10);
      const visible = x > view.x0 && x < view.x1 && y > view.y0 && y < view.y1;
      if ((visible && !allowVisible) || y < 300 || y > RIVER_Y0 - 30) continue;
      const p = createPerson(G, x, y);
      p.state = 'idle';
      p.look.pants = p.look.shirt;
      p.idleT = G.rng.range(6, 30);
      return p;
    }
    const loop = G.rng.pick(city.loops);
    if (Math.abs(loop.x + loop.w / 2 - cam.x) > 1000 || Math.abs(loop.y + loop.h / 2 - cam.y) > 900) continue;
    const k = G.rng.int(0, 3);
    const a = cornerOf(loop, k);
    const b = cornerOf(loop, (k + 1) % 4);
    const t = G.rng();
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t;
    const visible = x > view.x0 && x < view.x1 && y > view.y0 && y < view.y1;
    if (visible && !allowVisible) continue;
    const p = createPerson(G, x, y);
    p.loop = loop;
    p.turn = G.rng.sign();
    p.corner = p.turn > 0 ? (k + 1) % 4 : k;
    p.side = G.rng.range(-4, 4);
    return p;
  }
  return null;
}

function nextCorner(G, p) {
  const loop = p.loop;
  const from = cornerOf(loop, (p.corner - p.turn + 4) % 4);
  const at = cornerOf(loop, p.corner);
  // Sometimes carry straight on across the street to the next block.
  if (G.rng.chance(0.3)) {
    const di = Math.sign(Math.round(at[0] - from[0]));
    const dj = Math.sign(Math.round(at[1] - from[1]));
    const next = G.city.grid[loop.block.i + di]?.[loop.block.j + dj]?.loop;
    if (next) {
      let best = 0;
      let bestD = Infinity;
      for (let k = 0; k < 4; k++) {
        const c = cornerOf(next, k);
        const d = Math.hypot(c[0] - at[0], c[1] - at[1]);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      p.loop = next;
      p.corner = best;
      return;
    }
  }
  p.corner = (p.corner + p.turn + 4) % 4;
}

function updateCivilian(G, p, dt) {
  if (p.scareT > 0) {
    p.scareT -= dt;
    if (p.state === 'cower') {
      movePerson(G, p, 0, 0, 0, dt);
      p.walkT += dt * 14;
    } else movePerson(G, p, p.x - p.fearX, p.y - p.fearY, 112, dt);
    if (p.scareT <= 0) p.state = p.loop ? 'walk' : 'idle';
    return;
  }
  if (p.state === 'idle' || !p.loop) {
    p.idleT -= dt;
    if (p.idleT < 0) {
      p.idleT = G.rng.range(5, 20);
      p.driftX = G.rng.range(-1, 1);
      p.driftY = G.rng.range(-1, 1);
      p.driftT = G.rng.range(0.5, 2.5);
    }
    p.driftT = (p.driftT ?? 0) - dt;
    if (p.driftT > 0) movePerson(G, p, p.driftX, p.driftY, 22, dt);
    else movePerson(G, p, 0, 0, 0, dt);
    return;
  }
  const c = cornerOf(p.loop, p.corner);
  const dx = c[0] + p.side - p.x;
  const dy = c[1] + p.side - p.y;
  if (Math.hypot(dx, dy) < 9) nextCorner(G, p);
  // Wait at the kerb for a car about to pass.
  let wait = false;
  for (const v of G.vehicles) {
    if (Math.abs(v.speed) < 50 || Math.abs(v.x - p.x) > 70 || Math.abs(v.y - p.y) > 70) continue;
    const ahead = (p.x - v.x) * Math.cos(v.angle) + (p.y - v.y) * Math.sin(v.angle);
    const side = Math.abs(-(p.x - v.x) * Math.sin(v.angle) + (p.y - v.y) * Math.cos(v.angle));
    if (ahead > 0 && ahead < 70 && side < 30 && side > 11) wait = true;
  }
  movePerson(G, p, dx, dy, wait ? 0 : p.pace, dt);
}

/** Sends every civilian near a point running (some freeze and cower instead). */
export function scarePeople(G, x, y, radius, seconds = 7) {
  for (const p of G.people) {
    if (p.dead || p.role !== 'civ' || p.vehicle) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d > radius) continue;
    if (p.scareT <= 0) p.state = G.rng.chance(0.2) && d > 60 ? 'cower' : 'flee';
    p.scareT = seconds + G.rng.range(0, 3);
    p.fearX = x;
    p.fearY = y;
  }
}

/** Runs every person who is not the player: civilians here, police and gangs in their own files. */
export function updatePeople(G, dt) {
  const want = Math.round(MAX_PEDESTRIANS * (G.clock > 23 || G.clock < 5 ? 0.5 : 1) * (G.shot?.peds ?? 1));
  let civilians = 0;
  for (let i = G.people.length - 1; i >= 0; i--) {
    const p = G.people[i];
    if (p.hitT > 0) p.hitT -= dt;
    if (p.role === 'civ' && !p.dead) civilians++;
    const d = Math.hypot(p.x - cam.x, p.y - cam.y);
    if (p.dead) {
      p.downT += dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if ((p.downT > 30 && !p.tag) || d > DESPAWN_RADIUS) G.people.splice(i, 1);
      continue;
    }
    if (d > DESPAWN_RADIUS * 0.8 && !p.tag && !p.keep) {
      G.people.splice(i, 1);
      continue;
    }
    if (p.vehicle) continue;
    if (p.role === 'civ') updateCivilian(G, p, dt);
    else if (p.role === 'cop') updateOfficer(G, p, dt);
    else updateGangster(G, p, dt);
  }
  if (civilians < want && G.frame % 5 === 0) spawnPedestrian(G);
}

export function populatePedestrians(G, count) {
  for (let k = 0; k < count * 4 && count > 0; k++) if (spawnPedestrian(G, true)) count--;
}
