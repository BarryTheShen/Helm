import { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { ApiClient } from '@/services/api';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { useUIStore } from '@/stores/uiStore';
import { colors, spacing, typography, borderRadius } from '@/theme/colors';
import type { CalendarEvent } from '@/types/api';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';
import { useFocusEffect } from 'expo-router';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CalendarScreen() {
  const { token, serverUrl, logout } = useAuthStore();
  const { errorBanner, showError, hideError } = useUIStore();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  useFocusEffect(
    useCallback(() => {
      loadEvents(currentMonth);
    }, [token, serverUrl, currentMonth])
  );

  const loadEvents = async (month: Date) => {
    if (!token || !serverUrl) return;
    setIsLoading(true);
    try {
      const api = new ApiClient(serverUrl, token, logout);
      const start = format(startOfMonth(month), "yyyy-MM-dd'T'HH:mm:ss");
      const end = format(endOfMonth(month), "yyyy-MM-dd'T'HH:mm:ss");
      const data = await api.getCalendarEvents(start, end);
      setEvents(data);
      hideError();
    } catch {
      showError('Failed to load calendar events', () => loadEvents(month));
    } finally {
      setIsLoading(false);
    }
  };

  const navigateMonth = (delta: 1 | -1) => {
    const next = delta === 1 ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1);
    setCurrentMonth(next);
    setSelectedDate(null);
  };

  // Build grid: leading null-pads to align first day to correct weekday column
  const calendarDays = useMemo(() => {
    const days = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    });
    const leadingPads = Array<null>(getDay(days[0])).fill(null);
    return [...leadingPads, ...days];
  }, [currentMonth]);

  // O(1) lookup: date-string → events on that day
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
      const key = format(new Date(e.start_time), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [events]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventsByDate[format(selectedDate, 'yyyy-MM-dd')] ?? [];
  }, [selectedDate, eventsByDate]);

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
        {/* Month navigation header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.navBtn} accessibilityLabel="Previous month">
            <Text style={styles.navBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
          <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.navBtn} accessibilityLabel="Next month">
            <Text style={styles.navBtnText}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Day-of-week column headers */}
        <View style={styles.dayLabelsRow}>
          {DAY_LABELS.map((label) => (
            <Text key={label} style={styles.dayLabel}>{label}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        {isLoading ? (
          <Text style={styles.loadingText}>Loading…</Text>
        ) : (
          <View style={styles.grid}>
            {calendarDays.map((day, i) => {
              if (!day) {
                return <View key={`pad-${i}`} style={styles.dayCell} />;
              }
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDate[dateKey] ?? [];
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              const todayHighlight = isToday(day);
              return (
                <TouchableOpacity
                  key={dateKey}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    todayHighlight && !isSelected && styles.dayCellToday,
                  ]}
                  onPress={() => setSelectedDate(isSelected ? null : day)}
                  accessibilityLabel={format(day, 'EEEE MMMM d')}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      isSelected && styles.dayNumberSelected,
                      todayHighlight && !isSelected && styles.dayNumberToday,
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                  {dayEvents.length > 0 && (
                    <View style={styles.dotsRow}>
                      {dayEvents.slice(0, 3).map((e, idx) => (
                        <View
                          key={idx}
                          style={[styles.dot, { backgroundColor: e.color ?? colors.primary }]}
                        />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Selected day detail */}
        {selectedDate != null && (
          <View style={styles.dayDetail}>
            <Text style={styles.dayDetailTitle}>
              {format(selectedDate, 'EEEE, MMMM d')}
            </Text>
            {selectedDayEvents.length === 0 ? (
              <Text style={styles.noEvents}>No events</Text>
            ) : (
              selectedDayEvents.map((event) => (
                <View
                  key={event.id}
                  style={[styles.eventRow, { borderLeftColor: event.color ?? colors.primary }]}
                >
                  <Text style={styles.eventTime}>
                    {format(new Date(event.start_time), 'h:mm a')}
                    {' – '}
                    {format(new Date(event.end_time), 'h:mm a')}
                  </Text>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {event.description ? (
                    <Text style={styles.eventDescription}>{event.description}</Text>
                  ) : null}
                  {event.location ? (
                    <Text style={styles.eventLocation}>📍 {event.location}</Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthTitle: {
    ...typography.title2,
    color: colors.text,
  },
  navBtn: {
    padding: spacing.sm,
    minWidth: 40,
    alignItems: 'center',
  },
  navBtnText: {
    fontSize: 28,
    color: colors.primary,
    fontWeight: '300',
    lineHeight: 32,
  },
  dayLabelsRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  dayLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    ...typography.caption1,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  dayNumber: {
    ...typography.callout,
    color: colors.text,
  },
  dayNumberSelected: {
    color: colors.background,
    fontWeight: '700',
  },
  dayNumberToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dayDetail: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dayDetailTitle: {
    ...typography.headline,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  noEvents: {
    ...typography.body,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  eventRow: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.sm,
    marginBottom: spacing.md,
  },
  eventTime: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  eventTitle: {
    ...typography.subheadline,
    color: colors.text,
    fontWeight: '600',
    marginBottom: 2,
  },
  eventDescription: {
    ...typography.footnote,
    color: colors.textSecondary,
  },
  eventLocation: {
    ...typography.footnote,
    color: colors.textSecondary,
    marginTop: 2,
  },
});

