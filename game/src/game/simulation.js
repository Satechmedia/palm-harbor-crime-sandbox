// One fixed step of the whole game: the player, every driver, traffic, pedestrians, police,
// combat, the wanted level, the story and side jobs, pickups, the clock, the camera and the
// continuous sounds. Also the quieter "ambient" step that runs the city behind the title screen.
import { CLOCK_RATE } from '../core/config.js';
import { tapped, mouse } from '../core/input.js';
import { clamp } from '../core/math.js';
import { districtAt } from '../city/layout.js';
import { followCamera, screenToWorld } from '../render/camera.js';
import { updateParticles } from '../render/particles.js';
import { updatePlayer, enterableVehicle } from '../characters/player.js';
import { updatePeople } from '../characters/pedestrians.js';
import { collidePeopleWithVehicles } from '../characters/people.js';
import { stepVehicle, collideVehicles } from '../vehicles/physics.js';
import { updateTraffic, driveTraffic } from '../vehicles/traffic.js';
import { updatePolice, coolArrest } from '../ai/police.js';
import { updateHelicopter } from '../ai/helicopter.js';
import { driveChaser, driveRunner } from '../ai/gangs.js';
import { updateRockets, WEAPONS } from '../combat/weapons.js';
import { updateFires } from '../combat/damage.js';
import { updateWanted } from '../crime/wanted.js';
import { updateStory, objectiveTargets } from '../missions/director.js';
import { updateSideJobs, updatePelicans, jobTargets, jobPrompt, SPRINT_START } from '../activities/sidejobs.js';
import { shopNearby, openShop, shopPoints } from '../activities/shops.js';
import { nextStation } from '../audio/radio.js';
import { sfx, setListener, updateEngine, updateSiren } from '../audio/sound.js';
import { notify, addMoney } from './state.js';

const IDLE = { throttle: 0, steer: 0, handbrake: false };

function updateVehicles(G, dt) {
  for (const v of G.vehicles) {
    if (v.horn > 0) v.horn -= dt;
    if (v.driver === G.player) continue;
    const type = v.ai?.type;
    if (type === 'traffic') driveTraffic(G, v, dt);
    else if (type === 'chaser') driveChaser(G, v, dt);
    else if (type === 'runner') driveRunner(G, v, dt);
    else if (!type && (Math.abs(v.vx) > 1 || Math.abs(v.vy) > 1 || Math.abs(v.spin) > 0.05)) stepVehicle(G, v, IDLE, dt);
  }
}

function collectPickups(G, dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const k = G.pickups[i];
    k.t += dt;
    if (k.t > 60) {
      G.pickups.splice(i, 1);
      continue;
    }
    if (p.vehicle || Math.hypot(k.x - p.x, k.y - p.y) > 15) continue;
    if (k.kind === 'cash') addMoney(G, k.amount, k.x, k.y);
    else if (k.kind === 'ammo') {
      const id = p.weapons[k.weapon] !== undefined ? k.weapon : 'pistol';
      p.weapons[id] = (p.weapons[id] ?? 0) + k.amount;
      G.floaters.push({ x: k.x, y: k.y - 10, text: `+${k.amount} ${WEAPONS[id].name}`, color: '#ffd23f', t: 0 });
    } else p.hp = Math.min(p.maxHp, p.hp + 40);
    sfx('pickup');
    G.pickups.splice(i, 1);
  }
}

function tickFeeds(G, dt) {
  for (let i = G.notes.length - 1; i >= 0; i--) if ((G.notes[i].t += dt) > 6) G.notes.splice(i, 1);
  if (G.subtitle && (G.subtitle.t += dt) > G.subtitle.life) G.subtitle = null;
  G.zoneName.t += dt;
  if (G.radio.shownT > 0) G.radio.shownT -= dt;
  const d = districtAt(G.player.x, G.player.y);
  if (G.lastDistrict !== d.id) {
    if (G.lastDistrict) G.zoneName = { text: d.name, sub: d.blurb, color: d.color, t: 0 };
    G.lastDistrict = d.id;
  }
}

