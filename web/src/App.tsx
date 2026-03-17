import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Book,
  Braces,
  Inbox,
  MessageCircle,
  RefreshCcw,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';
import { NavItem } from './components/NavItem';
import { TopBar } from './components/TopBar';
import { groupByDay, formatDayKey, type DayOption } from './lib/day';
import type {
  ChoiceItem,
  DailyLesson,
  DayDigest,
  LearningArtifact,
  ProviderSettings,
  StoryArtifact,
} from './types';
import type { FilterType, ViewType } from './ui';
import { ChoicesView } from './views/ChoicesView';
import { DigestView } from './views/DigestView';
import { InboxView } from './views/InboxView';
import { LessonView } from './views/LessonView';
import { SettingsView } from './views/SettingsView';
import { StoryView } from './views/StoryView';

const API_BASE = 'http://localhost:43010';
const hasNonAscii = (value: string): boolean => Array.from(value).some((char) => char.charCodeAt(0) > 127);

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
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const todayKey = formatDayKey(new Date());
  const [selectedDay, setSelectedDay] = useState<string>(todayKey);
  const activeDay = selectedDay === 'all' ? todayKey : selectedDay;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSyncError(null);

    try {
      const storyUrl = new URL(`${API_BASE}/stories`);
      storyUrl.searchParams.set('day', activeDay);

      const dailyUrl = new URL(`${API_BASE}/daily`);
      dailyUrl.searchParams.set('day', activeDay);

      const digestUrl = new URL(`${API_BASE}/digests`);
      digestUrl.searchParams.set('day', activeDay);

      const [
        artifactsResponse,
        storiesResponse,
        choicesResponse,
        dailyResponse,
        digestResponse,
        settingsResponse,
        healthResponse,
      ] = await Promise.all([
        fetch(`${API_BASE}/artifacts`),
        fetch(storyUrl),
        fetch(`${API_BASE}/choices`),
        fetch(dailyUrl),
        fetch(digestUrl),
        fetch(`${API_BASE}/settings`),
        fetch(`${API_BASE}/health`),
      ]);

      if (!artifactsResponse.ok || !settingsResponse.ok || !healthResponse.ok) {
        throw new Error(
          `Sync failed (status: artifacts=${artifactsResponse.status}, settings=${settingsResponse.status}, health=${healthResponse.status})`,
        );
      }

      const rawArtifacts = ((await artifactsResponse.json()).items || []) as LearningArtifact[];
          setArtifacts(
        rawArtifacts.map((artifact) => ({
          ...artifact,
          type: artifact.sourceLanguage === 'english' ? 'Refinement' : 'Expression',
          sourceLanguage:
            artifact.sourceLanguage ?? (hasNonAscii(artifact.sourceText) ? 'mixed' : 'unknown'),
        })),
      );

      setStories((await storiesResponse.json()).items || []);
      setChoices((await choicesResponse.json()).items || []);
      setDaily((await dailyResponse.json()).item || null);
      setDigest((await digestResponse.json()).item || null);
      setSettings(await settingsResponse.json());

      const health = (await healthResponse.json()) as { providerModes?: unknown };
      if (!health.providerModes) {
        setSyncError('Service health check returned an unexpected payload.');
      }

      setLastSyncAt(Date.now());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSyncError(message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [activeDay]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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
    artifacts.filter((artifact) => {
      if (filter === 'all') return true;
      if (filter === 'english') return artifact.sourceLanguage === 'english';
      if (filter === 'chinese') return artifact.sourceLanguage !== 'english';
      return true;
    })
  ), [artifacts, filter]);

  const inboxArtifacts = useMemo(() => {
    if (selectedDay === 'all') return filteredArtifacts;
    return filteredArtifacts.filter((artifact) => (
      formatDayKey(new Date(artifact.createdAt)) === selectedDay
    ));
  }, [filteredArtifacts, selectedDay]);

  const dayOptions = useMemo<DayOption[]>(() => {
    const groups = groupByDay(filteredArtifacts);
    const allCount = filteredArtifacts.length;

    return [
      { day: 'all', label: 'All', count: allCount },
      ...groups.map((group) => ({
        day: group.day,
        label: group.label,
        count: group.items.length,
      })),
    ];
  }, [filteredArtifacts]);

  const digestDayOptions = useMemo(
    () => dayOptions.filter((option) => option.day !== 'all'),
    [dayOptions],
  );

  const allGroups = useMemo(() => groupByDay(filteredArtifacts), [filteredArtifacts]);

  const handleDayChange = useCallback((day: string) => {
    const next = day.trim();
    setSelectedDay(next || todayKey);
  }, [todayKey]);

  return (
    <div className="app-shell">
      <aside className="sidebar-shell glass-panel">
        <div className="sidebar-brand">
          <div className="brand-mark">
            <Sparkles size={14} />
          </div>
          <div className="brand-copy">
            <h1 className="brand-title">TypeLearn</h1>
            <p className="brand-subtitle">Ambient language practice from the writing you already do.</p>
          </div>
        </div>

        <nav className="nav-group">
          <NavItem active={view === 'inbox'} icon={<Inbox size={16} />} label="Inbox" onClick={() => setView('inbox')} />
          <NavItem
            active={view === 'choices'}
            icon={<MessageCircle size={16} />}
            label="Review"
            hint={choices.length ? `${choices.length}` : undefined}
            onClick={() => setView('choices')}
          />
          <NavItem active={view === 'lesson'} icon={<Zap size={16} />} label="Lesson" onClick={() => setView('lesson')} />
          <NavItem active={view === 'story'} icon={<Book size={16} />} label="Story" onClick={() => setView('story')} />
          <NavItem active={view === 'digest'} icon={<Braces size={16} />} label="Digest" onClick={() => setView('digest')} />
          <NavItem active={view === 'settings'} icon={<Settings size={16} />} label="Settings" onClick={() => setView('settings')} />
        </nav>

        <div className="sidebar-footer">
          {choices.length ? (
            <button className="review-hint" onClick={() => setView('choices')} type="button">
              <span className="review-hint-dot" />
              <span>{choices.length} item{choices.length > 1 ? 's' : ''} waiting for review</span>
            </button>
          ) : null}

          <button onClick={() => void fetchData()} className="nav-item muted" type="button">
            <span className="nav-item-icon">
              <RefreshCcw size={14} className={loading ? 'spinning' : ''} />
            </span>
            <span>{syncError ? 'Sync offline' : 'Refresh data'}</span>
          </button>
        </div>
      </aside>

      <main className="main-shell">
        <div className="canvas-glow canvas-glow-left" />
        <div className="canvas-glow canvas-glow-right" />

        <TopBar
          view={view}
          loading={loading}
          lastSyncAt={lastSyncAt}
          syncError={syncError}
          onSync={() => void fetchData()}
        />

        <div className="content-shell">
          {view === 'inbox' ? (
            <InboxView
              artifacts={selectedDay === 'all' ? undefined : inboxArtifacts}
              groups={selectedDay === 'all' ? allGroups : undefined}
              dayOptions={dayOptions}
              currentFilter={filter}
              onFilterChange={setFilter}
              selectedDay={selectedDay}
              onDayChange={handleDayChange}
            />
          ) : null}

          {view === 'choices' ? <ChoicesView choices={choices} onResolved={() => void fetchData()} /> : null}
          {view === 'lesson' ? <LessonView daily={daily} /> : null}
          {view === 'story' ? <StoryView stories={stories} selectedDay={activeDay} onGenerate={() => void generateStory()} /> : null}
          {view === 'digest' ? (
            <DigestView
              key={`${activeDay}-${digest?.day ?? 'empty'}`}
              digest={digest}
              selectedDay={activeDay}
              dayOptions={digestDayOptions}
              onDayChange={handleDayChange}
            />
          ) : null}
          {view === 'settings' && settings ? <SettingsView settings={settings} onUpdate={setSettings} /> : null}
        </div>
      </main>
    </div>
  );
}
