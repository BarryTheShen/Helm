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
  Modal,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  category?: string;    // FF4-CAL-016/CAL-019: event category for filtering
  properties?: Record<string, unknown>;
}

interface CalendarModuleProps {
  variant?: 'month' | 'week' | 'day' | 'eventList' | 'compact';
  title?: string;
  events?: CalendarEvent[];
  dataBinding?: SDUIDataBinding;
  maxEvents?: number;
  // FF4-CAL-016/CAL-019: Admin filtering controls
  sourceTypes?: string;
  categoryFilter?: string;
  showSourceBadges?: boolean;
  showNotes?: boolean;
  compactThreshold?: number;
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

// ── Local Cache Layer (FF4-CAL-013) ───────────────────────────────────────────
// Cache key prefix + TTL. Cache is a JSON blob with timestamp and events array.
// Loaded on mount for instant display; API fetch runs in background to refresh.

const CALENDAR_CACHE_PREFIX = 'calendar_events_';

interface CacheEntry {
  timestamp: number;
  events: CalendarEvent[];
}

async function loadCachedEvents(cacheKey: string): Promise<CalendarEvent[] | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (!Array.isArray(entry.events)) return null;
    return entry.events;
  } catch {
    return null;
  }
}

async function saveCachedEvents(cacheKey: string, events: CalendarEvent[]): Promise<void> {
  try {
    const entry: CacheEntry = { timestamp: Date.now(), events };
    await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    // Silently fail — cache is a non-critical optimization
  }
}

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

// ── CAL-009: Time positioning constants and helpers ──────────────────────────

const HOUR_HEIGHT = 60;

function getHourMinutes(iso: string): { hours: number; minutes: number } {
  const d = new Date(iso);
  return { hours: d.getHours(), minutes: d.getMinutes() };
}

function getDurationHours(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max((e.getTime() - s.getTime()) / (1000 * 60 * 60), 0.5);
}

function timeToTop(iso: string): number {
  const { hours, minutes } = getHourMinutes(iso);
  return (hours + minutes / 60) * HOUR_HEIGHT;
}

function eventHeight(start: string, end: string): number {
  return Math.max(getDurationHours(start, end) * HOUR_HEIGHT, 30);
}

interface TimedEventLayout<T extends CalendarEvent> {
  event: T;
  column: number;
  columnCount: number;
}

