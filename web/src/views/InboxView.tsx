import type { DayGroup, DayOption } from '../lib/day';
import { formatDayKey } from '../lib/day';
import { ArtifactCard } from '../components/ArtifactCard';
import { InboxHeaderControls } from '../components/HeaderControls';
import type { LearningArtifact } from '../types';
import type { FilterType } from '../ui';

type InboxViewProps = {
  artifacts?: LearningArtifact[];
  groups?: DayGroup[];
  dayOptions?: DayOption[];
  currentFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  selectedDay?: string;
  onDayChange?: (day: string) => void;
};

export function InboxView({
  artifacts,
  groups,
  dayOptions,
  currentFilter,
  onFilterChange,
  selectedDay,
  onDayChange,
}: InboxViewProps) {
  const showDayControls = Boolean(dayOptions && onDayChange);
  const todayKey = formatDayKey(new Date());
  const hasToday = dayOptions?.some((option) => option.day === todayKey) ?? false;
  const effectiveSelectedDay = selectedDay ?? (hasToday ? todayKey : 'all');
  const totalItems = groups
    ? groups.reduce((sum, group) => sum + group.items.length, 0)
    : artifacts?.length ?? 0;
  const visibleDays = groups?.length ?? Math.max((dayOptions?.length ?? 1) - 1, 1);

  const content = !artifacts?.length && !groups?.length ? (
    <div className="empty-panel paper-card">
      <div className="empty-state-title">No items yet.</div>
      <p>Keep typing. TypeLearn will collect corrections, rewrites, and reusable lines here.</p>
    </div>
  ) : groups ? (
    <div className="section-stack">
      {groups.map((group) => (
        <section key={group.day} className="paper-card day-group">
          <header className="day-header">
            <div>
              <div className="day-title">{group.label}</div>
              <div className="day-count">{group.items.length} item{group.items.length > 1 ? 's' : ''}</div>
            </div>
            <button className="ghost-button" onClick={() => onDayChange?.(group.day)} type="button">
              Open day
            </button>
          </header>
          <div className="content-grid">
            {group.items.map((artifact) => (
              <ArtifactCard key={artifact.id} artifact={artifact} />
            ))}
          </div>
        </section>
      ))}
    </div>
  ) : (
    <div className="content-grid">
      {(artifacts ?? []).map((artifact) => (
        <ArtifactCard key={artifact.id} artifact={artifact} />
      ))}
    </div>
  );

  return (
    <div className="view-stack">
      <section className="inbox-summary-bar glass-panel">
        <div className="inbox-summary-copy">
          <span className="mini-pill tone-lavender">{totalItems} items</span>
          <span className="mini-pill tone-mint">{visibleDays} days</span>
          <span className="mini-pill tone-peach">{currentFilter}</span>
        </div>
      </section>

      {showDayControls ? (
        <InboxHeaderControls
          dayOptions={dayOptions ?? []}
          currentFilter={currentFilter}
          onFilterChange={onFilterChange}
          selectedDay={effectiveSelectedDay}
          onDayChange={(day) => onDayChange?.(day)}
        />
      ) : null}

      {content}
    </div>
  );
}
