import { useState } from 'react';
import type { ProviderSettings } from '../types';

const API_BASE = 'http://localhost:43010';

type SettingsViewProps = {
  settings: ProviderSettings;
  onUpdate: (settings: ProviderSettings) => void;
};

export function SettingsView({ settings, onUpdate }: SettingsViewProps) {
  const [form, setForm] = useState(settings);

  const save = async () => {
    try {
      const response = await fetch(`${API_BASE}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        onUpdate(form);
        alert('Saved.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="view-stack">
      <section className="inbox-summary-bar glass-panel">
        <div className="inbox-summary-copy">
          <span className="summary-note">Provider settings. Local-first by default.</span>
        </div>
      </section>

      <div className="settings-shell paper-card">
        <div className="settings-section">
          <div className="settings-row">
            <div className="settings-info">
              <label htmlFor="base-url">Base URL</label>
              <div className="desc">The endpoint address for your AI provider.</div>
            </div>
            <div className="settings-input-area">
              <input
                id="base-url"
                value={form.baseUrl}
                onChange={(event) => setForm({ ...form, baseUrl: event.target.value })}
                placeholder="http://localhost:11434"
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label htmlFor="api-key">API Key</label>
              <div className="desc">Your secret key for authentication.</div>
            </div>
            <div className="settings-input-area">
              <input
                id="api-key"
                type="password"
                value={form.apiKey}
                onChange={(event) => setForm({ ...form, apiKey: event.target.value })}
                placeholder="sk-..."
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label htmlFor="model-name">Model Name</label>
              <div className="desc">The specific AI model to use for translations.</div>
            </div>
            <div className="settings-input-area">
              <input
                id="model-name"
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
                placeholder="gpt-4.1-mini"
              />
            </div>
          </div>
        </div>

        <div className="settings-actions">
          <button className="button-primary" onClick={save} type="button">
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
