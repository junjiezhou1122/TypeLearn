import { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DayOption } from '../lib/day';
import type { DayDigest } from '../types';
import type { FilterType } from '../ui';
import { DatePopover } from './DatePopover';

type InboxHeaderControlsProps = {
  dayOptions: DayOption[];
  currentFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  selectedDay: string;
  onDayChange: (day: string) => void;
};

export const InboxHeaderControls = memo(function InboxHeaderControls({
  dayOptions,
  currentFilter,
  onFilterChange,
  selectedDay,
  onDayChange,
}: InboxHeaderControlsProps) {
  const selectedOption = dayOptions.find((option) => option.day === selectedDay) ?? null;
  const isAll = selectedDay === 'all';

  const stepDay = (direction: 'left' | 'right') => {
    if (!dayOptions.length || isAll) return;

    const currentIndex = dayOptions.findIndex((option) => option.day === selectedDay);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + (direction === 'left' ? -1 : 1);
    if (nextIndex < 0 || nextIndex >= dayOptions.length) return;

    onDayChange(dayOptions[nextIndex].day);
  };

  return (
    <div className="toolbar glass-panel">
      <div className="filter-segment" role="tablist" aria-label="Inbox filter">
        <button
          className={`filter-segment-item ${currentFilter === 'all' ? 'active' : ''}`}
          onClick={() => onFilterChange('all')}
          type="button"
        >
          All
        </button>
        <button
          className={`filter-segment-item ${currentFilter === 'english' ? 'active' : ''}`}
          onClick={() => onFilterChange('english')}
          type="button"
        >
          English
        </button>
        <button
          className={`filter-segment-item ${currentFilter === 'chinese' ? 'active' : ''}`}
          onClick={() => onFilterChange('chinese')}
          type="button"
        >
          Chinese
        </button>
      </div>

      <div className="toolbar-day-controls">
        <span className="time-current-label">{selectedOption?.label ?? (isAll ? 'All' : 'Today')}</span>

        <div className="day-stepper">
          <button
            className="day-scroll-btn"
            type="button"
            aria-label="Previous day"
            onClick={() => stepDay('left')}
            disabled={!selectedOption || isAll}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            className="day-scroll-btn"
            type="button"
            aria-label="Next day"
            onClick={() => stepDay('right')}
            disabled={!selectedOption || isAll}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {!isAll ? <DatePopover key={selectedDay} day={selectedDay} onDayChange={onDayChange} /> : null}
      </div>
    </div>
  );
});

type DigestHeaderControlsProps = {
  digest: DayDigest | null;
  dayOptions: DayOption[];
  selectedDay: string;
  onDayChange: (day: string) => void;
};

export const DigestHeaderControls = memo(function DigestHeaderControls({
  digest,
  dayOptions,
  selectedDay,
  onDayChange,
}: DigestHeaderControlsProps) {
  const selectedOption = dayOptions.find((option) => option.day === selectedDay) ?? null;

  const stepDay = (direction: 'left' | 'right') => {
    if (!dayOptions.length) return;

    const currentIndex = dayOptions.findIndex((option) => option.day === selectedDay);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + (direction === 'left' ? -1 : 1);
    if (nextIndex < 0 || nextIndex >= dayOptions.length) return;

    onDayChange(dayOptions[nextIndex].day);
  };

  return (
    <div className="toolbar digest-toolbar glass-panel">
      <div className="digest-toolbar-copy">
        <div className="digest-toolbar-title">{selectedOption?.label ?? 'Today'}</div>
        <div className="digest-toolbar-subtitle">
          {digest
            ? `${digest.sessionCount} session${digest.sessionCount > 1 ? 's' : ''} · ${digest.keyMoments.length} key moment${digest.keyMoments.length > 1 ? 's' : ''}`
            : 'No digest generated for this day yet'}
        </div>
      </div>

      <div className="toolbar-day-controls">
        <div className="day-stepper">
          <button
            className="day-scroll-btn"
            type="button"
            aria-label="Previous day"
            onClick={() => stepDay('left')}
            disabled={!selectedOption}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            className="day-scroll-btn"
            type="button"
            aria-label="Next day"
            onClick={() => stepDay('right')}
            disabled={!selectedOption}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <DatePopover key={selectedDay} day={selectedDay} onDayChange={onDayChange} />
      </div>
    </div>
  );
});
