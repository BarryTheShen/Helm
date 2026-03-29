import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { CalendarComponent as CalendarData } from '@/types/sdui';
import { Card } from '@/components/common/Card';
import { colors, spacing, typography } from '@/theme/colors';

type CalendarComponentProps = CalendarData['props'] & {
  onEventPress?: (id: string) => void;
  onAction?: (action: string, data: any) => void;
}

export function CalendarComponent({ events, view, onEventPress, onAction }: CalendarComponentProps) {
  const handleEventPress = (eventId: string) => {
    onEventPress?.(eventId);
    onAction?.('event_press', { eventId });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Calendar ({view} view)</Text>
      {events.map((event) => (
        <TouchableOpacity
          key={event.id}
          onPress={() => handleEventPress(event.id)}
          activeOpacity={0.7}
        >
          <Card style={styles.eventCard}>
            <View style={[styles.colorBar, { backgroundColor: event.color || colors.primary }]} />
            <View style={styles.eventContent}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventTime}>
                {new Date(event.start).toLocaleString()} - {new Date(event.end).toLocaleString()}
              </Text>
              {event.allDay && (
                <Text style={styles.allDayBadge}>All Day</Text>
              )}
            </View>
          </Card>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    ...typography.title2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  eventCard: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  colorBar: {
    width: 4,
  },
  eventContent: {
    flex: 1,
    padding: spacing.sm,
  },
  eventTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  eventTime: {
    ...typography.caption1,
    color: colors.textSecondary,
  },
  allDayBadge: {
    ...typography.caption1,
    color: colors.primary,
    marginTop: 4,
  },
});
