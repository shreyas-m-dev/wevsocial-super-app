import React, { useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '../../../kernel/theme';
import { MiniAppHost } from '../../../kernel/MiniAppHost';
import { eventsManifest } from '../../../mini-apps/events/manifest';
import { useAuthStore } from '../../../kernel/stores/auth';

export default function EventsLayout(): React.JSX.Element {
  const { theme } = useTheme();
  const router = useRouter();
  
  const getUser = useCallback(() => {
    return useAuthStore.getState().getScopedUser();
  }, []);

  const onNavigate = useCallback((target: string, params?: Record<string, string>) => {
    const route = `/(tabs)/events/${target}` as `/${string}`;
    router.push({ pathname: route, params });
  }, [router]);

  return (
    <MiniAppHost manifest={eventsManifest} getUser={getUser} onNavigate={onNavigate}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Events' }} />
      </Stack>
    </MiniAppHost>
  );
}
