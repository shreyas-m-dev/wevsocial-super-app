import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../kernel/theme';

export default function EventsListScreen(): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>📅</Text>
      <Text style={[styles.title, { color: theme.text }]}>Events Coming Soon</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Discover local meetups and classes in your area.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center' },
});
