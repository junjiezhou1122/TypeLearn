import test from 'node:test';
import assert from 'node:assert/strict';
import { LearningStore, pickAutoChoiceCandidateForSeamlessLearning } from '../src/store.js';

test('adds artifacts to the front of the review history', () => {
  const store = new LearningStore();
  store.add('I has a question.');
  store.add('Please help me polish this sentence.');

  const items = store.list();

  assert.equal(items.length, 2);
  assert.equal(items[0]?.sourceText, 'Please help me polish this sentence.');
  assert.equal(items[1]?.sourceText, 'I has a question.');
});

test('exposes capture records in newest-first order for persisted history', async () => {
  const store = new LearningStore();
  await store.init();
  await store.updateSettings({ baseUrl: '', apiKey: '', model: 'gpt-4.1-mini' });

  const first = await store.addRecord('今天很开心', 'Notes');
  await new Promise(resolve => setTimeout(resolve, 50));
  const second = await store.addRecord('I have a meeting later', 'Xcode');

  const records = store.listRecords();

  // Draft records are inserted newest-first.
  assert.equal(records[0]?.id, second.id);
  assert.equal(records[1]?.id, first.id);
});

test('auto-picks a single clear candidate for seamless learning', async () => {
  const candidate = await pickAutoChoiceCandidateForSeamlessLearning(
    'ni hao',
    [{ intentZh: '你好', enMain: 'hello' }],
    'pinyin',
    { baseUrl: '', apiKey: '', model: 'gpt-4.1-mini' }
  );

  assert.deepEqual(candidate, { intentZh: '你好', enMain: 'hello' });
});

test('auto-picks when candidates are effectively the same meaning', async () => {
  const candidate = await pickAutoChoiceCandidateForSeamlessLearning(
    '想一下',
    [
      { intentZh: '想一下', enMain: 'think about it' },
      { intentZh: '想一下', enMain: 'think about it.' },
    ],
    'zh',
    { baseUrl: '', apiKey: '', model: 'gpt-4.1-mini' }
  );

  assert.deepEqual(candidate, { intentZh: '想一下', enMain: 'think about it' });
});
