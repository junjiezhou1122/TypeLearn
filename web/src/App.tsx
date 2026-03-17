import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import {
  Inbox,
  Book,
  Braces,
  Settings,
  RefreshCcw,
  MessageCircle,
  Zap,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import type {
  LearningArtifact,
  StoryArtifact,
  ProviderSettings,
  ChoiceItem,
  DailyLesson,
  DayDigest,
} from './types';

const API_BASE = 'http://localhost:43010';

type ViewType = 'inbox' | 'story' | 'digest' | 'choices' | 'lesson' | 'settings';
type FilterType = 'all' | 'english' | 'chinese';

type DayGroup = {
  day: string;
  label: string;
  items: LearningArtifact[];
};

type DayOption = {
  day: string;
  label: string;
  count: number;
};

type DigestFocus =
  | { type: 'pattern'; id: string }
  | { type: 'moment'; id: string }
  | { type: 'session'; id: string };

const formatDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDayKey = (dayKey: string): Date => {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const formatDateControlLabel = (dayKey: string): string => (
  parseDayKey(dayKey).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
);

const getDayLabel = (dayKey: string): string => {
  const todayKey = formatDayKey(new Date());
  const yesterdayKey = formatDayKey(new Date(Date.now() - 86_400_000));
  if (dayKey === todayKey) return 'Today';
  if (dayKey === yesterdayKey) return 'Yesterday';
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const humanizePatternKey = (patternKey: string): string => {
  const parts = patternKey.split(':');
  const raw = parts.length > 1 ? parts[1] : parts[0];
  return raw.replace(/[_-]+/g, ' ').trim();
};

const groupByDay = (artifacts: LearningArtifact[]): DayGroup[] => {
  const grouped = new Map<string, LearningArtifact[]>();
  artifacts.forEach((artifact) => {
    const dayKey = formatDayKey(new Date(artifact.createdAt));
    const bucket = grouped.get(dayKey);
    if (bucket) {
      bucket.push(artifact);
    } else {
      grouped.set(dayKey, [artifact]);
    }
  });

  return Array.from(grouped.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([day, items]) => ({ day, label: getDayLabel(day), items }));
};

export default function App() {
  const [view, setView] = useState<ViewType>('inbox');
  const [filter, setFilter] = useState<FilterType>('all');
  const [artifacts, setArtifacts] = useState<LearningArtifact[]>([]);
  const [stories, setStories] = useState<StoryArtifact[]>([]);
  const [choices, setChoices] = useState<ChoiceItem[]>([]);
  const [daily, setDaily] = useState<DailyLesson | null>(null);
  const [digest, setDigest] = useState<DayDigest | null>(null);
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const todayKey = formatDayKey(new Date());
  const [selectedDay, setSelectedDay] = useState<string>(todayKey);
  const activeDay = selectedDay;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const storyUrl = new URL(`${API_BASE}/stories`);
      storyUrl.searchParams.set('day', activeDay);
      const dailyUrl = new URL(`${API_BASE}/daily`);
      dailyUrl.searchParams.set('day', activeDay);
      const digestUrl = new URL(`${API_BASE}/digests`);
      digestUrl.searchParams.set('day', activeDay);

      const [artRes, storyRes, choiceRes, dailyRes, digestRes, setRes] = await Promise.all([
        fetch(`${API_BASE}/artifacts`),
        fetch(storyUrl),
        fetch(`${API_BASE}/choices`),
        fetch(dailyUrl),
        fetch(digestUrl),
        fetch(`${API_BASE}/settings`)
      ]);

      const arts = ((await artRes.json()).items || []) as LearningArtifact[];
      setArtifacts(
        arts.map((a) => ({
          ...a,
          type: a.intentZh || a.restoredText || /[\u4e00-\u9fff]/.test(a.sourceText) ? 'Expression' : 'Refinement',
        }))
      );

      setStories((await storyRes.json()).items || []);
      setChoices((await choiceRes.json()).items || []);
      setDaily((await dailyRes.json()).item || null);
      setDigest((await digestRes.json()).item || null);
      setSettings(await setRes.json());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [activeDay]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const generateStory = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/stories/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day: activeDay }),
      });
    } finally {
      await fetchData();
    }
  }, [activeDay, fetchData]);

  const filteredArtifacts = useMemo(() => (
    artifacts.filter((a) => {
      if (filter === 'all') return true;
      if (filter === 'english') return a.type === 'Refinement';
      if (filter === 'chinese') return a.type === 'Expression';
      return true;
    })
  ), [artifacts, filter]);

  const inboxArtifacts = useMemo(() => {
    return filteredArtifacts.filter((artifact) => (
      formatDayKey(new Date(artifact.createdAt)) === selectedDay
    ));
  }, [filteredArtifacts, selectedDay]);

  const dayOptions = useMemo<DayOption[]>(
    () => groupByDay(filteredArtifacts).map((group) => ({
      day: group.day,
      label: group.label,
      count: group.items.length,
    })),
    [filteredArtifacts]
  );

  const handleDayChange = useCallback((day: string) => {
    const next = day.trim();
    setSelectedDay(next || todayKey);
  }, [todayKey]);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <h2>TypeLearn</h2>
        <nav className="nav-group">
          <NavItem active={view === 'inbox'} icon={<Inbox size={15}/>} label="Inbox" onClick={() => setView('inbox')} />
          <NavItem active={view === 'choices'} icon={<MessageCircle size={15}/>} label="Review" hint={choices.length ? `${choices.length}` : undefined} onClick={() => setView('choices')} />
          <NavItem active={view === 'lesson'} icon={<Zap size={15}/>} label="Lesson" onClick={() => setView('lesson')} />
          <NavItem active={view === 'story'} icon={<Book size={15}/>} label="Story" onClick={() => setView('story')} />
          <NavItem active={view === 'digest'} icon={<Braces size={15}/>} label="Digest" onClick={() => setView('digest')} />
          <NavItem active={view === 'settings'} icon={<Settings size={15}/>} label="Settings" onClick={() => setView('settings')} />
        </nav>
        <div style={{ marginTop: 'auto' }}>
          {choices.length > 0 && (
            <button className="review-hint" onClick={() => setView('choices')}>
              <span className="review-hint-dot" />
              <span>{choices.length} item{choices.length > 1 ? 's' : ''} can be reviewed later</span>
            </button>
          )}
          <button onClick={fetchData} className="nav-item" style={{ fontSize: '12px', color: '#999' }}>
            <RefreshCcw size={13} className={loading ? 'spinning' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <TopBar
          view={view}
        />
        <div className="content-inner">
          {view === 'inbox' && (
            <InboxView
              artifacts={inboxArtifacts}
              dayOptions={dayOptions}
              currentFilter={filter}
              onFilterChange={setFilter}
              selectedDay={selectedDay}
              onDayChange={handleDayChange}
            />
          )}
          {view === 'choices' && <ChoicesView choices={choices} onResolved={fetchData} />}
          {view === 'lesson' && <LessonView daily={daily} />}
          {view === 'story' && <StoryView stories={stories} selectedDay={activeDay} onGenerate={generateStory} />}
          {view === 'digest' && (
            <DigestView
              digest={digest}
              selectedDay={selectedDay}
              dayOptions={dayOptions}
              onDayChange={handleDayChange}
            />
          )}
          {view === 'settings' && settings && <SettingsView settings={settings} onUpdate={setSettings} />}
        </div>
      </main>
    </div>
  );
}

