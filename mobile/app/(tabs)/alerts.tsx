import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { ApiClient } from '@/services/api';
import { Card } from '@/components/common/Card';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { useUIStore } from '@/stores/uiStore';
import { colors, spacing, typography } from '@/theme/colors';
import type { Notification } from '@/types/api';
import { format } from 'date-fns';

export default function AlertsScreen() {
  const { token, serverUrl, logout } = useAuthStore();
  const { errorBanner, showError, hideError } = useUIStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    if (!token || !serverUrl) return;

    setIsLoading(true);
    try {
      const api = new ApiClient(serverUrl, token, logout);
      const data = await api.getNotifications();
      setNotifications(data);
      hideError();
    } catch (error) {
      showError('Failed to load notifications', loadNotifications);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {errorBanner && (
        <ErrorBanner
          message={errorBanner.message}
          onRetry={errorBanner.retry}
          onDismiss={hideError}
        />
      )}

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Alerts</Text>

        {isLoading ? (
          <Text style={styles.loading}>Loading notifications...</Text>
        ) : notifications.length === 0 ? (
          <Text style={styles.empty}>No notifications</Text>
        ) : (
          notifications.map((notification) => (
            <Card key={notification.id} style={styles.notificationCard}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              <Text style={styles.notificationBody}>{notification.body}</Text>
              <Text style={styles.notificationTime}>
                {format(new Date(notification.created_at), 'MMM d, h:mm a')}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    ...typography.largeTitle,
    color: colors.text,
    marginBottom: spacing.lg,
  },
  loading: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  empty: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  notificationCard: {
    marginBottom: spacing.md,
  },
  notificationTitle: {
    ...typography.headline,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  notificationBody: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  notificationTime: {
    ...typography.footnote,
    color: colors.textTertiary,
  },
});
