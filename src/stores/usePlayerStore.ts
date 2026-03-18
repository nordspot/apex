import { create } from 'zustand';
import type { RepairState } from '../types/game';

interface PlayerState {
  repairState: RepairState;
  partsCollected: string[];
  isMoving: boolean;

  collectPart: (partId: string, grantState: RepairState) => void;
  setIsMoving: (moving: boolean) => void;
  reset: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  repairState: 0,
  partsCollected: [],
  isMoving: false,

  collectPart: (partId, grantState) =>
    set((state) => {
      if (state.partsCollected.includes(partId)) return state;
      return {
        partsCollected: [...state.partsCollected, partId],
        repairState: Math.max(state.repairState, grantState) as RepairState,
      };
    }),

  setIsMoving: (moving) => set({ isMoving: moving }),

  reset: () => set({ repairState: 0, partsCollected: [], isMoving: false }),
}));
