import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDayDigest } from '../src/digest.js';
import { generateStoryFromDigest } from '../src/story.js';

test('builds a fallback story from a day digest', async () => {
  const createdAt = new Date().toISOString();
  const day = createdAt.slice(0, 10);
  const digest = buildDayDigest(day, [
    {
      id: '1',
      sourceText: '今天我很开心',
      restoredText: null,
      englishText: 'Today I feel very happy.',
      sourceLanguage: 'chinese',
      sourceApp: 'Notes',
      createdAt,
      status: 'done',
      retryCount: 0,
      lastError: null,
      pipelineStage: 'committed',
      intentZh: '表达开心',
      enTemplates: ['I feel very happy today.'],
      patternKeys: ['tone:positive_opening'],
    },
  ], {});

  const story = await generateStoryFromDigest(digest, {
    baseUrl: '',
    apiKey: '',
    model: 'gpt-4.1-mini',
  });

  assert.equal(story.day, day);
  assert.equal(story.title, "Today's Story");
  assert.match(story.summary, /learning day/i);
  assert.match(story.story, /Steal these lines/);
  assert.deepEqual(story.stealLines, ['I feel very happy today.', 'Today I feel very happy.']);
});
