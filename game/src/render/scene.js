// Draws one frame of the world in order: ground and water, street markings, shadows, people
// and vehicles, low effects, the buildings and trees that lean over them, the helicopter, the
// lighting pass, then the beacons and floating texts that sit on top of everything.
import { cam, viewRect, setPlane, scaleAt, screenX, screenY } from './camera.js';
import { drawGround } from './ground.js';
import { drawWater } from './water.js';
import { L, computeLighting, beginLights, applyLighting, addLight, addGlow } from './lighting.js';
import { drawBuilding, buildingDepth } from './buildings.js';
import { drawPropLow, drawPropHigh, drawPropShadow, isTallProp } from './props.js';
import { drawBuildingShadows } from './shadows.js';
import { drawVehicle, drawVehicleShadow } from './vehicles.js';
import { drawPerson, drawPersonShadow } from './people.js';
import { drawParticles, drawFloaters } from './particles.js';
import { drawCloudShadows, drawGulls } from './ambient.js';
import { drawGroundMarkers, drawPickups, drawMarkerBeacons, drawTrafficSignals } from './markers.js';

function drawHelicopter(ctx, h) {
  const s = scaleAt(h.z);
  const x = screenX(h.x, s);
  const y = screenY(h.y, s);
  // The searchlight: a soft cone from the aircraft to a bright pool on the street.
  const s0 = scaleAt(0);
  const gx = screenX(h.lightX, s0);
  const gy = screenY(h.lightY, s0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.1 + L.night * 0.1;
  ctx.fillStyle = '#dcecff';
  const a = Math.atan2(gy - y, gx - x) + Math.PI / 2;
  const w = 58 * s0;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(gx + Math.cos(a) * w, gy + Math.sin(a) * w);
  ctx.lineTo(gx - Math.cos(a) * w, gy - Math.sin(a) * w);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  addLight(h.lightX, h.lightY, 300, '#e6f1ff', 0.9);
  addGlow(h.lightX, h.lightY, 0, 70, '#cfe2ff', 0.3);
  ctx.setTransform(s, 0, 0, s, x, y);
  ctx.rotate(h.angle);
  ctx.fillStyle = '#16233f';
  ctx.fillRect(-36, -2.2, 26, 4.4);
  ctx.fillRect(-38, -8, 4, 16);
  ctx.beginPath();
  ctx.ellipse(0, 0, 17, 9.5, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#f4f1e8';
  ctx.fillRect(-10, -9, 8, 18);
  ctx.fillStyle = '#7fc4ff';
  ctx.beginPath();
  ctx.ellipse(9, 0, 6.5, 6.5, 0, -1.3, 1.3);
  ctx.fill();
  ctx.strokeStyle = '#16233f';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-6, -13); ctx.lineTo(12, -13);
  ctx.moveTo(-6, 13); ctx.lineTo(12, 13);
  ctx.stroke();
  ctx.rotate(h.rotor);
  ctx.fillStyle = 'rgba(210,220,235,0.16)';
  ctx.beginPath();
  ctx.arc(0, 0, 33, 0, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(30,34,44,0.72)';
  ctx.fillRect(-33, -1.3, 66, 2.6);
  ctx.fillRect(-1.3, -33, 2.6, 66);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const blink = Math.floor(h.rotor / 12) % 2 === 0;
  addGlow(h.x, h.y, h.z + 4, 16, blink ? '#ff3030' : '#3a6bff', 0.9);
}

/** A soft ring and arrow over the player on foot, so tall buildings never hide them completely. */
function drawPlayerHalo(ctx, G) {
  const p = G.player;
  if (p.dead) return;
  const s = scaleAt(0);
  const x = screenX(p.x, s);
  const y = screenY(p.y, s);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (p.vehicle) {
    // At the wheel: a small pennant above the car you are driving.
    const top = y - (p.vehicle.spec.len * 0.5 + 16) * s + Math.sin(G.time * 5) * 2 * s;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff2f8e';
    ctx.lineWidth = 2.2 * cam.scale;
    ctx.beginPath();
    ctx.moveTo(x, top + 9 * s);
    ctx.lineTo(x - 6 * s, top);
    ctx.lineTo(x + 6 * s, top);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return;
  }
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.4 * cam.scale;
  ctx.beginPath();
  ctx.arc(x, y, 10 * s, 0, 7);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/**
 * Draws the world. `markers` are the objective, job and shop points to signpost; `quality` 0
 * skips the light map (the low graphics setting).
 */
export function drawWorld(ctx, G, markers, quality = 1) {
  computeLighting(G.clock);
  beginLights();
  const view = viewRect(40);
  setPlane(ctx, 0);
  // Tiles a little beyond the screen are painted ahead of time, one a frame, so driving never hitches.
  drawGround(ctx, G.shot ? view : viewRect(300), G.frame, G.shot ? 999 : 1);
  drawWater(ctx, view, G.time, G.city);
  const big = viewRect(360);
  const buildings = G.city.buildings.filter((b) => b.x < big.x1 && b.x + b.w > big.x0 && b.y < big.y1 && b.y + b.h > big.y0);
  const props = G.city.props.filter((p) => p.x > big.x0 && p.x < big.x1 && p.y > big.y0 && p.y < big.y1);
  const inView = (e, m = 60) => e.x > view.x0 - m && e.x < view.x1 + m && e.y > view.y0 - m && e.y < view.y1 + m;
  const vehicles = G.vehicles.filter((v) => inView(v));
  const people = G.people.filter((p) => !p.vehicle && inView(p, 20));
  const player = G.player;

  for (const p of props) drawPropLow(ctx, p, G.time);
  drawGroundMarkers(ctx, G, markers, view);
  drawPickups(ctx, G);

  // Shadows: one colour, drawn before anything that stands on the street.
  setPlane(ctx, 0);
  drawBuildingShadows(ctx, buildings);
  ctx.fillStyle = `rgba(26,14,64,${L.shadowAlpha})`;
  ctx.globalAlpha = 0.75;
  for (const p of props) drawPropShadow(ctx, p);
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(20,10,50,${L.shadowAlpha + 0.1})`;
  for (const v of vehicles) drawVehicleShadow(ctx, v);
  for (const p of people) drawPersonShadow(ctx, p);
  if (!player.vehicle) drawPersonShadow(ctx, player);
  drawCloudShadows(ctx, G.time, view);
  if (G.helicopter) {
    const h = G.helicopter;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(h.x + L.shadowX * h.z, h.y + L.shadowY * h.z, 24, 12, h.angle, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  for (const p of people) if (p.dead) drawPerson(ctx, p);
  for (const p of people) if (!p.dead) drawPerson(ctx, p, p.role !== 'civ' && (p.role !== 'cop' || G.wanted.level >= 2 || p.alert > 0) ? p.weapon : null);
  if (!player.vehicle) drawPerson(ctx, player, player.weapon !== 'fists' ? player.weapon : null);
  for (const v of vehicles) drawVehicle(ctx, v, G.time);
  setPlane(ctx, 8);
  for (const r of G.rockets) {
    ctx.fillStyle = '#e8e8ee';
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);
    ctx.fillRect(-6, -1.6, 12, 3.2);
    ctx.restore();
    addGlow(r.x - Math.cos(r.angle) * 8, r.y - Math.sin(r.angle) * 8, 8, 12, '#ffb347', 1);
  }
  drawParticles(ctx, G, false);
  drawTrafficSignals(ctx, G, view);

  const items = [];
  for (const b of buildings) items.push([buildingDepth(b), b, 0]);
  for (const p of props) if (isTallProp(p)) items.push([(p.x - cam.x) ** 2 + (p.y - cam.y) ** 2, p, 1]);
  items.sort((a, b) => b[0] - a[0]);
  for (const it of items) {
    if (it[2]) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawPropHigh(ctx, it[1]);
    } else drawBuilding(ctx, it[1]);
  }
  drawParticles(ctx, G, true);
  drawPlayerHalo(ctx, G);
  drawGulls(ctx, G.time);
  if (G.helicopter) drawHelicopter(ctx, G.helicopter);
  applyLighting(ctx, quality);
  drawMarkerBeacons(ctx, G, markers);
  drawFloaters(ctx, G);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