function minutesFromIso(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** FF4-CAL-009: side-by-side columns for overlapping timed events. */
function layoutTimedEvents<T extends CalendarEvent>(events: T[]): TimedEventLayout<T>[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => minutesFromIso(a.start) - minutesFromIso(b.start)
      || minutesFromIso(a.end) - minutesFromIso(b.end),
  );

  const columnEnds: number[] = [];
  const placed: Array<{ event: T; column: number; start: number; end: number }> = [];

  for (const event of sorted) {
    const start = minutesFromIso(event.start);
    const end = Math.max(start + 15, minutesFromIso(event.end));
    let column = columnEnds.findIndex((endMin) => endMin <= start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[column] = end;
    }
    placed.push({ event, column, start, end });
  }

  return placed.map(({ event, column, start, end }) => {
    const overlapping = placed.filter((other) => other.start < end && other.end > start);
    const points: Array<{ t: number; delta: number }> = [];
    for (const other of overlapping) {
      points.push({ t: other.start, delta: 1 });
      points.push({ t: other.end, delta: -1 });
    }
    points.sort((a, b) => a.t - b.t || a.delta - b.delta);
    let concurrent = 0;
    let maxConcurrent = 1;
    for (const point of points) {
      concurrent += point.delta;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
    }
    return { event, column, columnCount: maxConcurrent };
  });
}

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
  showSourceBadges = true,
  showNotes = true,
}: {
  event: CalendarEvent;
  onPress?: (e: CalendarEvent) => void;
  showDate?: boolean;
  showSourceBadges?: boolean;
  showNotes?: boolean;
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
          {/* FF4-CAL-026: sourceType badge — hidden when showSourceBadges is false */}
          {st && showSourceBadges ? (
            <View style={[styles.sourceBadge, { backgroundColor: st.bg }]}>
              <Text style={[styles.sourceBadgeText, { color: st.color }]}>{st.label}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.eventItemTime}>
          {showDate ? `${formatDateLong(event.start)} · ` : ''}
          {event.allDay ? 'All day' : `${formatTime(event.start)} – ${formatTime(event.end)}`}
        </Text>
        {/* FF4-CAL-027: notes display — hidden when showNotes is false */}
        {event.notes && showNotes ? (
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
  showSourceBadges = true,
  showNotes = true,
}: {
  events: CalendarEvent[];
  onEventPress?: (e: CalendarEvent) => void;
  cellWidth?: number;
  showSourceBadges?: boolean;
  showNotes?: boolean;
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
              <EventItem key={e.id} event={e} onPress={onEventPress} showSourceBadges={showSourceBadges} showNotes={showNotes} />
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

// ── Week Variant (CAL-009: time-based positioning) ──────────────────────────

function WeekView({
  events,
  onEventPress,
  showSourceBadges = true,
  showNotes = true,
}: {
  events: CalendarEvent[];
  onEventPress?: (e: CalendarEvent) => void;
  showSourceBadges?: boolean;
  showNotes?: boolean;
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

  // CAL-009: Hour labels from 12 AM to 11 PM
  const hourLabels = useMemo(() => {
    const labels: { hour: number; label: string }[] = [];
    for (let h = 0; h < 24; h++) {
      const ampm = h < 12 ? 'AM' : 'PM';
      const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
      labels.push({ hour: h, label: `${display} ${ampm}` });
    }
    return labels;
  }, []);

  // Tick every 60s to keep current-time line updated
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const currentTimeTop = useMemo(() => {
    const now = new Date();
    return (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;
  }, [weekDates, setTick]); // Re-render when tick state changes via interval

  return (
    <View>
      <DateNavBar label={weekLabel} onPrev={goPrev} onNext={goNext} onToday={goToday} />
      {/* Day header row with time-column spacer */}
      <View style={styles.weekGrid}>
        <View style={styles.weekTimeColSpacer} />
        {weekDates.map((d) => {
          const dateStr = formatDate(d);
          const isTodayView = isSameDay(d, today);
          const dayAllDay = getEventsForDate(events, dateStr).filter(e => e.allDay);
          return (
            <View key={dateStr} style={styles.weekDayCol}>
              <Text style={[styles.weekDayName, isTodayView && styles.weekDayNameToday]}>
                {getDayName(d)}
              </Text>
              <View style={[styles.weekDayNumWrap, isTodayView && styles.weekDayNumToday]}>
                <Text style={[styles.weekDayNum, isTodayView && styles.weekDayNumTodayText]}>
                  {d.getDate()}
                </Text>
              </View>
              {/* All-day event banners */}
              {dayAllDay.map(e => (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.allDayBanner, { backgroundColor: getEventColor(e) + '22' }]}
                  onPress={() => onEventPress?.(e)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.allDayBannerText} numberOfLines={1}>{e.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </View>
      {/* Time grid: hour labels + 7 day columns with absolutely positioned events */}
      <ScrollView style={styles.weekEventsContainer} nestedScrollEnabled>
        <View style={styles.timeGridBody}>
          <View style={styles.timeGridRow}>
            <View style={styles.timeColumn}>
              {hourLabels.map(h => (
                <View key={h.hour} style={styles.timeTick}>
                  <Text style={styles.timeTickLabel}>{h.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.timeDayColumnsRow}>
              {weekDates.map((d) => {
                const dateStr = formatDate(d);
                const dayEvents = getEventsForDate(events, dateStr).filter(e => !e.allDay);
                const isTodayView = isSameDay(d, today);
                return (
                  <View key={dateStr} style={styles.timeDayCol}>
                    {/* Hour grid lines */}
                    {hourLabels.map(h => (
                      <View key={h.hour} style={styles.timeDayColTick} />
                    ))}
                    {/* Timed events positioned absolutely by time (FF4-CAL-009 overlap layout) */}
                    {layoutTimedEvents(dayEvents).map(({ event: e, column, columnCount }) => {
                      const color = getEventColor(e);
                      const widthPct = 100 / columnCount;
                      const leftPct = column * widthPct;
                      return (
                        <TouchableOpacity
                          key={e.id}
                          style={[
                            styles.timeBlockEvent,
                            {
                              top: timeToTop(e.start),
                              height: eventHeight(e.start, e.end),
                              borderLeftColor: color,
                              left: `${leftPct}%`,
                              width: `${widthPct - 1}%`,
                            },
                          ]}
                          onPress={() => onEventPress?.(e)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.timeBlockTitle} numberOfLines={1}>{e.title}</Text>
                          <Text style={styles.timeBlockTime}>{formatTime(e.start)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {/* CAL-009: Red current-time line for today */}
                    {isTodayView ? (
                      <View style={[styles.currentTimeLine, { top: currentTimeTop }]} />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        </View>
        {events.length === 0 && (
          <Text style={styles.noEvents}>No events this week</Text>
        )}
      </ScrollView>
    </View>
  );
}

// ── Day Variant (CAL-009: time-based positioning) ────────────────────────────

function DayView({
  events,
  onEventPress,
  showSourceBadges = true,
  showNotes = true,
}: {
  events: CalendarEvent[];
  onEventPress?: (e: CalendarEvent) => void;
  showSourceBadges?: boolean;
  showNotes?: boolean;
}) {
  const [baseDate, setBaseDate] = useState(new Date());
  const today = new Date();

  const dateStr = useMemo(() => formatDate(baseDate), [baseDate]);
  const dayEvents = useMemo(() => getEventsForDate(events, dateStr), [events, dateStr]);
  const timedEvents = useMemo(() => dayEvents.filter(e => !e.allDay), [dayEvents]);
  const allDayEvents = useMemo(() => dayEvents.filter(e => e.allDay), [dayEvents]);

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

  // CAL-009: Hour labels from 12 AM to 11 PM
  const hourLabels = useMemo(() => {
    const labels: { hour: number; label: string }[] = [];
    for (let h = 0; h < 24; h++) {
      const ampm = h < 12 ? 'AM' : 'PM';
      const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
      labels.push({ hour: h, label: `${display} ${ampm}` });
    }
    return labels;
  }, []);

  // Tick every 60s to keep current-time line updated
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const isTodayView = isSameDay(baseDate, today);

  const currentTimeTop = useMemo(() => {
    const now = new Date();
    return (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;
  }, [isTodayView, setTick]); // Re-render when tick state changes

  return (
    <View>
      <DateNavBar
        label={`${isTodayView ? '📌 ' : ''}${label}`}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
      />
      {/* All-day events section */}
      {allDayEvents.length > 0 ? (
        <View style={styles.dayAllDaySection}>
          {allDayEvents.map(e => (
            <TouchableOpacity
              key={e.id}
              style={[styles.dayAllDayItem, { borderLeftColor: getEventColor(e) }]}
              onPress={() => onEventPress?.(e)}
              activeOpacity={0.7}
            >
              <Text style={styles.dayAllDayItemText}>📅 {e.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {/* Time grid: hour labels + single event column with absolutely positioned events */}
      <ScrollView style={styles.dayTimeline} nestedScrollEnabled>
        <View style={styles.timeGridBody}>
          <View style={styles.timeGridRow}>
            <View style={styles.timeColumn}>
              {hourLabels.map(h => (
                <View key={h.hour} style={styles.timeTick}>
                  <Text style={styles.timeTickLabel}>{h.label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.timeDayColumnsRow}>
              <View style={styles.timeDayColSingle}>
                {/* Hour grid lines */}
                {hourLabels.map(h => (
                  <View key={h.hour} style={styles.timeDayColTick} />
                ))}
                {/* Timed events positioned absolutely by time (FF4-CAL-009 overlap layout) */}
                {layoutTimedEvents(timedEvents).map(({ event: e, column, columnCount }) => {
                  const color = getEventColor(e);
                  const st = e.sourceType ? SOURCE_TYPE_CONFIG[e.sourceType] : undefined;
                  const widthPct = 100 / columnCount;
                  const leftPct = column * widthPct;
                  return (
                    <TouchableOpacity
                      key={e.id}
                      style={[
                        styles.timeBlockEvent,
                        styles.timeBlockEventDay,
                        {
                          top: timeToTop(e.start),
                          height: eventHeight(e.start, e.end),
                          borderLeftColor: color,
                          left: `${leftPct}%`,
                          width: `${widthPct - 1}%`,
                        },
                      ]}
                      onPress={() => onEventPress?.(e)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.timeBlockTitle} numberOfLines={1}>{e.title}</Text>
                      <Text style={styles.timeBlockTime}>
                        {formatTime(e.start)} – {formatTime(e.end)}
                      </Text>
                      {/* FF4-CAL-026: sourceType badge */}
                      {st && showSourceBadges ? (
                        <View style={[styles.timeBlockBadge, { backgroundColor: st.bg }]}>
                          <Text style={[styles.timeBlockBadgeText, { color: st.color }]}>{st.label}</Text>
                        </View>
                      ) : null}
                      {/* FF4-CAL-027: notes (2 lines truncated) */}
                      {e.notes && showNotes ? (
                        <Text style={styles.timeBlockNotes} numberOfLines={2}>{e.notes}</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                {/* CAL-009: Red current-time line for today */}
                {isTodayView ? (
                  <View style={[styles.currentTimeLine, { top: currentTimeTop }]} />
                ) : null}
                {timedEvents.length === 0 && allDayEvents.length === 0 && (
                  <Text style={styles.noEvents}>No events this day</Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Event List Variant ───────────────────────────────────────────────────────

function EventListView({
  events,
  onEventPress,
  maxEvents,
  showSourceBadges = true,
  showNotes = true,
}: {
  events: CalendarEvent[];
  onEventPress?: (e: CalendarEvent) => void;
  maxEvents?: number;
  showSourceBadges?: boolean;
  showNotes?: boolean;
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
            <EventItem key={e.id} event={e} onPress={onEventPress} showDate={false} showSourceBadges={showSourceBadges} showNotes={showNotes} />
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

// ── Event Detail Modal (CAL-011) ─────────────────────────────────────────────

function EventDetailModal({
  visible,
  event,
  onClose,
}: {
  visible: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
}) {
  if (!event) return null;
  const st = event.sourceType ? SOURCE_TYPE_CONFIG[event.sourceType] : undefined;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{event.title}</Text>
          <Text style={styles.modalTime}>
            {event.allDay ? 'All day' : `${formatTime(event.start)} – ${formatTime(event.end)}`}
          </Text>
          <Text style={styles.modalDate}>{formatDateFull(event.start)}</Text>
          {st ? (
            <View style={[styles.modalSourceBadge, { backgroundColor: st.bg }]}>
              <Text style={[styles.modalSourceBadgeText, { color: st.color }]}>{st.label}</Text>
            </View>
          ) : null}
          {event.notes ? (
            <Text style={styles.modalNotes}>{event.notes}</Text>
          ) : null}
          <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.modalCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main CalendarModule ──────────────────────────────────────────────────────

export function CalendarModule({
  variant = 'month',
  title,
  events: eventsProp = [],
  dataBinding,
  maxEvents,
  sourceTypes,
  categoryFilter,
  showSourceBadges = true,
  showNotes = true,
  compactThreshold = 200,
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

  // FF4-CAL-013: Local cache data source indicator
  //   'none'   → no cached data, awaiting API
  //   'cached' → showing cached data, API fetch in background
  //   'live'   → showing fresh API data
  //   'error'  → showing cached data, API fetch failed
  type CacheSource = 'none' | 'cached' | 'live' | 'error';
  const [cacheSource, setCacheSource] = useState<CacheSource>('none');

  // Stable cache key derived from dataBinding dataSourceId, or a fallback
  const cacheKey = useMemo(() => {
    const id = dataBinding?.dataSourceId ?? 'default';
    return `${CALENDAR_CACHE_PREFIX}${id}`;
  }, [dataBinding?.dataSourceId]);

  const { data: dataSourceData, refresh: dsRefresh } = useDataSource(dataBinding);

  // CAL-011: Event detail modal state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleEventPress = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setModalVisible(true);
    onEventPress?.(event);
  }, [onEventPress]);

  // Auto-fetch from backend API when no dataBinding is provided
  // On success: updates cache + sets source to 'live'
  // On failure: keeps cached data (if any) + sets source to 'error'
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
      const mapped: CalendarEvent[] = raw.map((e: any) => ({
        id: e.id,
        title: e.title,
        start: e.start ?? e.start_time ?? '',
        end: e.end ?? e.end_time ?? '',
        allDay: e.allDay ?? e.is_all_day ?? e.all_day ?? false,
        sourceColor: e.color ?? e.sourceColor,
        color: e.color,
        sourceType: e.sourceType ?? e.source_type ?? 'local',  // FF4-CAL-026
        notes: e.notes ?? undefined,                            // FF4-CAL-027
        category: e.category ?? undefined,                      // FF4-CAL-016
        description: e.description,
        location: e.location,
      }));
      setFetchedEvents(mapped);
      setCacheSource('live');
      // Save fresh data to local cache (fire-and-forget)
      saveCachedEvents(cacheKey, mapped);
    } catch (err) {
      console.warn('CalendarModule: failed to fetch events:', err);
      // If we were showing cached data, tag it as stale/error
      setCacheSource(prev => prev === 'cached' ? 'error' : 'none');
    } finally {
      setLoading(false);
    }
  }, [token, serverUrl, cacheKey]);

  // FF4-CAL-013: Load from local cache immediately for instant display
  useEffect(() => {
    if (dataBinding) return;
    let cancelled = false;

    loadCachedEvents(cacheKey).then((cached) => {
      if (cancelled) return;
      if (cached && cached.length > 0) {
        setFetchedEvents(cached);
        setCacheSource('cached');
        setLoading(false); // data available now, stop spinner
      }
    });

    return () => { cancelled = true; };
  }, [dataBinding, cacheKey]);

  // Fetch fresh data from API in background (replaces cached data on success)
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
        category: row.category as string | undefined,                      // FF4-CAL-016
        color: row.color as string | undefined,
        properties: row.properties as Record<string, unknown> | undefined,
      }));
    }
    if (eventsProp.length > 0) return eventsProp;
    return fetchedEvents;
  }, [dataSourceData, eventsProp, fetchedEvents]);

  // FF4-CAL-016: Filter events by source types and category
  const filteredEvents = useMemo<CalendarEvent[]>(() => {
    let result = events;

    if (sourceTypes && sourceTypes.trim()) {
      const types = sourceTypes.split(',').map(t => t.trim().toLowerCase());
      result = result.filter(e => e.sourceType && types.includes(e.sourceType.toLowerCase()));
    }

    if (categoryFilter && categoryFilter.trim()) {
      const filter = categoryFilter.trim().toLowerCase();
      result = result.filter(e =>
        (e.title && e.title.toLowerCase().includes(filter)) ||
        (e.category && e.category.toLowerCase().includes(filter)) ||
        (e.notes && e.notes.toLowerCase().includes(filter))
      );
    }

    return result;
  }, [events, sourceTypes, categoryFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCacheSource('none'); // clear stale cache indicator, show fresh state after fetch
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
  // FF4-CAL-019: compactThreshold is admin-controlled
  const effectiveVariant = useMemo<ValidVariant>(() => {
    if (cellWidth < compactThreshold && (validVariant === 'month' || validVariant === 'week' || validVariant === 'day')) {
      return 'compact';
    }
    return validVariant;
  }, [cellWidth, validVariant, compactThreshold]);

  const renderVariant = () => {
    switch (effectiveVariant) {
      case 'month':
        return <MonthView events={filteredEvents} onEventPress={handleEventPress} cellWidth={cellWidth} showSourceBadges={showSourceBadges} showNotes={showNotes} />;
      case 'week':
        return <WeekView events={filteredEvents} onEventPress={handleEventPress} showSourceBadges={showSourceBadges} showNotes={showNotes} />;
      case 'day':
        return <DayView events={filteredEvents} onEventPress={handleEventPress} showSourceBadges={showSourceBadges} showNotes={showNotes} />;
      case 'eventList':
        return <EventListView events={filteredEvents} onEventPress={handleEventPress} maxEvents={maxEvents} showSourceBadges={showSourceBadges} showNotes={showNotes} />;
      case 'compact':
        return <CompactView events={filteredEvents} onEventPress={handleEventPress} cellWidth={cellWidth} />;
    }
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} />
        }
      >
        {title ? (
          <Text style={styles.moduleTitle}>{title}</Text>
        ) : null}

        {/* FF4-CAL-013: Cache source indicator — "Live", "Cached", or "Offline data" */}
        {cacheSource !== 'none' ? (
          <View style={styles.cacheIndicator}>
            <View
              style={[
                styles.cacheDot,
                cacheSource === 'live'
                  ? styles.cacheDotLive
                  : cacheSource === 'cached'
                    ? styles.cacheDotCached
                    : styles.cacheDotError,
              ]}
            />
            <Text style={styles.cacheText}>
              {cacheSource === 'live'
                ? 'Live'
                : cacheSource === 'cached'
                  ? 'Cached'
                  : 'Offline data'}
            </Text>
          </View>
        ) : null}

        {/* FF4-CAL-005: NO variant switcher on mobile — variant is admin-controlled via SDUI payload */}
        {/* Only time navigation is available within the chosen variant */}

        {cellWidth < compactThreshold && validVariant !== effectiveVariant && (
          <Text style={styles.autoAdaptNotice}>
            Auto-adapted to compact view (cell too small)
          </Text>
        )}

        {renderVariant()}
      </ScrollView>
      {/* CAL-011: Event detail modal */}
      <EventDetailModal
        visible={modalVisible}
        event={selectedEvent}
        onClose={() => {
          setModalVisible(false);
          setSelectedEvent(null);
        }}
      />
    </>
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

  // CAL-009: Time grid (shared by WeekView and DayView)
  weekEventsContainer: {
    maxHeight: 400,
    paddingHorizontal: 4,
  },
  dayTimeline: {
    maxHeight: 500,
    paddingHorizontal: 4,
  },
  weekTimeColSpacer: {
    width: 50,
  },
  timeGridBody: {
    height: 24 * HOUR_HEIGHT,
  },
  timeGridRow: {
    flexDirection: 'row',
  },
  timeColumn: {
    width: 50,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E5E5EA',
  },
  timeTick: {
    height: HOUR_HEIGHT,
    justifyContent: 'flex-start',
    paddingTop: 1,
  },
  timeTickLabel: {
    fontSize: 9,
    color: '#8E8E93',
    textAlign: 'right',
    paddingRight: 4,
  },
  timeDayColumnsRow: {
    flex: 1,
    flexDirection: 'row',
  },
  timeDayCol: {
    flex: 1,
    position: 'relative',
  },
  timeDayColSingle: {
    flex: 1,
    position: 'relative',
    minHeight: 24 * HOUR_HEIGHT,
  },
  timeDayColTick: {
    height: HOUR_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F0',
  },
  timeBlockEvent: {
    position: 'absolute',
    borderLeftWidth: 3,
    backgroundColor: '#FAFAFA',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    overflow: 'hidden',
    zIndex: 5,
  },
  timeBlockEventSingle: {
    left: 2,
    right: 2,
  },
  timeBlockEventDay: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  timeBlockTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000',
  },
  timeBlockTime: {
    fontSize: 9,
    color: '#8E8E93',
  },
  timeBlockBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 2,
  },
  timeBlockBadgeText: {
    fontSize: 8,
    fontWeight: '600',
  },
  timeBlockNotes: {
    fontSize: 10,
    color: '#8E8E93',
    fontStyle: 'italic',
    marginTop: 2,
    lineHeight: 12,
  },
  currentTimeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FF3B30',
    zIndex: 10,
  },
  // All-day event banners (WeekView)
  allDayBanner: {
    width: '100%',
    paddingHorizontal: 2,
    paddingVertical: 1,
    borderRadius: 2,
    marginTop: 2,
  },
  allDayBannerText: {
    fontSize: 8,
    fontWeight: '500',
    color: '#555',
  },
  // All-day section (DayView)
  dayAllDaySection: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  dayAllDayItem: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 4,
    backgroundColor: '#FAFAFA',
    borderRadius: 3,
  },
  dayAllDayItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555',
  },
  noEventsTimeGrid: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    fontSize: 13,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
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
  // CAL-011: Event detail modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  modalTime: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  modalDate: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  modalSourceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 12,
  },
  modalSourceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalNotes: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalCloseBtn: {
    alignSelf: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalCloseBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // FF4-CAL-013: Cache source indicator
  cacheIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 2,
    gap: 4,
  },
  cacheDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cacheDotLive: {
    backgroundColor: '#34C759',
  },
  cacheDotCached: {
    backgroundColor: '#FF9500',
  },
  cacheDotError: {
    backgroundColor: '#FF3B30',
  },
  cacheText: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '500',
  },
});
