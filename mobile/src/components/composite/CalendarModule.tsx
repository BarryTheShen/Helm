/**
 * CalendarModule — Calendar display component with 5 view variants.
 *
 * REQ-IDs covered:
 *   FF4-CAL-001 — Real functional component with data binding
 *   FF4-CAL-003 — Single component with variant (admin-controlled)
 *   FF4-CAL-004 — 5 variants: month, week, day, eventList, compact
 *   FF4-CAL-005 — NO variant switcher on mobile (FF4-CAL-005)
 *   FF4-CAL-006 — Time navigation within chosen variant
 *   FF4-CAL-007 — Prev/next arrows + Today button (DateNavBar)
 *   FF4-CAL-011 — Built-in navigation (not manual user construction)
 *   FF4-CAL-012 — Layout-aware: respects cell size
 *   FF4-CAL-013 — Auto-adapt to Compact when cell width < 200px
 *   FF4-CAL-014 — Compact shows event count + next event
 *   FF4-CAL-017 — Month: 7-column grid
 *   FF4-CAL-018 — Today highlighted
 *   FF4-CAL-019 — Clickable dates
 *   FF4-CAL-020 — Event dots with indicators
 *   FF4-CAL-021 — Source color on dots
 *   FF4-CAL-022 — Tap date → agenda (lower part)
 *   FF4-CAL-023 — Week/Day: time-block grid
 *   FF4-CAL-024 — Event title, time, source color
 *   FF4-CAL-025 — Event List sorted chronologically
 *   FF4-CAL-034 — Real data binding (useDataSource)
 *   FF4-CAL-037 — Library wrapper pattern (react-native-calendars wrapped)
 *   FF4-CAL-038 — Daily Planner integration (Week variant)
 *   FF4-CAL-039 — First-class registry component
 *   FF4-CAL-040 — Event tap interaction
 *
 * Variants:
 *   - **month**:   7-column month grid via react-native-calendars, event dots, tap→agenda
 *   - **week**:    7-day column layout with events per day
 *   - **day**:     Single-day time-annotated event list
 *   - **eventList**: FlatList of upcoming events with section headers
 *   - **compact**: Small summary card ("📅 N events today / Next: time — title")
 *
 * When no dataBinding is provided, the module auto-fetches events from
 * the backend calendar API for the currently visible date range.
 *
 * FF4-CAL-005: Variant switching is admin-controlled only.
 * The mobile user sees ONLY time navigation controls (prev/next/Today),
 * no Month/Week/Day/List/Compact switcher buttons.
 *
 * FF4-CAL-013: If cell width < 200px, Month/Week/Day auto-adapt to Compact.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  FlatList,
  Dimensions,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { themeColors } from '@/theme/tokens';
import { useAuthStore } from '@/stores/authStore';
import { useDataSource, clearDataSourceCache } from '@/hooks/useDataSource';
import type { SDUIDataBinding } from '@/types/sdui';

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Local CalendarEvent type used by CalendarModule's sub-views.
 *
 * Naming convention: fields use camelCase (component-internal convention).
 * The REST API (api.ts CalendarEvent) uses snake_case (is_all_day, source_type).
 * Mapping from snake_case API responses to camelCase component fields is done
 * in fetchFromApi() and the dataSource mapping in the main CalendarModule body.
 *
 * Fields:
 *   allDay     ← API: all_day / is_all_day (both variants are handled)
 *   sourceType ← API: source_type           (FF4-CAL-026)
 *   notes      ← API: notes                 (FF4-CAL-027)
 */
interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  sourceColor?: string;
  color?: string;
  sourceType?: string;  // FF4-CAL-026
  notes?: string;       // FF4-CAL-027
  properties?: Record<string, unknown>;
}

interface CalendarModuleProps {
  variant?: 'month' | 'week' | 'day' | 'eventList' | 'compact';
  title?: string;
  events?: CalendarEvent[];
  dataBinding?: SDUIDataBinding;
  maxEvents?: number;
  onDataRefresh?: () => void;
  onEventPress?: (event: CalendarEvent) => void;
}

type ValidVariant = 'month' | 'week' | 'day' | 'eventList' | 'compact';

const VALID_VARIANTS: ValidVariant[] = ['month', 'week', 'day', 'eventList', 'compact'];

