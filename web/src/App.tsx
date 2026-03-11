import React, { useState, useEffect } from 'react';
import { Sparkles, BookOpen, Settings, ChevronRight, RefreshCcw } from 'lucide-react';
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
      
      const artData = await artRes.json();
      const storyData = await storyRes.json();
      const setData = await setRes.json();
      
      setArtifacts(artData.items || []);
      setStories(storyData.items || []);
      setSettings(setData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">
          <Sparkles size={20} className="accent-icon" />
          <span className="logo-text">TypeLearn</span>
        </div>
        
        <nav className="nav-links">
          <button 
            className={`nav-link ${view === 'insights' ? 'active' : ''}`}
            onClick={() => setView('insights')}
          >
            <Sparkles size={18} />
            <span>Learning Insights</span>
          </button>
          <button 
            className={`nav-link ${view === 'stories' ? 'active' : ''}`}
            onClick={() => setView('stories')}
          >
            <BookOpen size={18} />
            <span>Daily Stories</span>
          </button>
          <button 
            className={`nav-link ${view === 'settings' ? 'active' : ''}`}
            onClick={() => setView('settings')}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <button onClick={fetchData} className="refresh-btn">
            <RefreshCcw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="content-header">
          <h1>
            {view === 'insights' && "Learning Moments"}
            {view === 'stories' && "Your Learning Stories"}
            {view === 'settings' && "Preferences"}
          </h1>
          <p className="subtitle">
            {view === 'insights' && "Captured from your daily typing activity."}
            {view === 'stories' && "Narratives generated from your learning path."}
            {view === 'settings' && "Configure your language models and privacy."}
          </p>
        </header>

        <section className="scroll-area staggered-list">
          {loading ? (
            <div className="loading">Refining your insights...</div>
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
              {!loading && artifacts.length === 0 && view === 'insights' && (
                <div className="empty-state">
                  <p>No learning moments yet. Keep typing naturally!</p>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <style>{`
        .layout {
          display: flex;
          height: 100vh;
          width: 100%;
        }
        
        .sidebar {
          width: 260px;
          border-right: 1px solid var(--border);
          background: var(--bg-secondary);
          display: flex;
          flex-direction: column;
          padding: 2rem 1.5rem;
        }
        
        .logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 3rem;
        }
        
        .logo-text {
          font-family: "Georgia", serif;
          font-weight: 500;
          font-size: 1.25rem;
          letter-spacing: -0.02em;
        }
        
        .accent-icon {
          color: var(--accent);
        }
        
        .nav-links {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          flex: 1;
        }
        
        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          color: var(--text-secondary);
          text-align: left;
          font-size: 0.95rem;
        }
        
        .nav-link:hover {
          background: var(--bg-primary);
          color: var(--text-primary);
        }
        
        .nav-link.active {
          background: var(--bg-primary);
          color: var(--text-primary);
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        
        .content {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 3rem 4rem;
          background: var(--bg-primary);
          overflow: hidden;
        }
        
        .content-header {
          margin-bottom: 2.5rem;
        }
        
        h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }
        
        .subtitle {
          color: var(--text-secondary);
          font-size: 1.1rem;
        }
        
        .scroll-area {
          flex: 1;
          overflow-y: auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
          padding-right: 1rem;
          align-content: start;
        }
        
        /* Artifact Card Styles */
        .artifact-card {
          background: white;
          border: 1px solid var(--border);
          padding: 1.25rem;
          border-radius: 8px;
          transition: all 0.2s ease-out;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          position: relative;
        }
        
        .artifact-card:hover {
          border-color: var(--accent);
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.03);
        }
        
        .card-meta {
          font-size: 0.7rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid var(--bg-secondary);
          padding-bottom: 0.5rem;
        }
        
        .card-content {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .text-group h4 {
          font-size: 0.65rem;
          text-transform: uppercase;
          color: var(--text-secondary);
          margin-bottom: 0.25rem;
          opacity: 0.7;
        }
        
        .source-text {
          font-family: var(--font-serif);
          font-size: 0.95rem;
          line-height: 1.4;
          color: var(--text-secondary);
          text-decoration: line-through decoration-thickness(1px) color(var(--error));
          margin-bottom: 0.25rem;
        }

        .restored-context {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 0.5rem;
          background: var(--bg-secondary);
          border-radius: 4px;
        }

        .context-label {
          font-size: 0.6rem;
          text-transform: uppercase;
          font-weight: 700;
          color: var(--accent);
          flex-shrink: 0;
        }

        .chinese-text {
          font-size: 0.9rem;
          color: var(--text-primary);
          font-weight: 500;
        }
        
        .suggested-text {
          font-family: var(--font-serif);
          font-size: 1.1rem;
          line-height: 1.4;
          color: var(--text-primary);
          font-weight: 600;
        }
        
        .explanation {
          font-size: 0.8rem;
          line-height: 1.4;
          color: var(--text-secondary);
          font-style: italic;
          opacity: 0.8;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .story-card {
          grid-column: 1 / -1;
          background: var(--bg-secondary);
          padding: 2rem;
          border-radius: 8px;
        }
        
        .story-content {
          font-family: "Georgia", serif;
          font-size: 1.2rem;
          line-height: 1.8;
          color: var(--text-primary);
          white-space: pre-wrap;
        }
        
        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-secondary);
          font-size: 0.8rem;
        }
        
        .settings-view {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          max-width: 600px;
        }
        
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .form-group label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        
        .form-group input {
          padding: 0.75rem 1rem;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: white;
        }
        
        .save-btn {
          margin-top: 1rem;
          padding: 0.75rem 1.5rem;
          background: var(--text-primary);
          color: white;
          border-radius: 4px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: LearningArtifact }) {
  const isGeneric = artifact.explanation.includes('normalized capitalization');
  
  return (
    <article className="artifact-card">
      <div className="card-meta">
        <span>Insight</span>
        <span>{new Date(artifact.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="card-content">
        <div className="text-group">
          <h4>Input</h4>
          <p className="source-text serif">{artifact.sourceText}</p>
          {artifact.restoredText && (
            <div className="restored-context">
              <span className="context-label">ZH</span>
              <span className="chinese-text serif">{artifact.restoredText}</span>
            </div>
          )}
        </div>
        <div className="text-group">
          <h4>Suggested</h4>
          <p className="suggested-text serif">{artifact.suggestion}</p>
        </div>
      </div>
      {!isGeneric && (
        <div className="explanation">
          <p>{artifact.explanation}</p>
        </div>
      )}
    </article>
  );
}

function StoryCard({ story }: { story: StoryArtifact }) {
  return (
    <article className="story-card">
      <div className="card-meta">
        <span>{story.title}</span>
        <span>{new Date(story.createdAt).toLocaleDateString()}</span>
      </div>
      <div className="story-content serif">
        {story.story}
      </div>
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
      if (res.ok) {
        onUpdate(form);
        alert('Settings saved.');
      }
    } catch (err) {
      alert('Failed to save settings.');
    }
  };

  return (
    <div className="settings-view">
      <div className="form-group">
        <label>Base URL</label>
        <input 
          value={form.baseUrl} 
          onChange={e => setForm({...form, baseUrl: e.target.value})} 
          placeholder="https://api.openai.com/v1"
        />
      </div>
      <div className="form-group">
        <label>API Key</label>
        <input 
          type="password"
          value={form.apiKey} 
          onChange={e => setForm({...form, apiKey: e.target.value})} 
          placeholder="sk-..."
        />
      </div>
      <div className="form-group">
        <label>Model</label>
        <input 
          value={form.model} 
          onChange={e => setForm({...form, model: e.target.value})} 
        />
      </div>
      <button className="save-btn" onClick={save}>Save Preferences</button>
    </div>
  );
}
