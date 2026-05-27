import '../global.css';
import { useEffect, useMemo } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useAppConfigStore } from '@/stores/appConfigStore';
import { buildNavigationTheme } from '@/theme/navigationTheme';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { token, serverUrl, deviceId, isLoading, initialize } = useAuthStore();
  const initializeSettings = useSettingsStore((state) => state.initialize);
  const { loadAppConfig, hydrateFromCache, appConfig } = useAppConfigStore();
  const darkMode = appConfig?.dark_mode ?? false;
  const navigationTheme = useMemo(() => buildNavigationTheme(darkMode), [darkMode]);

  useEffect(() => {
    initialize();
    initializeSettings();
    hydrateFromCache().catch((error) => {
      console.warn('Failed to hydrate app config from cache:', error);
    });
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
    <ThemeProvider value={navigationTheme}>
      <WebSocketProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: navigationTheme.colors.background },
          }}
        />
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        <Toast />
      </WebSocketProvider>
    </ThemeProvider>
  );
}
