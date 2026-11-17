// Draws people from above: swinging arms and striding legs, shoulders, a head with hair or a
// hat, a weapon in hand, and the sprawl of someone who has gone down.
import { setPlane } from './camera.js';
import { L } from './lighting.js';

const GUN_LENGTH = { pistol: 6, smg: 8, shotgun: 12, rifle: 13, launcher: 14 };

export function drawPersonShadow(ctx, p) {
  ctx.beginPath();
  ctx.ellipse(p.x + L.shadowX * 9, p.y + L.shadowY * 9, p.dead ? 8 : 5.5, p.dead ? 5 : 4, p.angle, 0, 7);
  ctx.fill();
}

function drawDowned(ctx, p) {
  const k = p.look;
  ctx.fillStyle = k.pants;
  ctx.fillRect(-11, -3.6, 8, 3);
  ctx.fillRect(-10, 1, 8, 3);
  ctx.fillStyle = k.shirt;
  ctx.beginPath();
  ctx.ellipse(0, 0, 5.5, 4.6, 0, 0, 7);
  ctx.fill();
  ctx.fillRect(1, -8, 2.6, 6);
  ctx.fillRect(-1, 3, 2.6, 6);
  ctx.fillStyle = k.skin;
  ctx.beginPath();
  ctx.arc(6.5, 0.5, 3.2, 0, 7);
  ctx.fill();
}

/** Draws one person on the street plane, facing p.angle. `armed` is the weapon id in hand, if any. */
export function drawPerson(ctx, p, armed = null) {
  setPlane(ctx, 0);
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  if (p.dead) {
    drawDowned(ctx, p);
    return;
  }
  const k = p.look;
  const speed = Math.hypot(p.vx, p.vy);
  const stride = speed > 6 ? Math.sin(p.walkT) : 0;
  const cower = p.state === 'cower';
  // Legs.
  ctx.fillStyle = k.pants;
  ctx.fillRect(-1.8 + stride * 3.6, -3.6, 4.4, 2.8);
  ctx.fillRect(-1.8 - stride * 3.6, 0.8, 4.4, 2.8);
  ctx.fillStyle = '#1a1a1f';
  ctx.fillRect(1.6 + stride * 3.6, -3.6, 1.8, 2.8);
  ctx.fillRect(1.6 - stride * 3.6, 0.8, 1.8, 2.8);
  setPlane(ctx, 9);
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  // Arms.
  const gun = armed && GUN_LENGTH[armed];
  ctx.fillStyle = k.jacket ?? k.shirt;
  if (cower) {
    ctx.fillRect(0, -6.4, 4.5, 2.4);
    ctx.fillRect(0, 4, 4.5, 2.4);
  } else if (gun) {
    ctx.fillRect(0, -5.6, 6.5, 2.4);
    ctx.fillRect(0, 3.2, 6.5, 2.4);
    ctx.fillStyle = k.skin;
    ctx.fillRect(6, -1.6, 2.6, 3.2);
    ctx.fillStyle = '#16161a';
    ctx.fillRect(7.5, -1, gun, 2);
  } else if (p.punchT > 0) {
    ctx.fillRect(0, 3.2, 9, 2.6);
    ctx.fillStyle = k.skin;
    ctx.fillRect(8.4, 3, 2.8, 3);
  } else {
    ctx.fillRect(-1.6 - stride * 3, -6.2, 4.6, 2.3);
    ctx.fillRect(-1.6 + stride * 3, 3.9, 4.6, 2.3);
    ctx.fillStyle = k.skin;
    ctx.fillRect(2.4 - stride * 3, -6.2, 1.8, 2.3);
    ctx.fillRect(2.4 + stride * 3, 3.9, 1.8, 2.3);
  }
  // Shoulders.
  ctx.fillStyle = p.hitT > 0 ? '#ffffff' : k.jacket ?? k.shirt;
  ctx.beginPath();
  ctx.ellipse(-0.4, 0, 3.6, 5.6, 0, 0, 7);
  ctx.fill();
  if (k.jacket) {
    ctx.fillStyle = k.shirt;
    ctx.fillRect(0.2, -1.8, 3, 3.6);
  }
  if (k.stripe) {
    ctx.fillStyle = k.stripe;
    ctx.fillRect(-1.6, -5, 1.6, 10);
  }
  if (k.bag) {
    ctx.fillStyle = '#5b3d24';
    ctx.fillRect(-4.6, -3, 2.4, 6);
  }
  if (k.badge) {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(1, -3.4, 1.5, 1.5);
  }
  setPlane(ctx, 16);
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  // Head.
  ctx.fillStyle = k.skin;
  ctx.beginPath();
  ctx.arc(0.6, 0, 3.1, 0, 7);
  ctx.fill();
  if (k.hat) {
    ctx.fillStyle = k.hat;
    ctx.beginPath();
    ctx.arc(0.3, 0, 3.3, 0, 7);
    ctx.fill();
    ctx.fillRect(1.6, -2.6, 3.4, 5.2);
  } else if (!k.bald) {
    ctx.fillStyle = k.hair;
    ctx.beginPath();
    ctx.arc(-0.1, 0, 3.1, 1.15, 5.13);
    ctx.fill();
  }
}
