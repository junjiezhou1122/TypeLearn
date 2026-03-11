import test from 'node:test';
import assert from 'node:assert/strict';
import { LearningStore } from '../src/store.js';

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
  await store.updateSettings({ baseUrl: '', apiKey: '', model: 'gpt-4.1-mini' });
  const first = await store.addRecord('今天很开心', 'Notes');
  const second = await store.addRecord('I have a meeting later', 'Xcode');

  const records = store.listRecords();

  assert.equal(records[0]?.id, second.id);
  assert.equal(records[1]?.id, first.id);
});