function NavItem({
  active,
  icon,
  label,
  hint,
  onClick
}: {
  active: boolean,
  icon: React.ReactNode,
  label: string,
  hint?: string,
  onClick: () => void
}) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {hint && <span className="nav-hint-badge">{hint}</span>}
    </button>
  );
}

function TopBar({
  view,
}: {
  view: ViewType;
}) {
  const titles = { inbox: 'Inbox', choices: 'Review', lesson: 'Lesson', story: 'Story', digest: 'Digest', settings: 'Settings' };
  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <div className="view-title">{titles[view]}</div>
      </div>
    </div>
  );
}

const InboxHeaderControls = memo(function InboxHeaderControls({
  dayOptions,
  currentFilter,
  onFilterChange,
  selectedDay,
  onDayChange,
}: {
  dayOptions: DayOption[];
  currentFilter: FilterType;
  onFilterChange: (f: FilterType) => void;
  selectedDay: string;
  onDayChange: (day: string) => void;
}) {
  const selectedOption = dayOptions.find((option) => option.day === selectedDay) ?? null;

  const stepDay = (direction: 'left' | 'right') => {
    if (dayOptions.length === 0) return;
    const currentIndex = dayOptions.findIndex((option) => option.day === selectedDay);
    if (currentIndex === -1) return;
    const delta = direction === 'left' ? -1 : 1;
    const nextIndex = currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= dayOptions.length) return;
    onDayChange(dayOptions[nextIndex].day);
  };

  return (
    <div className="inbox-controls">
      <div className="filter-segment" role="tablist" aria-label="Inbox filter">
        <button className={`filter-segment-item ${currentFilter === 'all' ? 'active' : ''}`} onClick={() => onFilterChange('all')}>All</button>
        <button className={`filter-segment-item ${currentFilter === 'english' ? 'active' : ''}`} onClick={() => onFilterChange('english')}>English</button>
        <button className={`filter-segment-item ${currentFilter === 'chinese' ? 'active' : ''}`} onClick={() => onFilterChange('chinese')}>Chinese</button>
      </div>

      <div className="inbox-time-inline">
        <span className="time-current-label">{selectedOption?.label ?? 'Today'}</span>

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

        <div className="day-scroller-date">
          <DatePopover day={selectedDay} onDayChange={onDayChange} />
        </div>
      </div>
    </div>
  );
});

