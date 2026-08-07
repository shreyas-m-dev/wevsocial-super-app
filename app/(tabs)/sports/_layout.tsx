import React, { useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '../../../kernel/theme';
import { MiniAppHost } from '../../../kernel/MiniAppHost';
import { sportsManifest } from '../../../mini-apps/sports/manifest';
import { useAuthStore } from '../../../kernel/stores/auth';

export default function SportsLayout(): React.JSX.Element {
  const { theme } = useTheme();
  const router = useRouter();
  
  const getUser = useCallback(() => {
    return useAuthStore.getState().getScopedUser();
  }, []);

  const onNavigate = useCallback((target: string, params?: Record<string, string>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push({ pathname: `/(tabs)/sports/${target}` as any, params });
  }, [router]);

  return (
    <MiniAppHost manifest={sportsManifest} getUser={getUser} onNavigate={onNavigate}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Sports' }} />
        <Stack.Screen name="[id]" options={{ title: 'Activity Details' }} />
      </Stack>
    </MiniAppHost>
  );
}
