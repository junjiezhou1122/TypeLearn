import test from 'node:test';
import assert from 'node:assert/strict';
import { canSendRemoteContent, getSupportedProviderModes } from '../src/provider.js';

test('lists the supported provider modes for the MVP contract', () => {
  assert.deepEqual(getSupportedProviderModes(), ['local', 'byok-remote', 'custom-base-url']);
});

test('local mode never allows remote content transfer', () => {
  assert.equal(canSendRemoteContent({ mode: 'local' }), false);
  assert.equal(canSendRemoteContent({ mode: 'byok-remote' }), true);
});
