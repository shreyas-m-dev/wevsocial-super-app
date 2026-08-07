import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../../kernel/theme';
import { apiRequest } from '../../../kernel/api/client';
import { SportsActivityDTO } from '../../../types/api';
import { sportsManifest } from '../../../mini-apps/sports/manifest';
import { useWevSDK } from '../../../kernel/SDKContext';
import { useNetworkStatus } from '../../../kernel/hooks/useNetworkStatus';
import { enqueue } from '../../../kernel/offline';
import { create } from 'zustand';

// Store for debug crash
export const useDebugStore = create<{ crashFlag: boolean; setCrashFlag: (val: boolean) => void }>((set) => ({
  crashFlag: false,
  setCrashFlag: (val) => set({ crashFlag: val }),
}));

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

export default function SportsDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const sdk = useWevSDK();
  const isOnline = useNetworkStatus();
  const { data: activity, isLoading } = useActivityDetails(id!);
  const [booking, setBooking] = useState(false);
  const crashFlag = useDebugStore((state) => state.crashFlag);

  if (crashFlag) {
    throw new Error('Intentional crash from debug settings!');
  }

  const handleBook = async () => {
    if (!activity) return;
    setBooking(true);
    try {
      if (isOnline) {
        await apiRequest('/sports/book', {
          method: 'POST',
          body: JSON.stringify({ activityId: activity.id }),
        });
        Toast.show({ type: 'success', text1: 'Booked Successfully' });
      } else {
        await enqueue({
          type: 'POST',
          endpoint: '/sports/book',
          payload: { activityId: activity.id },
        });
        Toast.show({ type: 'info', text1: 'Offline: Booking queued for sync' });
      }
      sdk.emit('sports:session_booked', { activityId: activity.id, title: activity.title, startTime: activity.startTime });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Booking failed' });
    } finally {
      setBooking(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={sportsManifest.accentColor} />
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>Activity not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>{activity.title}</Text>
      <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.infoText, { color: theme.text }]}>📅 {new Date(activity.startTime).toLocaleString()}</Text>
        <Text style={[styles.infoText, { color: theme.text }]}>📍 {activity.location}</Text>
        <Text style={[styles.infoText, { color: theme.text }]}>👤 {activity.organizerId}</Text>
        <Text style={[styles.infoText, { color: sportsManifest.accentColor }]}>{activity.availableSpots} spots left</Text>
      </View>

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: sportsManifest.accentColor }]}
        onPress={handleBook}
        disabled={booking}
      >
        {booking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Book Now</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
  infoCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 24 },
  infoText: { fontSize: 16, marginBottom: 8 },
  button: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
