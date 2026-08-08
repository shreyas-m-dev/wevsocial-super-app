import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../../../kernel/theme';
import { apiRequest, ApiError } from '../../../kernel/api/client';
import { SportsActivityDTO, SportsBookingDTO } from '../../../types/api';
import { useWevSDK } from '../../../kernel/SDKContext';
import { useNetworkStatus } from '../../../kernel/hooks/useNetworkStatus';
import { enqueue } from '../../../kernel/offline';
import { colors, borderRadius, spacing } from '../../../kernel/theme/tokens';

/**
 * Repository hook for activity details.
 */
function useActivityDetails(id: string) {
  return useQuery({
    queryKey: ['sports', 'activities', id],
    queryFn: async (): Promise<SportsActivityDTO> => {
      const { data } = await apiRequest<SportsActivityDTO>(`/sports/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

/**
 * Sports detail + booking screen.
 * 
 * BRIDGE INTEGRATION: After a successful booking, emits 'sports:session_booked'
 * through the bridge. Care listens for this and offers childcare.
 * 
 * OFFLINE: If the device is offline, the booking is enqueued in the offline
 * queue and the UI shows "Pending Sync" state.
 */

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return 'Date TBD';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Date TBD';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatTime(dateStr: string | undefined | null): string {
  if (!dateStr) return '--:--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function SportsDetailScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id ?? '';
  const { theme } = useTheme();
  const sdk = useWevSDK();
  const { isConnected } = useNetworkStatus();
  const queryClient = useQueryClient();
  const { data: activity, isLoading } = useActivityDetails(id);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'pending_sync' | 'success' | 'error'>('idle');

  /**
   * Booking handler — online or offline path.
   * 
   * Online: POST to /sports/:id/book with idempotencyKey
   * Offline: Enqueue to offline queue, show Pending Sync
   * 
   * After success, emit bridge event for cross-mini-app coordination.
   */
  const handleBook = async (): Promise<void> => {
    if (!activity) return;
    setIsBooking(true);

    try {
      if (isConnected) {
        // Generate a client-side idempotency key for deduplication
        const idempotencyKey = `${activity.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        await apiRequest<SportsBookingDTO>(`/sports/${activity.id}/book`, {
          method: 'POST',
          body: { idempotencyKey },
        });

        setBookingStatus('success');
        Toast.show({
          type: 'success',
          text1: 'Booked! 🎉',
          text2: `You're in for ${activity.title}`,
        });

        // Invalidate activity query to refresh participant count
        await queryClient.invalidateQueries({ queryKey: ['sports', 'activities'] });
        // Invalidate bookings so the new booking appears in "my bookings"
        await queryClient.invalidateQueries({ queryKey: ['sports', 'bookings'] });

        /**
         * BRIDGE EVENT: Emit booking event for cross-mini-app coordination.
         * Care listens for this and offers "Need childcare during this session?"
         */
        try {
          sdk.bridge.emit('sports:session_booked', {
            activityId: activity.id,
            activityTitle: activity.title,
            sportType: activity.sportType,
            startTime: activity.startTime,
            endTime: activity.endTime,
            locationName: activity.locationName ?? 'Unknown',
          });
        } catch (bridgeError: unknown) {
          // Bridge emit failure shouldn't break the booking flow
          console.warn('[SportsDetail] Bridge emit failed:', bridgeError);
        }
      } else {
        // OFFLINE PATH: Queue the booking for later sync
        await enqueue('sports', {
          activityId: activity.id,
          activityTitle: activity.title,
        });

        setBookingStatus('pending_sync');
        Toast.show({
          type: 'info',
          text1: 'Queued for Sync 📱',
          text2: 'Your booking will be confirmed when you go online',
        });
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 409) {
        setBookingStatus('error');
        Toast.show({
          type: 'error',
          text1: 'Slot Full',
          text2: 'This activity is fully booked. Try another one!',
        });
      } else {
        setBookingStatus('error');
        Toast.show({
          type: 'error',
          text1: 'Booking Failed',
          text2: error instanceof Error ? error.message : 'An error occurred',
        });
      }
    } finally {
      setIsBooking(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={colors.sports} />
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>🔍</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 16 }}>Activity not found</Text>
      </View>
    );
  }

  const spotsLeft = (activity.maxParticipants ?? 0) - (activity.currentParticipants ?? 0);
  const isFull = spotsLeft <= 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <Animated.View entering={FadeInUp.springify()}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.sports + '15' }]}>
          <Text style={styles.headerEmoji}>⚽</Text>
          <Text style={[styles.title, { color: theme.text }]}>{activity.title}</Text>
          <Text style={[styles.sportType, { color: colors.sports }]}>
            {activity.sportType ? activity.sportType.charAt(0).toUpperCase() + activity.sportType.slice(1) : 'Sport'}
          </Text>
        </View>

        {/* Details Card */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {activity.description ? (
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {activity.description}
            </Text>
          ) : null}

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📅</Text>
            <View>
              <Text style={{ color: theme.text, fontWeight: '600' }}>
                {formatDate(activity.startTime)}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                {formatTime(activity.startTime)}
                {' – '}
                {formatTime(activity.endTime)}
              </Text>
            </View>
          </View>

          {activity.locationName ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>📍</Text>
              <Text style={{ color: theme.text }}>{activity.locationName}</Text>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>👥</Text>
            <Text style={{ color: isFull ? colors.error.main : theme.text }}>
              {isFull ? 'Fully booked' : `${spotsLeft} of ${activity.maxParticipants ?? '?'} spots available`}
            </Text>
          </View>
        </View>

        {/* Booking Status */}
        {bookingStatus === 'pending_sync' && (
          <View style={[styles.statusBanner, { backgroundColor: colors.warning.main + '20' }]}>
            <Text style={{ color: colors.warning.main, fontWeight: '600' }}>
              ⏳ Pending Sync — will confirm when online
            </Text>
          </View>
        )}
        {bookingStatus === 'success' && (
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
            { backgroundColor: isFull || bookingStatus === 'success' ? theme.border : colors.sports },
          ]}
          onPress={handleBook}
          disabled={isBooking || isFull || bookingStatus === 'success'}
          activeOpacity={0.8}
        >
          {isBooking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bookButtonText}>
              {bookingStatus === 'success'
                ? 'Already Booked ✓'
                : bookingStatus === 'pending_sync'
                ? 'Queued for Sync'
                : isFull
                ? 'Fully Booked'
                : 'Book Now'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Network status hint */}
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
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  sportType: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  card: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  description: { fontSize: 15, lineHeight: 22, marginBottom: spacing.md },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  detailIcon: { fontSize: 18, marginRight: spacing.sm, marginTop: 1 },
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
