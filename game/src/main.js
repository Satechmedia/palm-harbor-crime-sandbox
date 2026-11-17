// Palm Harbor: Heatwave. The entry point: builds the city, wires the systems together, runs
// the fixed-step loop and switches between the title screen, play, pause, shops and the
// hospital. ?shot=name stages a screenshot scene; ?selftest=1 plays the game by itself.
import { STEP } from './core/config.js';
import { bindInput, endInputFrame, tapped, mouse, pressKey } from './core/input.js';
import { createGame, notify, say } from './game/state.js';
import { stepGame, stepAmbient, gatherMarkers, gatherPrompts } from './game/simulation.js';
import { MISSIONS } from './missions/story.js';
import { missionInterrupted } from './missions/director.js';
import { reportCrime } from './crime/wanted.js';
import { createPlayer, respawnPlayer } from './characters/player.js';
import { populatePedestrians } from './characters/pedestrians.js';
import { populateTraffic, panicTraffic } from './vehicles/traffic.js';
import { placePelicans, endJob } from './activities/sidejobs.js';
import { updateShop, spawnPersonalCar } from './activities/shops.js';
import { saveGame, readSave, applySave, describeSave, saveSettings, loadSettings } from './save/savegame.js';
import { initAudio, setVolumes, sfx } from './audio/sound.js';
import { updateRadio } from './audio/radio.js';
import { cam, resizeCamera, snapCamera, worldToScreen } from './render/camera.js';
import { resetGround } from './render/ground.js';
import { drawWorld } from './render/scene.js';
import { drawHud } from './ui/hud.js';
import { updateDialogue, drawDialogue } from './ui/dialogue.js';
import { updateMenu, drawMenu, drawShop, drawDownScreen } from './ui/menus.js';
import { SCENES } from './shots/scenes.js';
import { runSelfTest } from './shots/selftest.js';

const query = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const seed = Number(query.get('seed')) || 1;
let G = null;
let titleFocus = { x: 1010, y: 1660, zoom: 1.12 };

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  resizeCamera(canvas.width, canvas.height);
}

/** A fresh world with the player standing outside the Seabreeze Motel. */
function buildWorld() {
  const settings = loadSettings(G ? G.settings : { sound: 0.8, music: 0.5, quality: 1, shake: 1 });
  G = createGame(seed);
  G.settings = settings;
  setVolumes(settings.sound, settings.music);
  resetGround(G.city);
  placePelicans(G);
  const home = G.city.places.safehouse;
  createPlayer(G, home.x, home.y);
  snapCamera(home.x, home.y, 1.6);
  G.hitByPlayer = (other, force) => {
    if (other.driver === 'ai' || other.spec.police) reportCrime(G, other.spec.police ? 'copAssault' : 'ram', other.x, other.y);
    if (force > 160) panicTraffic(G, other.x, other.y, 160);
  };
  G.onPlayerDown = (arrested) => {
    if (G.down) return;
    G.down = { arrested, t: 0 };
    G.player.dead = true;
    G.mode = 'down';
    endJob(G);
    missionInterrupted(G, arrested);
    sfx('failed');
  };
  G.onSave = () => notify(G, saveGame(G) ? 'Game saved.' : 'Could not save in this browser.', '#8dff9c', '✓');
  G.onAutosave = () => saveGame(G);
  return G;
}

function enterPlay(fromSave) {
  const home = G.city.places.safehouse;
  G.mode = 'play';
  G.menu.screen = 'pause';
  snapCamera(home.x, home.y, 1.7);
  spawnPersonalCar(G, home.x + (home.horizontal ? -46 : 0), home.y + (home.horizontal ? 0 : -46), home.horizontal ? 0 : Math.PI / 2);
  populateTraffic(G, 14);
  populatePedestrians(G, 26);
  const next = MISSIONS[G.story.done.length];
  if (fromSave) notify(G, 'Welcome back to Palm Harbor.', '#ffd23f');
  else {
    G.story.banner = { title: 'PALM HARBOR', sub: 'Day 1 · Seabreeze Motel, Coral Strand', color: '#ffd23f', t: 0, life: 4 };
    say(G, 'dez', 'Three years. The town still smells like sunscreen and exhaust.', 5);
    notify(G, 'Your Brava 440 is parked outside. Press F to drive.', '#ffffff');
    notify(G, 'Follow the T on the map to Tía at Bravo Motors.', '#ffd23f', 'T');
  }
  if (next && fromSave) notify(G, `Next: "${next.title}" at the ${next.giver[0].toUpperCase()} marker.`, '#ffd23f');
}

const hooks = {
  saveInfo: null,
  newGame: () => {
    buildWorld();
    enterPlay(false);
  },
  continueGame: () => {
    const data = readSave();
    buildWorld();
    if (data) applySave(G, data);
    enterPlay(true);
  },
  resume: () => {
    G.mode = 'play';
  },
  save: () => {
    G.onSave();
    G.mode = 'play';
  },
  quit: () => {
    buildWorld();
    showTitle();
  },
  settingsChanged: () => {
    setVolumes(G.settings.sound, G.settings.music);
    saveSettings(G.settings);
  },
};

function showTitle() {
  const data = readSave();
  hooks.saveInfo = data ? describeSave(data) : null;
  G.mode = 'title';
  G.clock = 18.6;
  G.menu = { screen: 'title', page: 'main', sel: 0, sub: 0, t: 0 };
  snapCamera(titleFocus.x, titleFocus.y, titleFocus.zoom);
  populateTraffic(G, 20);
  populatePedestrians(G, 40);
}

