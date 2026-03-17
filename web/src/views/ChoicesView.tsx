import { useState } from 'react';
import type { ChoiceItem } from '../types';

const API_BASE = 'http://localhost:43010';

type ChoicesViewProps = {
  choices: ChoiceItem[];
  onResolved: () => void;
};

export function ChoicesView({ choices, onResolved }: ChoicesViewProps) {
  const [submitting, setSubmitting] = useState<string | null>(null);

  const select = async (choiceId: string, index: number) => {
    setSubmitting(choiceId);
    try {
      await fetch(`${API_BASE}/choices/${choiceId}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index }),
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

  return (
    <div className="view-stack">
      <section className="inbox-summary-bar glass-panel">
        <div className="inbox-summary-copy">
          <span className="mini-pill tone-peach">{choices.length} pending</span>
          <span className="summary-note">Only uncertain items land here.</span>
        </div>
      </section>

      {!choices.length ? (
        <div className="empty-panel paper-card">
          <div className="empty-state-title">Nothing needs review right now.</div>
          <p>TypeLearn only saves uncertain items here when they are worth checking later.</p>
        </div>
      ) : (
        <div className="content-grid">
          {choices.map((choice) => (
            <article key={choice.id} className="artifact-card paper-card variant-expression">
              <div className="artifact-card-head">
                <span className="card-type-tag">Review</span>
                <span className="card-time">
                  {new Date(choice.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div className="card-body">
                <div className="artifact-copy">
                  <div className="eyebrow-label">Captured input</div>
                  <p className="card-source">{choice.mergedRaw}</p>
                </div>

                <div className="choice-grid">
                  {choice.candidates.map((candidate, index) => (
                    <button
                      key={`${choice.id}-${index}`}
                      className={`choice-option tone-${['sage', 'peach', 'butter', 'rose'][index % 4]}`}
                      onClick={() => select(choice.id, index)}
                      disabled={submitting === choice.id}
                      type="button"
                    >
                      <div className="choice-title">{candidate.intentZh}</div>
                      <div className="choice-subtext">{candidate.enMain}</div>
                    </button>
                  ))}
                </div>

                <div className="choice-actions">
                  <button className="ghost-button" onClick={() => drop(choice.id)} disabled={submitting === choice.id} type="button">
                    Drop
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
