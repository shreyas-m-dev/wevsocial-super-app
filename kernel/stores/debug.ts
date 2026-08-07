/**
 * Debug Store — global debug flags for testing.
 * 
 * Used by the Settings screen to trigger deliberate crashes
 * in mini-apps for fault isolation testing.
 */

import { create } from 'zustand';

interface DebugState {
  /** When true, the Sports screen will throw during render */
  shouldCrashSports: boolean;
  /** Toggle the crash flag */
  triggerSportsCrash: () => void;
  /** Reset the crash flag */
  resetSportsCrash: () => void;
}

export const useDebugStore = create<DebugState>((set) => ({
  shouldCrashSports: false,

  triggerSportsCrash: () => {
    set({ shouldCrashSports: true });
  },

  resetSportsCrash: () => {
    set({ shouldCrashSports: false });
  },
}));