function followPlayer(G, dt) {
  const p = G.player;
  const v = p.vehicle;
  let zoom = 1.75;
  let aimX = 0;
  let aimY = 0;
  // The camera itself widens the view with speed, so a car only asks for its standing zoom.
  if (v) zoom = 1.42;
  else {
    const [mx, my] = screenToWorld(mouse.x, mouse.y);
    const armed = p.weapon !== 'fists';
    aimX = clamp((mx - p.x) * (armed ? 0.3 : 0.12), -110, 110);
    aimY = clamp((my - p.y) * (armed ? 0.3 : 0.12), -80, 80);
  }
  if (G.dialogue) zoom *= 1.2;
  followCamera(dt, { x: p.x, y: p.y, vx: p.vx, vy: p.vy, zoom, aimX, aimY, shake: G.settings.shake ? 1 : 0 });
}

function continuousSounds(G) {
  const p = G.player;
  setListener(p.x, p.y);
  const v = p.vehicle;
  updateEngine(!!v && !v.wreck && G.mode === 'play', v ? clamp(Math.abs(v.speed) / v.spec.top, 0, 1) : 0, v ? Math.abs(v.throttle) : 0);
  let near = 0;
  if (G.wanted.level > 0) {
    for (const c of G.vehicles) if (c.siren) near = Math.max(near, 1 - Math.hypot(c.x - p.x, c.y - p.y) / 800);
  }
  updateSiren(G.mode === 'play' ? Math.max(0, near) : 0, G.time);
}

/** Everything the HUD and the scene need to signpost this frame. */
export function gatherMarkers(G) {
  const targets = [...objectiveTargets(G), ...jobTargets(G)];
  const places = shopPoints(G).map((s) => ({ ...s, kind: 'shop', r: 15 }));
  if (!G.job && !G.story.active) places.push({ ...SPRINT_START, kind: 'shop', r: 26 });
  return { targets, places };
}

/** The [key, label] hints for what the player can do right here. */
export function gatherPrompts(G) {
  const p = G.player;
  const prompts = [];
  if (G.mode !== 'play' || p.dead) return prompts;
  if (!p.vehicle) {
    const v = enterableVehicle(G);
    if (v) prompts.push(['F', v.personal ? `Drive your ${v.spec.name}` : v.driver === 'ai' ? `Carjack the ${v.spec.name}` : `Steal the ${v.spec.name}`]);
  } else {
    const job = jobPrompt(G);
    if (job) prompts.push(['T', job.replace('Press T to ', '').replace(/^./, (c) => c.toUpperCase())]);
  }
  const shop = shopNearby(G);
  if (shop) prompts.push(['E', shop.name]);
  if (G.story.failed && !G.story.active) prompts.push(['R', `Retry "${G.story.failed.mission.title}"`]);
  return prompts;
}

/** Advances the game by one fixed step of dt seconds. */
export function stepGame(G, dt) {
  G.time += dt;
  G.frame++;
  G.stats.playTime += dt;
  G.clock += dt * CLOCK_RATE;
  if (G.clock >= 24) {
    G.clock -= 24;
    G.day++;
  }
  const locked = !!G.dialogue || G.player.dead;
  updatePlayer(G, dt, locked);
  updateVehicles(G, dt);
  updateTraffic(G, dt);
  updatePolice(G, dt);
  updateHelicopter(G, dt);
  collideVehicles(G);
  collidePeopleWithVehicles(G, dt);
  coolArrest(G, dt);
  updatePeople(G, dt);
  updateRockets(G, dt);
  updateFires(G, dt);
  updateParticles(G, dt);
  updateWanted(G, dt);
  if (!G.player.dead) {
    updateStory(G, dt);
    updateSideJobs(G, dt);
    updatePelicans(G);
    collectPickups(G, dt);
    if (!locked && tapped('KeyE')) {
      const shop = shopNearby(G);
      if (shop) openShop(G, shop);
    }
    if (!locked && G.player.vehicle && tapped('KeyR') && !G.story.failed) {
      const st = nextStation(G);
      notify(G, st ? `${st.name} · ${st.genre}` : 'Radio off', '#ff7ad9', '♪');
    }
  }
  tickFeeds(G, dt);
  followPlayer(G, dt);
  continuousSounds(G);
}

/** The city going about its day with nobody at the controls (behind the title screen). */
export function stepAmbient(G, dt, focus) {
  G.time += dt;
  G.frame++;
  updateVehicles(G, dt);
  updateTraffic(G, dt);
  collideVehicles(G);
  updatePeople(G, dt);
  updateParticles(G, dt);
  followCamera(dt, { x: focus.x, y: focus.y, vx: 0, vy: 0, zoom: focus.zoom });
  updateEngine(false, 0, 0);
  updateSiren(0, G.time);
}
