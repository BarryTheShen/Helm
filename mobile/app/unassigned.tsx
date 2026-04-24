import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { colors, spacing, typography } from '@/theme/colors';

export default function UnassignedScreen() {
  const router = useRouter();
  const { serverUrl, token, deviceId } = useAuthStore();
  const ws = useWebSocket();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for app assignment every 10 seconds
  useEffect(() => {
    if (!serverUrl || !token || !deviceId) return;

    const checkAppAssignment = async () => {
      try {
        const response = await fetch(`${serverUrl}/api/devices/${deviceId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const deviceData = await response.json();
          if (deviceData.assigned_app_id) {
            // App has been assigned, navigate to main app
            router.replace('/(tabs)/home');
          }
        }
      } catch (error) {
        console.error('Failed to check app assignment:', error);
      }
    };

    // Check immediately
    checkAppAssignment();

    // Then poll every 10 seconds
    pollIntervalRef.current = setInterval(checkAppAssignment, 10000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [serverUrl, token, deviceId, router]);

  // Listen for WebSocket device_app_assigned event
  useEffect(() => {
    if (!ws || !deviceId) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'device_app_assigned' && data.device_id === deviceId) {
          // App has been assigned via WebSocket, navigate immediately
          router.replace('/(tabs)/home');
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onMessage(handleMessage);

    return () => {
      // Cleanup handled by WebSocketService
    };
  }, [ws, deviceId, router]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>📱</Text>
        <Text style={styles.title}>No App Assigned</Text>
        <Text style={styles.message}>
          This device hasn't been assigned an app yet.
        </Text>
        <Text style={styles.instructions}>
          Use the web admin panel to assign an app to this device.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.largeTitle,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  instructions: {
    ...typography.subheadline,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
