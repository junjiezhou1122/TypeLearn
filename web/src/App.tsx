import React, { useState, useEffect } from 'react';
import { Sparkles, BookOpen, Settings, RefreshCcw } from 'lucide-react';
import type { LearningArtifact, StoryArtifact, ProviderSettings } from './types';

const API_BASE = 'http://localhost:43010';

export default function App() {
  const [view, setView] = useState<'insights' | 'stories' | 'settings'>('insights');
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
      setArtifacts((await artRes.json()).items || []);
      setStories((await storyRes.json()).items || []);
      setSettings(await setRes.json());
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '2rem', paddingLeft: '1rem' }}>TypeLearn</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <button className={`nav-item ${view === 'insights' ? 'active' : ''}`} onClick={() => setView('insights')}>
            Insights
          </button>
          <button className={`nav-item ${view === 'stories' ? 'active' : ''}`} onClick={() => setView('stories')}>
            Stories
          </button>
          <button className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
            Settings
          </button>
        </nav>
        <div style={{ marginTop: 'auto', padding: '1rem' }}>
          <button onClick={fetchData} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#999', fontSize: '0.8rem' }}>
            <RefreshCcw size={14} className={loading ? 'spinning' : ''} />
            <span>Sync</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header>
          <h1>{view === 'insights' ? 'Learning Insights' : view === 'stories' ? 'Daily Stories' : 'Configuration'}</h1>
          <p className="subtitle">
            {view === 'insights' && "Refined suggestions from your daily computer usage."}
            {view === 'stories' && "A narrative overview of your recent progress."}
            {view === 'settings' && "Configure AI engine and preferences."}
          </p>
        </header>

        <section className="artifacts-grid">
          {loading ? (
            <div style={{ color: '#999', fontSize: '0.9rem' }}>Loading...</div>
          ) : (
            <>
              {view === 'insights' && artifacts.map(art => (
                <ArtifactCard key={art.id} artifact={art} />
              ))}
              {view === 'stories' && stories.map(story => (
                <StoryCard key={story.id} story={story} />
              ))}
              {view === 'settings' && settings && (
                <SettingsView settings={settings} onUpdate={setSettings} />
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: LearningArtifact }) {
  const isGeneric = artifact.explanation.includes('normalized capitalization');
  
  return (
    <article className="card">
      <div className="card-header">
        <span>Insight</span>
        <span>{new Date(artifact.createdAt).toLocaleDateString()}</span>
      </div>
      
      <div className="learning-flow">
        <div className="flow-step">
          <label>Raw Input</label>
          <div className="original-box serif">{artifact.sourceText}</div>
        </div>

        {artifact.restoredText && (
          <div className="flow-step">
            <label>Chinese Context</label>
            <div className="chinese-box serif">{artifact.restoredText}</div>
          </div>
        )}

        <div className="flow-step highlight">
          <label>English Suggestion</label>
          <div className="suggested-box serif">{artifact.suggestion}</div>
        </div>
      </div>
      
      {!isGeneric && (
        <div className="explanation-text">
          {artifact.explanation}
        </div>
      )}
    </article>
  );
}

function StoryCard({ story }: { story: StoryArtifact }) {
  return (
    <article className="card" style={{ gridColumn: '1 / -1' }}>
      <div className="card-header" style={{ marginBottom: '1rem' }}>
        <span>Story</span>
        <span>{new Date(story.createdAt).toLocaleDateString()}</span>
      </div>
      <h3 style={{ marginBottom: '1rem' }}>{story.title}</h3>
      <p className="serif" style={{ fontSize: '1.1rem', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
        {story.story}
      </p>
    </article>
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
    } catch (err) { alert('Failed.'); }
  };

  return (
    <div style={{ gridColumn: '1 / -1', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Base URL</label>
        <input style={{ padding: '0.75rem', border: '1px solid #eee', borderRadius: '8px' }} value={form.baseUrl} onChange={e => setForm({...form, baseUrl: e.target.value})} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>API Key</label>
        <input type="password" style={{ padding: '0.75rem', border: '1px solid #eee', borderRadius: '8px' }} value={form.apiKey} onChange={e => setForm({...form, apiKey: e.target.value})} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Model</label>
        <input style={{ padding: '0.75rem', border: '1px solid #eee', borderRadius: '8px' }} value={form.model} onChange={e => setForm({...form, model: e.target.value})} />
      </div>
      <button style={{ background: '#1a1a1a', color: 'white', padding: '0.75rem', borderRadius: '8px', marginTop: '1rem' }} onClick={save}>Save</button>
    </div>
  );
}
