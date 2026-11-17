// The camera. It follows its target, leads it along its velocity, widens the view with speed,
// shakes on impacts and stays inside the city limits. It also owns the top-down perspective
// that makes buildings lean: a point at height z is drawn scaled by
// CAMERA_HEIGHT / (CAMERA_HEIGHT - z) around the view centre (cam.cx, cam.cy).
import { CAMERA_HEIGHT, WORLD_W, WORLD_H } from '../core/config.js';
import { clamp, damp } from '../core/math.js';

// Look-ahead: nothing below a walking pace, the full lead at a fast drive.
const LEAD_START_SPEED = 40;
const LEAD_FULL_SPEED = 480;
const LEAD_MAX = 230;
/** Stiffness of the look-ahead spring, 1/s: it settles in a little over a second. */
const LEAD_STIFFNESS = 3.2;
/** How fast the view leans toward the mouse on foot, 1/s. */
const AIM_RATE = 6;
const FOLLOW_RATE = 7;

// Speed zoom: the view widens by up to SPEED_ZOOM_OUT between these two speeds.
const ZOOM_START_SPEED = 120;
const ZOOM_FULL_SPEED = 520;
const SPEED_ZOOM_OUT = 0.3;
// Pulling back is quicker than closing in, so braking for a corner does not pump the view.
const ZOOM_OUT_RATE = 2.2;
const ZOOM_IN_RATE = 1.1;

// Shake is an amplitude in pixels of a 720-line screen.
const SHAKE_MAX = 22;
const SHAKE_DECAY = 4.5;
const SHAKE_FADE = 5;
const SHAKE_ATTACK = 38;

/** World units of open sea the view may show beyond the edge of the city. */
const EDGE_OVERSCAN = 220;
/** A target that jumps farther than this in one step (a respawn, a loaded save) is cut to. */
const CUT_DISTANCE = 1600;

export const cam = {
  x: 0, y: 0, zoom: 1,
  w: 1280, h: 720, scale: 1, cx: 640, cy: 360,
  leadX: 0, leadY: 0, leadVX: 0, leadVY: 0,
  aimX: 0, aimY: 0,
  shake: 0, shakeLevel: 0, shakeT: 0,
};

export function resizeCamera(width, height) {
  cam.w = width;
  cam.h = height;
  cam.scale = height / 720;
  centreView();
}

// ---- projection ----

/** Canvas pixels per world unit for things at height z. */
export function scaleAt(z) {
  return (cam.zoom * cam.scale * CAMERA_HEIGHT) / (CAMERA_HEIGHT - z);
}

export const screenX = (x, s) => cam.cx + (x - cam.x) * s;
export const screenY = (y, s) => cam.cy + (y - cam.y) * s;

/** Sets the canvas transform so drawing in world units lands on the horizontal plane at height z. */
export function setPlane(ctx, z = 0) {
  const s = scaleAt(z);
  ctx.setTransform(s, 0, 0, s, cam.cx - cam.x * s, cam.cy - cam.y * s);
  return s;
}

export function worldToScreen(x, y, z = 0) {
  const s = scaleAt(z);
  return [screenX(x, s), screenY(y, s)];
}

export function screenToWorld(px, py) {
  const s = scaleAt(0);
  return [cam.x + (px - cam.cx) / s, cam.y + (py - cam.cy) / s];
}

/** The world rectangle visible at street level, grown by `margin` world units. */
export function viewRect(margin = 0) {
  const s = scaleAt(0);
  const hw = cam.w / 2 / s + margin;
  const hh = cam.h / 2 / s + margin;
  return { x0: cam.x - hw, y0: cam.y - hh, x1: cam.x + hw, y1: cam.y + hh };
}

// ---- easing helpers ----

