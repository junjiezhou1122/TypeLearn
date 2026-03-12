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
          <NavItem active={view === 'inbox'} icon={<Inbox size={18}/>} label="Inbox" onClick={() => setView('inbox')} />
          <NavItem active={view === 'library'} icon={<Library size={18}/>} label="Library" onClick={() => setView('library')} />
          <NavItem active={view === 'story'} icon={<Book size={18}/>} label="Story" onClick={() => setView('story')} />
          <NavItem active={view === 'settings'} icon={<Settings size={18}/>} label="Settings" onClick={() => setView('settings')} />
        </nav>
        <div style={{ marginTop: 'auto', padding: '1rem' }}>
          <button onClick={fetchData} className="nav-item" style={{ width: '100%', fontSize: '0.8rem', opacity: 0.6 }}>
            <RefreshCcw size={14} className={loading ? 'spinning' : ''} />
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
        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: '#ccc' }}>
          <Archive size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
          <p>No items found.</p>
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
        {isExpression ? <MessageCircle size={14} strokeWidth={2.5}/> : <Zap size={14} strokeWidth={2.5}/>}
      </div>
      <div className="card-body">
        {isExpression ? (
          <>
            <div className="label-small">Intent</div>
            <div className="main-text serif">{artifact.intentText}</div>
            <div className="label-small">Native</div>
            <div className="main-text serif highlight-text">{artifact.suggestion}</div>
          </>
        ) : (
          <>
            <div className="label-small">Draft</div>
            <div className="secondary-text serif" style={{ marginBottom: '1rem' }}>{artifact.sourceText}</div>
            <div className="label-small">Refined</div>
            <div className="main-text serif highlight-text">{artifact.suggestion}</div>
          </>
        )}
        {shouldShowExplanation && (
          <div className="explanation-area">{artifact.explanation}</div>
        )}
      </div>
      <div className="card-footer">
        <span>{new Date(artifact.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {artifact.keyPhrases?.slice(0, 2).map(p => <span key={p} className="key-phrase-pill">{p}</span>)}
        </div>
      </div>
    </article>
  );
}

function StoryView({ stories }: { stories: StoryArtifact[] }) {
  const [idx, setIdx] = useState(0);
  const story = stories[idx];
  if (!story) return <div className="story-page" style={{ textAlign: 'center', padding: '10rem' }}>No stories yet.</div>;

  return (
    <div className="story-page">
      <div className="story-navigation">
        <button className="nav-button" onClick={() => setIdx(idx + 1)} disabled={idx === stories.length - 1}><ChevronLeft size={16}/> Previous</button>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#aaa' }}>{stories.length - idx} / {stories.length}</span>
        <button className="nav-button" onClick={() => setIdx(idx - 1)} disabled={idx === 0}>Next <ChevronRight size={16}/></button>
      </div>
      <article className="story-doc fade-in" key={story.id}>
        <h1 className="serif">{story.title}</h1>
        <div className="date">{new Date(story.createdAt).toLocaleDateString()}</div>
        <div className="content serif">
          {story.story.split('\n').map((p, i) => <p key={i} style={{ marginBottom: '1.5rem' }}>{p}</p>)}
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
    <div style={{ maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <label className="label-small" style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Base URL</label>
        <input value={form.baseUrl} onChange={e => setForm({...form, baseUrl: e.target.value})} />
      </div>
      <div>
        <label className="label-small" style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>API Key</label>
        <input type="password" value={form.apiKey} onChange={e => setForm({...form, apiKey: e.target.value})} />
      </div>
      <div>
        <label className="label-small" style={{ color: '#aaa', display: 'block', marginBottom: '8px' }}>Model</label>
        <input value={form.model} onChange={e => setForm({...form, model: e.target.value})} />
      </div>
      <button className="button-primary" onClick={save} style={{ alignSelf: 'flex-start', borderRadius: '12px' }}>Save Changes</button>
    </div>
  );
}
