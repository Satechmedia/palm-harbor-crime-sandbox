// ?selftest=1: the game plays itself for a few simulated minutes (walking, driving, a chase
// at every wanted level, every weapon, every step of every mission, the shops, the side jobs,
// going down, saving and loading) and writes what happened, and any error, into the page.
import { STEP } from '../core/config.js';
import { pressKey, mouse, endInputFrame } from '../core/input.js';
import { MISSIONS } from '../missions/story.js';
import { jumpToStep, failMission, objectiveTargets } from '../missions/director.js';
import { setWanted, clearWanted } from '../crime/wanted.js';
import { WEAPON_ORDER } from '../combat/weapons.js';
import { hurtPerson, explode, damageVehicle } from '../combat/damage.js';
import { enterVehicle, exitVehicle } from '../characters/player.js';
import { createVehicle } from '../vehicles/physics.js';
import { shopPoints, openShop } from '../activities/shops.js';
import { saveGame, readSave, applySave } from '../save/savegame.js';

export function runSelfTest(app) {
  const log = [];
  const out = document.createElement('pre');
  out.id = 'selftest';
  out.style.cssText = 'position:fixed;left:0;top:0;margin:0;padding:8px;color:#9f9;background:rgba(0,0,0,0.8);font:12px monospace;z-index:9;max-height:100%;overflow:auto';
  document.body.appendChild(out);
  let steps = 0;
  let stage = 'boot';
  const say = (line) => log.push(line);
  const run = (n, every = 30) => {
    for (let k = 0; k < n; k++) {
      app.update(STEP);
      steps++;
      if (k % every === 0) app.render();
    }
  };
  const tap = (code) => {
    pressKey(code, true);
    run(1);
    pressKey(code, false);
  };
  try {
    app.buildWorld();
    app.hooks.newGame();
    let G = app.game();
    G.godmode = true;
    const p = G.player;
    stage = 'walk';
    pressKey('KeyD'); run(60); pressKey('KeyD', false);
    pressKey('KeyS'); pressKey('ShiftLeft'); run(40); pressKey('KeyS', false); pressKey('ShiftLeft', false);
    say(`walk ok at ${p.x | 0},${p.y | 0}; vehicles ${G.vehicles.length}, people ${G.people.length}`);

    stage = 'drive';
    const own = G.vehicles.find((v) => v.personal);
    enterVehicle(G, own);
    const t0 = performance.now();
    pressKey('KeyW');
    for (let k = 0; k < 8; k++) {
      pressKey(k % 2 ? 'KeyA' : 'KeyD');
      if (k === 5) pressKey('Space');
      run(60);
      pressKey('KeyA', false); pressKey('KeyD', false); pressKey('Space', false);
    }
    say(`drive ok: ${((performance.now() - t0) / 480).toFixed(2)} ms a step with a render every 30; speed ${own.speed | 0}`);

    const r0 = performance.now();
    for (let k = 0; k < 10; k++) app.render();
    say(`render: ${((performance.now() - r0) / 10).toFixed(1)} ms a frame at ${innerWidth}x${innerHeight}`);

    stage = 'chase';
    for (const level of [1, 2, 3, 4, 5]) {
      setWanted(G, level);
      run(150);
      say(`wanted ${level}: police cars ${G.vehicles.filter((v) => v.spec.police).length}, officers ${G.people.filter((q) => q.role === 'cop').length}, helicopter ${!!G.helicopter}`);
    }
    pressKey('KeyW', false);
    clearWanted(G);
    run(60);

    stage = 'weapons';
    exitVehicle(G);
    for (const id of WEAPON_ORDER) {
      p.weapons[id] = id === 'fists' ? Infinity : 40;
      p.weapon = id;
      mouse.down = true;
      mouse.clicked = true;
      run(24);
    }
    mouse.down = false;
    explode(G, p.x + 60, p.y, 90, p);
    run(90);
    clearWanted(G, true);
    say(`weapons ok; particles ${G.particles.length}`);

    stage = 'missions';
    // Play the whole story: each step's goal is met the blunt way (teleporting, one-hit kills),
    // so every setup, objective, payout and clean-up of every mission really runs.
    G.godmode = true;
    const moveTo = (x, y) => {
      const car = p.vehicle;
      if (car) {
        car.x = x; car.y = y; car.vx = 0; car.vy = 0;
      }
      p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    };
    for (const m of MISSIONS) {
      G.story.done = MISSIONS.slice(0, MISSIONS.indexOf(m)).map((q) => q.id);
      jumpToStep(G, m, 0, true);
      for (let guard = 0; guard < 400 && G.story.active === m; guard++) {
        const index = G.story.step;
        const step = m.steps[index];
        stage = `mission ${m.id} step ${index} (${step.type})`;
        if (step.type === 'talk') {
          tap('Space');
          run(3);
          continue;
        }
        if (step.type === 'lose') clearWanted(G, true);
        if (step.tag && step.type !== 'kill' && step.type !== 'destroy' && p.vehicle?.tag !== step.tag) {
          if (p.vehicle) exitVehicle(G);
          const car = G.vehicles.find((v) => v.tag === step.tag);
          if (!car) throw new Error(`no vehicle tagged ${step.tag}`);
          enterVehicle(G, car, true);
        }
        if (step.type === 'kill') for (const e of G.people.filter((q) => q.tag === step.tag && !q.dead)) hurtPerson(G, e, 9999, p, 0, 'bullet');
        if (step.type === 'destroy') for (const v of G.vehicles.filter((q) => q.tag === step.tag && !q.wreck)) damageVehicle(G, v, 9999, p, 'blast');
        const target = objectiveTargets(G).find((t) => t.kind === 'goal' || t.kind === 'pickup');
        if (target && (step.type === 'goto' || step.type === 'deliver' || step.type === 'collect')) {
          if (step.onFoot && p.vehicle) exitVehicle(G);
          moveTo(target.x, target.y);
        }
        run(step.type === 'destroy' ? 200 : 40);
      }
      if (!G.story.done.includes(m.id)) throw new Error(`mission ${m.id} did not complete (stuck at ${stage}; ${G.story.failed?.reason ?? 'no failure'})`);
      clearWanted(G, true);
      if (p.vehicle) exitVehicle(G);
      run(20);
    }
    failMission(G, 'unused');
    say(`story ok: ${G.story.done.length} of ${MISSIONS.length} missions completed, $${G.money}, ${G.xp} XP, weapons ${Object.keys(p.weapons).join(' ')}`);
    const moving = G.vehicles.filter((v) => v.ai?.type === 'traffic');
    say(`traffic: ${moving.length} cars, mean speed ${(moving.reduce((n, v) => n + Math.abs(v.speed), 0) / Math.max(1, moving.length)) | 0}, wrecks ${G.vehicles.filter((v) => v.wreck).length}`);

    stage = 'shops';
    for (const s of shopPoints({ ...G, story: { ...G.story, done: ['x'] } })) {
      G.money = 99999;
      openShop(G, s);
      app.render();
      for (let k = 0; k < G.shop?.items.length ?? 0; k++) { tap('Enter'); if (!G.shop) break; tap('KeyS'); }
      if (G.shop) tap('Escape');
      app.render();
    }
    say(`shops ok; mode ${G.mode}`);

    stage = 'jobs';
    for (const model of ['solcab', 'kitevan']) {
      const v = createVehicle(G, model, p.x + 30, p.y, 0);
      enterVehicle(G, v, true);
      tap('KeyT');
      run(120);
      say(`job ${G.job?.kind ?? 'none'} running`);
      tap('KeyT');
      exitVehicle(G);
    }

    stage = 'menus';
    tap('Escape');
    for (const page of ['main', 'map', 'stats', 'controls', 'settings']) {
      G.menu.page = page;
      app.render();
      run(2);
    }
    G.menu.page = 'main';
    tap('Escape');
    say(`menus ok; mode ${G.mode}`);

    stage = 'down';
    G.godmode = false;
    hurtPerson(G, p, 999, null, 0, 'blast');
    run(260);
    say(`down ok; mode ${G.mode}, hp ${p.hp | 0}`);
    G.onPlayerDown(true);
    run(260);

    stage = 'save';
    G.story.done = ['fresh_out', 'heat_check'];
    const saved = saveGame(G);
    const data = readSave();
    app.buildWorld();
    G = app.game();
    if (data) applySave(G, data);
    app.enterPlay(true);
    run(30);
    say(`save ${saved ? 'ok' : 'unavailable'}; loaded missions done ${G.story.done.length}`);

    stage = 'title';
    app.hooks.quit();
    run(120);
    endInputFrame();
    document.title = `SELFTEST OK ${steps} steps`;
    say(`OK: ${steps} steps without an error`);
  } catch (e) {
    document.title = `SELFTEST FAIL at ${stage}: ${e.message}`;
    say(`FAIL at ${stage}: ${e.stack ?? e}`);
  }
  out.textContent = log.join('\n');
}
