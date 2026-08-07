import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { useTheme } from '../../kernel/theme';
import { useAuthStore } from '../../kernel/stores/auth';

import { colors } from '../../kernel/theme/tokens';

export default function LoginScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore(state => state.login);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      // RootLayout handles redirection
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.primary }]}>WevSocial</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Welcome back</Text>
      
      {error && <Text style={[styles.error, { color: colors.error.main }]}>{error}</Text>}

      <TextInput
        style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
        placeholder="Email"
        placeholderTextColor={theme.textSecondary}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      
      <TextInput
        style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
        placeholder="Password"
        placeholderTextColor={theme.textSecondary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={theme.background} />
        ) : (
          <Text style={[styles.buttonText, { color: theme.background }]}>Login</Text>
        )}
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={{ color: theme.textSecondary }}>Don't have an account? </Text>
        <Link href="/(auth)/register" asChild>
          <TouchableOpacity>
            <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Sign up</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 42, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 18, textAlign: 'center', marginBottom: 32 },
  input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, fontSize: 16 },
  button: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  buttonText: { fontSize: 16, fontWeight: 'bold' },
  error: { marginBottom: 16, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
});
