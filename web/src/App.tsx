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
  Zap
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
      const transformedArts: LearningArtifact[] = arts.map((a: any) => ({
        ...a,
        type: a.restoredText ? 'Expression' : 'Refinement',
        category: a.category,
        intentText: a.restoredText,
        keyPhrases: a.keyPhrases || []
      }));
      
      setArtifacts(transformedArts);
      setStories((await storyRes.json()).items || []);
      setSettings(await setRes.json());
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

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
          <button onClick={fetchData} className="nav-item" style={{ width: '100%', fontSize: '0.8rem', color: '#999' }}>
            <RefreshCcw size={14} className={loading ? 'spinning' : ''} />
            <span style={{ marginLeft: '8px' }}>Sync Progress</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Header view={view} />
        
        <div className="fade-in">
          {view === 'inbox' && <InboxView artifacts={artifacts} />}
          {view === 'library' && <LibraryView artifacts={artifacts.filter(a => a.isSaved)} />}
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

function Header({ view }: { view: ViewType }) {
  const titles = {
    inbox: "Capture Inbox",
    library: "Library",
    story: "Narrative",
    settings: "Config"
  };
  return (
    <header>
      <h1>{titles[view]}</h1>
    </header>
  );
}

function InboxView({ artifacts }: { artifacts: LearningArtifact[] }) {
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredArtifacts = artifacts.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'english') return a.type === 'Refinement';
    if (filter === 'chinese') return a.type === 'Expression';
    return true;
  });

  return (
    <div className="view-inbox">
      <div className="filter-bar">
        <button className={`filter-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`filter-tab ${filter === 'english' ? 'active' : ''}`} onClick={() => setFilter('english')}>English</button>
        <button className={`filter-tab ${filter === 'chinese' ? 'active' : ''}`} onClick={() => setFilter('chinese')}>Chinese</button>
      </div>

      <div className="content-grid">
        {filteredArtifacts.length > 0 ? (
          filteredArtifacts.map(a => <ArtifactCard key={a.id} artifact={a} />)
        ) : (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: '#999' }}>
            <Archive size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <p>Empty inbox.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: LearningArtifact }) {
  const isExpression = artifact.type === 'Expression';
  const variantClass = isExpression ? 'variant-expression' : 'variant-refinement';
  
  const genericMessages = [
    'normalized capitalization',
    'already looks clear',
    'kept it as-is',
    'natural in everyday writing'
  ];
  
  const shouldShowExplanation = artifact.explanation && !genericMessages.some(msg => 
    artifact.explanation.toLowerCase().includes(msg.toLowerCase())
  );
  
  return (
    <div className={`artifact-card-container ${variantClass}`}>
      <article className="artifact-card">
        <div className="card-header-icon" style={{ backgroundColor: isExpression ? '#fff0f3' : '#f0f7ff' }}>
          {isExpression ? <MessageCircle size={16} color="#ff4d6d" /> : <Zap size={16} color="#0077ff" />}
        </div>

        <div className="card-body">
          {isExpression ? (
            <div className="expression-body">
              <div className="input-block">
                <label>Intent</label>
                <div className="intent-text serif">{artifact.intentText}</div>
              </div>
              <div className="input-block" style={{ marginTop: '1rem' }}>
                <label>English</label>
                <div className="suggestion-text serif">{artifact.suggestion}</div>
              </div>
            </div>
          ) : (
            <div className="refinement-body">
              <div className="input-block">
                <label>Draft</label>
                <div className="source-text serif">{artifact.sourceText}</div>
              </div>
              <div className="input-block" style={{ marginTop: '1rem' }}>
                <label>Refined</label>
                <div className="suggestion-text serif">{artifact.suggestion}</div>
              </div>
            </div>
          )}
        </div>

        {shouldShowExplanation && (
          <div className="explanation-block">
            {artifact.explanation}
          </div>
        )}

        <div className="card-footer">
          <span className="footer-label">{new Date(artifact.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {artifact.keyPhrases?.slice(0, 2).map(phrase => (
              <span key={phrase} className="key-phrase-pill">{phrase}</span>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}

function LibraryView({ artifacts }: { artifacts: LearningArtifact[] }) {
  return (
    <div className="content-grid">
      {artifacts.map(a => <ArtifactCard key={a.id} artifact={a} />)}
    </div>
  );
}

function StoryView({ stories }: { stories: StoryArtifact[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentStory = stories[currentIndex];

  if (!currentStory) return <div style={{ padding: '4rem', textAlign: 'center' }}>No stories yet.</div>;

  return (
    <div className="story-viewer">
      <div className="story-navigation" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <button className="nav-button" disabled={currentIndex === stories.length - 1} onClick={() => setCurrentIndex(currentIndex + 1)}>
          <ChevronLeft size={16} /> Prev
        </button>
        <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>{stories.length - currentIndex} / {stories.length}</span>
        <button className="nav-button" disabled={currentIndex === 0} onClick={() => setCurrentIndex(currentIndex - 1)}>
          Next <ChevronRight size={16} />
        </button>
      </div>

      <article className="story-card fade-in" key={currentStory.id}>
        <div className="story-header" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 className="serif" style={{ fontSize: '2rem', fontWeight: 800 }}>{currentStory.title}</h2>
          <div style={{ color: '#aaa', fontSize: '0.9rem', marginTop: '0.5rem' }}>{new Date(currentStory.createdAt).toLocaleDateString()}</div>
        </div>
        <div className="story-content serif" style={{ fontSize: '1.2rem', lineHeight: '1.8' }}>
          {currentStory.story.split('\n').map((p, i) => <p key={i} style={{ marginBottom: '1.5rem' }}>{p}</p>)}
        </div>
      </article>
    </div>
  );
}

function SettingsView({ settings, onUpdate }: { 
  settings: ProviderSettings, 
  onUpdate: (s: ProviderSettings) => void 
}) {
  const [form, setForm] = useState(settings);
  const save = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) { onUpdate(form); alert('Saved.'); }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{ maxWidth: '500px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="input-group">
        <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Base URL</label>
        <input value={form.baseUrl} onChange={e => setForm({...form, baseUrl: e.target.value})} />
      </div>
      <div className="input-group">
        <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>API Key</label>
        <input type="password" value={form.apiKey} onChange={e => setForm({...form, apiKey: e.target.value})} />
      </div>
      <div className="input-group">
        <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#aaa', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>Model</label>
        <input value={form.model} onChange={e => setForm({...form, model: e.target.value})} />
      </div>
      <button className="button-primary" onClick={save}>Save Changes</button>
    </div>
  );
}
