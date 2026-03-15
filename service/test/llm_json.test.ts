import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonFromText } from '../src/llm.js';

test('extractJsonFromText parses fenced JSON', () => {
  const value = extractJsonFromText('```json\n{"ok":true,"n":1}\n```');
  assert.deepEqual(value, { ok: true, n: 1 });
});

test('extractJsonFromText parses JSON inside extra text', () => {
  const value = extractJsonFromText('Sure. Here is the result:\n{ "a": [1,2,3], "b": "x" }\nThanks');
  assert.deepEqual(value, { a: [1, 2, 3], b: 'x' });
});

test('extractJsonFromText parses JSON array', () => {
  const value = extractJsonFromText('prefix\n[1,2,{"x":3}]\n');
  assert.deepEqual(value, [1, 2, { x: 3 }]);
});
