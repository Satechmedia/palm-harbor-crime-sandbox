// The camera: follows its target smoothly, looks ahead along its velocity, zooms out with
// speed and shakes on impacts. It also owns the top-down perspective that makes buildings lean:
// a point at height z is drawn scaled by CAMERA_HEIGHT / (CAMERA_HEIGHT - z) around the view centre.
import { CAMERA_HEIGHT } from '../core/config.js';
import { clamp, damp } from '../core/math.js';

export const cam = { x: 0, y: 0, zoom: 1, w: 1280, h: 720, scale: 1, cx: 640, cy: 360, shake: 0, shakeT: 0, lookX: 0, lookY: 0 };

export function resizeCamera(width, height) {
  cam.w = width;
  cam.h = height;
  cam.scale = height / 720;
}

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

/**
 * Eases the camera toward a target { x, y, vx, vy, zoom, aimX, aimY }: the view leads the
 * target by its velocity (and a little toward the mouse on foot) and widens as it speeds up.
 */
export function followCamera(dt, target) {
  const speed = Math.hypot(target.vx, target.vy);
  const lead = Math.min(240, speed * 0.5);
  const lx = (speed > 1 ? (target.vx / speed) * lead : 0) + (target.aimX ?? 0);
  const ly = (speed > 1 ? (target.vy / speed) * lead : 0) + (target.aimY ?? 0);
  cam.lookX += (lx - cam.lookX) * damp(2.2, dt);
  cam.lookY += (ly - cam.lookY) * damp(2.2, dt);
  cam.x += (target.x + cam.lookX - cam.x) * damp(7, dt);
  cam.y += (target.y + cam.lookY - cam.y) * damp(7, dt);
  cam.zoom += (target.zoom - cam.zoom) * damp(1.6, dt);
  cam.shake = Math.max(0, cam.shake - dt * 26);
  cam.shakeT += dt;
  const k = cam.shake * cam.scale;
  cam.cx = cam.w / 2 + Math.sin(cam.shakeT * 83) * k;
  cam.cy = cam.h / 2 + Math.cos(cam.shakeT * 67) * k;
}

export function snapCamera(x, y, zoom = cam.zoom) {
  cam.x = x;
  cam.y = y;
  cam.zoom = zoom;
  cam.lookX = 0;
  cam.lookY = 0;
  cam.cx = cam.w / 2;
  cam.cy = cam.h / 2;
}

export function addShake(amount) {
  cam.shake = clamp(cam.shake + amount, 0, 22);
}
