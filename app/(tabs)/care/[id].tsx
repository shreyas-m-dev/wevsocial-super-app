import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../../../kernel/theme';
import { apiRequest, ApiError } from '../../../kernel/api/client';
import { CareProviderDTO, CareBookingDTO } from '../../../types/api';
import { useNetworkStatus } from '../../../kernel/hooks/useNetworkStatus';
import { enqueue } from '../../../kernel/offline';
import { colors, spacing, borderRadius } from '../../../kernel/theme/tokens';

/**
 * Repository hook for provider details.
 * CRITICAL: Only returns obfuscated coordinates unless user has CONFIRMED booking.
 */
function useProviderDetails(id: string) {
  return useQuery({
    queryKey: ['care', 'providers', id],
    queryFn: async (): Promise<CareProviderDTO> => {
      const { data } = await apiRequest<CareProviderDTO>(`/care/providers/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

function useMyCareBookings() {
  return useQuery({
    queryKey: ['care', 'bookings'],
    queryFn: async (): Promise<CareBookingDTO[]> => {
      const { data } = await apiRequest<CareBookingDTO[]>('/care/bookings');
      return data;
    },
  });
}

/**
 * Care provider detail + booking screen.
 * 
 * GEO-PRIVACY: Shows obfuscated location until booking is CONFIRMED.
 * The API enforces this — we never filter client-side.
 * 
 * OFFLINE: Supports offline booking through the queue.
 */
export default function CareDetailScreen(): React.JSX.Element {
  const { id, startTime: prefilledStartTime, endTime: prefilledEndTime } = useLocalSearchParams<{ id: string; startTime?: string; endTime?: string }>();
  const { theme } = useTheme();
  const { isConnected } = useNetworkStatus();
  const queryClient = useQueryClient();
  const { data: provider, isLoading } = useProviderDetails(id ?? '');
  const { data: myBookings } = useMyCareBookings();
  const [isBooking, setIsBooking] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'pending_sync' | 'confirmed' | 'error'>('idle');

  const hasBooked = myBookings?.some((b) => b.provider.id === id && b.status !== 'CANCELLED');

  /**
   * Handle care booking — online or offline.
   * Uses a simplified time slot (next available 2-hour window).
   */
  const handleBook = async (): Promise<void> => {
    if (!provider) return;
    setIsBooking(true);

    let startIso: string;
    let endIso: string;

    if (prefilledStartTime && prefilledEndTime) {
      startIso = prefilledStartTime;
      endIso = prefilledEndTime;
    } else {
      // Generate a 2-hour time window starting from the next round hour
      const now = new Date();
      const startTime = new Date(now);
      startTime.setHours(startTime.getHours() + 1, 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 2);
      startIso = startTime.toISOString();
      endIso = endTime.toISOString();
    }

    try {
      if (isConnected) {
        await apiRequest<CareBookingDTO>('/care/bookings', {
          method: 'POST',
          body: {
            providerId: provider.id,
            startTime: startIso,
            endTime: endIso,
          },
        });

        setBookingStatus('confirmed');
        Toast.show({
          type: 'success',
          text1: 'Care Booked! 🎉',
          text2: `${provider.name} is confirmed for your booking`,
        });

        // Refresh provider details to get real location (if confirmed)
        await queryClient.invalidateQueries({ queryKey: ['care', 'providers', id] });
        // Invalidate bookings so the new booking appears in "my bookings"
        await queryClient.invalidateQueries({ queryKey: ['care', 'bookings'] });
      } else {
        await enqueue('care', {
          providerId: provider.id,
          startTime: startIso,
          endTime: endIso,
          providerName: provider.name,
        });

        setBookingStatus('pending_sync');
        Toast.show({
          type: 'info',
          text1: 'Queued for Sync 📱',
          text2: 'Booking will be confirmed when you go online',
        });
      }
    } catch (error: unknown) {
      setBookingStatus('error');
      Toast.show({
        type: 'error',
        text1: 'Booking Failed',
        text2: error instanceof ApiError ? error.message : 'An error occurred',
      });
    } finally {
      setIsBooking(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={colors.care} />
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>🔍</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 16 }}>Provider not found</Text>
      </View>
    );
  }

  const hasRealLocation = provider.realLat != null && provider.realLng != null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <Animated.View entering={FadeInUp.springify()}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.care + '15' }]}>
          <Text style={styles.headerEmoji}>👩‍⚕️</Text>
          <View style={styles.nameRow}>
            <Text style={[styles.title, { color: theme.text }]}>{provider.name}</Text>
            {provider.verified && (
              <View style={[styles.verifiedBadge, { backgroundColor: colors.success.main + '20' }]}>
                <Text style={{ color: colors.success.main, fontSize: 12, fontWeight: '600' }}>✓ Verified</Text>
              </View>
            )}
          </View>
          {provider.hourlyRate != null && (
            <Text style={[styles.rate, { color: colors.care }]}>${provider.hourlyRate}/hr</Text>
          )}
        </View>

        {/* Bio */}
        {provider.bio ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
            <Text style={{ color: theme.textSecondary, lineHeight: 22 }}>{provider.bio}</Text>
          </View>
        ) : null}

        {/* Location Card — GEO-PRIVACY */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>📍 Location</Text>
          {hasRealLocation ? (
            <View>
              <Text style={{ color: colors.success.main, fontWeight: '600' }}>
                Exact location available (booking confirmed)
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4 }}>
                Lat: {provider.realLat?.toFixed(4)}, Lng: {provider.realLng?.toFixed(4)}
              </Text>
            </View>
          ) : (
            <View>
              <Text style={{ color: colors.warning.main, fontWeight: '600' }}>
                Approximate location (~500m radius)
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>
                Exact address revealed after booking confirmation
              </Text>
            </View>
          )}
        </View>

        {/* Services */}
        {Array.isArray(provider.services) && provider.services.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Services</Text>
            <View style={styles.servicesContainer}>
              {provider.services.map((svc) => (
                <View key={svc} style={[styles.serviceBadge, { backgroundColor: colors.care + '15' }]}>
                  <Text style={{ color: colors.care, fontWeight: '500' }}>{svc}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Booking Status */}
        {bookingStatus === 'pending_sync' && (
          <View style={[styles.statusBanner, { backgroundColor: colors.warning.main + '20' }]}>
            <Text style={{ color: colors.warning.main, fontWeight: '600' }}>
              ⏳ Pending Sync — will confirm when online
            </Text>
          </View>
        )}
        {bookingStatus === 'confirmed' && (
          <View style={[styles.statusBanner, { backgroundColor: colors.success.main + '20' }]}>
            <Text style={{ color: colors.success.main, fontWeight: '600' }}>
              ✅ Booking Confirmed!
            </Text>
          </View>
        )}

        {/* Book Button */}
        <TouchableOpacity
          style={[
            styles.bookButton,
            { backgroundColor: bookingStatus === 'confirmed' || hasBooked ? theme.border : colors.care },
          ]}
          onPress={handleBook}
          disabled={isBooking || bookingStatus === 'confirmed' || hasBooked}
          activeOpacity={0.8}
        >
          {isBooking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bookButtonText}>
              {hasBooked || bookingStatus === 'confirmed'
                ? 'Already Booked ✓'
                : bookingStatus === 'pending_sync'
                ? 'Queued for Sync'
                : 'Book Care Provider'}
            </Text>
          )}
        </TouchableOpacity>

        {!isConnected && (
          <Text style={[styles.offlineHint, { color: theme.textMuted }]}>
            📵 You're offline. Bookings will sync when you reconnect.
          </Text>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.md },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerEmoji: { fontSize: 48, marginBottom: spacing.sm },
  title: { fontSize: 24, fontWeight: '700' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  rate: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  verifiedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBanner: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  bookButton: {
    height: 52,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  bookButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  offlineHint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});
