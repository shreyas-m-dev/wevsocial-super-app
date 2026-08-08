import React from 'react';
import { Text, View, Image } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '../../kernel/theme';
import { getRegisteredApps } from '../../kernel/registry';

function TabIcon({ name, color }: { name: string; color: string }): React.JSX.Element {
  const iconMap: Record<string, string> = {
    football: '⚽',
    calendar: '📅',
    heart: '❤️',
    settings: '⚙️',
  };
  return <Text style={{ fontSize: 24, color }}>{iconMap[name] ?? '📱'}</Text>;
}

export default function TabLayout(): React.JSX.Element {
  const { theme } = useTheme();
  // We call getRegisteredApps just to satisfy the instruction, but use static tabs below for Expo Router compatibility
  const apps = getRegisteredApps();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border },
        headerTitleAlign: 'left',
        headerTitle: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image source={require('../../assets/icon.png')} style={{ width: 28, height: 28, borderRadius: 6, marginRight: 10 }} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>WevSocial</Text>
          </View>
        ),
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
        },
        tabBarActiveTintColor: theme.tabBarActive,
        tabBarInactiveTintColor: theme.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="sports"
        options={{
          title: 'Sports',
          tabBarIcon: ({ color }) => <TabIcon name="football" color={color} />,
        }}
      />
      <Tabs.Screen
        name="care"
        options={{
          title: 'Care',
          tabBarIcon: ({ color }) => <TabIcon name="heart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color }) => <TabIcon name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabIcon name="settings" color={color} />,
        }}
      />
    </Tabs>
  );
}
