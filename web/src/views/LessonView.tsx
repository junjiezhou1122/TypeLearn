import type { DailyLesson } from '../types';

type LessonViewProps = {
  daily: DailyLesson | null;
};

export function LessonView({ daily }: LessonViewProps) {
  return (
    <div className="view-stack">
      <section className="inbox-summary-bar glass-panel">
        <div className="inbox-summary-copy">
          <span className="mini-pill tone-mint">{daily?.groups.length ?? 0} groups</span>
          <span className="mini-pill tone-lavender">{daily?.stealLines.length ?? 0} steal lines</span>
          <span className="summary-note">Patterns grouped for reuse, not presentation.</span>
        </div>
      </section>

      {!daily ? (
        <div className="empty-panel paper-card">
          <div className="empty-state-title">No lesson yet.</div>
          <p>Come back after more typing and TypeLearn will summarize the strongest pattern signals.</p>
        </div>
      ) : (
        <article className="story-doc lesson-doc">
          <div className="story-header lesson-header">
            <div>
              <div className="lesson-title-row">
                <h1>{daily.day}</h1>
              </div>
            </div>
          </div>

          <div className="lesson-groups">
            {daily.groups.map((group) => (
              <section key={group.macroCategory} className="lesson-group">
                <div className="lesson-group-head">
                  <h2>{group.macroCategory}</h2>
                  <span>{group.patterns.length} pattern{group.patterns.length === 1 ? '' : 's'}</span>
                </div>

                <div className="lesson-pattern-grid">
                  {group.patterns.map((pattern) => (
                    <article key={pattern.patternKey} className="paper-card lesson-pattern-card">
                      <div className="lesson-pattern-head">
                        <div>
                          <h3>{pattern.title}</h3>
                          <div className="lesson-pattern-count">{pattern.counts.today} hit{pattern.counts.today === 1 ? '' : 's'} today</div>
                        </div>
                      </div>

                      <dl className="lesson-rule-list lesson-rule-list-plain">
                        <div className="lesson-rule-row">
                          <dt className="eyebrow-label">Rule</dt>
                          <dd>{pattern.lesson.rule}</dd>
                        </div>
                        <div className="lesson-rule-row">
                          <dt className="eyebrow-label">Hook</dt>
                          <dd>{pattern.lesson.hook}</dd>
                        </div>
                        <div className="lesson-rule-row">
                          <dt className="eyebrow-label">Avoid</dt>
                          <dd>{pattern.lesson.badExample}</dd>
                        </div>
                        <div className="lesson-rule-row">
                          <dt className="eyebrow-label">Use instead</dt>
                          <dd>{pattern.lesson.goodExample}</dd>
                        </div>
                        <div className="lesson-rule-row">
                          <dt className="eyebrow-label">Template</dt>
                          <dd>{pattern.lesson.template}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {daily.stealLines.length ? (
            <section className="story-lines">
              <h2>Steal these lines</h2>
              <ul>
                {daily.stealLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
      )}
    </div>
  );
}