const DigestHeaderControls = memo(function DigestHeaderControls({
  digest,
  dayOptions,
  selectedDay,
  onDayChange,
}: {
  digest: DayDigest | null;
  dayOptions: DayOption[];
  selectedDay: string;
  onDayChange: (day: string) => void;
}) {
  const selectedOption = dayOptions.find((option) => option.day === selectedDay) ?? null;

  const stepDay = (direction: 'left' | 'right') => {
    if (dayOptions.length === 0) return;
    const currentIndex = dayOptions.findIndex((option) => option.day === selectedDay);
    if (currentIndex === -1) return;
    const delta = direction === 'left' ? -1 : 1;
    const nextIndex = currentIndex + delta;
    if (nextIndex < 0 || nextIndex >= dayOptions.length) return;
    onDayChange(dayOptions[nextIndex].day);
  };

  return (
    <div className="inbox-controls digest-controls">
      <div className="digest-toolbar-copy">
        <div className="digest-toolbar-title">{selectedOption?.label ?? 'Today'}</div>
        <div className="digest-toolbar-subtitle">
          {digest
            ? `${digest.sessionCount} session${digest.sessionCount > 1 ? 's' : ''} · ${digest.keyMoments.length} key moment${digest.keyMoments.length > 1 ? 's' : ''}`
            : 'No digest generated for this day yet'}
        </div>
      </div>

      <div className="inbox-time-inline">
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

        <div className="day-scroller-date">
          <DatePopover day={selectedDay} onDayChange={onDayChange} />
        </div>
      </div>
    </div>
  );
});

const InboxView = memo(function InboxView({
  artifacts,
  dayOptions,
  currentFilter,
  onFilterChange,
  selectedDay,
  onDayChange,
}: {
  artifacts?: LearningArtifact[];
  dayOptions?: DayOption[];
  currentFilter: FilterType;
  onFilterChange: (f: FilterType) => void;
  selectedDay?: string;
  onDayChange?: (day: string) => void;
}) {
  const showDayScroller = Boolean(dayOptions && onDayChange);
  const todayKey = formatDayKey(new Date());
  const hasToday = dayOptions?.some((option) => option.day === todayKey) ?? false;
  const effectiveSelectedDay = selectedDay ?? (hasToday ? todayKey : todayKey);

  const grid = !artifacts || artifacts.length === 0 ? (
    <div className="empty-state">
      <p>No items yet.</p>
    </div>
  ) : (
    <div className="content-grid">
      {artifacts.map((artifact) => (
        <ArtifactCard key={artifact.id} artifact={artifact} />
      ))}
    </div>
  );

  if (!showDayScroller) {
    return grid;
  }

  return (
    <div className="inbox-view">
      <InboxHeaderControls
        dayOptions={dayOptions ?? []}
        currentFilter={currentFilter}
        onFilterChange={onFilterChange}
        selectedDay={effectiveSelectedDay}
        onDayChange={(day) => onDayChange?.(day)}
      />
      {grid}
    </div>
  );
});

function DatePopover({
  day,
  onDayChange,
}: {
  day: string;
  onDayChange?: (day: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const date = parseDayKey(day);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  useEffect(() => {
    const date = parseDayKey(day);
    setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [day]);

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

  const calendarDays = useMemo(() => {
    const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const firstWeekday = monthStart.getDay();
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - firstWeekday);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return {
        key: formatDayKey(date),
        date,
        inMonth: date.getMonth() === viewMonth.getMonth(),
        isToday: formatDayKey(date) === formatDayKey(new Date()),
      };
    });
  }, [viewMonth]);

  const chooseDay = (nextDay: string) => {
    onDayChange?.(nextDay);
    setIsOpen(false);
  };

  const shiftMonth = (delta: number) => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
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

      {isOpen && (
        <div className="date-popover-panel" role="dialog" aria-label="Calendar">
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
              ].filter(Boolean).join(' ');

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
      )}
    </div>
  );
}

