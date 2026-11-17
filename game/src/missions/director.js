// The mission director: offers the next story mission at its giver's door, plays its steps
// one by one, tracks objectives, timers and failure, pays out on success and cleans up after.
import { tapped } from '../core/input.js';
import { MISSIONS, CAST } from './story.js';
import { notify, addMoney, addXp, say } from '../game/state.js';
import { joinTraffic } from '../vehicles/traffic.js';
import { WEAPONS } from '../combat/weapons.js';
import { sfx } from '../audio/sound.js';

export const nextMission = (G) => MISSIONS[G.story.done.length] ?? null;
export const currentStep = (G) => (G.story.active ? G.story.active.steps[G.story.step] : null);

function pointOf(G, at) {
  if (typeof at === 'string') return G.city.places[at];
  return { x: at[0], y: at[1] };
}

const taggedVehicle = (G, tag) => G.vehicles.find((v) => v.tag === tag);
const living = (G, tag) => G.people.filter((p) => p.tag === tag && !p.dead);
const standing = (G, tag) => G.vehicles.filter((v) => v.tag === tag && !v.wreck);

function beginStep(G) {
  const S = G.story;
  const step = currentStep(G);
  S.stepT = 0;
  S.data = {};
  S.timer = step.timer ?? 0;
  G.wanted.cap = step.cap;
  step.setup?.(G, S);
  if (step.type === 'talk') G.dialogue = { lines: step.lines, i: 0, t: 0 };
  if (step.type === 'collect') {
    let pts = step.points;
    if (step.dropAt) {
      const c = taggedVehicle(G, step.dropAt) ?? G.player;
      pts = [];
      for (let k = 0; k < step.count; k++) pts.push([c.x + Math.cos(k * 1.7) * (34 + k * 9), c.y + Math.sin(k * 1.7) * (34 + k * 9)]);
    }
    S.data.points = pts.map((p) => ({ x: p[0], y: p[1], done: false }));
    S.data.left = pts.length;
  }
  if (step.type !== 'talk') sfx('objective');
}

export function startMission(G, mission) {
  const S = G.story;
  S.active = mission;
  S.step = 0;
  S.failed = null;
  S.banner = { title: mission.title.toUpperCase(), sub: `${CAST[mission.giver].name} · Mission ${MISSIONS.indexOf(mission) + 1} of ${MISSIONS.length}`, color: CAST[mission.giver].color, t: 0, life: 3.4 };
  G.job = null;
  sfx('mission');
  beginStep(G);
}

/** Puts the story at one step of a mission directly (the self-test and the screenshot scenes use this). */
export function jumpToStep(G, mission, index, withSetup = true) {
  const S = G.story;
  S.active = mission;
  S.step = index;
  S.failed = null;
  if (withSetup) beginStep(G);
  else {
    S.stepT = 0;
    S.data = {};
    S.timer = mission.steps[index].timer ?? 0;
  }
}

/** Removes what a mission put in the world once it ends either way. */
function cleanUp(G) {
  G.people = G.people.filter((p) => !p.tag);
  for (const v of G.vehicles) {
    if (!v.tag) continue;
    v.tag = null;
    if (v.driver === 'ai') joinTraffic(G, v);
  }
  G.wanted.cap = undefined;
  G.dialogue = null;
}

function completeMission(G) {
  const S = G.story;
  const m = S.active;
  S.done.push(m.id);
  S.active = null;
  G.stats.missions++;
  addMoney(G, m.reward);
  addXp(G, m.xp);
  if (m.gift) {
    const [id, ammo] = m.gift;
    G.player.weapons[id] = (G.player.weapons[id] ?? 0) + ammo;
    G.player.weapon = id;
    notify(G, `New weapon: ${WEAPONS[id].name}`, '#ffd23f', '✦');
  }
  S.banner = { title: 'JOB DONE', sub: `${m.title}  +$${m.reward.toLocaleString('en-US')}`, color: '#8dff9c', t: 0, life: 4.5, big: true };
  sfx('passed');
  cleanUp(G);
  S.armed = false;
  if (!nextMission(G)) {
    S.banner = { title: 'PALM HARBOR IS YOURS', sub: 'Story complete. The city stays open: jobs, races and pelicans await.', color: '#ffd23f', t: 0, life: 9, big: true };
  }
  G.onAutosave?.();
}

