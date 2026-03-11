import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguage, translateToEnglish } from '../src/translator.js';

test('detects chinese text', () => {
  assert.equal(detectLanguage('今天我很开心'), 'chinese');
});

test('falls back safely when no remote translator is configured', async () => {
  const result = await translateToEnglish('今天我很开心', {
    baseUrl: '',
    apiKey: '',
    model: 'gpt-4.1-mini',
  });

  assert.equal(result.sourceLanguage, 'chinese');
  assert.match(result.englishText, /Translation pending/);
});
