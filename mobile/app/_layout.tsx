import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import Toast from 'react-native-toast-message';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { token, serverUrl, isLoading, initialize } = useAuthStore();
  const initializeSettings = useSettingsStore((state) => state.initialize);

  useEffect(() => {
    initialize();
    initializeSettings();
  }, []);

  // Derive a stable boolean so the effect doesn't re-fire on every render
  // (useSegments() returns a new array reference each time).
  const inAuthGroup = segments[0] === '(auth)';

  useEffect(() => {
    if (isLoading) return;

    if (!token && !inAuthGroup) {
      // If we already have a serverUrl, go directly to login instead of setup
      if (serverUrl) {
        router.replace('/(auth)/login');
      } else {
        router.replace('/(auth)/connect');
      }
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)/chat');
    }
  }, [token, inAuthGroup, isLoading, serverUrl]);

  return (
    <WebSocketProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <Toast />
    </WebSocketProvider>
  );
}
