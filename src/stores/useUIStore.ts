import { create } from 'zustand';

interface UIState {
  message: string | null;
  messageTimeout: number | null;
  interactionPrompt: string | null;

  showMessage: (msg: string, duration?: number) => void;
  hideMessage: () => void;
  setInteractionPrompt: (prompt: string | null) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  message: null,
  messageTimeout: null,
  interactionPrompt: null,

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
}));
