// Keyboard and mouse state: which keys are held, which were tapped this frame, where the
// mouse points and whether it fires. Systems read it; nothing here knows about the game.

const keys = new Set();
const taps = new Set();
export const mouse = { x: 640, y: 360, down: false, clicked: false, wheel: 0, moved: false };

const GAME_KEYS = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);

export function bindInput(canvas, onFirstGesture) {
  let woke = false;
  const wake = () => {
    if (!woke) {
      woke = true;
      onFirstGesture?.();
    }
  };
  addEventListener('keydown', (e) => {
    wake();
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) taps.add(e.code);
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  const place = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
    mouse.moved = true;
  };
  canvas.addEventListener('mousemove', place);
  canvas.addEventListener('mousedown', (e) => {
    wake();
    place(e);
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
  });
  canvas.addEventListener('wheel', (e) => {
    mouse.wheel += Math.sign(e.deltaY);
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

export const held = (...codes) => codes.some((c) => keys.has(c));
export const tapped = (...codes) => codes.some((c) => taps.has(c));

/** Forgets the taps and clicks of the frame that has just been simulated. */
export function endInputFrame() {
  taps.clear();
  mouse.clicked = false;
  mouse.wheel = 0;
}

/** WASD or the arrow keys as a direction: x is right, y is down. */
export function moveAxis() {
  const x = (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0);
  const y = (held('KeyS', 'ArrowDown') ? 1 : 0) - (held('KeyW', 'ArrowUp') ? 1 : 0);
  return { x, y };
}

/** Lets the self-test and the screenshot scenes press keys. */
export function pressKey(code, down = true) {
  if (down) {
    keys.add(code);
    taps.add(code);
  } else keys.delete(code);
}
