// The car radio: three made-up stations whose music is composed on the fly by a small step
// sequencer (drums, bass, chords and a lead line), each with its own tempo, scale and mood.
import { audioContext, musicOutput } from './sound.js';

export const STATIONS = [
  { name: 'Tiki FM 99.1', host: 'Juno Tide', genre: 'Sunset synth', bpm: 104, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 3, 4], lead: 'sawtooth', swing: 0 },
  { name: 'Onda 102', host: 'DJ Marisol', genre: 'Harbor latin', bpm: 118, root: 43, scale: [0, 2, 4, 5, 7, 9, 10], chords: [0, 3, 4, 3], lead: 'triangle', swing: 0.14 },
  { name: 'Laguna Air 88', host: 'Night desk', genre: 'Slow tide', bpm: 78, root: 41, scale: [0, 2, 3, 7, 8], chords: [0, 2, 3, 1], lead: 'sine', swing: 0.08 },
];

const hz = (note) => 440 * 2 ** ((note - 69) / 12);
let nextTime = 0;
let step = 0;
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function voice(type, freq, t, dur, vol, cutoff) {
  const ac = audioContext();
  const o = ac.createOscillator();
  const g = ac.createGain();
  const f = ac.createBiquadFilter();
  o.type = type;
  o.frequency.value = freq;
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f);
  f.connect(g);
  g.connect(musicOutput());
  o.start(t);
  o.stop(t + dur + 0.03);
}

function drum(kind, t) {
  const ac = audioContext();
  const g = ac.createGain();
  g.connect(musicOutput());
  if (kind === 'kick') {
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.22);
    return;
  }
  const len = kind === 'snare' ? 0.14 : 0.04;
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * len), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = kind === 'snare' ? 1400 : 6000;
  g.gain.value = kind === 'snare' ? 0.22 : 0.09;
  src.connect(f);
  f.connect(g);
  src.start(t);
}

const degree = (st, d, octave = 0) => st.root + st.scale[((d % st.scale.length) + st.scale.length) % st.scale.length] + 12 * (octave + Math.floor(d / st.scale.length));

/** Schedules one sixteenth-note step of a station's pattern at time t. */
function playStep(st, n, t) {
  const bar = Math.floor(n / 16);
  const s = n % 16;
  const chord = st.chords[bar % st.chords.length];
  if (s % 8 === 0 || (st.bpm > 100 && s === 10)) drum('kick', t);
  if (s % 8 === 4) drum('snare', t);
  if (s % 2 === 0 || rand() < 0.2) drum('hat', t);
  if (s % 4 === 0 || s === 6 || s === 11) voice('square', hz(degree(st, chord, -1)), t, 0.2, 0.11, 500);
  if (s === 0 || s === 8) for (const d of [0, 2, 4]) voice('sawtooth', hz(degree(st, chord + d, 1)), t, st.bpm < 90 ? 1.3 : 0.55, 0.035, 1500);
  if (bar % 4 >= 1 && (s % 4 === 2 || rand() < 0.22)) voice(st.lead, hz(degree(st, chord + [0, 2, 4, 5, 7][Math.floor(rand() * 5)], 2)), t, 0.26, 0.06, 2600);
}

/** Keeps the music scheduled a little ahead of the clock while `playing`. */
export function updateRadio(G, playing) {
  const ac = audioContext();
  if (!ac || ac.state !== 'running') return;
  if (!playing || !G.radio.on) {
    nextTime = 0;
    return;
  }
  const st = STATIONS[G.radio.station];
  const sixteenth = 60 / st.bpm / 4;
  if (nextTime < ac.currentTime) {
    nextTime = ac.currentTime + 0.05;
    step = 0;
    seed = 7 + G.radio.station * 101;
  }
  while (nextTime < ac.currentTime + 0.18) {
    playStep(st, step, nextTime + (step % 2 ? st.swing * sixteenth : 0));
    nextTime += sixteenth;
    step++;
  }
}

export function nextStation(G) {
  const n = STATIONS.length + 1;
  const k = G.radio.on ? G.radio.station + 1 : 0;
  G.radio.on = k < n - 1;
  if (G.radio.on) G.radio.station = k;
  nextTime = 0;
  G.radio.shownT = 3;
  return G.radio.on ? STATIONS[G.radio.station] : null;
}
