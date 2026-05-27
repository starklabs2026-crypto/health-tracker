import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../src/theme/tokens';

type FeatherName = ComponentProps<typeof Feather>['name'];

function TabIcon({ name, focused }: { name: FeatherName; focused: boolean }) {
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? colors.primary : colors.softSurface,
      }}
    >
      <Feather name={name} size={16} color={focused ? '#FFFFFF' : colors.textSecondary} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          height: 58 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarItemStyle: { gap: 1 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="documents"
        options={{ title: 'Docs', tabBarIcon: ({ focused }) => <TabIcon name="file-text" focused={focused} /> }}
      />
      <Tabs.Screen
        name="readings"
        options={{ title: 'Read', tabBarIcon: ({ focused }) => <TabIcon name="activity" focused={focused} /> }}
      />
      <Tabs.Screen
        name="family"
        options={{ title: 'Family', tabBarIcon: ({ focused }) => <TabIcon name="users" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ focused }) => <TabIcon name="user" focused={focused} /> }}
      />
    </Tabs>
  );
}
