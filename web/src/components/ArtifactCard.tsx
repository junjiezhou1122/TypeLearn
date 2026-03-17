import { memo } from 'react';
import type { LearningArtifact } from '../types';
import { humanizePatternKey } from '../lib/day';

type ArtifactCardProps = {
  artifact: LearningArtifact;
};

const genericMessages = [
  'normalized capitalization',
  'already looks clear',
  'kept it as-is',
  'natural in everyday writing',
];

export const ArtifactCard = memo(function ArtifactCard({ artifact }: ArtifactCardProps) {
  const isExpression = artifact.type === 'Expression';
  const variantClass = isExpression ? 'variant-expression' : 'variant-refinement';
  const shouldShowExplanation = artifact.explanation && !genericMessages.some((message) => (
    artifact.explanation.toLowerCase().includes(message.toLowerCase())
  ));
  const source = isExpression ? (artifact.intentZh ?? artifact.sourceText) : artifact.sourceText;
  const hasRewrite = Boolean(artifact.corrected || artifact.alt1Natural || artifact.alt2ClearFormal);
  const corrected = artifact.corrected ?? artifact.suggestion;
  const patternLabels = artifact.patternKeys?.slice(0, 4).map(humanizePatternKey) ?? [];

  return (
    <article className={`artifact-card paper-card ${variantClass}`}>
      <div className="artifact-card-head">
        <span className="card-type-tag">{isExpression ? 'Expression' : 'Refinement'}</span>
        <span className="card-time">
          {new Date(artifact.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <div className="card-body">
        <div className="artifact-copy">
          <div className="eyebrow-label">{isExpression ? 'Intent' : 'Original'}</div>
          <p className="card-source">{source}</p>
        </div>

        {isExpression ? (
          <>
            <div className="artifact-copy">
              <div className="eyebrow-label">Best line</div>
              <p className="card-result">{artifact.suggestion}</p>
            </div>

            {artifact.enAlternatives?.length ? (
              <div className="artifact-inline-group">
                <div className="artifact-note-title">Alternatives</div>
                <ul className="artifact-list">
                  {artifact.enAlternatives.slice(0, 4).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {artifact.enTemplates?.length ? (
              <div className="artifact-inline-group">
                <div className="artifact-note-title">Templates</div>
                <ul className="artifact-list">
                  {artifact.enTemplates.slice(0, 3).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : hasRewrite ? (
          <div className="artifact-variant-stack">
            <div className="artifact-copy">
              <div className="artifact-note-title">Corrected</div>
              <div className="card-result">{corrected}</div>
            </div>
            <div className="artifact-copy">
              <div className="artifact-note-title">Natural</div>
              <div className="card-result">{artifact.alt1Natural ?? corrected}</div>
            </div>
            <div className="artifact-copy">
              <div className="artifact-note-title">Clear / formal</div>
              <div className="card-result">{artifact.alt2ClearFormal ?? corrected}</div>
            </div>
          </div>
        ) : (
          <div className="artifact-copy">
            <div className="eyebrow-label">Rewrite</div>
            <p className="card-result">{artifact.suggestion}</p>
          </div>
        )}

        {shouldShowExplanation ? (
          <div className="artifact-inline-group soft">
            <div className="artifact-note-title">Why this works</div>
            <p className="card-note">{artifact.explanation}</p>
          </div>
        ) : null}

        {patternLabels.length ? (
          <div className="card-meta-tags">
            {patternLabels.map((pattern) => (
              <span key={pattern} className="mini-pill subtle">
                {pattern}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
});
