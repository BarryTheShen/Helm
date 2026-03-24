import { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { token, isLoading, initialize } = useAuthStore();
  const initializeSettings = useSettingsStore((state) => state.initialize);

  useEffect(() => {
    initialize();
    initializeSettings();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      router.replace('/(auth)/connect');
    } else if (token && inAuthGroup) {
      router.replace('/(tabs)/chat');
    }
  }, [token, segments, isLoading]);

  return <Slot />;
}
