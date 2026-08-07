import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../kernel/stores/auth';

export default function Index() {
  const { isAuthenticated } = useAuthStore();
  
  if (isAuthenticated) {
    return <Redirect href="/(tabs)/sports" />;
  }
  
  return <Redirect href="/(auth)/login" />;
}
