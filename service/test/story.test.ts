import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDailyStory } from '../src/story.js';

test('builds a fallback story from today\'s translated records', async () => {
  const story = await generateDailyStory([
    {
      id: '1',
      sourceText: '今天我很开心',
      restoredText: null,
      englishText: 'Today I feel very happy.',
      sourceLanguage: 'chinese',
      sourceApp: 'Notes',
      createdAt: new Date().toISOString(),
      status: 'done',
      retryCount: 0,
      lastError: null,
      pipelineStage: 'committed',
    },
  ], {
    baseUrl: '',
    apiKey: '',
    model: 'gpt-4.1-mini',
  });

  assert.equal(story.title, "Today's Story");
  assert.match(story.story, /Today I feel very happy/);
  assert.match(story.story, /Steal these lines/);
});
