import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { ApiClient } from '@/services/api';
import { Card } from '@/components/common/Card';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { useUIStore } from '@/stores/uiStore';
import { colors, spacing, typography } from '@/theme/colors';
import type { CalendarEvent } from '@/types/api';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export default function CalendarScreen() {
  const { token, serverUrl, logout } = useAuthStore();
  const { errorBanner, showError, hideError } = useUIStore();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'month' | 'day'>('month');

  useEffect(() => {
    loadEvents();
  }, [token, serverUrl]);

  const loadEvents = async () => {
    if (!token || !serverUrl) return;

    setIsLoading(true);
    try {
      const api = new ApiClient(serverUrl, token, logout);
      const now = new Date();
      const start = format(startOfMonth(now), "yyyy-MM-dd'T'HH:mm:ss");
      const end = format(endOfMonth(now), "yyyy-MM-dd'T'HH:mm:ss");
      const data = await api.getCalendarEvents(start, end);
      setEvents(data);
      hideError();
    } catch (error) {
      showError('Failed to load calendar events', loadEvents);
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
        <Text style={styles.title}>Calendar</Text>

        {isLoading ? (
          <Text style={styles.loading}>Loading events...</Text>
        ) : events.length === 0 ? (
          <Text style={styles.empty}>No events this month</Text>
        ) : (
          events.map((event) => (
            <Card key={event.id} style={styles.eventCard}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              {event.description && (
                <Text style={styles.eventDescription}>{event.description}</Text>
              )}
              <Text style={styles.eventTime}>
                {format(new Date(event.start_time), 'MMM d, h:mm a')} -{' '}
                {format(new Date(event.end_time), 'h:mm a')}
              </Text>
              {event.location && (
                <Text style={styles.eventLocation}>📍 {event.location}</Text>
              )}
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
  eventCard: {
    marginBottom: spacing.md,
  },
  eventTitle: {
    ...typography.headline,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  eventDescription: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  eventTime: {
    ...typography.subheadline,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  eventLocation: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
});
