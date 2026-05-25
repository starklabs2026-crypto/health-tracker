import type { FamilyMembershipView } from '@medical-tracker/shared-types';
import { useQuery } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { listFamilyMemberships } from '../lib/api/endpoints';
import { useProfileStore } from '../lib/profile/profileStore';
import { colors, radius, spacing } from '../theme/tokens';

export function ProfileSwitcher() {
  const { activeProfileId, setActiveProfile } = useProfileStore();

  const { data: memberships } = useQuery<FamilyMembershipView[]>({
    queryKey: ['family', 'memberships'],
    queryFn: listFamilyMemberships,
  });

  if (!memberships || memberships.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Pressable
          style={[styles.chip, activeProfileId === null && styles.chipActive]}
          onPress={() => setActiveProfile(null, null)}
        >
          <Text style={[styles.chipText, activeProfileId === null && styles.chipTextActive]}>
            My data
          </Text>
        </Pressable>
        {memberships.map((m) => (
          <Pressable
            key={m.link.id}
            style={[styles.chip, activeProfileId === m.link.ownerUserId && styles.chipActive]}
            onPress={() => setActiveProfile(m.link.ownerUserId, m.ownerName)}
          >
            <Text
              style={[
                styles.chipText,
                activeProfileId === m.link.ownerUserId && styles.chipTextActive,
              ]}
            >
              {m.ownerName}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.xs,
  },
  row: { paddingHorizontal: spacing.md, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
});