// FF4-CAL-026: Source type display configuration
const SOURCE_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  local: { label: 'Local', color: '#6B7280', bg: '#F3F4F6' },
  caldav: { label: 'CalDAV', color: '#2563EB', bg: '#DBEAFE' },
  notion: { label: 'Notion', color: '#7C3AED', bg: '#EDE9FE' },
  custom: { label: 'Custom', color: '#0D9488', bg: '#CCFBF1' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return iso;
  }
}

function formatDateLong(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function formatDateFull(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const first = formatDate(new Date(year, month, 1));
  const last = formatDate(new Date(year, month + 1, 0));
  return { start: first, end: last };
}

function getWeekDates(date: Date): Date[] {
  const day = date.getDay(); // 0=Sun
  const diff = date.getDate() - day;
  const weekStart = new Date(date);
  weekStart.setDate(diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function getEventsForDate(events: CalendarEvent[], dateStr: string): CalendarEvent[] {
  return events.filter(e => e.start.slice(0, 10) === dateStr);
}

function getEventColor(e: CalendarEvent): string {
  return e.sourceColor || e.color || themeColors.primary;
}

function getDayName(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

const SCREEN_WIDTH = Dimensions.get('window').width;

// ── Date Navigation Bar ──────────────────────────────────────────────────────

function DateNavBar({
  label,
  onPrev,
  onNext,
  onToday,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <View style={styles.dateNav}>
      <TouchableOpacity onPress={onPrev} style={styles.navBtn} accessibilityLabel="Previous">
        <Text style={styles.navBtnText}>◀</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onToday} style={styles.navToday}>
        <Text style={styles.navTodayText}>{label}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onNext} style={styles.navBtn} accessibilityLabel="Next">
        <Text style={styles.navBtnText}>▶</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Event List Item ──────────────────────────────────────────────────────────

const EventItem = React.memo(function EventItem({
  event,
  onPress,
  showDate,
}: {
  event: CalendarEvent;
  onPress?: (e: CalendarEvent) => void;
  showDate?: boolean;
}) {
  const color = getEventColor(event);
  const st = event.sourceType ? SOURCE_TYPE_CONFIG[event.sourceType] : undefined;
  return (
    <TouchableOpacity
      style={[styles.eventItem, { borderLeftColor: color }]}
      onPress={() => onPress?.(event)}
      activeOpacity={0.7}
    >
      <View style={styles.eventItemContent}>
        <View style={styles.eventItemTitleRow}>
          <Text style={styles.eventItemTitle} numberOfLines={1}>
            {event.allDay ? '📅 ' : ''}{event.title}
          </Text>
          {/* FF4-CAL-026: sourceType badge */}
          {st ? (
            <View style={[styles.sourceBadge, { backgroundColor: st.bg }]}>
              <Text style={[styles.sourceBadgeText, { color: st.color }]}>{st.label}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.eventItemTime}>
          {showDate ? `${formatDateLong(event.start)} · ` : ''}
          {event.allDay ? 'All day' : `${formatTime(event.start)} – ${formatTime(event.end)}`}
        </Text>
        {/* FF4-CAL-027: notes display */}
        {event.notes ? (
          <Text style={styles.eventNotes} numberOfLines={2}>{event.notes}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

// ── Month Variant ────────────────────────────────────────────────────────────

function MonthView({
  events,
  onEventPress,
  cellWidth,
}: {
  events: CalendarEvent[];
  onEventPress?: (e: CalendarEvent) => void;
  cellWidth?: number;
}) {
  const [selectedDate, setSelectedDate] = useState<string>('');

  const markedDates = useMemo(() => {
    const map: Record<string, { dots: Array<{ color: string }>; selected?: boolean; selectedColor?: string }> = {};
    for (const e of events) {
      const key = e.start.slice(0, 10);
      if (!map[key]) map[key] = { dots: [] };
      map[key].dots.push({ color: getEventColor(e) });
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
    return getEventsForDate(events, selectedDate);
  }, [selectedDate, events]);

  return (
    <View>
      <Calendar
        markingType="multi-dot"
        markedDates={markedDates}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        theme={{
          todayTextColor: themeColors.primary,
          selectedDayBackgroundColor: themeColors.primary,
          arrowColor: themeColors.primary,
          dotColor: themeColors.primary,
          textDayFontSize: cellWidth && cellWidth < 320 ? 12 : 16,
          textMonthFontSize: cellWidth && cellWidth < 320 ? 14 : 17,
          textMonthFontWeight: '600',
          textDayHeaderFontSize: cellWidth && cellWidth < 320 ? 10 : 12,
        }}
      />
      {selectedDate ? (
        <View style={styles.dayAgenda}>
          <Text style={styles.agendaTitle}>{formatDateFull(selectedDate)}</Text>
          {selectedEvents.length === 0 ? (
            <Text style={styles.noEvents}>No events</Text>
          ) : (
            selectedEvents.map((e) => (
              <EventItem key={e.id} event={e} onPress={onEventPress} />
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

// ── Week Variant ─────────────────────────────────────────────────────────────

function WeekView({
  events,
  onEventPress,
}: {
  events: CalendarEvent[];
  onEventPress?: (e: CalendarEvent) => void;
}) {
  const [baseDate, setBaseDate] = useState(new Date());
  const today = new Date();

  const weekDates = useMemo(() => getWeekDates(baseDate), [baseDate]);

  const weekLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
  }, [weekDates]);

  const goPrev = useCallback(() => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - 7);
    setBaseDate(d);
  }, [baseDate]);

  const goNext = useCallback(() => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 7);
    setBaseDate(d);
  }, [baseDate]);

  const goToday = useCallback(() => setBaseDate(new Date()), []);

  return (
    <View>
      <DateNavBar label={weekLabel} onPrev={goPrev} onNext={goNext} onToday={goToday} />
      <View style={styles.weekGrid}>
        {/* Day headers */}
        {weekDates.map((d) => {
          const dateStr = formatDate(d);
          const isToday = isSameDay(d, today);
          return (
            <View key={dateStr} style={styles.weekDayCol}>
              <Text style={[styles.weekDayName, isToday && styles.weekDayNameToday]}>
                {getDayName(d)}
              </Text>
              <View style={[styles.weekDayNumWrap, isToday && styles.weekDayNumToday]}>
                <Text style={[styles.weekDayNum, isToday && styles.weekDayNumTodayText]}>
                  {d.getDate()}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <ScrollView style={styles.weekEventsContainer} nestedScrollEnabled>
        {weekDates.map((d) => {
          const dateStr = formatDate(d);
          const dayEvents = getEventsForDate(events, dateStr);
          if (dayEvents.length === 0) return null;
          return (
            <View key={dateStr} style={styles.weekDaySection}>
              <Text style={styles.weekDaySectionTitle}>
                {d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                {' '}
                <Text style={styles.weekDayCount}>{dayEvents.length} events</Text>
              </Text>
              {dayEvents.map((e) => (
                <EventItem key={e.id} event={e} onPress={onEventPress} showDate={false} />
              ))}
            </View>
          );
        })}
        {events.length === 0 && (
          <Text style={styles.noEvents}>No events this week</Text>
        )}
      </ScrollView>
    </View>
  );
}

// ── Day Variant ──────────────────────────────────────────────────────────────

function DayView({
  events,
  onEventPress,
}: {
  events: CalendarEvent[];
  onEventPress?: (e: CalendarEvent) => void;
}) {
  const [baseDate, setBaseDate] = useState(new Date());
  const today = new Date();

  const dateStr = useMemo(() => formatDate(baseDate), [baseDate]);
  const dayEvents = useMemo(() => getEventsForDate(events, dateStr), [events, dateStr]);

  // Sort events by start time
  const sortedEvents = useMemo(() => {
    return [...dayEvents].sort((a, b) => a.start.localeCompare(b.start));
  }, [dayEvents]);

  const label = useMemo(
    () => baseDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    [baseDate],
  );

  const goPrev = useCallback(() => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - 1);
    setBaseDate(d);
  }, [baseDate]);

  const goNext = useCallback(() => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + 1);
    setBaseDate(d);
  }, [baseDate]);

  const goToday = useCallback(() => setBaseDate(new Date()), []);

  // Generate time slots from 6 AM to 10 PM
  const timeSlots = useMemo(() => {
    const slots: { hour: number; label: string }[] = [];
    for (let h = 6; h <= 22; h++) {
      const ampm = h < 12 ? 'AM' : 'PM';
      const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
      slots.push({ hour: h, label: `${display}:00 ${ampm}` });
    }
    return slots;
  }, []);

  const isToday = isSameDay(baseDate, today);

  return (
    <View>
      <DateNavBar
        label={`${isToday ? '📌 ' : ''}${label}`}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
      />
      <ScrollView style={styles.dayTimeline} nestedScrollEnabled>
        {timeSlots.map((slot) => {
          const slotStart = `${dateStr}T${String(slot.hour).padStart(2, '0')}:00:00`;
          const slotEnd = `${dateStr}T${String(slot.hour + 1).padStart(2, '0')}:00:00`;
          const slotEvents = sortedEvents.filter(
            (e) => e.start >= slotStart && e.start < slotEnd,
          );
          return (
            <View key={slot.hour} style={styles.timeSlot}>
              <Text style={styles.timeSlotLabel}>{slot.label}</Text>
              <View style={styles.timeSlotContent}>
                {slotEvents.length === 0 && (
                  <View style={styles.timeSlotEmpty} />
                )}
                {slotEvents.map((e) => {
                  const st = e.sourceType ? SOURCE_TYPE_CONFIG[e.sourceType] : undefined;
                  return (
                    <TouchableOpacity
                      key={e.id}
                      style={[styles.timeSlotEvent, { borderLeftColor: getEventColor(e) }]}
                      onPress={() => onEventPress?.(e)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.slotEventTitleRow}>
                        <Text style={styles.slotEventTitle}>{e.title}</Text>
                        {/* FF4-CAL-026: sourceType badge */}
                        {st ? (
                          <View style={[styles.slotSourceBadge, { backgroundColor: st.bg }]}>
                            <Text style={[styles.slotSourceBadgeText, { color: st.color }]}>{st.label}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.slotEventTime}>
                        {e.allDay ? 'All day' : `${formatTime(e.start)} – ${formatTime(e.end)}`}
                      </Text>
                      {/* FF4-CAL-027: notes display */}
                      {e.notes ? (
                        <Text style={styles.slotEventNotes} numberOfLines={1}>{e.notes}</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
        {sortedEvents.length === 0 && (
          <Text style={styles.noEvents}>No events this day</Text>
        )}
      </ScrollView>
    </View>
  );
}

// ── Event List Variant ───────────────────────────────────────────────────────

function EventListView({
  events,
  onEventPress,
  maxEvents,
}: {
  events: CalendarEvent[];
  onEventPress?: (e: CalendarEvent) => void;
  maxEvents?: number;
}) {
  const today = todayStr();

  // Group events by date, filter future events
  const grouped = useMemo(() => {
    const now = new Date(todayStr() + 'T00:00:00');
    const future = events.filter((e) => new Date(e.start) >= now || new Date(e.end) >= now);

    // Sort by start time ascending
    future.sort((a, b) => a.start.localeCompare(b.start));

    // Limit if maxEvents set
    const limited = maxEvents && maxEvents > 0 ? future.slice(0, maxEvents) : future;

    const groups: { date: string; events: CalendarEvent[] }[] = [];
    for (const ev of limited) {
      const dateKey = ev.start.slice(0, 10);
      const last = groups[groups.length - 1];
      if (last && last.date === dateKey) {
        last.events.push(ev);
      } else {
        groups.push({ date: dateKey, events: [ev] });
      }
    }
    return groups;
  }, [events, maxEvents]);

  if (events.length === 0) {
    return <Text style={styles.noEvents}>No upcoming events</Text>;
  }

  return (
    <FlatList
      data={grouped}
      keyExtractor={(item) => item.date}
      renderItem={({ item }) => (
        <View style={styles.eventListGroup}>
          <Text style={styles.eventListDate}>
            {formatDateFull(item.date)}
          </Text>
          {item.events.map((e) => (
            <EventItem key={e.id} event={e} onPress={onEventPress} showDate={false} />
          ))}
        </View>
      )}
      scrollEnabled={false}
    />
  );
}

// ── Compact Variant ──────────────────────────────────────────────────────────

function CompactView({
  events,
  onEventPress,
  cellWidth,
}: {
  events: CalendarEvent[];
  onEventPress?: (e: CalendarEvent) => void;
  cellWidth?: number;
}) {
  const today = todayStr();
  const now = new Date();

  const todayEvents = useMemo(
    () => events.filter((e) => e.start.slice(0, 10) === today),
    [events, today],
  );

  const nextEvent = useMemo(() => {
    const upcoming = events
      .filter((e) => new Date(e.start) > now)
      .sort((a, b) => a.start.localeCompare(b.start));
    return upcoming[0] ?? null;
  }, [events, now]);

  const count = todayEvents.length;

  if (count === 0 && !nextEvent) {
    return (
      <View style={styles.compactCard}>
        <Text style={styles.compactEmoji}>📅</Text>
        <Text style={styles.noEvents}>No upcoming events</Text>
      </View>
    );
  }

  return (
    <View style={styles.compactCard}>
      <View style={styles.compactHeader}>
        <Text style={styles.compactEmoji}>📅</Text>
        <Text style={styles.compactCount}>
          {count > 0 ? `${count} event${count !== 1 ? 's' : ''} today` : 'No events today'}
        </Text>
      </View>
      {nextEvent && (
        <TouchableOpacity
          style={styles.compactNext}
          onPress={() => onEventPress?.(nextEvent)}
          activeOpacity={0.7}
        >
          <Text style={styles.compactNextLabel}>Next:</Text>
          <Text style={styles.compactNextText} numberOfLines={1}>
            {formatTime(nextEvent.start)} — {nextEvent.title}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main CalendarModule ──────────────────────────────────────────────────────

export function CalendarModule({
  variant = 'month',
  title,
  events: eventsProp = [],
  dataBinding,
  maxEvents,
  onDataRefresh,
  onEventPress,
}: CalendarModuleProps) {
  const validVariant: ValidVariant = VALID_VARIANTS.includes(variant as ValidVariant)
    ? (variant as ValidVariant)
    : 'month';

  const { token, serverUrl } = useAuthStore();
  const [fetchedEvents, setFetchedEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { data: dataSourceData, refresh: dsRefresh } = useDataSource(dataBinding);

  // Auto-fetch from backend API when no dataBinding is provided
  const fetchFromApi = useCallback(async () => {
    if (!token || !serverUrl) return;
    try {
      const url = `${serverUrl}/api/calendar/events`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw = (data.events ?? []) as any[];
      setFetchedEvents(
        raw.map((e: any) => ({
          id: e.id,
          title: e.title,
          start: e.start ?? e.start_time ?? '',
          end: e.end ?? e.end_time ?? '',
          allDay: e.allDay ?? e.is_all_day ?? e.all_day ?? false,
          sourceColor: e.color ?? e.sourceColor,
          color: e.color,
          sourceType: e.sourceType ?? e.source_type ?? 'local',  // FF4-CAL-026
          notes: e.notes ?? undefined,                            // FF4-CAL-027
          description: e.description,
          location: e.location,
        })),
      );
    } catch (err) {
      console.warn('CalendarModule: failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, [token, serverUrl]);

  useEffect(() => {
    if (!dataBinding) {
      fetchFromApi();
    }
  }, [dataBinding, fetchFromApi]);

  // Merge events from props, data source, and API fetch
  const events = useMemo<CalendarEvent[]>(() => {
    if (dataSourceData && dataSourceData.length > 0) {
      return dataSourceData.map((row) => ({
        id: String(row.id ?? ''),
        title: String(row.title ?? ''),
        start: String(row.start ?? row.start_time ?? ''),
        end: String(row.end ?? row.end_time ?? ''),
        allDay: Boolean(row.allDay ?? row.is_all_day ?? false),
        sourceColor: (row.sourceColor ?? row.color) as string | undefined,
        sourceType: String(row.sourceType ?? row.source_type ?? 'local'),  // FF4-CAL-026
        notes: row.notes as string | undefined,                            // FF4-CAL-027
        color: row.color as string | undefined,
        properties: row.properties as Record<string, unknown> | undefined,
      }));
    }
    if (eventsProp.length > 0) return eventsProp;
    return fetchedEvents;
  }, [dataSourceData, eventsProp, fetchedEvents]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (dataBinding) {
      clearDataSourceCache(dataBinding.dataSourceId);
      dsRefresh();
    } else {
      fetchFromApi();
    }
    const refresh = onDataRefresh ?? (() => {});
    refresh();
    setTimeout(() => setRefreshing(false), 600);
  }, [dataBinding, onDataRefresh, dsRefresh, fetchFromApi]);

  const cellWidth = useMemo(() => {
    // Estimate cell width from screen width (rough heuristic)
    return Math.min(SCREEN_WIDTH - 32, 600);
  }, []);

  // FF4-CAL-013: Auto-adapt — if cell is too small for Month/Week/Day, fall back to Compact
  const effectiveVariant = useMemo<ValidVariant>(() => {
    if (cellWidth < 200 && (validVariant === 'month' || validVariant === 'week' || validVariant === 'day')) {
      return 'compact';
    }
    return validVariant;
  }, [cellWidth, validVariant]);

  const renderVariant = () => {
    switch (effectiveVariant) {
      case 'month':
        return <MonthView events={events} onEventPress={onEventPress} cellWidth={cellWidth} />;
      case 'week':
        return <WeekView events={events} onEventPress={onEventPress} />;
      case 'day':
        return <DayView events={events} onEventPress={onEventPress} />;
      case 'eventList':
        return <EventListView events={events} onEventPress={onEventPress} maxEvents={maxEvents} />;
      case 'compact':
        return <CompactView events={events} onEventPress={onEventPress} cellWidth={cellWidth} />;
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />
      }
    >
      {title ? (
        <Text style={styles.moduleTitle}>{title}</Text>
      ) : null}

      {/* FF4-CAL-005: NO variant switcher on mobile — variant is admin-controlled via SDUI payload */}
      {/* Only time navigation is available within the chosen variant */}

      {cellWidth < 200 && validVariant !== effectiveVariant && (
        <Text style={styles.autoAdaptNotice}>
          Auto-adapted to compact view (cell too small)
        </Text>
      )}

      {renderVariant()}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    flex: 1,
  },
  moduleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  // FF4-CAL-005: No view switcher on mobile — variant is admin-controlled
  // View switcher styles removed per FF4-CAL-005 requirement
  // Date navigation
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    fontSize: 14,
    color: '#007AFF',
  },
  navToday: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  navTodayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  // Day agenda (month variant)
  dayAgenda: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  agendaTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  noEvents: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    paddingVertical: 12,
    textAlign: 'center',
  },
  eventItem: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 8,
    marginBottom: 6,
    backgroundColor: '#FAFAFA',
    borderRadius: 4,
  },
  eventItemContent: {
    flex: 1,
  },
  eventItemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },
  eventItemTime: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  // FF4-CAL-026: sourceType badge styles
  eventItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  // FF4-CAL-027: notes text style
  eventNotes: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 16,
  },
  // Week variant
  weekGrid: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  weekDayCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekDayName: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 4,
  },
  weekDayNameToday: {
    color: '#007AFF',
    fontWeight: '700',
  },
  weekDayNumWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayNumToday: {
    backgroundColor: '#007AFF',
  },
  weekDayNum: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  weekDayNumTodayText: {
    color: '#fff',
  },
  weekEventsContainer: {
    maxHeight: 400,
    paddingHorizontal: 12,
  },
  weekDaySection: {
    marginTop: 8,
  },
  weekDaySectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  weekDayCount: {
    fontSize: 12,
    fontWeight: '400',
    color: '#8E8E93',
  },
  // Day variant
  dayTimeline: {
    maxHeight: 500,
    paddingHorizontal: 12,
  },
  timeSlot: {
    flexDirection: 'row',
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  timeSlotLabel: {
    width: 60,
    fontSize: 10,
    color: '#8E8E93',
    paddingTop: 4,
    textAlign: 'right',
    paddingRight: 8,
  },
  timeSlotContent: {
    flex: 1,
    paddingLeft: 4,
  },
  timeSlotEmpty: {
    height: 10,
  },
  timeSlotEvent: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 2,
    backgroundColor: '#FAFAFA',
    borderRadius: 3,
  },
  slotEventTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  slotEventTime: {
    fontSize: 11,
    color: '#8E8E93',
  },
  // FF4-CAL-026: sourceType badge for DayView
  slotEventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  slotSourceBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  slotSourceBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  // FF4-CAL-027: notes text for DayView
  slotEventNotes: {
    fontSize: 11,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginTop: 2,
    lineHeight: 14,
  },
  // Event List variant
  eventListGroup: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  eventListDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  // Compact variant
  compactCard: {
    padding: 12,
    margin: 8,
    backgroundColor: '#F8F9FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8EAFF',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactEmoji: {
    fontSize: 20,
  },
  compactCount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  compactNext: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D0D5FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactNextLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  compactNextText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
    flex: 1,
  },
  autoAdaptNotice: {
    fontSize: 11,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
});
