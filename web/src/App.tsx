import React, { useState, useEffect } from 'react';
import { 
  Inbox,
  Library, 
  Book, 
  Settings, 
  RefreshCcw,
  Archive,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Zap,
  MoreHorizontal
} from 'lucide-react';
import type { 
  LearningArtifact, 
  StoryArtifact, 
  ProviderSettings,
  ArtifactType,
  ArtifactCategory 
} from './types';

const API_BASE = 'http://localhost:43010';

type ViewType = 'inbox' | 'library' | 'story' | 'settings';
type FilterType = 'all' | 'english' | 'chinese';

export default function App() {
  const [view, setView] = useState<ViewType>('inbox');
  const [filter, setFilter] = useState<FilterType>('all');
  const [artifacts, setArtifacts] = useState<LearningArtifact[]>([]);
  const [stories, setStories] = useState<StoryArtifact[]>([]);
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [artRes, storyRes, setRes] = await Promise.all([
        fetch(`${API_BASE}/artifacts`),
        fetch(`${API_BASE}/stories`),
        fetch(`${API_BASE}/settings`)
      ]);
      const arts = (await artRes.json()).items || [];
      setArtifacts(arts.map((a: any) => ({
        ...a,
        type: a.restoredText ? 'Expression' : 'Refinement',
        intentText: a.restoredText,
        keyPhrases: a.keyPhrases || []
      })));
      setStories((await storyRes.json()).items || []);
      setSettings(await setRes.json());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredArtifacts = artifacts.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'english') return a.type === 'Refinement';
    if (filter === 'chinese') return a.type === 'Expression';
    return true;
  });

  return (
    <div className="app-container">
      <aside className="sidebar">
        <h2>TypeLearn</h2>
        <nav className="nav-group">
          <NavItem active={view === 'inbox'} icon={<Inbox size={15}/>} label="Inbox" onClick={() => setView('inbox')} />
          <NavItem active={view === 'library'} icon={<Library size={15}/>} label="Library" onClick={() => setView('library')} />
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
        <TopBar view={view} currentFilter={filter} onFilterChange={setFilter} />
        <div className="content-inner fade-in">
          {view === 'inbox' && <InboxView artifacts={filteredArtifacts} />}
          {view === 'library' && <InboxView artifacts={filteredArtifacts.filter(a => a.isSaved)} />}
          {view === 'story' && <StoryView stories={stories} />}
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

function TopBar({ view, currentFilter, onFilterChange }: { view: ViewType, currentFilter: FilterType, onFilterChange: (f: FilterType) => void }) {
  const titles = { inbox: 'Inbox', library: 'Library', story: 'Story', settings: 'Settings' };
  return (
    <div className="top-bar">
      <div className="view-title">{titles[view]}</div>
      <div className="toolbar">
        {view === 'inbox' && (
          <>
            <button className={`filter-pill ${currentFilter === 'all' ? 'active' : ''}`} onClick={() => onFilterChange('all')}>All</button>
            <button className={`filter-pill ${currentFilter === 'english' ? 'active' : ''}`} onClick={() => onFilterChange('english')}>English</button>
            <button className={`filter-pill ${currentFilter === 'chinese' ? 'active' : ''}`} onClick={() => onFilterChange('chinese')}>Chinese</button>
          </>
        )}
        <button className="filter-pill"><MoreHorizontal size={14}/></button>
      </div>
    </div>
  );
}

function InboxView({ artifacts }: { artifacts: LearningArtifact[] }) {
  return (
    <div className="content-grid">
      {artifacts.length > 0 ? (
        artifacts.map(a => <ArtifactCard key={a.id} artifact={a} />)
      ) : (
        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: '#999' }}>
          <p>No items yet.</p>
        </div>
      )}
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: LearningArtifact }) {
  const isExpression = artifact.type === 'Expression';
  const variantClass = isExpression ? 'variant-expression' : 'variant-refinement';
  const genericMessages = ['normalized capitalization', 'already looks clear', 'kept it as-is', 'natural in everyday writing'];
  const shouldShowExplanation = artifact.explanation && !genericMessages.some(msg =>
    artifact.explanation.toLowerCase().includes(msg.toLowerCase())
  );

  return (
    <article className={`artifact-card ${variantClass}`}>
      <div className="card-header">
        {isExpression ? <MessageCircle size={12}/> : <Zap size={12}/>}
        <span>{isExpression ? 'Expression' : 'Refinement'}</span>
      </div>
      <div className="card-body">
        {isExpression ? (
          <>
            <div className="label-small">Intent</div>
            <div className="main-text">{artifact.intentText}</div>
            <div className="label-small">Native</div>
            <div className="main-text highlight-text">{artifact.suggestion}</div>
          </>
        ) : (
          <>
            <div className="label-small">Draft</div>
            <div className="secondary-text" style={{ marginBottom: '8px' }}>{artifact.sourceText}</div>
            <div className="label-small">Refined</div>
            <div className="main-text highlight-text">{artifact.suggestion}</div>
          </>
        )}
        {shouldShowExplanation && (
          <div className="explanation-area">{artifact.explanation}</div>
        )}
      </div>
      <div className="card-footer">
        <span>{new Date(artifact.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </article>
  );
}

function StoryView({ stories }: { stories: StoryArtifact[] }) {
  const [idx, setIdx] = useState(0);
  const story = stories[idx];
  if (!story) return <div className="story-page" style={{ textAlign: 'center', padding: '4rem', color: '#999' }}>No stories yet.</div>;

  return (
    <div className="story-page">
      <div className="story-navigation">
        <button className="button-primary nav-button" onClick={() => setIdx(idx + 1)} disabled={idx === stories.length - 1}><ChevronLeft size={14}/> Prev</button>
        <span style={{ fontSize: '12px', fontWeight: 500, color: '#999' }}>{stories.length - idx} / {stories.length}</span>
        <button className="button-primary nav-button" onClick={() => setIdx(idx - 1)} disabled={idx === 0}>Next <ChevronRight size={14}/></button>
      </div>
      <article className="story-doc fade-in" key={story.id}>
        <h1>{story.title}</h1>
        <div className="date">{new Date(story.createdAt).toLocaleDateString()}</div>
        <div className="content">
          {story.story.split('\n').map((p, i) => <p key={i} style={{ marginBottom: '1rem' }}>{p}</p>)}
        </div>
      </article>
    </div>
  );
}

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