/** 0 below `lo`, 1 above `hi`, and an S-curve with no kink at either end between them. */
function easeBetween(lo, hi, v) {
  const t = clamp((v - lo) / (hi - lo), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * One exact step of a critically damped spring on cam[pos] / cam[vel] toward `goal`. Unlike a
 * plain exponential it starts from rest gently as well as arriving gently, and never overshoots
 * a goal that stands still, whatever the length of the step.
 */
function springToward(pos, vel, goal, stiffness, dt) {
  const offset = cam[pos] - goal;
  const pull = cam[vel] + stiffness * offset;
  const decay = Math.exp(-stiffness * dt);
  cam[pos] = goal + (offset + pull * dt) * decay;
  cam[vel] = (cam[vel] - stiffness * pull * dt) * decay;
}

// ---- the parts of following ----

/** How far ahead of a target moving at `speed` the view should sit. */
export function leadDistance(speed) {
  return LEAD_MAX * easeBetween(LEAD_START_SPEED, LEAD_FULL_SPEED, speed);
}

/** The zoom for a target that asks for `baseZoom` and moves at `speed`. */
export function zoomForSpeed(baseZoom, speed) {
  return baseZoom * (1 - SPEED_ZOOM_OUT * easeBetween(ZOOM_START_SPEED, ZOOM_FULL_SPEED, speed));
}

/** Clamps a view centre on one axis of a world `size` long, of which the view covers `half` each way. */
function clampAxis(v, half, size) {
  const lo = half - EDGE_OVERSCAN;
  const hi = size - half + EDGE_OVERSCAN;
  return lo > hi ? size / 2 : clamp(v, lo, hi);
}

/** The nearest view centre to (x, y) that keeps the view at `zoom` within the city and a strip of sea. */
export function clampToCity(x, y, zoom = cam.zoom) {
  const s = zoom * cam.scale;
  return [clampAxis(x, cam.w / 2 / s, WORLD_W), clampAxis(y, cam.h / 2 / s, WORLD_H)];
}

function updateLookAhead(dt, target, speed) {
  const lead = leadDistance(speed);
  const dirX = speed > 1 ? target.vx / speed : 0;
  const dirY = speed > 1 ? target.vy / speed : 0;
  springToward('leadX', 'leadVX', dirX * lead, LEAD_STIFFNESS, dt);
  springToward('leadY', 'leadVY', dirY * lead, LEAD_STIFFNESS, dt);
  const k = damp(AIM_RATE, dt);
  cam.aimX += ((target.aimX ?? 0) - cam.aimX) * k;
  cam.aimY += ((target.aimY ?? 0) - cam.aimY) * k;
}

function updateZoom(dt, target, speed) {
  const goal = zoomForSpeed(target.zoom, speed);
  cam.zoom += (goal - cam.zoom) * damp(goal < cam.zoom ? ZOOM_OUT_RATE : ZOOM_IN_RATE, dt);
}

function updatePosition(dt, target) {
  const [gx, gy] = clampToCity(target.x + cam.leadX + cam.aimX, target.y + cam.leadY + cam.aimY);
  if (Math.hypot(gx - cam.x, gy - cam.y) > CUT_DISTANCE) {
    cam.x = gx;
    cam.y = gy;
    return;
  }
  const k = damp(FOLLOW_RATE, dt);
  cam.x += (gx - cam.x) * k;
  cam.y += (gy - cam.y) * k;
}

/** A wobble in [-1, 1]: two detuned sines, which never settle into a visible loop. */
function wobble(t, phase) {
  return 0.62 * Math.sin(t * 61 + phase) + 0.38 * Math.sin(t * 97.3 + phase * 2.1);
}

function centreView() {
  cam.cx = cam.w / 2;
  cam.cy = cam.h / 2;
}

/**
 * Decays the shake and moves the view centre by it. The amplitude on screen rises to the
 * requested one over a few frames rather than in one, and `gain` (0 to 1) scales it.
 */
function updateShake(dt, gain) {
  cam.shake = Math.max(0, cam.shake * Math.exp(-SHAKE_DECAY * dt) - SHAKE_FADE * dt);
  cam.shakeLevel += (cam.shake * gain - cam.shakeLevel) * damp(SHAKE_ATTACK, dt);
  cam.shakeT += dt;
  if (cam.shakeLevel < 0.02) {
    cam.shakeLevel = 0;
    centreView();
    return;
  }
  const k = cam.shakeLevel * cam.scale;
  cam.cx = cam.w / 2 + wobble(cam.shakeT, 0) * k;
  cam.cy = cam.h / 2 + wobble(cam.shakeT, 1.7) * k;
}

// ---- what the game calls ----

/**
 * Moves the camera one step after a target { x, y, vx, vy, zoom, aimX, aimY, shake }: the view
 * leads the target along its velocity, leans by (aimX, aimY) toward the mouse, widens from
 * `zoom` as the target speeds up, and shakes by the pending impacts times `shake` (default 1).
 */
export function followCamera(dt, target) {
  if (!(dt > 0)) return;
  const speed = Math.hypot(target.vx, target.vy);
  updateLookAhead(dt, target, speed);
  updateZoom(dt, target, speed);
  updatePosition(dt, target);
  updateShake(dt, target.shake ?? 1);
}

/** Cuts straight to a view of (x, y), at rest: no look-ahead, no shake. */
export function snapCamera(x, y, zoom = cam.zoom) {
  cam.zoom = zoom;
  [cam.x, cam.y] = clampToCity(x, y, zoom);
  cam.leadX = cam.leadY = cam.leadVX = cam.leadVY = 0;
  cam.aimX = cam.aimY = 0;
  cam.shake = cam.shakeLevel = 0;
  centreView();
}

/** Adds an impact: about 1 for a gunshot, 10 for a hard crash, 16 for an explosion at your feet. */
export function addShake(amount) {
  cam.shake = clamp(cam.shake + amount, 0, SHAKE_MAX);
}
