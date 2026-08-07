import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../../kernel/theme';
import { apiRequest } from '../../../kernel/api/client';
import { CareProviderDTO } from '../../../types/api';
import { careManifest } from '../../../mini-apps/care/manifest';
import { useWevSDK } from '../../../kernel/SDKContext';

function useCareProviders() {
  return useQuery({
    queryKey: ['care', 'providers'],
    queryFn: async (): Promise<CareProviderDTO[]> => {
      const { data } = await apiRequest<CareProviderDTO[]>('/care/providers');
      return data;
    },
  });
}

export default function CareListScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const router = useRouter();
  const { data: providers, isLoading, refetch, isRefetching } = useCareProviders();
  const sdk = useWevSDK();

  useEffect(() => {
    const unsub = sdk.listen('sports:session_booked', (payload) => {
      if (payload && typeof payload === 'object' && 'title' in payload) {
        Toast.show({
          type: 'info',
          text1: `Need childcare during ${payload.title as string}?`,
          text2: 'Tap here to find providers',
          onPress: () => {
            // Optional: navigate and filter by time window
          },
        });
      }
    });
    return unsub;
  }, [sdk]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={careManifest.accentColor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={providers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={{ color: theme.textSecondary }}>No providers found.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onPress={() => router.push({ pathname: '/(tabs)/care/[id]' as any, params: { id: item.id } })}
            >
              <View style={styles.cardHeader}>
                <Text style={{ fontSize: 24 }}>❤️</Text>
                <View style={{ marginLeft: 12 }}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    {item.name} {item.isVerified && '✅'}
                  </Text>
                  <Text style={{ color: theme.textSecondary }}>${item.hourlyRate}/hr</Text>
                </View>
              </View>
              <View style={styles.servicesContainer}>
                {item.services.map((svc) => (
                  <View key={svc} style={[styles.badge, { backgroundColor: careManifest.accentColor + '20' }]}>
                    <Text style={{ color: careManifest.accentColor, fontSize: 12 }}>{svc}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: 'bold' },
  servicesContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});
