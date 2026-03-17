import { humanizePatternKey } from '../lib/day';
import type { StoryArtifact } from '../types';

type StoryViewProps = {
  stories: StoryArtifact[];
  selectedDay: string;
  onGenerate: () => void;
};

export function StoryView({ stories, selectedDay, onGenerate }: StoryViewProps) {
  const story = stories[0];
  const paragraphs = story?.paragraphs?.length
    ? story.paragraphs
    : story?.story.split(/\n+/).map((line) => line.trim()).filter(Boolean) ?? [];
  const stealLines = story?.stealLines ?? [];
  const themeLabels = story?.themeLabels ?? [];
  const patternKeys = story?.patternKeys ?? [];
  const displayDate = new Date(`${selectedDay}T00:00:00`).toLocaleDateString();

  if (!story) {
    return (
      <div className="view-stack story-page">
        <section className="inbox-summary-bar glass-panel">
          <div className="inbox-summary-copy">
            <span className="summary-note">No story for {displayDate} yet.</span>
            <button className="button-primary" onClick={onGenerate} type="button">
              Generate story
            </button>
          </div>
        </section>

        <div className="empty-panel paper-card">
          <div className="empty-state-title">No story for {displayDate} yet.</div>
          <p>Generate one when you want the day summarized as a compact narrative instead of raw fragments.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="story-page view-stack">
      <article className="story-doc">
        <div className="story-header">
          <div>
            <div className="page-kicker">Daily story</div>
            <h1>{story.title || "Today's Story"}</h1>
            <div className="date">{displayDate}</div>
          </div>
          <button className="button-primary" onClick={onGenerate} type="button">
            Regenerate
          </button>
        </div>

        <div className="story-note">Generated from the compressed digest, not the full raw transcript.</div>
        <div className="story-summary">{story.summary}</div>

        {(themeLabels.length || patternKeys.length || story.sessionCount > 0) ? (
          <div className="story-meta">
            {story.sessionCount > 0 ? <span className="story-chip">{story.sessionCount} session{story.sessionCount > 1 ? 's' : ''}</span> : null}
            {themeLabels.map((theme) => <span key={theme} className="story-chip">{theme}</span>)}
            {patternKeys.map((pattern) => (
              <span key={pattern} className="story-chip subtle">
                {humanizePatternKey(pattern)}
              </span>
            ))}
          </div>
        ) : null}

        <div className="story-content">
          {paragraphs.map((paragraph, index) => (
            <p key={`${story.id}-${index}`}>{paragraph}</p>
          ))}
        </div>

        {stealLines.length ? (
          <section className="story-lines">
            <h2>Steal these lines</h2>
            <ul>
              {stealLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </div>
  );
}