export function failMission(G, reason) {
  const S = G.story;
  if (!S.active) return;
  S.failed = { reason, t: 0, mission: S.active };
  S.banner = { title: 'JOB BLOWN', sub: reason, color: '#ff5d6c', t: 0, life: 4.5, big: true };
  S.active = null;
  S.armed = false;
  sfx('failed');
  cleanUp(G);
}

function nextStep(G) {
  const S = G.story;
  S.step++;
  if (S.step >= S.active.steps.length) completeMission(G);
  else beginStep(G);
}

/** Text of the current objective, with ~highlighted~ words and a running count where there is one. */
export function objectiveText(G) {
  const S = G.story;
  const step = currentStep(G);
  if (!step || step.type === 'talk') return null;
  const p = G.player;
  if (step.tag && (step.type === 'deliver' || step.type === 'collect' || (step.type === 'lose' && step.health)) && p.vehicle?.tag !== step.tag) return 'Get back in the ~vehicle~';
  let text = step.text;
  if (step.type === 'collect') text += `  (${S.data.points.length - S.data.left}/${S.data.points.length})`;
  if (step.type === 'kill') text += `  (${living(G, step.tag).length} left)`;
  if (step.type === 'destroy') text += `  (${standing(G, step.tag).length} left)`;
  return text;
}

/** Where the current objective is: the points the HUD, minimap and world markers show. */
export function objectiveTargets(G) {
  const S = G.story;
  const step = currentStep(G);
  const out = [];
  if (!step) {
    const m = nextMission(G);
    if (m && !G.job) {
      const at = G.city.places[m.place];
      out.push({ x: at.x, y: at.y, color: CAST[m.giver].color, letter: CAST[m.giver].letter, label: m.title, kind: 'giver', r: 20 });
    }
    return out;
  }
  const p = G.player;
  const needCar = step.tag && ['deliver', 'collect', 'enter', 'lose'].includes(step.type) && p.vehicle?.tag !== step.tag;
  if (needCar) {
    const v = taggedVehicle(G, step.tag);
    if (v) out.push({ x: v.x, y: v.y, color: '#5ad1ff', label: v.spec.name, kind: 'vehicle', r: 30, follow: true });
    if (step.type !== 'lose') return out;
  }
  if (step.type === 'goto' || step.type === 'deliver') {
    const at = pointOf(G, step.at);
    out.push({ x: at.x, y: at.y, color: '#ffd23f', label: '', kind: 'goal', r: step.r ?? 34 });
  } else if (step.type === 'collect') {
    for (const pt of S.data.points) if (!pt.done) out.push({ x: pt.x, y: pt.y, color: '#ffd23f', label: step.label, kind: 'pickup', r: 22 });
  } else if (step.type === 'kill') {
    for (const e of living(G, step.tag)) out.push({ x: e.x, y: e.y, color: '#ff4d5e', label: e.boss ? 'Vex' : '', kind: 'enemy', r: 10, follow: true });
  } else if (step.type === 'destroy') {
    for (const v of standing(G, step.tag)) out.push({ x: v.x, y: v.y, color: '#ff4d5e', label: step.label, kind: 'enemy', r: 30, follow: true, hp: v.hp / v.maxHp });
  } else if (step.type === 'lose' && step.hint) {
    const at = G.city.places[step.hint];
    out.push({ x: at.x, y: at.y, color: '#7de3ff', label: at.name, kind: 'shop', r: 20, letter: at.letter });
  }
  return out;
}

/** Health (0..1) of the vehicle the current step must keep alive, or null. */
export function escortHealth(G) {
  const step = currentStep(G);
  if (!step?.health) return null;
  const v = taggedVehicle(G, step.health);
  return v ? { value: v.hp / v.maxHp, name: v.spec.name } : null;
}

