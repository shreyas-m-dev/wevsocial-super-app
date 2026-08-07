import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../../kernel/theme';
import { apiRequest } from '../../../kernel/api/client';
import { SportsActivityDTO } from '../../../types/api';
import { useDebugStore } from '../../../kernel/stores/debug';
import { colors } from '../../../kernel/theme/tokens';

/**
 * Repository hook — data access through TanStack Query.
 * UI never calls apiRequest directly in render; only via this hook.
 */
function useSportsActivities() {
  return useQuery({
    queryKey: ['sports', 'activities'],
    queryFn: async (): Promise<SportsActivityDTO[]> => {
      const { data } = await apiRequest<SportsActivityDTO[]>('/sports');
      return data;
    },
  });
}

/**
 * Sports list screen.
 * Reads the debug crash flag to demonstrate fault isolation.
 */
export default function SportsListScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const router = useRouter();
  const { data: activities, isLoading, refetch, isRefetching } = useSportsActivities();
  const shouldCrash = useDebugStore((s) => s.shouldCrashSports);

  /**
   * FAULT ISOLATION TEST: If the crash flag is set from Settings,
   * this throws during render. The MiniAppErrorBoundary catches it,
   * and Care/Events continue running normally.
   */
  if (shouldCrash) {
    throw new Error(
      'Deliberate crash for fault isolation testing. ' +
      'Care and Events tabs should still work. ' +
      'Tap Retry to recover this mini-app.'
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        {/* Skeleton placeholder */}
        <ActivityIndicator size="large" color={colors.sports} />
        <Text style={{ color: theme.textMuted, marginTop: 12 }}>Loading activities...</Text>
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
        onRefresh={() => { refetch(); }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>🏃</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Activities Yet</Text>
            <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
              Check back soon for sports activities near you.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const spotsLeft = item.maxParticipants - item.currentParticipants;
          const sportEmoji = getSportEmoji(item.sportType);

          return (
            <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
              <TouchableOpacity
                style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => router.push(`/(tabs)/sports/${item.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.sportIcon, { backgroundColor: colors.sports + '20' }]}>
                    <Text style={{ fontSize: 24 }}>{sportEmoji}</Text>
                  </View>
                  <View style={styles.cardHeaderText}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
                    <Text style={[styles.sportType, { color: colors.sports }]}>
                      {item.sportType.charAt(0).toUpperCase() + item.sportType.slice(1)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDetails}>
                  <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                    📅 {new Date(item.startTime).toLocaleDateString()} · {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {item.locationName ? (
                    <Text style={{ color: theme.textSecondary, fontSize: 14, marginTop: 4 }}>
                      📍 {item.locationName}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.cardFooter}>
                  <View style={[
                    styles.badge,
                    { backgroundColor: spotsLeft > 3 ? colors.sports + '20' : colors.error.main + '20' }
                  ]}>
                    <Text style={{
                      color: spotsLeft > 3 ? colors.sports : colors.error.main,
                      fontWeight: '600',
                      fontSize: 13,
                    }}>
                      {spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        }}
      />
    </View>
  );
}

function getSportEmoji(sportType: string): string {
  const map: Record<string, string> = {
    soccer: '⚽',
    football: '🏈',
    basketball: '🏀',
    tennis: '🎾',
    badminton: '🏸',
    'ping pong': '🏓',
    swimming: '🏊',
    running: '🏃',
    volleyball: '🏐',
    cricket: '🏏',
  };
  return map[sportType.toLowerCase()] ?? '🏅';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sportIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sportType: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  cardDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ffffff10',
  },
  cardFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
});