/** One fixed step in whatever mode the game is in. */
function update(dt) {
  if (G.mode === 'title') {
    titleFocus.y = 1660 + Math.sin(G.time * 0.05) * 420;
    stepAmbient(G, dt, titleFocus);
    updateMenu(G, dt, hooks);
  } else if (G.mode === 'pause') updateMenu(G, dt, hooks);
  else if (G.mode === 'shop') updateShop(G, dt);
  else if (G.mode === 'down') {
    G.down.t += dt;
    stepGame(G, dt * 0.4);
    if (G.down.t > 3.6) {
      respawnPlayer(G, G.down.arrested);
      G.down = null;
      G.mode = 'play';
    }
  } else {
    if (G.slowmo > 0) G.slowmo -= dt;
    updateDialogue(G, dt);
    stepGame(G, G.slowmo > 0 ? dt * 0.4 : dt);
    if (tapped('Escape', 'KeyP') && G.mode === 'play' && !G.dialogue) {
      G.mode = 'pause';
      G.menu = { screen: 'pause', page: 'main', sel: 0, sub: 0, t: 0 };
      sfx('menu');
    } else if (tapped('KeyM', 'Tab') && G.mode === 'play' && !G.dialogue) {
      G.mode = 'pause';
      G.menu = { screen: 'pause', page: 'map', sel: 1, sub: 0, t: 0 };
    }
  }
  endInputFrame();
  mouse.moved = false;
}

function render() {
  const { targets, places } = gatherMarkers(G);
  const title = G.mode === 'title';
  drawWorld(ctx, G, title ? [] : [...targets, ...places], G.settings.quality);
  if (title) {
    drawMenu(ctx, G, hooks, targets, places);
    return;
  }
  drawHud(ctx, G, targets, places, gatherPrompts(G), mouse);
  drawDialogue(ctx, G);
  if (G.mode === 'pause') drawMenu(ctx, G, hooks, targets, places);
  if (G.mode === 'shop') drawShop(ctx, G);
  if (G.mode === 'down') drawDownScreen(ctx, G);
}

/** Shows an error on the page instead of a blank canvas, and in the title for headless runs. */
function reportError(e) {
  document.title = `ERROR ${e?.message ?? e}`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#200';
  ctx.fillRect(0, 0, canvas.width, 120);
  ctx.fillStyle = '#f66';
  ctx.font = '14px monospace';
  String(e?.stack ?? e).split('\n').slice(0, 6).forEach((line, i) => ctx.fillText(line, 10, 20 + i * 18));
}

/** Stages a screenshot scene: set it up, let it run for a moment with the camera pinned, then hold the frame. */
function stageShot(name) {
  const scene = SCENES[name];
  buildWorld();
  G.shot = { traffic: 1, peds: 1, noCrosshair: false };
  G.mode = 'play';
  G.menu.screen = 'pause';
  const s = scene(G);
  const pin = () => snapCamera((Number(query.get('x')) || s.cam[0]) + (s.track ? G.player.x : 0), (Number(query.get('y')) || s.cam[1]) + (s.track ? G.player.y : 0), Number(query.get('z')) || s.cam[2]);
  if (query.get('t')) G.clock = Number(query.get('t'));
  pin();
  if (s.title) {
    hooks.saveInfo = s.saveInfo;
    G.menu = { screen: 'title', page: query.get('page') ?? 'main', sel: 0, sub: 0, t: 0 };
    titleFocus = { x: s.cam[0], y: s.cam[1], zoom: s.cam[2] };
  }
  render();
  for (const key of s.keys ?? []) pressKey(key);
  const steps = Number(query.get('steps')) || s.steps;
  for (let k = 0; k < steps; k++) {
    if (s.aim) [mouse.x, mouse.y] = worldToScreen(s.aim[0], s.aim[1]);
    mouse.down = !!s.fire;
    if (s.title) stepAmbient(G, STEP, titleFocus);
    else stepGame(G, STEP);
    pin();
    endInputFrame();
  }
  mouse.down = false;
  s.after?.();
  if (query.get('page') && !s.title) {
    G.mode = 'pause';
    G.menu = { screen: 'pause', page: query.get('page'), sel: 0, sub: 0, t: 0 };
  }
  document.title = `shot ${name} ready`;
}

let last = 0;
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  try {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    let ran = 0;
    while (acc >= STEP && ran < 5) {
      update(STEP);
      acc -= STEP;
      ran++;
    }
    render();
    updateRadio(G, G.mode === 'title' || (G.mode === 'play' && !!G.player.vehicle));
  } catch (e) {
    reportError(e);
    throw e;
  }
}

function boot() {
  resize();
  addEventListener('resize', resize);
  bindInput(canvas, () => initAudio()?.resume?.());
  try {
    if (query.get('selftest')) {
      runSelfTest({ buildWorld, enterPlay, update, render, hooks, game: () => G });
      return;
    }
    const scene = query.get('shot');
    if (scene && SCENES[scene]) {
      // A staged scene is drawn once and held: nothing moves, so the capture is repeatable.
      stageShot(scene);
      let held = 0;
      const hold = () => {
        render();
        if (++held < 3) requestAnimationFrame(hold);
      };
      hold();
      addEventListener('resize', () => requestAnimationFrame(render));
      return;
    }
    {
      buildWorld();
      showTitle();
    }
  } catch (e) {
    reportError(e);
    throw e;
  }
  last = performance.now();
  requestAnimationFrame(frame);
}

boot();
