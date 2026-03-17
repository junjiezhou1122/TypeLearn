import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDayDigest } from '../src/digest.js';

test('compresses a busy day into bounded sessions and highlights key moments', () => {
  const base = Date.now();
  const day = new Date(base).toISOString().slice(0, 10);

  const records = Array.from({ length: 14 }, (_, index) => ({
    id: `r${index + 1}`,
    sourceText: `source ${index + 1}`,
    restoredText: null,
    englishText: `Reusable line ${index + 1}.`,
    sourceLanguage: 'english' as const,
    sourceApp: index < 7 ? 'Notes' : 'Mail',
    createdAt: new Date(base + index * 60_000).toISOString(),
    status: 'done' as const,
    retryCount: 0,
    lastError: null,
    pipelineStage: 'committed' as const,
    intentZh: index < 7 ? '安排计划' : '推进事情',
    enTemplates: [`Template line ${index + 1}.`],
    patternKeys: [index % 2 === 0 ? 'tense:past_for_finished_action' : 'preposition:on_the_weekend'],
  }));

  const digest = buildDayDigest(day, records, {});

  assert.equal(digest.stats.totalDoneRecords, 14);
  assert.equal(digest.sessionCount, 2);
  assert.ok(digest.themes.length <= 5);
  assert.ok(digest.stealLines.length <= 8);
  assert.ok(digest.keyMoments.length <= 6);
  assert.deepEqual(digest.sourceRecordIds.length, 14);
});
