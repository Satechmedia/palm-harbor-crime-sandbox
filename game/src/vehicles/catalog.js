// Every vehicle model of Palm Harbor: its made-up name, size, handling numbers, hit points,
// body style and paint choices. Speeds are world units a second (about 4.5 units = 1 mph).

const PAINTS = ['#e2374d', '#f5bd4e', '#36c9e0', '#f4f1e8', '#2b2f3a', '#ff7a45', '#7d6bff', '#2ecc71', '#ff8fb3', '#9aa4b1', '#1f6fd6', '#b0362f'];

export const VEHICLES = {
  pico: { name: 'Pico', kind: 'hatchback', len: 38, wid: 19, accel: 250, top: 330, grip: 8, turn: 3.2, hp: 90, value: 300, paints: PAINTS },
  calypso: { name: 'Calypso', kind: 'sedan', len: 46, wid: 21, accel: 270, top: 380, grip: 7, turn: 2.9, hp: 110, value: 500, paints: PAINTS },
  tortuga: { name: 'Tortuga', kind: 'suv', len: 48, wid: 23, accel: 250, top: 360, grip: 6.5, turn: 2.6, hp: 150, value: 700, paints: PAINTS },
  mule: { name: 'Mule', kind: 'pickup', len: 50, wid: 22, accel: 240, top: 350, grip: 6, turn: 2.6, hp: 140, value: 450, paints: PAINTS },
  brava: { name: 'Brava 440', kind: 'muscle', len: 48, wid: 22, accel: 360, top: 470, grip: 5.6, turn: 2.8, hp: 120, value: 1200, paints: ['#ff7a45', '#2b2f3a', '#e2374d', '#f5bd4e', '#1f6fd6'], stripe: true },
  marlin: { name: 'Marlin GT', kind: 'sports', len: 45, wid: 21, accel: 420, top: 520, grip: 7.6, turn: 3.2, hp: 100, value: 2400, paints: ['#e2374d', '#f5bd4e', '#36c9e0', '#ff8fb3', '#f4f1e8'] },
  aurelia: { name: 'Aurelia V', kind: 'super', len: 46, wid: 22, accel: 520, top: 600, grip: 8.4, turn: 3.3, hp: 110, value: 9000, paints: ['#ff2f8e', '#b98cff', '#36e0d0'] },
  solcab: { name: 'Sol Cab', kind: 'sedan', len: 46, wid: 21, accel: 280, top: 390, grip: 7, turn: 2.9, hp: 120, value: 350, paints: ['#ffcf33'], taxi: true },
  kitevan: { name: 'Kite Van', kind: 'van', len: 54, wid: 24, accel: 220, top: 320, grip: 6, turn: 2.4, hp: 170, value: 400, paints: ['#f4d35e', '#f4f1e8', '#9aa4b1'] },
  reefer: { name: 'Glacier Reefer', kind: 'truck', len: 70, wid: 26, accel: 180, top: 290, grip: 5.6, turn: 2.0, hp: 320, value: 900, paints: ['#e8edf0'] },
  harborbus: { name: 'Harbor Line 9', kind: 'bus', len: 78, wid: 26, accel: 150, top: 260, grip: 5.6, turn: 1.8, hp: 300, value: 600, paints: ['#36c9e0', '#ff8fb3'] },
  interceptor: { name: 'PHPD Interceptor', kind: 'sedan', len: 47, wid: 21, accel: 400, top: 500, grip: 7.8, turn: 3.1, hp: 150, value: 0, paints: ['#f4f1e8'], police: true },
  rhino: { name: 'PHPD Rhino', kind: 'van', len: 56, wid: 25, accel: 300, top: 420, grip: 6.6, turn: 2.5, hp: 320, value: 0, paints: ['#27364f'], police: true, armored: true },
  vault: { name: 'Pelican Vault', kind: 'van', len: 56, wid: 25, accel: 230, top: 340, grip: 6.2, turn: 2.3, hp: 420, value: 0, paints: ['#3c4a3f'], armored: true },
};

/** How often each model turns up in traffic, by district. */
export const TRAFFIC_MIX = {
  beach: ['pico', 'pico', 'calypso', 'marlin', 'brava', 'solcab', 'tortuga', 'harborbus'],
  downtown: ['calypso', 'calypso', 'solcab', 'solcab', 'tortuga', 'marlin', 'pico', 'harborbus', 'kitevan'],
  oldtown: ['pico', 'pico', 'calypso', 'mule', 'solcab', 'kitevan', 'brava'],
  suburbs: ['tortuga', 'tortuga', 'calypso', 'marlin', 'mule', 'pico', 'aurelia'],
  docks: ['mule', 'mule', 'kitevan', 'reefer', 'reefer', 'calypso', 'pico'],
};

export const mph = (speed) => Math.round(Math.abs(speed) * 0.224);
