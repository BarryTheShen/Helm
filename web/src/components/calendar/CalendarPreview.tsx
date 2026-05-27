import { useMemo, useState } from 'react';

export type CalendarPreviewVariant = 'month' | 'week' | 'day' | 'eventList' | 'compact';

export interface CalendarPreviewEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  sourceColor?: string;
  sourceType?: 'local' | 'caldav' | 'notion' | 'custom';
  notes?: string;
}

export interface CalendarPreviewProps {
  variant?: CalendarPreviewVariant;
  title?: string;
  maxEvents?: number;
  showSourceBadges?: boolean;
  showNotes?: boolean;
  compactThreshold?: number;
  sourceTypes?: string;
  categoryFilter?: string;
}

const SOURCE_BADGE_COLORS: Record<string, string> = {
  local: '#6B7280',
  caldav: '#2563EB',
  notion: '#7C3AED',
  custom: '#0D9488',
};

const SAMPLE_EVENTS: CalendarPreviewEvent[] = [
  {
    id: 'evt-1',
    title: 'Team standup',
    start: `${todayIso()}T09:00:00`,
    end: `${todayIso()}T09:30:00`,
    sourceColor: '#2563EB',
    sourceType: 'local',
    notes: 'Daily sync with engineering. Review blockers and sprint goals for the week ahead.',
  },
  {
    id: 'evt-2',
    title: 'Design review',
    start: `${todayIso()}T14:00:00`,
    end: `${todayIso()}T15:00:00`,
    sourceColor: '#7C3AED',
    sourceType: 'notion',
    notes: 'Review FF4 calendar mockups and mobile parity checklist.',
  },
  {
    id: 'evt-3',
    title: 'Tomorrow planning',
    start: `${offsetDateIso(1)}T10:00:00`,
    end: `${offsetDateIso(1)}T11:00:00`,
    sourceColor: '#0D9488',
    sourceType: 'custom',
    notes: 'Plan tomorrow tasks and calendar blocks.',
  },
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function offsetDateIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function normalizeVariant(variant?: string): CalendarPreviewVariant {
  if (variant === 'week' || variant === 'day' || variant === 'eventList' || variant === 'compact') {
    return variant;
  }
  return 'month';
}

function eventsForDate(events: CalendarPreviewEvent[], dateIso: string): CalendarPreviewEvent[] {
  return events.filter((event) => event.start.startsWith(dateIso));
}

function truncateNotes(notes: string, maxLines = 2): string {
  const lines = notes.split('\n').slice(0, maxLines);
  const joined = lines.join('\n');
  if (notes.split('\n').length > maxLines) {
    return `${joined}…`;
  }
  return joined.length > 120 ? `${joined.slice(0, 117)}…` : joined;
}

function filterEvents(
  events: CalendarPreviewEvent[],
  sourceTypes?: string,
  categoryFilter?: string,
): CalendarPreviewEvent[] {
  let filtered = events;
  if (sourceTypes?.trim()) {
    const allowed = new Set(
      sourceTypes.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean),
    );
    if (allowed.size > 0) {
      filtered = filtered.filter((event) => allowed.has((event.sourceType ?? 'local').toLowerCase()));
    }
  }
  if (categoryFilter?.trim()) {
    filtered = filtered.filter((event) =>
      event.title.toLowerCase().includes(categoryFilter.trim().toLowerCase()),
    );
  }
  return filtered;
}

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
    <div
      className="mb-2 flex items-center justify-between gap-1 text-[10px] text-gray-600"
      data-testid="calendar-date-nav"
    >
      <button type="button" data-testid="calendar-nav-prev" className="rounded px-1 hover:bg-gray-100" onClick={onPrev}>
        ◀
      </button>
      <span data-testid="calendar-range-label" className="flex-1 text-center font-medium">
        {label}
      </span>
      <button type="button" data-testid="calendar-nav-next" className="rounded px-1 hover:bg-gray-100" onClick={onNext}>
        ▶
      </button>
      <button
        type="button"
        data-testid="calendar-nav-today"
        className="rounded bg-gray-100 px-2 py-0.5 font-semibold hover:bg-gray-200"
        onClick={onToday}
      >
        Today
      </button>
    </div>
  );
}

function SourceBadge({ sourceType }: { sourceType?: string }) {
  const resolved = sourceType ?? 'local';
  return (
    <span
      data-testid={`calendar-source-badge-${resolved}`}
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white"
      style={{ backgroundColor: SOURCE_BADGE_COLORS[resolved] ?? SOURCE_BADGE_COLORS.local }}
    >
      {resolved}
    </span>
  );
}

