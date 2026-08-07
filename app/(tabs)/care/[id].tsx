import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../../kernel/theme';
import { apiRequest } from '../../../kernel/api/client';
import { CareProviderDTO } from '../../../types/api';
import { careManifest } from '../../../mini-apps/care/manifest';
import { useNetworkStatus } from '../../../kernel/hooks/useNetworkStatus';
import { enqueue } from '../../../kernel/offline';

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

export default function CareDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const isOnline = useNetworkStatus();
  const { data: provider, isLoading } = useProviderDetails(id!);
  const [booking, setBooking] = useState(false);
  const [hasBooked, setHasBooked] = useState(false);

  const handleBook = async () => {
    if (!provider) return;
    setBooking(true);
    try {
      if (isOnline) {
        await apiRequest('/care/book', {
          method: 'POST',
          body: JSON.stringify({ providerId: provider.id }),
        });
        Toast.show({ type: 'success', text1: 'Booked Successfully' });
        setHasBooked(true);
      } else {
        await enqueue({
          type: 'POST',
          endpoint: '/care/book',
          payload: { providerId: provider.id },
        });
        Toast.show({ type: 'info', text1: 'Offline: Booking queued for sync' });
        // Assume booked for UI sake, offline sync will finalize
        setHasBooked(true);
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Booking failed' });
    } finally {
      setBooking(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={careManifest.accentColor} />
      </View>
    );
  }

  if (!provider) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textSecondary }}>Provider not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>
        {provider.name} {provider.isVerified && '✅'}
      </Text>
      <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.infoText, { color: theme.text }]}>Rating: {provider.rating} ⭐️</Text>
        <Text style={[styles.infoText, { color: theme.text }]}>Rate: ${provider.hourlyRate}/hr</Text>
        <Text style={[styles.infoText, { color: theme.text }]}>
          Location: {hasBooked ? provider.location.city : 'Obfuscated (~2 miles away)'}
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Services</Text>
      <View style={styles.servicesContainer}>
        {provider.services.map((svc) => (
          <View key={svc} style={[styles.badge, { backgroundColor: careManifest.accentColor + '20' }]}>
            <Text style={{ color: careManifest.accentColor }}>{svc}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: careManifest.accentColor }]}
        onPress={handleBook}
        disabled={booking}
      >
        {booking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Book Care Provider</Text>
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
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  infoCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  infoText: { fontSize: 16, marginBottom: 8 },
  servicesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  button: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
