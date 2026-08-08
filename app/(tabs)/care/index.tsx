import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown, withRepeat, withTiming, useSharedValue, useAnimatedStyle, useEffect as useAnimatedEffect, withSequence } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../../kernel/theme';
import { apiRequest } from '../../../kernel/api/client';
import { CareProviderDTO } from '../../../types/api';
import { useWevSDK } from '../../../kernel/SDKContext';
import { colors, spacing, borderRadius } from '../../../kernel/theme/tokens';

/**
 * Repository hook — fetches care providers with obfuscated coordinates.
 * CRITICAL: The API response NEVER contains real lat/lng.
 */
function useCareProviders() {
  return useQuery({
    queryKey: ['care', 'providers'],
    queryFn: async (): Promise<CareProviderDTO[]> => {
      const { data } = await apiRequest<CareProviderDTO[]>('/care/providers');
      return data;
    },
  });
}

function SkeletonCard() {
  const { theme } = useTheme();
  const opacity = useSharedValue(0.5);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.5, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, animatedStyle]}>
      <View style={styles.cardHeader}>
        <View style={[styles.providerIcon, { backgroundColor: theme.border }]} />
        <View style={styles.cardHeaderText}>
          <View style={{ height: 18, width: 140, backgroundColor: theme.border, borderRadius: 4, marginBottom: 6 }} />
          <View style={{ height: 14, width: 60, backgroundColor: theme.border, borderRadius: 4 }} />
        </View>
      </View>
      <View style={{ height: 14, width: '100%', backgroundColor: theme.border, borderRadius: 4, marginTop: 12, marginBottom: 6 }} />
      <View style={{ height: 14, width: '80%', backgroundColor: theme.border, borderRadius: 4 }} />
    </Animated.View>
  );
}

/**
 * Care provider list screen.
 * 
 * BRIDGE INTEGRATION: Listens for 'sports:session_booked' events from Sports.
 * When a sports session is booked, shows a toast banner offering childcare
 * for that time window. Tapping deep-links into the care booking flow.
 */

function formatTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '--:--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function CareListScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const router = useRouter();
  const { data: providers, isLoading, refetch, isRefetching } = useCareProviders();
  const sdk = useWevSDK();
  const [suggestedTimeWindow, setSuggestedTimeWindow] = useState<{
    startTime: string;
    endTime: string;
    activityTitle: string;
  } | null>(null);

  /**
   * CROSS-MINI-APP COORDINATION:
   * Listen for sports booking events through the bridge.
   * When Sports emits 'sports:session_booked', Care shows a contextual
   * banner offering childcare for the booked time window.
   */
  useEffect(() => {
    const unsubscribe = sdk.bridge.on('sports:session_booked', (payload) => {
      setSuggestedTimeWindow({
        startTime: payload.startTime,
        endTime: payload.endTime,
        activityTitle: payload.activityTitle,
      });

      Toast.show({
        type: 'info',
        text1: `Need childcare during ${payload.activityTitle}?`,
        text2: 'Tap to find available providers',
        visibilityTime: 5000,
      });
    });

    return unsubscribe;
  }, [sdk]);

  const dismissSuggestion = useCallback(() => {
    setSuggestedTimeWindow(null);
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.list}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Cross-app suggestion banner */}
      {suggestedTimeWindow && (
        <Animated.View entering={FadeInDown.springify()}>
          <TouchableOpacity
            style={[styles.suggestionBanner, { backgroundColor: colors.care + '20', borderColor: colors.care + '40' }]}
            onPress={() => {
              // Deep-link to first available provider
              if (providers && providers.length > 0) {
                const firstProvider = providers[0];
                if (firstProvider) {
                  router.push({
                    pathname: `/(tabs)/care/${firstProvider.id}` as `/${string}`,
                    params: {
                      startTime: suggestedTimeWindow.startTime,
                      endTime: suggestedTimeWindow.endTime,
                    },
                  });
                }
              }
              dismissSuggestion();
            }}
            activeOpacity={0.8}
          >
            <View style={styles.suggestionContent}>
              <Text style={{ fontSize: 20 }}>👶</Text>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={{ color: colors.care, fontWeight: '700', fontSize: 14 }}>
                  Need childcare during {suggestedTimeWindow.activityTitle}?
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {formatTime(suggestedTimeWindow.startTime)}
                  {' – '}
                  {formatTime(suggestedTimeWindow.endTime)}
                </Text>
              </View>
              <TouchableOpacity onPress={dismissSuggestion}>
                <Text style={{ color: theme.textMuted, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      <FlatList
        data={providers ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={isRefetching}
        onRefresh={() => { refetch(); }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48 }}>❤️</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Providers Yet</Text>
            <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>
              Check back soon for vetted childcare and eldercare providers.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
            <TouchableOpacity
              style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.push(`/(tabs)/care/${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.providerIcon, { backgroundColor: colors.care + '20' }]}>
                  <Text style={{ fontSize: 24 }}>👩‍⚕️</Text>
                </View>
                <View style={styles.cardHeaderText}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>{item.name}</Text>
                    {item.verified && (
                      <View style={[styles.verifiedBadge, { backgroundColor: colors.success.main + '20' }]}>
                        <Text style={{ color: colors.success.main, fontSize: 11, fontWeight: '600' }}>✓ Verified</Text>
                      </View>
                    )}
                  </View>
                  {item.hourlyRate != null && (
                    <Text style={{ color: colors.care, fontWeight: '600', fontSize: 14, marginTop: 2 }}>
                      ${item.hourlyRate}/hr
                    </Text>
                  )}
                </View>
              </View>

              {item.bio ? (
                <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: spacing.sm }} numberOfLines={2}>
                  {item.bio}
                </Text>
              ) : null}

              {Array.isArray(item.services) && item.services.length > 0 && (
                <View style={styles.servicesContainer}>
                  {item.services.map((svc) => (
                    <View key={svc} style={[styles.serviceBadge, { backgroundColor: colors.care + '15' }]}>
                      <Text style={{ color: colors.care, fontSize: 12, fontWeight: '500' }}>{svc}</Text>
                    </View>
                  ))}
                </View>
              )}
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
  list: { padding: spacing.md },
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
  suggestionBanner: {
    margin: spacing.md,
    marginBottom: 0,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  verifiedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: 6,
  },
  serviceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
});
