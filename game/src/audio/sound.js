// Sound effects, synthesised with the Web Audio API (no sound files): gunshots, crashes,
// explosions, horns, doors, pickups and menu blips, plus the continuous engine note and the
// police siren. Sounds fade with distance from the listener. Silent until the first key press.
import { clamp } from '../core/math.js';

let ac = null;
let out = null;
let noiseBuffer = null;
let engine = null;
let siren = null;
const listener = { x: 0, y: 0 };
const volume = { sound: 0.8, music: 0.5 };
let musicBus = null;

export function initAudio() {
  if (ac) return ac;
  const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ac = new Ctor();
  } catch {
    return null;
  }
  const limiter = ac.createDynamicsCompressor();
  limiter.connect(ac.destination);
  out = ac.createGain();
  out.gain.value = volume.sound;
  out.connect(limiter);
  musicBus = ac.createGain();
  musicBus.gain.value = volume.music;
  musicBus.connect(limiter);
  noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ac;
}

export const audioContext = () => ac;
export const musicOutput = () => musicBus;

export function setVolumes(sound, music) {
  volume.sound = sound;
  volume.music = music;
  if (out) out.gain.value = sound;
  if (musicBus) musicBus.gain.value = music;
}

export function setListener(x, y) {
  listener.x = x;
  listener.y = y;
}

function envelope(vol, dur, delay) {
  const g = ac.createGain();
  const t = ac.currentTime + delay;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(out);
  return [g, t];
}

function tone(type, f0, f1, dur, vol, delay = 0) {
  const [g, t] = envelope(vol, dur, delay);
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  o.connect(g);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol, kind, f0, f1, delay = 0) {
  const [g, t] = envelope(vol, dur, delay);
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = kind;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  src.connect(f);
  f.connect(g);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

/** How each effect is built from tones and filtered noise; v is its volume. */
const RECIPES = {
  pistol: (v) => { noise(0.13, 0.7 * v, 'lowpass', 3200, 500); tone('square', 240, 70, 0.07, 0.25 * v); },
  smg: (v) => { noise(0.08, 0.55 * v, 'bandpass', 2400, 900); tone('square', 300, 110, 0.05, 0.18 * v); },
  rifle: (v) => { noise(0.14, 0.7 * v, 'lowpass', 4200, 600); tone('sawtooth', 180, 60, 0.09, 0.25 * v); },
  shotgun: (v) => { noise(0.3, 0.9 * v, 'lowpass', 2200, 200); tone('square', 130, 40, 0.16, 0.35 * v); },
  launch: (v) => { noise(0.5, 0.6 * v, 'bandpass', 500, 2400); tone('sawtooth', 90, 300, 0.4, 0.2 * v); },
  boom: (v) => { noise(1.1, 1.0 * v, 'lowpass', 900, 50); tone('sine', 90, 28, 0.8, 0.9 * v); noise(0.2, 0.5 * v, 'highpass', 2000, 800); },
  crash: (v) => { noise(0.22, 0.7 * v, 'lowpass', 1800, 240); tone('square', 110, 50, 0.1, 0.2 * v); },
  clank: (v) => { tone('square', 620, 240, 0.09, 0.2 * v); noise(0.1, 0.3 * v, 'highpass', 3000, 1500); },
  skid: (v) => noise(0.3, 0.2 * v, 'bandpass', 1500, 1100),
  horn: (v) => { tone('square', 392, 392, 0.3, 0.14 * v); tone('square', 494, 494, 0.3, 0.14 * v); },
  door: (v) => { noise(0.07, 0.4 * v, 'lowpass', 700, 200); tone('sine', 140, 80, 0.06, 0.3 * v); },
  click: (v) => tone('square', 900, 700, 0.03, 0.1 * v),
  menu: (v) => { tone('triangle', 520, 780, 0.08, 0.16 * v); },
  empty: (v) => tone('square', 180, 150, 0.05, 0.14 * v),
  punch: (v) => { noise(0.08, 0.5 * v, 'lowpass', 600, 150); tone('sine', 160, 60, 0.08, 0.4 * v); },
  swish: (v) => noise(0.1, 0.15 * v, 'bandpass', 1400, 500),
  ricochet: (v) => tone('triangle', 2400, 700, 0.14, 0.12 * v),
  hurt: (v) => { tone('sawtooth', 210, 120, 0.14, 0.2 * v); },
  thud: (v) => tone('sine', 110, 45, 0.16, 0.4 * v),
  ignite: (v) => noise(0.5, 0.4 * v, 'bandpass', 400, 1600),
  star: (v) => { tone('square', 660, 660, 0.09, 0.14 * v); tone('square', 880, 880, 0.14, 0.14 * v, 0.1); },
  clear: (v) => { tone('triangle', 660, 660, 0.12, 0.2 * v); tone('triangle', 880, 880, 0.12, 0.2 * v, 0.1); tone('triangle', 1320, 1320, 0.25, 0.2 * v, 0.2); },
  objective: (v) => { tone('triangle', 740, 740, 0.08, 0.16 * v); tone('triangle', 988, 988, 0.14, 0.16 * v, 0.08); },
  mission: (v) => { tone('sawtooth', 196, 196, 0.5, 0.12 * v); tone('sawtooth', 294, 294, 0.5, 0.12 * v, 0.12); tone('sawtooth', 392, 392, 0.7, 0.12 * v, 0.24); },
  passed: (v) => { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.3, 0.2 * v, i * 0.11)); },
  failed: (v) => { [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.97, 0.3, 0.12 * v, i * 0.14)); },
  tick: (v) => tone('square', 1200, 1200, 0.04, 0.12 * v),
  pickup: (v) => { tone('triangle', 880, 1320, 0.12, 0.2 * v); },
  cash: (v) => { tone('triangle', 1320, 1320, 0.06, 0.16 * v); tone('triangle', 1760, 1760, 0.16, 0.16 * v, 0.07); },
  buy: (v) => { tone('triangle', 660, 990, 0.14, 0.18 * v); },
  spray: (v) => noise(0.9, 0.3 * v, 'highpass', 3000, 5000),
};