function MonthPreview({
  events,
  selectedDate,
  onSelectDate,
  onSelectEvent,
  showSourceBadges,
}: {
  events: CalendarPreviewEvent[];
  selectedDate: string;
  onSelectDate: (dateIso: string) => void;
  onSelectEvent: (event: CalendarPreviewEvent) => void;
  showSourceBadges?: boolean;
}) {
  const today = todayIso();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const firstWeekday = startOfMonth.getDay();
  const daysInMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0).getDate();

  const cells: Array<{ day: number | null; dateIso: string | null }> = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ day: null, dateIso: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateIso = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, dateIso });
  }

  const agendaEvents = eventsForDate(events, selectedDate);

  return (
    <div data-testid="calendar-month-view">
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-gray-500">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
          <div key={`${label}-${index}`} className="font-medium">
            {label}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5 text-center text-xs" data-testid="calendar-month-grid">
        {cells.map((cell, index) => {
          if (cell.day === null || cell.dateIso === null) {
            return <div key={`empty-${index}`} className="py-1" />;
          }

          const dayEvents = eventsForDate(events, cell.dateIso);
          const isToday = cell.dateIso === today;
          const isSelected = cell.dateIso === selectedDate;

          return (
            <button
              key={cell.dateIso}
              type="button"
              data-testid={isToday ? 'calendar-today' : `calendar-date-${cell.day}`}
              data-date={cell.dateIso}
              onClick={() => onSelectDate(cell.dateIso!)}
              className={`relative rounded py-1 transition-colors ${
                isToday ? 'bg-blue-600 text-white' : isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              {cell.day}
              {dayEvents.length > 0 && (
                <span className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className="inline-block h-1 w-1 rounded-full"
                      style={{ backgroundColor: event.sourceColor ?? SOURCE_BADGE_COLORS[event.sourceType ?? 'local'] }}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-2 border-t pt-2" data-testid="calendar-agenda">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Agenda</div>
        {agendaEvents.length === 0 ? (
          <div className="text-xs text-gray-400">No events for this date</div>
        ) : (
          agendaEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              data-testid={`calendar-agenda-event-${event.id}`}
              onClick={() => onSelectEvent(event)}
              className="mb-1 flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-gray-50"
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: event.sourceColor ?? SOURCE_BADGE_COLORS[event.sourceType ?? 'local'] }}
              />
              <span className="font-medium">{formatTime(event.start)}</span>
              <span className="flex-1">{event.title}</span>
              {showSourceBadges && <SourceBadge sourceType={event.sourceType} />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function TimeGridPreview({
  events,
  onSelectEvent,
  mode,
  showSourceBadges,
}: {
  events: CalendarPreviewEvent[];
  onSelectEvent: (event: CalendarPreviewEvent) => void;
  mode: 'week' | 'day';
  showSourceBadges?: boolean;
}) {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

  return (
    <div data-testid={`calendar-${mode}-view`}>
      <div className="relative" data-testid="calendar-time-grid">
        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-[40px_1fr] border-t border-gray-100 text-[10px]">
            <div className="py-2 pr-1 text-right text-gray-400">{String(hour).padStart(2, '0')}:00</div>
            <div className="relative min-h-[28px] py-1">
              {events
                .filter((event) => new Date(event.start).getHours() === hour)
                .map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    data-testid={`calendar-time-event-${event.id}`}
                    onClick={() => onSelectEvent(event)}
                    className="mb-1 flex w-full items-center gap-1 rounded px-2 py-1 text-left text-[10px] text-white"
                    style={{ backgroundColor: event.sourceColor ?? SOURCE_BADGE_COLORS[event.sourceType ?? 'local'] }}
                  >
                    <span className="flex-1">
                      {formatTime(event.start)} — {event.title}
                    </span>
                    {showSourceBadges && <SourceBadge sourceType={event.sourceType} />}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactPreview({ events, maxEvents }: { events: CalendarPreviewEvent[]; maxEvents: number }) {
  const todayEvents = eventsForDate(events, todayIso());
  const visible = events.slice(0, maxEvents);
  const nextEvent = visible[0];

  return (
    <div data-testid="calendar-compact-view" className="space-y-1 text-xs">
      <div className="font-semibold" data-testid="calendar-compact-count">
        📅 {todayEvents.length} events today
      </div>
      {nextEvent && (
        <div className="truncate text-gray-600" data-testid="calendar-compact-next">
          Next: {formatTime(nextEvent.start)} — {nextEvent.title}
        </div>
      )}
    </div>
  );
}

function EventListPreview({
  events,
  maxEvents,
  showSourceBadges,
  showNotes,
}: {
  events: CalendarPreviewEvent[];
  maxEvents: number;
  showSourceBadges?: boolean;
  showNotes?: boolean;
}) {
  const visible = [...events]
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, maxEvents);

  return (
    <div data-testid="calendar-event-list-view" className="space-y-1 text-xs">
      {visible.map((event) => (
        <div key={event.id} className="flex flex-col gap-0.5 rounded border border-gray-100 px-2 py-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: event.sourceColor ?? SOURCE_BADGE_COLORS[event.sourceType ?? 'local'] }}
            />
            <span className="font-medium">{formatTime(event.start)}</span>
            <span className="flex-1">{event.title}</span>
            {showSourceBadges && <SourceBadge sourceType={event.sourceType} />}
          </div>
          {showNotes && event.notes && (
            <p className="line-clamp-2 text-[10px] text-gray-500" data-testid={`calendar-event-notes-${event.id}`}>
              {truncateNotes(event.notes)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function CalendarPreview({
  variant = 'month',
  title,
  maxEvents = 10,
  showSourceBadges = true,
  showNotes = true,
  compactThreshold = 200,
  sourceTypes,
  categoryFilter,
}: CalendarPreviewProps) {
  const resolvedVariant = normalizeVariant(variant);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selectedEvent, setSelectedEvent] = useState<CalendarPreviewEvent | null>(null);
  const [rangeOffset, setRangeOffset] = useState(0);
  const events = useMemo(
    () => filterEvents(SAMPLE_EVENTS, sourceTypes, categoryFilter),
    [sourceTypes, categoryFilter],
  );

  const rangeLabel = useMemo(() => {
    if (resolvedVariant === 'week') return `Week +${rangeOffset}`;
    if (resolvedVariant === 'day') return selectedDate;
    if (resolvedVariant === 'compact' || resolvedVariant === 'eventList') return 'Upcoming';
    const d = new Date();
    d.setMonth(d.getMonth() + rangeOffset);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [resolvedVariant, rangeOffset, selectedDate]);

  const showFitWarning =
    (resolvedVariant === 'month' || resolvedVariant === 'week' || resolvedVariant === 'day')
    && compactThreshold >= 200;

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto rounded-lg border bg-white p-2"
      data-testid="calendar-preview"
      data-variant={resolvedVariant}
    >
      <div className="mb-2 text-sm font-bold">{title?.trim() ? title : '📅 Calendar'}</div>

      <DateNavBar
        label={rangeLabel}
        onPrev={() => setRangeOffset((value) => value - 1)}
        onNext={() => setRangeOffset((value) => value + 1)}
        onToday={() => {
          setRangeOffset(0);
          setSelectedDate(todayIso());
        }}
      />

      {showFitWarning && (
        <div
          className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-800"
          data-testid="calendar-fit-warning"
        >
          Cells narrower than {compactThreshold}px auto-adapt to Compact or Event List on mobile.
        </div>
      )}

      {resolvedVariant === 'month' && (
        <MonthPreview
          events={events}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onSelectEvent={setSelectedEvent}
          showSourceBadges={showSourceBadges}
        />
      )}

      {(resolvedVariant === 'week' || resolvedVariant === 'day') && (
        <TimeGridPreview
          events={events}
          onSelectEvent={setSelectedEvent}
          mode={resolvedVariant}
          showSourceBadges={showSourceBadges}
        />
      )}

      {resolvedVariant === 'compact' && <CompactPreview events={events} maxEvents={maxEvents} />}

      {resolvedVariant === 'eventList' && (
        <EventListPreview
          events={events}
          maxEvents={maxEvents}
          showSourceBadges={showSourceBadges}
          showNotes={showNotes}
        />
      )}

      {selectedEvent && (
        <div
          className="mt-2 rounded border border-blue-100 bg-blue-50 p-2 text-xs"
          data-testid="calendar-event-detail"
        >
          <div className="flex items-center gap-2">
            <div className="font-semibold">{selectedEvent.title}</div>
            {showSourceBadges && <SourceBadge sourceType={selectedEvent.sourceType} />}
          </div>
          <div className="text-gray-600">
            {formatTime(selectedEvent.start)} – {formatTime(selectedEvent.end)}
          </div>
          {showNotes && selectedEvent.notes && (
            <p className="mt-1 line-clamp-2 text-gray-600" data-testid="calendar-event-detail-notes">
              {truncateNotes(selectedEvent.notes)}
            </p>
          )}
          <button
            type="button"
            className="mt-1 text-[10px] text-blue-600"
            onClick={() => setSelectedEvent(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
