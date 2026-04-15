/**
 * CalendarModule — Tier 3 composite module.
 * MVP: Month grid view with event dots and day agenda on tap.
 * Wraps a simple built-in calendar (no external library for MVP).
 * Supports pull-to-refresh when connected to a data source.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { themeColors } from '@/theme/tokens';
import { useDataSource, clearDataSourceCache } from '@/hooks/useDataSource';
import type { SDUIDataBinding } from '@/types/sdui';

interface CalendarModuleProps {
  defaultView?: 'month' | 'threeDay';
  events?: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    allDay?: boolean;
    sourceColor?: string;
    properties?: Record<string, unknown>;
  }>;
  dataBinding?: SDUIDataBinding;
  onDataRefresh?: () => void;
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function CalendarModule({ defaultView = 'month', events: eventsProp = [], dataBinding, onDataRefresh }: CalendarModuleProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState(defaultView);
  const [refreshing, setRefreshing] = useState(false);

  // Data source integration: use bound data as events if available
  const { data: dataSourceData, refresh: dsRefresh } = useDataSource(dataBinding);

  const events = useMemo(() => {
    if (dataSourceData && dataSourceData.length > 0) {
      return dataSourceData.map((row) => ({
        id: String(row.id ?? ''),
        title: String(row.title ?? ''),
        start: String(row.start ?? row.start_time ?? ''),
        end: String(row.end ?? row.end_time ?? ''),
        allDay: Boolean(row.allDay ?? row.is_all_day ?? false),
        sourceColor: row.sourceColor as string | undefined ?? row.color as string | undefined,
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
    // Brief delay so the spinner is visible
    setTimeout(() => setRefreshing(false), 600);
  }, [dataBinding, onDataRefresh, dsRefresh]);

  const today = new Date();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const leadPads = Array(firstDay.getDay()).fill(null);
    const days = Array.from({ length: lastDay.getDate() }, (_, i) => new Date(year, month, i + 1));
    return [...leadPads, ...days];
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, typeof events> = {};
    for (const e of events) {
      const key = e.start.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [events]);

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
    return eventsByDate[key] ?? [];
  }, [selectedDate, eventsByDate]);

  const navigateMonth = (delta: number) => {
    setCurrentMonth(new Date(year, month + delta, 1));
    setSelectedDate(null);
  };

  const formatMonthYear = () => {
    return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const isToday = (d: Date) =>
    d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();

  const isSelected = (d: Date) =>
    selectedDate && d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();

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
          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.navBtn}>
              <Text style={styles.navBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{formatMonthYear()}</Text>
            <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.navBtn}>
              <Text style={styles.navBtnText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day Labels */}
          <View style={styles.dayLabels}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={styles.dayLabel}>{d}</Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.grid}>
            {calendarDays.map((day, i) => {
              if (!day) return <View key={`pad-${i}`} style={styles.dayCell} />;
              const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
              const hasEvents = !!eventsByDate[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.dayCell,
                    isToday(day) && styles.today,
                    isSelected(day) && styles.selected,
                  ]}
                  onPress={() => setSelectedDate(day)}
                >
                  <Text style={[
                    styles.dayText,
                    isToday(day) && styles.todayText,
                    isSelected(day) && styles.selectedText,
                  ]}>
                    {day.getDate()}
                  </Text>
                  {hasEvents && (
                    <View style={styles.eventDots}>
                      {(eventsByDate[key] ?? []).slice(0, 3).map((e, j) => (
                        <View key={j} style={[styles.dot, { backgroundColor: e.sourceColor || themeColors.primary }]} />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Day Agenda */}
          {selectedDate && (
            <ScrollView style={styles.agenda}>
              <Text style={styles.agendaTitle}>
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </Text>
              {selectedEvents.length === 0 ? (
                <Text style={styles.noEvents}>No events</Text>
              ) : (
                selectedEvents.map((e) => (
                  <View key={e.id} style={[styles.agendaEvent, { borderLeftColor: e.sourceColor || themeColors.primary }]}>
                    <Text style={styles.agendaEventTitle}>{e.title}</Text>
                    <Text style={styles.agendaEventTime}>
                      {new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {' – '}
                      {new Date(e.end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}
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
  viewTabActive: { backgroundColor: '#fff', boxShadow: '0px 0px 2px rgba(0, 0, 0, 0.1)', elevation: 1 },
  viewTabText: { fontSize: 14, color: '#8E8E93', fontWeight: '500' },
  viewTabTextActive: { color: '#007AFF', fontWeight: '600' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  navBtn: { padding: 8 },
  navBtnText: { fontSize: 24, color: '#007AFF', fontWeight: '600' },
  monthTitle: { fontSize: 17, fontWeight: '600', color: '#000' },
  dayLabels: { flexDirection: 'row', paddingHorizontal: 8 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 12, color: '#8E8E93', fontWeight: '600', paddingBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 },
  dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  dayText: { fontSize: 16, color: '#000' },
  today: { backgroundColor: '#007AFF15', borderRadius: 20 },
  todayText: { color: '#007AFF', fontWeight: '600' },
  selected: { backgroundColor: '#007AFF', borderRadius: 20 },
  selectedText: { color: '#fff', fontWeight: '600' },
  eventDots: { flexDirection: 'row', gap: 2, marginTop: 1 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  agenda: { maxHeight: 200, paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E5EA' },
  agendaTitle: { fontSize: 15, fontWeight: '600', color: '#000', marginBottom: 8 },
  noEvents: { fontSize: 14, color: '#8E8E93', fontStyle: 'italic' },
  agendaEvent: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 6, marginBottom: 6 },
  agendaEventTitle: { fontSize: 15, fontWeight: '500', color: '#000' },
  agendaEventTime: { fontSize: 13, color: '#8E8E93', marginTop: 2 },
  threeDayPlaceholder: { padding: 40, alignItems: 'center' },
  threeDayText: { fontSize: 17, fontWeight: '600', color: '#8E8E93' },
  threeDaySubtext: { fontSize: 14, color: '#C7C7CC', marginTop: 4 },
});
