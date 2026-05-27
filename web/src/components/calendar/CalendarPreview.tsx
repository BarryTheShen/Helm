import { useMemo, useState } from 'react';

export type CalendarPreviewVariant = 'month' | 'week' | 'day' | 'eventList' | 'compact';

export interface CalendarPreviewEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  sourceColor?: string;
}

export interface CalendarPreviewProps {
  variant?: CalendarPreviewVariant;
  title?: string;
  maxEvents?: number;
}

const SAMPLE_EVENTS: CalendarPreviewEvent[] = [
  {
    id: 'evt-1',
    title: 'Team standup',
    start: `${todayIso()}T09:00:00`,
    end: `${todayIso()}T09:30:00`,
    sourceColor: '#2563EB',
  },
  {
    id: 'evt-2',
    title: 'Design review',
    start: `${todayIso()}T14:00:00`,
    end: `${todayIso()}T15:00:00`,
    sourceColor: '#7C3AED',
  },
  {
    id: 'evt-3',
    title: 'Tomorrow planning',
    start: `${offsetDateIso(1)}T10:00:00`,
    end: `${offsetDateIso(1)}T11:00:00`,
    sourceColor: '#0D9488',
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

function MonthPreview({
  events,
  selectedDate,
  onSelectDate,
  onSelectEvent,
}: {
  events: CalendarPreviewEvent[];
  selectedDate: string;
  onSelectDate: (dateIso: string) => void;
  onSelectEvent: (event: CalendarPreviewEvent) => void;
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
              data-testid={`calendar-date-${cell.day}`}
              data-date={cell.dateIso}
              onClick={() => onSelectDate(cell.dateIso!)}
              className={`relative rounded py-1 transition-colors ${
                isToday ? 'bg-blue-600 text-white' : isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'
              }`}
              {...(isToday ? { 'data-testid': 'calendar-today' } : {})}
            >
              {cell.day}
              {dayEvents.length > 0 && (
                <span className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className="inline-block h-1 w-1 rounded-full"
                      style={{ backgroundColor: event.sourceColor ?? '#2563EB' }}
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
                style={{ backgroundColor: event.sourceColor ?? '#2563EB' }}
              />
              <span className="font-medium">{formatTime(event.start)}</span>
              <span>{event.title}</span>
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
}: {
  events: CalendarPreviewEvent[];
  onSelectEvent: (event: CalendarPreviewEvent) => void;
  mode: 'week' | 'day';
}) {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

  return (
    <div data-testid={`calendar-${mode}-view`}>
      <div className="mb-2 flex items-center justify-between text-[10px] text-gray-500">
        <button type="button" data-testid="calendar-nav-prev" className="rounded px-1 hover:bg-gray-100">
          ◀
        </button>
        <span>{mode === 'week' ? 'Week view' : 'Day view'}</span>
        <button type="button" data-testid="calendar-nav-next" className="rounded px-1 hover:bg-gray-100">
          ▶
        </button>
      </div>
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
                    className="mb-1 block w-full rounded px-2 py-1 text-left text-[10px] text-white"
                    style={{ backgroundColor: event.sourceColor ?? '#2563EB' }}
                  >
                    {formatTime(event.start)} — {event.title}
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
  const visible = events.slice(0, maxEvents);
  return (
    <div data-testid="calendar-compact-view" className="space-y-1 text-xs">
      <div className="font-semibold">📅 {eventsForDate(events, todayIso()).length} events today</div>
      {visible.map((event) => (
        <div key={event.id} className="truncate text-gray-600">
          Next: {formatTime(event.start)} — {event.title}
        </div>
      ))}
    </div>
  );
}

function EventListPreview({ events, maxEvents }: { events: CalendarPreviewEvent[]; maxEvents: number }) {
  const visible = [...events]
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, maxEvents);

  return (
    <div data-testid="calendar-event-list-view" className="space-y-1 text-xs">
      {visible.map((event) => (
        <div key={event.id} className="flex items-center gap-2 rounded border border-gray-100 px-2 py-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: event.sourceColor ?? '#2563EB' }}
          />
          <span className="font-medium">{formatTime(event.start)}</span>
          <span>{event.title}</span>
        </div>
      ))}
    </div>
  );
}

export function CalendarPreview({ variant = 'month', title, maxEvents = 10 }: CalendarPreviewProps) {
  const resolvedVariant = normalizeVariant(variant);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selectedEvent, setSelectedEvent] = useState<CalendarPreviewEvent | null>(null);
  const events = useMemo(() => SAMPLE_EVENTS, []);

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto rounded-lg border bg-white p-2"
      data-testid="calendar-preview"
      data-variant={resolvedVariant}
    >
      <div className="mb-2 text-sm font-bold">{title?.trim() ? title : '📅 Calendar'}</div>

      {resolvedVariant === 'month' && (
        <MonthPreview
          events={events}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onSelectEvent={setSelectedEvent}
        />
      )}

      {(resolvedVariant === 'week' || resolvedVariant === 'day') && (
        <TimeGridPreview events={events} onSelectEvent={setSelectedEvent} mode={resolvedVariant} />
      )}

      {resolvedVariant === 'compact' && <CompactPreview events={events} maxEvents={maxEvents} />}

      {resolvedVariant === 'eventList' && <EventListPreview events={events} maxEvents={maxEvents} />}

      {selectedEvent && (
        <div
          className="mt-2 rounded border border-blue-100 bg-blue-50 p-2 text-xs"
          data-testid="calendar-event-detail"
        >
          <div className="font-semibold">{selectedEvent.title}</div>
          <div className="text-gray-600">
            {formatTime(selectedEvent.start)} – {formatTime(selectedEvent.end)}
          </div>
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
