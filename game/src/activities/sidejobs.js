// Side work between missions: taxi fares in a Sol Cab, parcel rounds in a Kite Van, the Sunset
// Sprint street race against the clock, and the twenty golden pelicans hidden around town.
import { tapped } from '../core/input.js';
import { createRandom } from '../core/random.js';
import { V_ROADS, H_ROADS, districtAt } from '../city/layout.js';
import { surfaceAt } from '../city/terrain.js';
import { pushOutOfStatics } from '../city/collision.js';
import { notify, addMoney, addXp, say } from '../game/state.js';
import { sfx } from '../audio/sound.js';

const FARE_LINES = ['The Gilded Pelican, and step on it.', 'Anywhere with air conditioning.', 'My ex is behind us. Drive.', 'Take the scenic route. Kidding. Hurry.', 'I am late for a very legal meeting.'];
const SPRINT = [[850, 1000], [850, 1700], [1550, 1700], [2600, 1700], [2600, 650], [1550, 650], [850, 650], [850, 480]];
export const SPRINT_START = { x: 850, y: 470, name: 'Sunset Sprint', letter: 'R', color: '#ff7ad9' };
const MEDALS = [[62, 'Gold', 2000, '#ffd23f'], [76, 'Silver', 1000, '#dfe6ec'], [95, 'Bronze', 500, '#e09a5a']];

/** A kerbside point on a random block, between `min` and `max` away from the player. */
function kerbPoint(G, min, max) {
  const p = G.player;
  for (let k = 0; k < 40; k++) {
    const i = G.rng.int(0, V_ROADS.length - 1);
    const j = G.rng.int(0, H_ROADS.length - 2);
    if (j === 7) continue;
    const x = V_ROADS[i].x + G.rng.sign() * 13;
    const y = H_ROADS[j].y + G.rng.range(80, 270);
    const d = Math.hypot(x - p.x, y - p.y);
    if (d > min && d < max) return { x, y };
  }
  return { x: V_ROADS[5].x + 13, y: H_ROADS[4].y + 120 };
}

function startTaxi(G) {
  const at = kerbPoint(G, 300, 800);
  G.job = { kind: 'taxi', title: 'SOL CAB FARES', stage: 'pickup', x: at.x, y: at.y, streak: 0, timer: 0, text: 'Pick up the ~fare~' };
  notify(G, 'On duty. Find your fare.', '#ffcf33', '🚕');
}

function startParcels(G) {
  const drops = [];
  for (let k = 0; k < 5; k++) drops.push(kerbPoint(G, 350 + k * 150, 800 + k * 300));
  G.job = { kind: 'parcels', title: 'KITE EXPRESS', drops, left: drops.length, timer: 150, text: 'Deliver the ~parcels~' };
  notify(G, 'Five parcels on board. Clock is running.', '#f4d35e', '📦');
}

function startSprint(G) {
  G.job = { kind: 'sprint', title: 'SUNSET SPRINT', leg: 0, clock: 0, text: 'Race through the ~checkpoints~' };
  G.story.banner = { title: 'SUNSET SPRINT', sub: 'Gold under 1:02', color: '#ff7ad9', t: 0, life: 2.5 };
  sfx('mission');
}

export function endJob(G, why) {
  if (!G.job) return;
  if (why) notify(G, why, '#cfd6e0');
  if (G.player.vehicle) G.player.vehicle.fare = false;
  G.job = null;
}

function updateTaxi(G, J, dt) {
  const p = G.player;
  const v = p.vehicle;
  if (!v || !v.spec.taxi) return endJob(G, 'Off duty.');
  const near = Math.hypot(J.x - p.x, J.y - p.y) < 34 && Math.abs(v.speed) < 50;
  if (J.stage === 'pickup') {
    if (!near) return;
    const dest = kerbPoint(G, 600, 1500);
    const far = Math.hypot(dest.x - p.x, dest.y - p.y);
    Object.assign(J, { stage: 'drop', x: dest.x, y: dest.y, timer: 14 + far / 22, pay: Math.round(far * 0.11 / 5) * 5 + 20, text: `Drive the fare to ~${districtAt(dest.x, dest.y).name}~` });
    v.fare = true;
    say(G, 'Fare', G.rng.pick(FARE_LINES), 3.5);
    sfx('door');
  } else {
    J.timer -= dt;
    if (J.timer <= 0) {
      say(G, 'Fare', 'Forget it. I will walk!', 3);
      return endJob(G, 'The fare got out. Streak lost.');
    }
    if (!near) return;
    const tip = Math.round(J.timer * 2);
    J.streak++;
    addMoney(G, Math.round((J.pay + tip) * (1 + J.streak * 0.1)));
    addXp(G, 20);
    G.stats.fares++;
    v.fare = false;
    sfx('cash');
    const at = kerbPoint(G, 300, 800);
    Object.assign(J, { stage: 'pickup', x: at.x, y: at.y, timer: 0, text: `Pick up the next ~fare~  (streak ${J.streak})` });
  }
}

function updateParcels(G, J, dt) {
  const p = G.player;
  if (p.vehicle?.model !== 'kitevan') return endJob(G, 'Round abandoned.');
  J.timer -= dt;
  if (J.timer <= 0) return endJob(G, 'Out of time. Auntie Kite is disappointed.');
  for (const d of J.drops) {
    if (d.done || Math.hypot(d.x - p.x, d.y - p.y) > 30) continue;
    d.done = true;
    J.left--;
    J.timer += 12;
    addMoney(G, 90);
    G.stats.parcels++;
    sfx('pickup');
  }
  J.text = `Deliver the ~parcels~  (${J.drops.length - J.left}/${J.drops.length})`;
  if (J.left <= 0) {
    addMoney(G, 250 + Math.round(J.timer) * 3);
    addXp(G, 60);
    notify(G, 'Round complete. Time bonus paid.', '#8dff9c', '✓');
    G.job = null;
  }
}

