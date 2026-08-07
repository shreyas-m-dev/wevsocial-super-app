import React, { useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '../../../kernel/theme';
import { MiniAppHost } from '../../../kernel/MiniAppHost';
import { careManifest } from '../../../mini-apps/care/manifest';
import { useAuthStore } from '../../../kernel/stores/auth';

export default function CareLayout(): React.JSX.Element {
  const { theme } = useTheme();
  const router = useRouter();
  
  const getUser = useCallback(() => {
    return useAuthStore.getState().getScopedUser();
  }, []);

  const onNavigate = useCallback((target: string, params?: Record<string, string>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push({ pathname: `/(tabs)/care/${target}` as any, params });
  }, [router]);

  return (
    <MiniAppHost manifest={careManifest} getUser={getUser} onNavigate={onNavigate}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Care Services' }} />
        <Stack.Screen name="[id]" options={{ title: 'Provider Details' }} />
      </Stack>
    </MiniAppHost>
  );
}