const ArtifactCard = memo(function ArtifactCard({ artifact }: { artifact: LearningArtifact }) {
  const isExpression = artifact.type === 'Expression';
  const variantClass = isExpression ? 'variant-expression' : 'variant-refinement';
  const genericMessages = ['normalized capitalization', 'already looks clear', 'kept it as-is', 'natural in everyday writing'];
  const shouldShowExplanation = artifact.explanation && !genericMessages.some(msg =>
    artifact.explanation.toLowerCase().includes(msg.toLowerCase())
  );

  const source = isExpression ? (artifact.intentZh ?? artifact.sourceText) : artifact.sourceText;

  const hasRewrite = Boolean(artifact.corrected || artifact.alt1Natural || artifact.alt2ClearFormal);
  const corrected = artifact.corrected ?? artifact.suggestion;

  return (
    <article className={`artifact-card ${variantClass}`}>
      <div className="card-body">
        <p className="card-source">{source}</p>

        {isExpression ? (
          <>
            <p className="card-result">{artifact.suggestion}</p>
            {artifact.enAlternatives && artifact.enAlternatives.length > 0 && (
              <div className="card-note">
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Alternatives</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {artifact.enAlternatives.slice(0, 4).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
            {artifact.enTemplates && artifact.enTemplates.length > 0 && (
              <div className="card-note">
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Templates</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {artifact.enTemplates.slice(0, 3).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : hasRewrite ? (
          <>
            <div className="card-note" style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Corrected</div>
              <div className="card-result">{corrected}</div>
            </div>
            <div className="card-note" style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Alt 1 (Natural)</div>
              <div className="card-result">{artifact.alt1Natural ?? corrected}</div>
            </div>
            <div className="card-note">
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Alt 2 (Clear/Formal)</div>
              <div className="card-result">{artifact.alt2ClearFormal ?? corrected}</div>
            </div>
          </>
        ) : (
          <p className="card-result">{artifact.suggestion}</p>
        )}

        {shouldShowExplanation && (
          <p className="card-note">{artifact.explanation}</p>
        )}

        {artifact.patternKeys && artifact.patternKeys.length > 0 && (
          <div className="card-meta" style={{ marginTop: 10 }}>
            <span style={{ fontSize: 12, color: '#999' }}>Patterns: {artifact.patternKeys.slice(0, 4).join(', ')}</span>
          </div>
        )}
      </div>
      <div className="card-meta">
        <span className="card-type-tag">{isExpression ? 'Expr' : 'Refine'}</span>
        <span>{new Date(artifact.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </article>
  );
});

function ChoicesView({ choices, onResolved }: { choices: ChoiceItem[]; onResolved: () => void }) {
  const [submitting, setSubmitting] = useState<string | null>(null);

  const select = async (choiceId: string, index: number) => {
    setSubmitting(choiceId);
    try {
      await fetch(`${API_BASE}/choices/${choiceId}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index })
      });
    } finally {
      setSubmitting(null);
      onResolved();
    }
  };

  const drop = async (choiceId: string) => {
    setSubmitting(choiceId);
    try {
      await fetch(`${API_BASE}/choices/${choiceId}`, { method: 'DELETE' });
    } finally {
      setSubmitting(null);
      onResolved();
    }
  };

  if (!choices.length) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
        <p>Nothing needs review right now.</p>
        <p style={{ marginTop: 8, fontSize: 13 }}>TypeLearn will only save uncertain items here when they are worth checking later.</p>
      </div>
    );
  }

  return (
    <div className="content-grid">
      {choices.map((c) => (
        <article key={c.id} className="artifact-card variant-expression">
          <div className="card-body">
            <p className="card-source">{c.mergedRaw}</p>


            <div style={{ display: 'grid', gap: 8 }}>
              {c.candidates.map((cand, idx) => (
                <button
                  key={idx}
                  className="choice-option"
                  onClick={() => select(c.id, idx)}
                  disabled={submitting === c.id}
                >
                  <div className="choice-title">{cand.intentZh}</div>
                  <div className="choice-subtext">英文表达：{cand.enMain}</div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <button className="nav-item" style={{ fontSize: 12, color: '#999' }} onClick={() => drop(c.id)} disabled={submitting === c.id}>
                Drop
              </button>
            </div>
          </div>
          <div className="card-meta">
            <span className="card-type-tag">Review</span>
            <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function LessonView({ daily }: { daily: DailyLesson | null }) {
  if (!daily) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
        <p>No lesson yet.</p>
      </div>
    );
  }

  return (
    <div className="story-page">
      <article className="story-doc fade-in">
        <h1>Daily Lesson</h1>
        <div className="date">{daily.day}</div>

        {daily.groups.map((g) => (
          <div key={g.macroCategory} style={{ marginTop: 18 }}>
            <h2 style={{ marginBottom: 10, fontSize: 14, color: '#ddd' }}>{g.macroCategory}</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              {g.patterns.map((p) => (
                <div key={p.patternKey} className="artifact-card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{p.title} <span style={{ color: '#999', fontWeight: 500 }}>({p.counts.today} today)</span></div>
                  <div className="card-note" style={{ marginBottom: 8 }}><b>Rule:</b> {p.lesson.rule}</div>
                  <div className="card-note" style={{ marginBottom: 8 }}><b>Hook:</b> {p.lesson.hook}</div>
                  <div className="card-note" style={{ marginBottom: 8 }}><b>❌</b> {p.lesson.badExample}</div>
                  <div className="card-note" style={{ marginBottom: 8 }}><b>✅</b> {p.lesson.goodExample}</div>
                  <div className="card-note"><b>Template:</b> {p.lesson.template}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {daily.stealLines.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <h2 style={{ marginBottom: 10, fontSize: 14, color: '#ddd' }}>Steal these lines</h2>
            <ul>
              {daily.stealLines.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
        )}
      </article>
    </div>
  );
}

const DigestView = memo(function DigestView({
  digest,
  selectedDay,
  dayOptions,
  onDayChange,
}: {
  digest: DayDigest | null;
  selectedDay: string;
  dayOptions: DayOption[];
  onDayChange: (day: string) => void;
}) {
  const [focus, setFocus] = useState<DigestFocus | null>(null);
  const displayDate = parseDayKey(selectedDay).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const compressionRate = digest
    ? Math.max(0, Math.round((1 - (digest.keyMoments.length / Math.max(digest.sourceRecordIds.length, 1))) * 100))
    : 0;
  const averageRecordsPerSession = digest
    ? Math.round((digest.sourceRecordIds.length / Math.max(digest.sessionCount, 1)) * 10) / 10
    : 0;

  useEffect(() => {
    setFocus(null);
  }, [selectedDay, digest?.day]);

  if (!digest) {
    return (
      <div className="digest-page">
        <DigestHeaderControls
          digest={digest}
          dayOptions={dayOptions}
          selectedDay={selectedDay}
          onDayChange={onDayChange}
        />
        <section className="digest-card digest-card-empty">
          <div className="story-empty">
            <p>No digest for {displayDate} yet.</p>
            <div className="digest-empty-note">Pick another day with records, or keep typing to build a digest here.</div>
          </div>
        </section>
      </div>
    );
  }

  const digestData = digest;
  const focusedPattern = focus?.type === 'pattern'
    ? (digestData.topPatterns.find((pattern) => pattern.patternKey === focus.id) ?? null)
    : focus?.type === 'moment'
      ? (digestData.keyMoments.find((moment) => moment.recordId === focus.id)?.patternKeys
          .map((patternKey) => digestData.topPatterns.find((pattern) => pattern.patternKey === patternKey))
          .find(Boolean) ?? null)
      : focus?.type === 'session'
        ? (digestData.sessionDigests.find((session) => session.id === focus.id)?.topPatternKeys
            .map((patternKey) => digestData.topPatterns.find((pattern) => pattern.patternKey === patternKey))
            .find(Boolean) ?? null)
        : null;
  const focusedMoment = focus?.type === 'moment'
    ? (digestData.keyMoments.find((moment) => moment.recordId === focus.id) ?? null)
    : null;
  const focusedSession = focus?.type === 'session'
    ? (digestData.sessionDigests.find((session) => session.id === focus.id) ?? null)
    : focus?.type === 'moment'
      ? (digestData.sessionDigests.find((session) => session.recordIds.includes(focus.id)) ?? null)
      : null;

  const patternIsActive = (patternKey: string): boolean => {
    if (!focus) return false;
    if (focus.type === 'pattern') return focus.id === patternKey;
    if (focus.type === 'moment') {
      return digestData.keyMoments.find((moment) => moment.recordId === focus.id)?.patternKeys.includes(patternKey) ?? false;
    }
    return digestData.sessionDigests.find((session) => session.id === focus.id)?.topPatternKeys.includes(patternKey) ?? false;
  };

  const momentIsActive = (recordId: string, patternKeys: string[]): boolean => {
    if (!focus) return false;
    if (focus.type === 'moment') return focus.id === recordId;
    if (focus.type === 'pattern') return patternKeys.includes(focus.id);
    return digestData.sessionDigests.find((session) => session.id === focus.id)?.recordIds.includes(recordId) ?? false;
  };

  const sessionIsActive = (sessionId: string, sessionRecordIds: string[], topPatternKeys: string[]): boolean => {
    if (!focus) return false;
    if (focus.type === 'session') return focus.id === sessionId;
    if (focus.type === 'pattern') return topPatternKeys.includes(focus.id);
    return sessionRecordIds.includes(focus.id);
  };

  const activeSessions = !focus
    ? digestData.sessionDigests
    : digestData.sessionDigests.filter((session) => sessionIsActive(session.id, session.recordIds, session.topPatternKeys));
  const activeMoments = !focus
    ? digestData.keyMoments
    : digestData.keyMoments.filter((moment) => momentIsActive(moment.recordId, moment.patternKeys));
  const activeRecordIds = Array.from(new Set(
    focus?.type === 'moment'
      ? [focus.id]
      : activeSessions.flatMap((session) => session.recordIds),
  ));
  const activeStealLines = Array.from(new Set(
    focus?.type === 'pattern' && focusedPattern
      ? focusedPattern.sampleLines
      : activeSessions.flatMap((session) => session.stealLines),
  ));
  const focusTitle =
    focus?.type === 'pattern' && focusedPattern
      ? focusedPattern.title
      : focus?.type === 'moment' && focusedMoment
        ? (focusedMoment.enMain || focusedMoment.intentZh || 'selected moment')
        : focus?.type === 'session' && focusedSession
          ? `Session ${digestData.sessionDigests.findIndex((session) => session.id === focusedSession.id) + 1}`
          : null;
  const focusLead =
    focus?.type === 'pattern'
      ? `This pattern appears across ${activeSessions.length} session${activeSessions.length === 1 ? '' : 's'} and shapes ${activeMoments.length} key moment${activeMoments.length === 1 ? '' : 's'}.`
      : focus?.type === 'moment'
        ? `This moment belongs to ${activeSessions.length} session and carries ${focusedMoment?.patternKeys.length ?? 0} linked pattern${(focusedMoment?.patternKeys.length ?? 0) === 1 ? '' : 's'}.`
        : focus?.type === 'session'
          ? `This session contributes ${activeRecordIds.length} source record${activeRecordIds.length === 1 ? '' : 's'} and ${activeMoments.length} key moment${activeMoments.length === 1 ? '' : 's'} to the digest.`
          : null;

  return (
    <div className="digest-page">
      <DigestHeaderControls
        digest={digest}
        dayOptions={dayOptions}
        selectedDay={selectedDay}
        onDayChange={onDayChange}
      />
      <div className="digest-grid fade-in">
        <section className="digest-card digest-card-hero">
          <div className="digest-kicker">Daily Compression Report</div>
          <h1>{displayDate}</h1>
          <div className="digest-hero-bar" />
          <p className="digest-lead">
            {digest.stats.totalDoneRecords} committed learning records compressed into {digest.sessionCount} session{digest.sessionCount > 1 ? 's' : ''} and {digest.keyMoments.length} key moment{digest.keyMoments.length > 1 ? 's' : ''}.
          </p>
          {focusTitle && focusLead && (
            <div className="digest-hero-focus">
              <div className="digest-hero-focus-kicker">Current focus</div>
              <div className="digest-hero-focus-title">{focusTitle}</div>
              <div className="digest-hero-focus-copy">{focusLead}</div>
            </div>
          )}
          <div className="digest-metric-strip">
            <div className="digest-metric-chip">
              <span className="digest-metric-value">{focus ? activeRecordIds.length : compressionRate}{focus ? '' : '%'}</span>
              <span className="digest-metric-label">{focus ? 'records in focus' : 'compressed'}</span>
            </div>
            <div className="digest-metric-chip">
              <span className="digest-metric-value">{focus ? activeSessions.length : averageRecordsPerSession}</span>
              <span className="digest-metric-label">{focus ? 'sessions in focus' : 'records / session'}</span>
            </div>
            <div className="digest-metric-chip">
              <span className="digest-metric-value">{focus ? activeStealLines.length : digest.stealLines.length}</span>
              <span className="digest-metric-label">{focus ? 'lines in focus' : 'steal lines kept'}</span>
            </div>
          </div>
          <div className="digest-chip-row">
            {digest.themes.length > 0
              ? digest.themes.map((theme) => <span key={theme} className="story-chip">{theme}</span>)
              : <span className="story-chip subtle">No themes yet</span>}
          </div>
        </section>

        <section className="digest-card digest-card-wide">
          <div className="digest-section-title">Compression Flow</div>
          <div className="digest-flow">
            <div className={`digest-flow-step ${focus ? 'active' : ''}`}>
              <div className="digest-flow-count">{focus ? activeRecordIds.length : digest.stats.totalRecords}</div>
              <div className="digest-flow-label">{focus ? 'focused records' : 'visible records'}</div>
            </div>
            <div className="digest-flow-arrow">→</div>
            <div className={`digest-flow-step ${focus ? 'active' : ''}`}>
              <div className="digest-flow-count">{focus ? activeSessions.length : digest.sessionCount}</div>
              <div className="digest-flow-label">{focus ? 'focused sessions' : 'sessions'}</div>
            </div>
            <div className="digest-flow-arrow">→</div>
            <div className={`digest-flow-step ${focus ? 'active' : ''}`}>
              <div className="digest-flow-count">{focus ? activeMoments.length : digest.keyMoments.length}</div>
              <div className="digest-flow-label">{focus ? 'focused moments' : 'key moments'}</div>
            </div>
            <div className="digest-flow-arrow">→</div>
            <div className={`digest-flow-step ${focus ? 'active' : ''}`}>
              <div className="digest-flow-count">{focus ? activeStealLines.length : digest.stealLines.length}</div>
              <div className="digest-flow-label">{focus ? 'focused lines' : 'reusable lines'}</div>
            </div>
          </div>
        </section>

        <section className="digest-card">
          <div className="digest-section-title">Coverage</div>
          <div className="digest-stats">
            <div className="digest-stat">
              <span className="digest-stat-value">{digest.stats.totalRecords}</span>
              <span className="digest-stat-label">visible records</span>
            </div>
            <div className="digest-stat">
              <span className="digest-stat-value">{digest.stats.totalDoneRecords}</span>
              <span className="digest-stat-label">done records</span>
            </div>
            <div className="digest-stat">
              <span className="digest-stat-value">{digest.stats.totalPatterns}</span>
              <span className="digest-stat-label">pattern hits</span>
            </div>
          </div>
        </section>

        <section className="digest-card">
          <div className="digest-section-title">Themes</div>
          <div className="digest-theme-stack">
            {digest.themes.length > 0 ? digest.themes.map((theme, index) => (
              <div key={theme} className="digest-theme-line">
                <span className="digest-theme-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="digest-theme-text">{theme}</span>
              </div>
            )) : <div className="digest-empty">No themes selected for this day.</div>}
          </div>
        </section>

        <section className="digest-card">
          <div className="digest-section-title">Steal Lines</div>
          <div className="digest-stack">
            {digest.stealLines.length > 0 ? digest.stealLines.map((line, index) => (
              <div key={line} className="digest-line-item">
                <span className="digest-line-index">{index + 1}</span>
                <span className="digest-line-text">{line}</span>
              </div>
            )) : <div className="digest-empty">No reusable lines selected for this day.</div>}
          </div>
        </section>

        <section className="digest-card">
          <div className="digest-section-title">Top Patterns</div>
          {(focusedPattern || focusedMoment || focusedSession) && (
            <div className="digest-focus-banner">
              <span className="digest-focus-copy">
                {focus?.type === 'pattern' && focusedPattern && <>Focusing on <strong>{focusedPattern.title}</strong></>}
                {focus?.type === 'moment' && focusedMoment && <>Tracing <strong>{focusedMoment.enMain || focusedMoment.intentZh || 'selected moment'}</strong></>}
                {focus?.type === 'session' && focusedSession && <>Inspecting <strong>Session {digest.sessionDigests.findIndex((session) => session.id === focusedSession.id) + 1}</strong></>}
              </span>
              <button
                type="button"
                className="digest-focus-clear"
                onClick={() => setFocus(null)}
              >
                Clear
              </button>
            </div>
          )}
          <div className="digest-stack">
            {digest.topPatterns.length > 0 ? digest.topPatterns.map((pattern) => (
              <button
                key={pattern.patternKey}
                type="button"
                className={`digest-item digest-item-button ${patternIsActive(pattern.patternKey) ? 'active' : focus ? 'muted' : ''}`}
                aria-pressed={patternIsActive(pattern.patternKey)}
                onClick={() => setFocus((current) => current?.type === 'pattern' && current.id === pattern.patternKey ? null : { type: 'pattern', id: pattern.patternKey })}
              >
                <div className="digest-item-header">
                  <strong>{pattern.title}</strong>
                  <span>{pattern.count} hit{pattern.count > 1 ? 's' : ''}</span>
                </div>
                {pattern.sampleLines.length > 0 && (
                  <div className="digest-inline-list">
                    {pattern.sampleLines.map((line) => <span key={line} className="digest-inline-pill">{line}</span>)}
                  </div>
                )}
              </button>
            )) : <div className="digest-empty">No pattern summaries for this day.</div>}
          </div>
        </section>

        <section className="digest-card digest-card-wide">
          <div className="digest-section-title">Key Moments</div>
          <div className="digest-stack">
            {digest.keyMoments.length > 0 ? digest.keyMoments.map((moment, index) => (
              <button
                key={moment.recordId}
                type="button"
                className={[
                  'digest-moment-row',
                  'digest-item-button',
                  momentIsActive(moment.recordId, moment.patternKeys) ? 'active' : focus ? 'muted' : '',
                ].filter(Boolean).join(' ')}
                aria-pressed={momentIsActive(moment.recordId, moment.patternKeys)}
                onClick={() => setFocus((current) => current?.type === 'moment' && current.id === moment.recordId ? null : { type: 'moment', id: moment.recordId })}
              >
                <div className="digest-item-header">
                  <strong>{moment.enMain || moment.intentZh || 'Untitled moment'}</strong>
                  <span>{moment.timeBucket}</span>
                </div>
                <div className="digest-moment-meta">
                  <span className="digest-moment-rank">Moment {index + 1}</span>
                  <span>{new Date(moment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {moment.sourceApp ? <span>{moment.sourceApp}</span> : null}
                  <span>score {moment.score}</span>
                </div>
                <div className="digest-item-copy">{moment.intentZh || 'No abstracted intent for this moment.'}</div>
                {moment.patternKeys.length > 0 && (
                  <div className="digest-inline-list">
                    {moment.patternKeys.map((pattern) => <span key={pattern} className="digest-inline-pill subtle">{humanizePatternKey(pattern)}</span>)}
                  </div>
                )}
              </button>
            )) : <div className="digest-empty">No key moments selected yet.</div>}
          </div>
        </section>

        <section className="digest-card digest-card-wide">
          <div className="digest-section-title">Sessions</div>
          <div className="digest-section-intro">These are the chunks the day collapsed into before the final digest was assembled.</div>
          <div className="digest-timeline">
            {digest.sessionDigests.length > 0 ? digest.sessionDigests.map((session, index) => (
              <button
                key={session.id}
                type="button"
                className={[
                  'digest-session',
                  'digest-session-timeline',
                  'digest-item-button',
                  sessionIsActive(session.id, session.recordIds, session.topPatternKeys) ? 'active' : focus ? 'muted' : '',
                ].filter(Boolean).join(' ')}
                aria-pressed={sessionIsActive(session.id, session.recordIds, session.topPatternKeys)}
                onClick={() => setFocus((current) => current?.type === 'session' && current.id === session.id ? null : { type: 'session', id: session.id })}
              >
                <div className="digest-session-rail">
                  <span className="digest-session-dot" />
                  {index !== digest.sessionDigests.length - 1 && <span className="digest-session-line" />}
                </div>
                <div className="digest-session-body">
                  <div className="digest-item-header">
                    <strong>Session {index + 1}</strong>
                    <span>{session.recordCount} record{session.recordCount > 1 ? 's' : ''}</span>
                  </div>
                  <div className="digest-session-range">
                    {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {new Date(session.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {session.sourceApps.length > 0 ? ` · ${session.sourceApps.join(', ')}` : ''}
                  </div>
                  <div className="digest-inline-list">
                    {session.themeLabels.map((theme) => <span key={theme} className="story-chip">{theme}</span>)}
                    {session.topPatternKeys.map((pattern) => <span key={pattern} className="digest-inline-pill subtle">{humanizePatternKey(pattern)}</span>)}
                  </div>
                  {session.stealLines.length > 0 && (
                    <div className="digest-item-copy">{session.stealLines.join(' · ')}</div>
                  )}
                </div>
              </button>
            )) : <div className="digest-empty">No sessions available for this day.</div>}
          </div>
        </section>
      </div>
    </div>
  );
});

const StoryView = memo(function StoryView({
  stories,
  selectedDay,
  onGenerate,
}: {
  stories: StoryArtifact[];
  selectedDay: string;
  onGenerate: () => void;
}) {
  const story = stories[0];
  const paragraphs = story?.paragraphs?.length
    ? story.paragraphs
    : story?.story.split(/\n+/).map((line) => line.trim()).filter(Boolean) ?? [];
  const stealLines = story?.stealLines ?? [];
  const themeLabels = story?.themeLabels ?? [];
  const patternKeys = story?.patternKeys ?? [];
  const displayDate = new Date(`${selectedDay}T00:00:00`).toLocaleDateString();

  if (!story) {
    return (
      <div className="story-page">
        <div className="story-empty">
          <p>No story for {displayDate} yet.</p>
          <button className="button-primary" onClick={onGenerate}>Generate story</button>
        </div>
      </div>
    );
  }

  return (
    <div className="story-page">
      <article className="story-doc fade-in" key={story.id}>
        <div className="story-header">
          <div>
            <h1>{story.title || "Today's Story"}</h1>
            <div className="date">{displayDate}</div>
          </div>
          <button className="button-primary" onClick={onGenerate}>Generate story</button>
        </div>
        <div className="story-note">Generated from a compressed day digest, not from the full raw transcript.</div>
        <div className="story-summary">{story.summary}</div>
        {(themeLabels.length > 0 || patternKeys.length > 0 || story.sessionCount > 0) && (
          <div className="story-meta">
            {story.sessionCount > 0 && <span className="story-chip">{story.sessionCount} session{story.sessionCount > 1 ? 's' : ''}</span>}
            {themeLabels.map((theme) => <span key={theme} className="story-chip">{theme}</span>)}
            {patternKeys.map((pattern) => <span key={pattern} className="story-chip subtle">{humanizePatternKey(pattern)}</span>)}
          </div>
        )}
        <div className="content">
          {paragraphs.map((p, i) => <p key={i} style={{ marginBottom: '1rem' }}>{p}</p>)}
        </div>
        {stealLines.length > 0 && (
          <div className="story-lines">
            <h2>Steal these lines</h2>
            <ul>
              {stealLines.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>
        )}
      </article>
    </div>
  );
});

function SettingsView({ settings, onUpdate }: { settings: ProviderSettings, onUpdate: (s: ProviderSettings) => void }) {
  const [form, setForm] = useState(settings);
  const save = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) { onUpdate(form); alert('Saved.'); }
    } catch (e) { console.error(e); }
  };

  return (
    <div className="settings-wrapper">
      <div className="settings-section">
        <div className="settings-row">
          <div className="settings-info">
            <label>Base URL</label>
            <div className="desc">The endpoint address for your AI provider.</div>
          </div>
          <div className="settings-input-area">
            <input value={form.baseUrl} onChange={e => setForm({...form, baseUrl: e.target.value})} placeholder="http://localhost:11434" />
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-info">
            <label>API Key</label>
            <div className="desc">Your secret key for authentication.</div>
          </div>
          <div className="settings-input-area">
            <input type="password" value={form.apiKey} onChange={e => setForm({...form, apiKey: e.target.value})} placeholder="sk-..." />
          </div>
        </div>

        <div className="settings-row">
          <div className="settings-info">
            <label>Model Name</label>
            <div className="desc">The specific AI model to use for translations.</div>
          </div>
          <div className="settings-input-area">
            <input value={form.model} onChange={e => setForm({...form, model: e.target.value})} placeholder="gpt-4o" />
          </div>
        </div>
      </div>

      <div className="settings-row" style={{ marginTop: '1rem' }}>
        <div className="settings-info"></div>
        <div className="settings-input-area">
          <button className="button-primary" onClick={save}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}