/** Plays a named effect. With a position it is quieter the farther it is from the listener. */
export function sfx(name, o = {}) {
  if (!ac || ac.state !== 'running') return;
  let v = o.vol ?? 1;
  if (o.x !== undefined) {
    v *= clamp(1 - Math.hypot(o.x - listener.x, o.y - listener.y) / 760, 0, 1) ** 1.5;
    if (v < 0.03) return;
  }
  RECIPES[name]?.(v);
}

/** The engine: a filtered sawtooth whose pitch follows the speed. `rev` is 0..1; off when not driving. */
export function updateEngine(on, rev, throttle) {
  if (!ac) return;
  if (!engine) {
    const o = ac.createOscillator();
    const o2 = ac.createOscillator();
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    o.type = 'sawtooth';
    o2.type = 'square';
    f.type = 'lowpass';
    g.gain.value = 0;
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(out);
    o.start();
    o2.start();
    engine = { o, o2, f, g };
  }
  const t = ac.currentTime;
  const hz = 46 + rev * 120;
  engine.o.frequency.setTargetAtTime(hz, t, 0.06);
  engine.o2.frequency.setTargetAtTime(hz * 0.5, t, 0.06);
  engine.f.frequency.setTargetAtTime(260 + rev * 1300 + throttle * 500, t, 0.08);
  engine.g.gain.setTargetAtTime(on ? 0.05 + throttle * 0.045 : 0, t, 0.1);
}

/** The wail of pursuing patrol cars; `level` 0..1 is how close the nearest one is. */
export function updateSiren(level, time) {
  if (!ac) return;
  if (!siren) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'triangle';
    g.gain.value = 0;
    o.connect(g);
    g.connect(out);
    o.start();
    siren = { o, g };
  }
  const t = ac.currentTime;
  siren.o.frequency.setTargetAtTime(760 + Math.sin(time * 4.2) * 260, t, 0.05);
  siren.g.gain.setTargetAtTime(level * 0.06, t, 0.15);
}
