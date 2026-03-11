import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningArtifact } from '../src/coaching.js';

test('rewrites common subject-verb agreement mistakes', () => {
  const artifact = buildLearningArtifact('I has a question about this sentence.');

  assert.equal(artifact.suggestion, 'I have a question about this sentence.');
  assert.match(artifact.explanation, /Use "have" with "I"/);
});

test('normalizes generic text with punctuation when no specific rule matches', () => {
  const artifact = buildLearningArtifact('this is already pretty clear');

  assert.equal(artifact.suggestion, 'This is already pretty clear.');
  assert.match(artifact.explanation, /capitalization or punctuation/);
});
