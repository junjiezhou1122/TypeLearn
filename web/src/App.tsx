import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  Inbox,
  Library,
  Book,
  Settings,
  RefreshCcw,
  MessageCircle,
  Zap,
} from 'lucide-react';
import type {
  LearningArtifact,
  StoryArtifact,
  ProviderSettings,
  ChoiceItem,
  DailyLesson,
} from './types';

const API_BASE = 'http://localhost:43010';

type ViewType = 'inbox' | 'library' | 'story' | 'choices' | 'lesson' | 'settings';
type FilterType = 'all' | 'english' | 'chinese';

type DayGroup = {
  day: string;
  label: string;
  items: LearningArtifact[];
};

const RECENT_DAYS = 3;

const formatDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

const splitStorySections = (storyText: string): { body: string; stealLines: string[] } => {
  if (!storyText) return { body: '', stealLines: [] };
  const marker = 'steal these lines';
  const lower = storyText.toLowerCase();
  const idx = lower.indexOf(marker);
  if (idx === -1) return { body: storyText.trim(), stealLines: [] };

  const before = storyText.slice(0, idx).trim();
  const after = storyText.slice(idx + marker.length).trim();
  const lines = after.split('\n').map((line) => line.trim()).filter(Boolean);
  const stealLines = lines
    .filter((line) => /^[-•*]/.test(line) || /^\d+\./.test(line))
    .map((line) => line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);

  if (stealLines.length === 0) {
    const fallbackLines = lines
      .map((line) => line.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
    return { body: before, stealLines: fallbackLines };
  }

  return { body: before, stealLines };
};

export default function App() {
  const [view, setView] = useState<ViewType>('inbox');
  const [filter, setFilter] = useState<FilterType>('all');
  const [artifacts, setArtifacts] = useState<LearningArtifact[]>([]);
  const [stories, setStories] = useState<StoryArtifact[]>([]);
  const [choices, setChoices] = useState<ChoiceItem[]>([]);
  const [daily, setDaily] = useState<DailyLesson | null>(null);
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAllDays, setShowAllDays] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [artRes, storyRes, choiceRes, dailyRes, setRes] = await Promise.all([
        fetch(`${API_BASE}/artifacts`),
        fetch(`${API_BASE}/stories`),
        fetch(`${API_BASE}/choices`),
        fetch(`${API_BASE}/daily`),
        fetch(`${API_BASE}/settings`)
      ]);

      const arts = ((await artRes.json()).items || []) as LearningArtifact[];
      setArtifacts(
        arts.map((a) => ({
          ...a,
          type: a.intentZh || a.restoredText ? 'Expression' : 'Refinement',
        }))
      );

      setStories((await storyRes.json()).items || []);
      setChoices((await choiceRes.json()).items || []);
      setDaily((await dailyRes.json()).item || null);
      setSettings(await setRes.json());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const generateStory = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/stories/generate`, { method: 'POST' });
    } finally {
      await fetchData();
    }
  }, [fetchData]);

  const filteredArtifacts = useMemo(() => (
    artifacts.filter((a) => {
      if (filter === 'all') return true;
      if (filter === 'english') return a.type === 'Refinement';
      if (filter === 'chinese') return a.type === 'Expression';
      return true;
    })
  ), [artifacts, filter]);

  const savedArtifacts = useMemo(
    () => filteredArtifacts.filter((a) => a.isSaved),
    [filteredArtifacts]
  );

  const inboxArtifacts = useMemo(() => {
    if (!selectedDay) return filteredArtifacts;
    return filteredArtifacts.filter((artifact) => (
      formatDayKey(new Date(artifact.createdAt)) === selectedDay
    ));
  }, [filteredArtifacts, selectedDay]);

  const groupedArtifacts = useMemo(
    () => groupByDay(inboxArtifacts),
    [inboxArtifacts]
  );

  const visibleGroups = useMemo(() => {
    if (showAllDays || selectedDay) return groupedArtifacts;
    return groupedArtifacts.slice(0, RECENT_DAYS);
  }, [groupedArtifacts, showAllDays, selectedDay]);

  const showMoreDays = !selectedDay && !showAllDays && groupedArtifacts.length > RECENT_DAYS;

  const handleDayChange = useCallback((day: string) => {
    const next = day.trim();
    setSelectedDay(next.length ? next : null);
    setShowAllDays(false);
  }, []);

  const handleToday = useCallback(() => {
    setSelectedDay(formatDayKey(new Date()));
    setShowAllDays(false);
  }, []);

  const handleShowMore = useCallback(() => {
    setShowAllDays(true);
  }, []);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <h2>TypeLearn</h2>
        <nav className="nav-group">
          <NavItem active={view === 'inbox'} icon={<Inbox size={15}/>} label="Inbox" onClick={() => setView('inbox')} />
          <NavItem active={view === 'library'} icon={<Library size={15}/>} label="Library" onClick={() => setView('library')} />
          <NavItem active={view === 'choices'} icon={<MessageCircle size={15}/>} label={`Choices${choices.length ? ` (${choices.length})` : ''}`} onClick={() => setView('choices')} />
          <NavItem active={view === 'lesson'} icon={<Zap size={15}/>} label="Lesson" onClick={() => setView('lesson')} />
          <NavItem active={view === 'story'} icon={<Book size={15}/>} label="Story" onClick={() => setView('story')} />
          <NavItem active={view === 'settings'} icon={<Settings size={15}/>} label="Settings" onClick={() => setView('settings')} />
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <button onClick={fetchData} className="nav-item" style={{ fontSize: '12px', color: '#999' }}>
            <RefreshCcw size={13} className={loading ? 'spinning' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <TopBar
          view={view}
          currentFilter={filter}
          onFilterChange={setFilter}
          selectedDay={selectedDay}
          onDayChange={handleDayChange}
          onToday={handleToday}
        />
        <div className="content-inner">
          {view === 'inbox' && (
            <InboxView
              groups={visibleGroups}
              showMoreDays={showMoreDays}
              onShowMore={handleShowMore}
            />
          )}
          {view === 'library' && <InboxView artifacts={savedArtifacts} />}
          {view === 'choices' && <ChoicesView choices={choices} onResolved={fetchData} />}
          {view === 'lesson' && <LessonView daily={daily} />}
          {view === 'story' && <StoryView stories={stories} onGenerate={generateStory} />}
          {view === 'settings' && settings && <SettingsView settings={settings} onUpdate={setSettings} />}
        </div>
      </main>
    </div>
  );
}

function NavItem({ active, icon, label, onClick }: { active: boolean, icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function TopBar({
  view,
  currentFilter,
  onFilterChange,
  selectedDay,
  onDayChange,
  onToday,
}: {
  view: ViewType;
  currentFilter: FilterType;
  onFilterChange: (f: FilterType) => void;
  selectedDay: string | null;
  onDayChange: (day: string) => void;
  onToday: () => void;
}) {
  const titles = { inbox: 'Inbox', library: 'Library', choices: 'Choices', lesson: 'Lesson', story: 'Story', settings: 'Settings' };
  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <div className="view-title">{titles[view]}</div>
        {view === 'inbox' && (
          <div className="toolbar">
            <button className={`filter-pill ${currentFilter === 'all' ? 'active' : ''}`} onClick={() => onFilterChange('all')}>All</button>
            <button className={`filter-pill ${currentFilter === 'english' ? 'active' : ''}`} onClick={() => onFilterChange('english')}>English</button>
            <button className={`filter-pill ${currentFilter === 'chinese' ? 'active' : ''}`} onClick={() => onFilterChange('chinese')}>Chinese</button>
            <div className="toolbar-divider" />
            <div className="toolbar-date">
              <input
                className="date-input"
                type="date"
                value={selectedDay ?? ''}
                onChange={(event) => onDayChange(event.target.value)}
              />
              <button className="filter-pill" onClick={onToday}>Today</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const InboxView = memo(function InboxView({
  artifacts,
  groups,
  showMoreDays,
  onShowMore,
}: {
  artifacts?: LearningArtifact[];
  groups?: DayGroup[];
  showMoreDays?: boolean;
  onShowMore?: () => void;
}) {
  if (groups) {
    if (groups.length === 0) {
      return (
        <div className="empty-state">
          <p>No items yet.</p>
        </div>
      );
    }

    return (
      <div className="inbox-groups">
        {groups.map((group) => (
          <section key={group.day} className="day-group">
            <div className="day-header">
              <div className="day-title">{group.label}</div>
              <div className="day-count">{group.items.length} items</div>
            </div>
            <div className="content-grid">
              {group.items.map((artifact) => (
                <ArtifactCard key={artifact.id} artifact={artifact} />
              ))}
            </div>
          </section>
        ))}
        {showMoreDays && onShowMore && (
          <div className="day-more">
            <button className="button-primary" onClick={onShowMore}>Show more days</button>
          </div>
        )}
      </div>
    );
  }

  if (!artifacts || artifacts.length === 0) {
    return (
      <div className="empty-state">
        <p>No items yet.</p>
      </div>
    );
  }

  return (
    <div className="content-grid">
      {artifacts.map((artifact) => (
        <ArtifactCard key={artifact.id} artifact={artifact} />
      ))}
    </div>
  );
});

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
        <p>No pending choices.</p>
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
            <span className="card-type-tag">Choice</span>
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

const StoryView = memo(function StoryView({
  stories,
  onGenerate,
}: {
  stories: StoryArtifact[];
  onGenerate: () => void;
}) {
  const story = stories[0];
  const { body, stealLines } = useMemo(
    () => splitStorySections(story?.story ?? ''),
    [story?.story]
  );
  const paragraphs = useMemo(
    () => body.split(/\n+/).map((line) => line.trim()).filter(Boolean),
    [body]
  );

  if (!story) {
    return (
      <div className="story-page">
        <div className="story-empty">
          <p>No stories yet.</p>
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
            <div className="date">{new Date(story.createdAt).toLocaleDateString()}</div>
          </div>
          <button className="button-primary" onClick={onGenerate}>Generate story</button>
        </div>
        <div className="story-note">Generated from today's completed captures; falls back to a safe template if no provider is configured.</div>
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
