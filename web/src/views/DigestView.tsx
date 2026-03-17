import { useState } from 'react';
import { humanizePatternKey, parseDayKey, type DayOption } from '../lib/day';
import { DigestHeaderControls } from '../components/HeaderControls';
import type { DayDigest } from '../types';
import type { DigestFocus } from '../ui';

type DigestViewProps = {
  digest: DayDigest | null;
  selectedDay: string;
  dayOptions: DayOption[];
  onDayChange: (day: string) => void;
};

export function DigestView({ digest, selectedDay, dayOptions, onDayChange }: DigestViewProps) {
  const [focus, setFocus] = useState<DigestFocus | null>(null);
  const displayDate = parseDayKey(selectedDay).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const compressionRate = digest
    ? Math.max(0, Math.round((1 - (digest.keyMoments.length / Math.max(digest.sourceRecordIds.length, 1))) * 100))
    : 0;

  if (!digest) {
    return (
      <div className="digest-page view-stack">
        <DigestHeaderControls
          digest={digest}
          dayOptions={dayOptions}
          selectedDay={selectedDay}
          onDayChange={onDayChange}
        />
        <section className="digest-card digest-card-empty paper-card">
          <div className="story-empty">
            <p>No digest for {displayDate} yet.</p>
            <div className="digest-empty-note">Pick another day with records, or keep typing to build a digest here.</div>
          </div>
        </section>
      </div>
    );
  }

  const focusedPattern = focus?.type === 'pattern'
    ? (digest.topPatterns.find((pattern) => pattern.patternKey === focus.id) ?? null)
    : focus?.type === 'moment'
      ? (digest.keyMoments.find((moment) => moment.recordId === focus.id)?.patternKeys
          .map((patternKey) => digest.topPatterns.find((pattern) => pattern.patternKey === patternKey))
          .find(Boolean) ?? null)
      : focus?.type === 'session'
        ? (digest.sessionDigests.find((session) => session.id === focus.id)?.topPatternKeys
            .map((patternKey) => digest.topPatterns.find((pattern) => pattern.patternKey === patternKey))
            .find(Boolean) ?? null)
        : null;
  const focusedMoment = focus?.type === 'moment'
    ? (digest.keyMoments.find((moment) => moment.recordId === focus.id) ?? null)
    : null;
  const focusedSession = focus?.type === 'session'
    ? (digest.sessionDigests.find((session) => session.id === focus.id) ?? null)
    : focus?.type === 'moment'
      ? (digest.sessionDigests.find((session) => session.recordIds.includes(focus.id)) ?? null)
      : null;

  const patternIsActive = (patternKey: string): boolean => {
    if (!focus) return false;
    if (focus.type === 'pattern') return focus.id === patternKey;
    if (focus.type === 'moment') {
      return digest.keyMoments.find((moment) => moment.recordId === focus.id)?.patternKeys.includes(patternKey) ?? false;
    }
    return digest.sessionDigests.find((session) => session.id === focus.id)?.topPatternKeys.includes(patternKey) ?? false;
  };

  const momentIsActive = (recordId: string, patternKeys: string[]): boolean => {
    if (!focus) return false;
    if (focus.type === 'moment') return focus.id === recordId;
    if (focus.type === 'pattern') return patternKeys.includes(focus.id);
    return digest.sessionDigests.find((session) => session.id === focus.id)?.recordIds.includes(recordId) ?? false;
  };

  const sessionIsActive = (sessionId: string, sessionRecordIds: string[], topPatternKeys: string[]): boolean => {
    if (!focus) return false;
    if (focus.type === 'session') return focus.id === sessionId;
    if (focus.type === 'pattern') return topPatternKeys.includes(focus.id);
    return sessionRecordIds.includes(focus.id);
  };

  const activeSessions = !focus
    ? digest.sessionDigests
    : digest.sessionDigests.filter((session) => sessionIsActive(session.id, session.recordIds, session.topPatternKeys));
  const activeMoments = !focus
    ? digest.keyMoments
    : digest.keyMoments.filter((moment) => momentIsActive(moment.recordId, moment.patternKeys));
  const activeRecordIds = Array.from(new Set(
    focus?.type === 'moment'
      ? [focus.id]
      : activeSessions.flatMap((session) => session.recordIds),
  ));
  const activeStealLines = Array.from(new Set(
    focus?.type === 'pattern' && focusedPattern
      ? focusedPattern.sampleLines
      : activeSessions.flatMap((session) => session.stealLines),
  ));
  const focusTitle =
    focus?.type === 'pattern' && focusedPattern
      ? focusedPattern.title
      : focus?.type === 'moment' && focusedMoment
        ? (focusedMoment.enMain || focusedMoment.intentZh || 'selected moment')
        : focus?.type === 'session' && focusedSession
          ? `Session ${digest.sessionDigests.findIndex((session) => session.id === focusedSession.id) + 1}`
          : null;
  return (
    <div className="digest-page view-stack">
      <DigestHeaderControls
        digest={digest}
        dayOptions={dayOptions}
        selectedDay={selectedDay}
        onDayChange={onDayChange}
      />

      <section className="inbox-summary-bar glass-panel">
        <div className="inbox-summary-copy">
          <span className="mini-pill tone-lavender">{compressionRate}% compressed</span>
          <span className="mini-pill tone-mint">{digest.sessionCount} sessions</span>
          <span className="mini-pill tone-sky">{digest.keyMoments.length} moments</span>
          <span className="mini-pill tone-peach">{digest.stealLines.length} lines</span>
          {focusTitle ? <span className="summary-note">Focus: {focusTitle}</span> : null}
        </div>
      </section>

      <div className="digest-grid">
        <section className="digest-card digest-card-wide paper-card digest-flow-card">
          <div className="digest-section-title">Compression Flow</div>
          <div className="digest-flow">
            <div className={`digest-flow-step ${focus ? 'active' : ''}`}>
              <div className="digest-flow-count">{focus ? activeRecordIds.length : digest.stats.totalRecords}</div>
              <div className="digest-flow-label">{focus ? 'focused records' : 'visible records'}</div>
            </div>
            <div className="digest-flow-arrow">→</div>
            <div className={`digest-flow-step ${focus ? 'active' : ''}`}>
              <div className="digest-flow-count">{focus ? activeSessions.length : digest.sessionCount}</div>
              <div className="digest-flow-label">{focus ? 'focused sessions' : 'sessions'}</div>
            </div>
            <div className="digest-flow-arrow">→</div>
            <div className={`digest-flow-step ${focus ? 'active' : ''}`}>
              <div className="digest-flow-count">{focus ? activeMoments.length : digest.keyMoments.length}</div>
              <div className="digest-flow-label">{focus ? 'focused moments' : 'key moments'}</div>
            </div>
            <div className="digest-flow-arrow">→</div>
            <div className={`digest-flow-step ${focus ? 'active' : ''}`}>
              <div className="digest-flow-count">{focus ? activeStealLines.length : digest.stealLines.length}</div>
              <div className="digest-flow-label">{focus ? 'focused lines' : 'reusable lines'}</div>
            </div>
          </div>
        </section>

        <section className="digest-card paper-card">
          <div className="digest-section-title">Themes</div>
          <div className="digest-theme-stack">
            {digest.themes.length ? digest.themes.map((theme, index) => (
              <div key={theme} className="digest-theme-line">
                <span className="digest-theme-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="digest-theme-text">{theme}</span>
              </div>
            )) : <div className="digest-empty">No themes selected for this day.</div>}
          </div>
        </section>

        <section className="digest-card paper-card">
          <div className="digest-section-title">Steal Lines</div>
          <div className="digest-stack">
            {digest.stealLines.length ? digest.stealLines.map((line, index) => (
              <div key={line} className="digest-line-item">
                <span className="digest-line-index">{index + 1}</span>
                <span className="digest-line-text">{line}</span>
              </div>
            )) : <div className="digest-empty">No reusable lines selected for this day.</div>}
          </div>
        </section>

        <section className="digest-card paper-card">
          <div className="digest-section-title">Top Patterns</div>
          {(focusedPattern || focusedMoment || focusedSession) ? (
            <div className="digest-focus-banner">
              <span className="digest-focus-copy">
                {focus?.type === 'pattern' && focusedPattern ? <>Focusing on <strong>{focusedPattern.title}</strong></> : null}
                {focus?.type === 'moment' && focusedMoment ? <>Tracing <strong>{focusedMoment.enMain || focusedMoment.intentZh || 'selected moment'}</strong></> : null}
                {focus?.type === 'session' && focusedSession ? <>Inspecting <strong>Session {digest.sessionDigests.findIndex((session) => session.id === focusedSession.id) + 1}</strong></> : null}
              </span>
              <button type="button" className="digest-focus-clear" onClick={() => setFocus(null)}>
                Clear
              </button>
            </div>
          ) : null}
          <div className="digest-stack">
            {digest.topPatterns.length ? digest.topPatterns.map((pattern) => (
              <button
                key={pattern.patternKey}
                type="button"
                className={`digest-item digest-item-button ${patternIsActive(pattern.patternKey) ? 'active' : focus ? 'muted' : ''}`}
                aria-pressed={patternIsActive(pattern.patternKey)}
                onClick={() => setFocus((current) => (
                  current?.type === 'pattern' && current.id === pattern.patternKey
                    ? null
                    : { type: 'pattern', id: pattern.patternKey }
                ))}
              >
                <div className="digest-item-header">
                  <strong>{pattern.title}</strong>
                  <span>{pattern.count} hit{pattern.count > 1 ? 's' : ''}</span>
                </div>
                {pattern.sampleLines.length ? (
                  <div className="digest-inline-list">
                    {pattern.sampleLines.map((line) => <span key={line} className="digest-inline-pill">{line}</span>)}
                  </div>
                ) : null}
              </button>
            )) : <div className="digest-empty">No pattern summaries for this day.</div>}
          </div>
        </section>

        <section className="digest-card digest-card-wide paper-card">
          <div className="digest-section-title">Key Moments</div>
          <div className="digest-stack">
            {digest.keyMoments.length ? digest.keyMoments.map((moment, index) => (
              <button
                key={moment.recordId}
                type="button"
                className={[
                  'digest-moment-row',
                  'digest-item-button',
                  momentIsActive(moment.recordId, moment.patternKeys) ? 'active' : focus ? 'muted' : '',
                ].filter(Boolean).join(' ')}
                aria-pressed={momentIsActive(moment.recordId, moment.patternKeys)}
                onClick={() => setFocus((current) => (
                  current?.type === 'moment' && current.id === moment.recordId
                    ? null
                    : { type: 'moment', id: moment.recordId }
                ))}
              >
                <div className="digest-item-header">
                  <strong>{moment.enMain || moment.intentZh || 'Untitled moment'}</strong>
                  <span className="digest-soft-meta">{moment.timeBucket}</span>
                </div>
                <div className="digest-moment-meta">
                  <span className="digest-moment-rank">Moment {index + 1}</span>
                  <span>{new Date(moment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {moment.sourceApp ? <span>{moment.sourceApp}</span> : null}
                  <span>score {moment.score}</span>
                </div>
                <div className="digest-item-copy">{moment.intentZh || 'No abstracted intent for this moment.'}</div>
                {moment.patternKeys.length ? (
                  <div className="digest-inline-list">
                    {moment.patternKeys.map((pattern) => <span key={pattern} className="digest-inline-pill subtle">{humanizePatternKey(pattern)}</span>)}
                  </div>
                ) : null}
              </button>
            )) : <div className="digest-empty">No key moments selected yet.</div>}
          </div>
        </section>

        <section className="digest-card digest-card-wide paper-card">
          <div className="digest-section-title">Sessions</div>
          <div className="digest-section-intro">These are the chunks the day collapsed into before the final digest was assembled.</div>
          <div className="digest-timeline">
            {digest.sessionDigests.length ? digest.sessionDigests.map((session, index) => (
              <button
                key={session.id}
                type="button"
                className={[
                  'digest-session',
                  'digest-session-timeline',
                  'digest-item-button',
                  sessionIsActive(session.id, session.recordIds, session.topPatternKeys) ? 'active' : focus ? 'muted' : '',
                ].filter(Boolean).join(' ')}
                aria-pressed={sessionIsActive(session.id, session.recordIds, session.topPatternKeys)}
                onClick={() => setFocus((current) => (
                  current?.type === 'session' && current.id === session.id
                    ? null
                    : { type: 'session', id: session.id }
                ))}
              >
                <div className="digest-session-rail">
                  <span className="digest-session-dot" />
                  {index !== digest.sessionDigests.length - 1 ? <span className="digest-session-line" /> : null}
                </div>
                <div className="digest-session-body">
                  <div className="digest-item-header">
                    <strong>Session {index + 1}</strong>
                    <span className="digest-soft-meta">{session.recordCount} record{session.recordCount > 1 ? 's' : ''}</span>
                  </div>
                  <div className="digest-session-range">
                    {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {new Date(session.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {session.sourceApps.length ? ` · ${session.sourceApps.join(', ')}` : ''}
                  </div>
                  <div className="digest-inline-list">
                    {session.themeLabels.map((theme) => <span key={theme} className="story-chip">{theme}</span>)}
                    {session.topPatternKeys.map((pattern) => <span key={pattern} className="digest-inline-pill subtle">{humanizePatternKey(pattern)}</span>)}
                  </div>
                  {session.stealLines.length ? <div className="digest-item-copy">{session.stealLines.join(' · ')}</div> : null}
                </div>
              </button>
            )) : <div className="digest-empty">No sessions available for this day.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
