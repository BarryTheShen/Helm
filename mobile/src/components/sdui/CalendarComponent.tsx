import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { CalendarComponent as CalendarData } from '@/types/sdui';
import { Card } from '@/components/common/Card';
import { colors, spacing, typography } from '@/theme/colors';

type CalendarComponentProps = CalendarData['props'] & {
  onEventPress?: (id: string) => void;
  onAction?: (action: string, data: any) => void;
}

export function CalendarComponent({ events, view, variant = 'month', onEventPress, onAction }: CalendarComponentProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const handleEventPress = (eventId: string) => {
    onEventPress?.(eventId);
    onAction?.('event_press', { eventId });
  };

  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    switch (variant) {
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() - 1);
        break;
      case 'agenda':
        newDate.setDate(newDate.getDate() - 7);
        break;
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    switch (variant) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + 1);
        break;
      case 'agenda':
        newDate.setDate(newDate.getDate() + 7);
        break;
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getDateRangeLabel = () => {
    switch (variant) {
      case 'month':
        return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'week': {
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
      case 'day':
        return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      case 'agenda':
        return 'Upcoming Events';
      default:
        return '';
    }
  };

  const filterEventsByDate = () => {
    const now = currentDate.getTime();

    switch (variant) {
      case 'month': {
        const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
        return events.filter(event => {
          const eventStart = new Date(event.start).getTime();
          return eventStart >= monthStart.getTime() && eventStart <= monthEnd.getTime();
        });
      }
      case 'week': {
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return events.filter(event => {
          const eventStart = new Date(event.start).getTime();
          return eventStart >= weekStart.getTime() && eventStart <= weekEnd.getTime();
        });
      }
      case 'day': {
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);
        return events.filter(event => {
          const eventStart = new Date(event.start).getTime();
          return eventStart >= dayStart.getTime() && eventStart <= dayEnd.getTime();
        });
      }
      case 'agenda':
        return events.filter(event => new Date(event.start).getTime() >= now);
      default:
        return events;
    }
  };

  const filteredEvents = filterEventsByDate();

  return (
    <View style={styles.container}>
      <View style={styles.navigationBar}>
        <TouchableOpacity onPress={handlePrevious} style={styles.navButton} activeOpacity={0.7}>
          <Text style={styles.navButtonText}>{'<'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleToday} style={styles.todayButton} activeOpacity={0.7}>
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleNext} style={styles.navButton} activeOpacity={0.7}>
          <Text style={styles.navButtonText}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.dateLabel}>{getDateRangeLabel()}</Text>

      {filteredEvents.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No events</Text>
        </View>
      ) : (
        filteredEvents.map((event) => (
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
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  navButtonText: {
    ...typography.title3,
    color: colors.text,
    fontWeight: '600',
  },
  todayButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  todayButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  dateLabel: {
    ...typography.title2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.textSecondary,
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
