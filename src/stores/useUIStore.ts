import { create } from 'zustand';

export type GamePhase = 'start' | 'onboarding' | 'playing' | 'complete';

interface UIState {
  gamePhase: GamePhase;
  message: string | null;
  messageTimeout: number | null;
  interactionPrompt: string | null;
  startTime: number | null;
  endTime: number | null;

  setGamePhase: (phase: GamePhase) => void;
  showMessage: (msg: string, duration?: number) => void;
  hideMessage: () => void;
  setInteractionPrompt: (prompt: string | null) => void;
  startTimer: () => void;
  stopTimer: () => void;
  getElapsedMs: () => number;
}

export const useUIStore = create<UIState>((set, get) => ({
  gamePhase: 'start',
  message: null,
  messageTimeout: null,
  interactionPrompt: null,
  startTime: null,
  endTime: null,

  setGamePhase: (phase) => set({ gamePhase: phase }),

  showMessage: (msg, duration = 4000) => {
    const prev = get().messageTimeout;
    if (prev) clearTimeout(prev);
    const timeout = window.setTimeout(() => set({ message: null, messageTimeout: null }), duration);
    set({ message: msg, messageTimeout: timeout });
  },

  hideMessage: () => {
    const prev = get().messageTimeout;
    if (prev) clearTimeout(prev);
    set({ message: null, messageTimeout: null });
  },

  setInteractionPrompt: (prompt) => set({ interactionPrompt: prompt }),

  startTimer: () => set({ startTime: Date.now(), endTime: null }),
  stopTimer: () => set({ endTime: Date.now() }),
  getElapsedMs: () => {
    const { startTime, endTime } = get();
    if (!startTime) return 0;
    return (endTime ?? Date.now()) - startTime;
  },
}));
