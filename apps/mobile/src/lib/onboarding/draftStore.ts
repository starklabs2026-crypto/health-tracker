import type { Sex, UnitsPreference, UpdateMeRequest } from '@medical-tracker/shared-types';
import { create } from 'zustand';

interface OnboardingDraftState {
  basicDetails: UpdateMeRequest | null;
  setBasicDetails: (details: {
    name: string;
    dob: string;
    sex: Sex;
    unitsPreference: UnitsPreference;
  }) => void;
  clear: () => void;
}

export const useOnboardingDraftStore = create<OnboardingDraftState>((set) => ({
  basicDetails: null,
  setBasicDetails: (details) => set({ basicDetails: details }),
  clear: () => set({ basicDetails: null }),
}));
