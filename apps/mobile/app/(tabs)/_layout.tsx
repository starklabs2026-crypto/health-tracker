import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../src/theme/tokens';

type FeatherName = ComponentProps<typeof Feather>['name'];

function TabIcon({ name, label, focused }: { name: FeatherName; label: string; focused: boolean }) {
  return (
    <View
      style={{
        width: focused ? 86 : 58,
        height: 58,
        borderRadius: 29,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        backgroundColor: focused ? colors.primaryBg : 'transparent',
      }}
    >
      <Feather
        name={name}
          size={focused ? 24 : 22}
        color={focused ? colors.primary : colors.textSecondary}
      />
      <Text
        numberOfLines={1}
        style={{
          color: focused ? colors.primary : colors.textSecondary,
          fontSize: 12,
          lineHeight: 15,
          fontFamily: 'AvenirNext-Medium',
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
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
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: Math.max(insets.bottom + 6, 12),
          height: 80,
          borderTopWidth: 0,
          borderWidth: 0,
          borderRadius: 40,
          backgroundColor: '#FFFFFF',
          paddingTop: 7,
          paddingBottom: 7,
          shadowColor: '#15232B',
          shadowOpacity: 0.1,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
        },
        tabBarShowLabel: false,
        tabBarItemStyle: { alignItems: 'center', justifyContent: 'center' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => <TabIcon name="home" label="Today" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'Docs',
          tabBarIcon: ({ focused }) => <TabIcon name="file-text" label="Docs" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="readings"
        options={{
          title: 'Trends',
          tabBarIcon: ({ focused }) => <TabIcon name="activity" label="Trends" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Family',
          tabBarIcon: ({ focused }) => <TabIcon name="users" label="Family" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="user" label="Profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
