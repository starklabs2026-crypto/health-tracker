import { create } from 'zustand';

interface ProfileState {
  /** null = viewing own profile; string = viewing this owner's userId */
  activeProfileId: string | null;
  activeProfileName: string | null;
  setActiveProfile: (id: string | null, name: string | null) => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  activeProfileId: null,
  activeProfileName: null,
  setActiveProfile: (id, name) => set({ activeProfileId: id, activeProfileName: name }),
}));
