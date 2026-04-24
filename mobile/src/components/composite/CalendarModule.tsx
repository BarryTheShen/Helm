/**
 * CalendarModule — Calendar display component with multiple view types
 *
 * @prop variant - View type: 'month' | 'week' | 'day' | 'agenda'
 *   - 'month': Fully implemented (default)
 *   - 'week': Planned (falls back to month)
 *   - 'day': Planned (falls back to month)
 *   - 'agenda': Planned (falls back to month)
 *
 * @prop events - Array of calendar events to display
 * @prop dataBinding - Optional data source configuration for live event loading
 * @prop onDataRefresh - Callback when data refresh is triggered
 * @prop onEventPress - Callback when an event is tapped
 *
 * Note: View switcher UI only shows implemented views (Month, 3 Day).
 * Future work: Implement week, day, and agenda views.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { themeColors } from '@/theme/tokens';
import { useDataSource, clearDataSourceCache } from '@/hooks/useDataSource';
import type { SDUIDataBinding } from '@/types/sdui';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  sourceColor?: string;
  properties?: Record<string, unknown>;
}

interface CalendarModuleProps {
  variant?: 'month' | 'week' | 'day' | 'agenda';
  events?: CalendarEvent[];
  dataBinding?: SDUIDataBinding;
  onDataRefresh?: () => void;
  onEventPress?: (event: CalendarEvent) => void;
}

export function CalendarModule({
  variant = 'month',
  events: eventsProp = [],
  dataBinding,
  onDataRefresh,
  onEventPress,
}: CalendarModuleProps) {
  // Map variant to implemented view types
  const supportedViews = ['month', 'threeDay'] as const;
  const initialView = supportedViews.includes(variant as any) ? variant : 'month';

  // Warn if unsupported variant is used
  if (variant && !supportedViews.includes(variant as any)) {
    console.warn(`CalendarModule: variant "${variant}" not implemented, falling back to "month". Supported: ${supportedViews.join(', ')}`);
  }

  const [view, setView] = useState<'month' | 'threeDay'>(initialView as 'month' | 'threeDay');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const { data: dataSourceData, refresh: dsRefresh } = useDataSource(dataBinding);

  const events = useMemo<CalendarEvent[]>(() => {
    if (dataSourceData && dataSourceData.length > 0) {
      return dataSourceData.map((row) => ({
        id: String(row.id ?? ''),
        title: String(row.title ?? ''),
        start: String(row.start ?? row.start_time ?? ''),
        end: String(row.end ?? row.end_time ?? ''),
        allDay: Boolean(row.allDay ?? row.is_all_day ?? false),
        sourceColor: (row.sourceColor ?? row.color) as string | undefined,
        properties: row.properties as Record<string, unknown> | undefined,
      }));
    }
    return eventsProp;
  }, [dataSourceData, eventsProp]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (dataBinding) {
      clearDataSourceCache(dataBinding.dataSourceId);
    }
    const refresh = onDataRefresh ?? dsRefresh;
    refresh();
    setTimeout(() => setRefreshing(false), 600);
  }, [dataBinding, onDataRefresh, dsRefresh]);

  // Build markedDates map for react-native-calendars
  const markedDates = useMemo(() => {
    const map: Record<string, { dots: Array<{ color: string }>; selected?: boolean; selectedColor?: string }> = {};
    for (const e of events) {
      const key = e.start.slice(0, 10);
      if (!map[key]) map[key] = { dots: [] };
      map[key].dots.push({ color: e.sourceColor || themeColors.primary });
    }
    if (selectedDate) {
      map[selectedDate] = {
        ...(map[selectedDate] ?? { dots: [] }),
        selected: true,
        selectedColor: themeColors.primary,
      };
    }
    return map;
  }, [events, selectedDate]);

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((e) => e.start.slice(0, 10) === selectedDate);
  }, [selectedDate, events]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />
      }
    >
      {/* View Switcher */}
      <View style={styles.viewSwitcher}>
        <TouchableOpacity
          style={[styles.viewTab, view === 'month' && styles.viewTabActive]}
          onPress={() => setView('month')}
        >
          <Text style={[styles.viewTabText, view === 'month' && styles.viewTabTextActive]}>Month</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewTab, view === 'threeDay' && styles.viewTabActive]}
          onPress={() => setView('threeDay')}
        >
          <Text style={[styles.viewTabText, view === 'threeDay' && styles.viewTabTextActive]}>3 Day</Text>
        </TouchableOpacity>
      </View>

      {view === 'month' ? (
        <>
          <Calendar
            markingType="multi-dot"
            markedDates={markedDates}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            theme={{
              todayTextColor: themeColors.primary,
              selectedDayBackgroundColor: themeColors.primary,
              arrowColor: themeColors.primary,
              dotColor: themeColors.primary,
              textDayFontSize: 16,
              textMonthFontSize: 17,
              textMonthFontWeight: '600',
              textDayHeaderFontSize: 12,
            }}
          />

          {/* Day Agenda */}
          {selectedDate ? (
            <View style={styles.agenda}>
              <Text style={styles.agendaTitle}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
              {selectedEvents.length === 0 ? (
                <Text style={styles.noEvents}>No events</Text>
              ) : (
                selectedEvents.map((e) => (
                  <TouchableOpacity
                    key={e.id}
                    style={[styles.agendaEvent, { borderLeftColor: e.sourceColor || themeColors.primary }]}
                    onPress={() => onEventPress?.(e)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.agendaEventTitle}>{e.title}</Text>
                    <Text style={styles.agendaEventTime}>
                      {new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {' – '}
                      {new Date(e.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          ) : null}
        </>
      ) : (
        /* 3-Day View Placeholder */
        <View style={styles.threeDayPlaceholder}>
          <Text style={styles.threeDayText}>3-Day Time Block View</Text>
          <Text style={styles.threeDaySubtext}>Coming in next update</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  viewSwitcher: { flexDirection: 'row', padding: 8, gap: 4, backgroundColor: '#F2F2F7', margin: 12, borderRadius: 8 },
  viewTab: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 6 },
  viewTabActive: { backgroundColor: '#fff', elevation: 1 },
  viewTabText: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },
  viewTabTextActive: { color: '#007AFF', fontWeight: '600' },
  agenda: { paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  agendaTitle: { fontSize: 15, fontWeight: '600', color: '#000', marginBottom: 8 },
  noEvents: { fontSize: 14, color: '#8E8E93', fontStyle: 'italic', paddingBottom: 12 },
  agendaEvent: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 6, marginBottom: 6 },
  agendaEventTitle: { fontSize: 15, fontWeight: '500', color: '#000' },
  agendaEventTime: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  threeDayPlaceholder: { padding: 40, alignItems: 'center' },
  threeDayText: { fontSize: 17, fontWeight: '600', color: '#8E8E93' },
  threeDaySubtext: { fontSize: 14, color: '#C7C7CC', marginTop: 4 },
});
