import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import Toast from 'react-native-toast-message';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAppConfigStore } from '@/stores/appConfigStore';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { token, serverUrl, deviceId, isLoading, initialize } = useAuthStore();
  const initializeSettings = useSettingsStore((state) => state.initialize);
  const { loadAppConfig, appConfig } = useAppConfigStore();

  useEffect(() => {
    initialize();
    initializeSettings();
  }, []);

  // Derive a stable boolean so the effect doesn't re-fire on every render
  // (useSegments() returns a new array reference each time).
  const inAuthGroup = segments[0] === '(auth)';
  const inUnassigned = segments[0] === 'unassigned';

  // Load app config when authenticated and have device ID
  useEffect(() => {
    if (token && serverUrl && deviceId && !isLoading) {
      loadAppConfig(serverUrl, token, deviceId).catch((error) => {
        console.error('Failed to load app config:', error);
      });
    }
  }, [token, serverUrl, deviceId, isLoading]);

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
      // Check if device has assigned app
      if (deviceId && appConfig === null && !inUnassigned) {
        // No app config loaded yet, might be unassigned
        router.replace('/unassigned');
      } else {
        router.replace('/(tabs)/chat');
      }
    }
  }, [token, inAuthGroup, isLoading, serverUrl, deviceId, appConfig, inUnassigned]);

  return (
    <WebSocketProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <Toast />
    </WebSocketProvider>
  );
}
