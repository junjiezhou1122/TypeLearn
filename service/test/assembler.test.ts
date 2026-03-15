import test from 'node:test';
import assert from 'node:assert/strict';
import { LearningStore } from '../src/store.js';

// This test focuses on the watermark behavior: fragments should not immediately
// become committed records; they should stay as draft until older than L=20s.

test('stream assembler delays commit by watermark (L=20s)', async () => {
  const store = new LearningStore();
  await store.init();

  const r1 = await store.addRecord('Hello', 'Notes');
  assert.equal(r1.pipelineStage, 'draft');

  // Immediately after ingest there should be only the draft record.
  const recordsNow = store.listRecords();
  assert.ok(recordsNow.some((r) => r.pipelineStage === 'draft'));
  assert.ok(!recordsNow.some((r) => r.pipelineStage === 'committed' && r.sourceText.includes('Hello')));

  // Wait past watermark.
  await new Promise((resolve) => setTimeout(resolve, 21_500));

  // Give the periodic assembler tick a chance.
  await new Promise((resolve) => setTimeout(resolve, 6_000));

  const recordsLater = store.listRecords();
  assert.ok(recordsLater.some((r) => r.pipelineStage === 'committed' && r.sourceText.includes('Hello')));
});
