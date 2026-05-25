import { create } from 'zustand';

// Idle timeout (playbook §1.2.3): if backgrounded > 5 min, re-prompt biometric.
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

interface AuthState {
  /** Whether the session is unlocked (tokens present AND biometric passed). */
  unlocked: boolean;
  /** Timestamp the app was last active (for idle re-lock). */
  lastActiveAt: number;
  setUnlocked: (unlocked: boolean) => void;
  touch: () => void;
  /** True if the app has been idle/backgrounded longer than the timeout. */
  isStale: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  unlocked: false,
  lastActiveAt: Date.now(),
  setUnlocked: (unlocked) => set({ unlocked, lastActiveAt: Date.now() }),
  touch: () => set({ lastActiveAt: Date.now() }),
  isStale: () => Date.now() - get().lastActiveAt > IDLE_TIMEOUT_MS,
}));