function updateStep(G, dt) {
  const S = G.story;
  const step = currentStep(G);
  const p = G.player;
  S.stepT += dt;
  if (step.type === 'talk') {
    if (!G.dialogue) nextStep(G);
    return;
  }
  step.tick?.(G, S);
  if (S.timer > 0) {
    S.timer -= dt;
    if (S.timer <= 0) return failMission(G, 'Out of time.');
    if (S.timer < 10 && Math.floor(S.timer) !== Math.floor(S.timer + dt)) sfx('tick');
  }
  const need = step.tag && step.type !== 'kill' && step.type !== 'destroy' ? step.tag : step.health;
  if (need) {
    const v = taggedVehicle(G, need);
    if (!v || v.wreck) return failMission(G, `The ${v ? v.spec.name : 'vehicle'} was destroyed.`);
  }
  const why = step.fail?.(G);
  if (why) return failMission(G, why);
  const inCar = !step.tag || p.vehicle?.tag === step.tag;
  if (step.type === 'enter') {
    if (p.vehicle?.tag === step.tag) nextStep(G);
  } else if (step.type === 'goto') {
    const at = pointOf(G, step.at);
    if (Math.hypot(at.x - p.x, at.y - p.y) < (step.r ?? 34)) nextStep(G);
  } else if (step.type === 'deliver') {
    const at = pointOf(G, step.at);
    if (inCar && Math.hypot(at.x - p.x, at.y - p.y) < (step.r ?? 40) && Math.hypot(p.vx, p.vy) < 90) nextStep(G);
  } else if (step.type === 'collect') {
    for (const pt of S.data.points) {
      if (pt.done || !inCar || Math.hypot(pt.x - p.x, pt.y - p.y) > 28) continue;
      pt.done = true;
      S.data.left--;
      sfx('pickup');
      G.floaters.push({ x: pt.x, y: pt.y - 10, text: step.label, color: '#ffd23f', t: 0 });
      if (S.timer > 0) S.timer += 6;
    }
    if (S.data.left <= 0) nextStep(G);
  } else if (step.type === 'kill') {
    if (S.stepT > 0.5 && living(G, step.tag).length === 0) nextStep(G);
  } else if (step.type === 'destroy') {
    if (S.stepT > 0.5 && standing(G, step.tag).length === 0) nextStep(G);
  } else if (step.type === 'lose') {
    if (S.stepT > 1 && G.wanted.level === 0) nextStep(G);
  }
}

/** One step of the story: start a mission at its marker, run the active one, offer a retry after a failure. */
export function updateStory(G, dt) {
  const S = G.story;
  if (S.banner && (S.banner.t += dt) > S.banner.life) S.banner = null;
  if (S.active) {
    updateStep(G, dt);
    return;
  }
  const p = G.player;
  if (S.failed) {
    S.failed.t += dt;
    if (S.failed.t > 12) S.failed = null;
    else if (tapped('KeyR') && !p.dead) {
      const m = S.failed.mission;
      const at = G.city.places[m.place];
      if (p.vehicle) {
        p.vehicle.driver = null;
        p.vehicle = null;
      }
      p.x = at.x;
      p.y = at.y;
      G.wanted.level = 0;
      G.wanted.heat = 0;
      startMission(G, m);
      return;
    }
  }
  const m = nextMission(G);
  if (!m || G.job || p.dead) return;
  const at = G.city.places[m.place];
  const d = Math.hypot(at.x - p.x, at.y - p.y);
  if (d > 60) S.armed = true;
  if (d < 22 && S.armed && Math.hypot(p.vx, p.vy) < 120) {
    if (G.wanted.level > 0) {
      if (G.frame % 240 === 0) say(G, m.giver, 'Not with the police on you. Lose them first.', 3);
      return;
    }
    startMission(G, m);
  }
}

/** The player went down or was arrested in the middle of a mission. */
export function missionInterrupted(G, arrested) {
  if (G.story.active) failMission(G, arrested ? 'You were arrested.' : 'You went down.');
}