function updateSprint(G, J, dt) {
  const p = G.player;
  if (!p.vehicle) return endJob(G, 'Race abandoned.');
  J.clock += dt;
  J.timer = J.clock;
  const cp = SPRINT[J.leg];
  if (Math.hypot(cp[0] - p.x, cp[1] - p.y) < 62) {
    J.leg++;
    sfx('pickup');
    if (J.leg >= SPRINT.length) {
      const medal = MEDALS.find((m) => J.clock <= m[0]);
      if (!G.stats.bestSprint || J.clock < G.stats.bestSprint) G.stats.bestSprint = J.clock;
      if (medal) {
        addMoney(G, medal[2]);
        addXp(G, 80);
        G.story.banner = { title: `${medal[1].toUpperCase()} MEDAL`, sub: `Sunset Sprint in ${J.clock.toFixed(1)}s  +$${medal[2]}`, color: medal[3], t: 0, life: 4, big: true };
        sfx('passed');
      } else notify(G, `Finished in ${J.clock.toFixed(1)}s. No medal.`, '#cfd6e0');
      G.job = null;
      return;
    }
  }
  if (J.clock > 150) endJob(G, 'Too slow. Race over.');
}

/** Starts and runs side jobs. T starts the job that fits the vehicle; the race starts at its marker. */
export function updateSideJobs(G, dt) {
  const p = G.player;
  const J = G.job;
  if (J) {
    if (tapped('KeyT')) return endJob(G, 'Job ended.');
    if (J.kind === 'taxi') updateTaxi(G, J, dt);
    else if (J.kind === 'parcels') updateParcels(G, J, dt);
    else updateSprint(G, J, dt);
    return;
  }
  if (G.story.active || !p.vehicle) return;
  if (tapped('KeyT')) {
    if (p.vehicle.spec.taxi) startTaxi(G);
    else if (p.vehicle.model === 'kitevan') startParcels(G);
  }
  const d = Math.hypot(SPRINT_START.x - p.x, SPRINT_START.y - p.y);
  if (d > 90) G.sprintArmed = true;
  if (d < 30 && G.sprintArmed && G.wanted.level === 0) {
    G.sprintArmed = false;
    startSprint(G);
  }
}

/** What the vehicle the player sits in can do, as a prompt, or null. */
export function jobPrompt(G) {
  const v = G.player.vehicle;
  if (!v || G.job || G.story.active) return null;
  if (v.spec.taxi) return 'Press T to take taxi fares';
  if (v.model === 'kitevan') return 'Press T to start a parcel round';
  return null;
}

/** The points the current job shows on the map and in the world. */
export function jobTargets(G) {
  const J = G.job;
  if (!J) return [];
  if (J.kind === 'taxi') return [{ x: J.x, y: J.y, color: J.stage === 'pickup' ? '#ffcf33' : '#7dff9a', label: J.stage === 'pickup' ? 'Fare' : 'Drop off', kind: 'goal', r: 30 }];
  if (J.kind === 'parcels') return J.drops.filter((d) => !d.done).map((d) => ({ x: d.x, y: d.y, color: '#f4d35e', label: 'Parcel', kind: 'pickup', r: 24 }));
  const out = [{ x: SPRINT[J.leg][0], y: SPRINT[J.leg][1], color: '#ff7ad9', label: J.leg === SPRINT.length - 1 ? 'Finish' : `${J.leg + 1}/${SPRINT.length}`, kind: 'goal', r: 56 }];
  if (SPRINT[J.leg + 1]) out.push({ x: SPRINT[J.leg + 1][0], y: SPRINT[J.leg + 1][1], color: '#8a5fa0', label: '', kind: 'next', r: 40 });
  return out;
}

/** Hides the golden pelicans: the same twenty spots for a given city. */
export function placePelicans(G) {
  const rng = createRandom(G.seed * 977 + 5);
  const spots = [];
  for (let tries = 0; tries < 900 && spots.length < 20; tries++) {
    const x = rng.range(620, 5350);
    const y = rng.range(330, 4040);
    const surface = surfaceAt(G.city, x, y);
    if (surface === 'road' || surface === 'water') continue;
    const probe = { x, y };
    if (pushOutOfStatics(G.city, probe, 14)) continue;
    if (spots.some((s) => Math.hypot(s.x - x, s.y - y) < 500)) continue;
    spots.push({ x, y, id: spots.length });
  }
  G.pelicans = spots;
}

export function updatePelicans(G) {
  const p = G.player;
  if (p.vehicle) return;
  for (const s of G.pelicans) {
    if (G.pelicansFound.includes(s.id) || Math.hypot(s.x - p.x, s.y - p.y) > 16) continue;
    G.pelicansFound.push(s.id);
    G.stats.pelicans = G.pelicansFound.length;
    addMoney(G, 250, s.x, s.y);
    addXp(G, 40);
    sfx('passed');
    notify(G, `Golden pelican ${G.pelicansFound.length} of ${G.pelicans.length}`, '#ffd23f', '✦');
    if (G.pelicansFound.length === G.pelicans.length) {
      addMoney(G, 10000);
      G.story.banner = { title: 'FLOCK COMPLETE', sub: 'All golden pelicans found  +$10,000', color: '#ffd23f', t: 0, life: 5, big: true };
    }
  }
}
