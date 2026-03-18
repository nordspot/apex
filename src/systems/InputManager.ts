import { create } from 'zustand';

interface InputState {
  moveX: number; // -1 to 1
  moveY: number; // -1 to 1
  interact: boolean;

  setMove: (x: number, y: number) => void;
  setInteract: (pressed: boolean) => void;
}

export const useInputStore = create<InputState>((set) => ({
  moveX: 0,
  moveY: 0,
  interact: false,

  setMove: (x, y) => set({ moveX: x, moveY: y }),
  setInteract: (pressed) => set({ interact: pressed }),
}));

// Keyboard state tracked outside React for useFrame access
const keys: Record<string, boolean> = {};

function onKeyDown(e: KeyboardEvent) {
  keys[e.code] = true;
  if (e.code === 'KeyE' || e.code === 'Space') {
    useInputStore.getState().setInteract(true);
  }
  updateMove();
}

function onKeyUp(e: KeyboardEvent) {
  keys[e.code] = false;
  if (e.code === 'KeyE' || e.code === 'Space') {
    useInputStore.getState().setInteract(false);
  }
  updateMove();
}

function updateMove() {
  const x = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
  const y = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
  useInputStore.getState().setMove(x, y);
}

let initialized = false;

export function initKeyboardInput() {
  if (initialized) return;
  initialized = true;
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}

export function cleanupKeyboardInput() {
  initialized = false;
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
}
