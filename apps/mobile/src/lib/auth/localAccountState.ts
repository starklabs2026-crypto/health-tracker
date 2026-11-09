import { useAuthStore } from './authStore';
import { useOnboardingDraftStore } from '../onboarding/draftStore';
import { useProfileStore } from '../profile/profileStore';
import { queryClient } from '../query';

/** Drop every in-memory account cache before another person signs in. */
export function clearLocalAccountState(): void {
  queryClient.clear();
  useProfileStore.setState({ activeProfileId: null, activeProfileName: null });
  useOnboardingDraftStore.getState().clear();
  useAuthStore.setState({ unlocked: false });
}
