import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../../kernel/theme';
import { apiRequest } from '../../../kernel/api/client';
import { SportsActivityDTO } from '../../../types/api';
import { sportsManifest } from '../../../mini-apps/sports/manifest';

function useSportsActivities() {
  return useQuery({
    queryKey: ['sports', 'activities'],
    queryFn: async (): Promise<SportsActivityDTO[]> => {
      const { data } = await apiRequest<SportsActivityDTO[]>('/sports');
      return data;
    },
  });
}

export default function SportsListScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const router = useRouter();
  const { data: activities, isLoading, refetch, isRefetching } = useSportsActivities();

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={sportsManifest.accentColor} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={{ color: theme.textSecondary }}>No activities found.</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onPress={() => router.push({ pathname: '/(tabs)/sports/[id]' as any, params: { id: item.id } })}
            >
              <View style={styles.cardHeader}>
                <Text style={{ fontSize: 24 }}>⚽</Text>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
              </View>
              <Text style={{ color: theme.textSecondary, marginTop: 8 }}>{new Date(item.startTime).toLocaleString()}</Text>
              <Text style={{ color: theme.textSecondary }}>{item.location}</Text>
              <View style={[styles.badge, { backgroundColor: sportsManifest.accentColor + '20' }]}>
                <Text style={{ color: sportsManifest.accentColor, fontWeight: 'bold' }}>
                  {item.availableSpots} spots left
                </Text>
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
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 12 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 12 },
});
