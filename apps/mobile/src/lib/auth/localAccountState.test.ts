import { describe, expect, it } from 'vitest';

import { Sex, UnitsPreference } from '@medical-tracker/shared-types';

import { clearLocalAccountState } from './localAccountState';
import { useAuthStore } from './authStore';
import { useOnboardingDraftStore } from '../onboarding/draftStore';
import { useProfileStore } from '../profile/profileStore';
import { queryClient } from '../query';

describe('sign out then sign up', () => {
  it('does not leave the previous account in memory', () => {
    useAuthStore.setState({ unlocked: true });
    useProfileStore.setState({ activeProfileId: 'previous-child', activeProfileName: 'Previous' });
    useOnboardingDraftStore.getState().setBasicDetails({
      name: 'Previous Person',
      dob: '1980-04-02',
      sex: Sex.Female,
      unitsPreference: UnitsPreference.Metric,
    });
    queryClient.setQueryData(['me'], { user: { id: 'previous', name: 'Previous Person' } });
    queryClient.setQueryData(['documents', 'previous-child'], { items: [{ id: 'doc-1' }] });

    clearLocalAccountState();

    expect(useAuthStore.getState().unlocked).toBe(false);
    expect(useProfileStore.getState()).toMatchObject({
      activeProfileId: null,
      activeProfileName: null,
    });
    expect(useOnboardingDraftStore.getState().basicDetails).toBeNull();
    expect(queryClient.getQueryData(['me'])).toBeUndefined();
    expect(queryClient.getQueryData(['documents', 'previous-child'])).toBeUndefined();

    useAuthStore.setState({ unlocked: true });
    expect(useProfileStore.getState().activeProfileName).toBeNull();
    expect(queryClient.getQueryData(['me'])).toBeUndefined();
  });
});
