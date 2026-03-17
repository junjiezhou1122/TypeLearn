import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateControlLabel, formatDayKey, parseDayKey } from '../lib/day';

type DatePopoverProps = {
  day: string;
  onDayChange?: (day: string) => void;
};

export function DatePopover({ day, onDayChange }: DatePopoverProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const selectedDate = parseDayKey(day);
  const viewMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + monthOffset, 1);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const monthLabel = viewMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const firstWeekday = monthStart.getDay();
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - firstWeekday);

  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);

    return {
      key: formatDayKey(date),
      date,
      inMonth: date.getMonth() === viewMonth.getMonth(),
      isToday: formatDayKey(date) === formatDayKey(new Date()),
    };
  });

  const chooseDay = (nextDay: string) => {
    onDayChange?.(nextDay);
    setIsOpen(false);
  };

  const shiftMonth = (delta: number) => {
    setMonthOffset((current) => current + delta);
  };

  return (
    <div className="date-popover" ref={rootRef}>
      <button
        className={`date-trigger ${isOpen ? 'open' : ''}`}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Choose date"
        aria-expanded={isOpen}
      >
        <span>{formatDateControlLabel(day)}</span>
        <Calendar size={15} />
      </button>

      {isOpen ? (
        <div className="date-popover-panel glass-panel" role="dialog" aria-label="Calendar">
          <div className="date-popover-header">
            <button
              className="calendar-nav-btn"
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <div className="calendar-month-label">{monthLabel}</div>
            <button
              className="calendar-nav-btn"
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarDays.map((entry) => {
              const isSelected = entry.key === day;
              const classes = [
                'calendar-day',
                entry.inMonth ? '' : 'calendar-day-muted',
                isSelected ? 'calendar-day-selected' : '',
                entry.isToday ? 'calendar-day-today' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <button
                  key={entry.key}
                  className={classes}
                  type="button"
                  onClick={() => chooseDay(entry.key)}
                  aria-pressed={isSelected}
                >
                  {entry.date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="calendar-footer">
            <button
              className="calendar-today-link"
              type="button"
              onClick={() => chooseDay(formatDayKey(new Date()))}
            >
              Jump to today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
