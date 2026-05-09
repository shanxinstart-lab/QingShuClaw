import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { shouldKeepBundledExtension } = require('../scripts/prune-openclaw-runtime.cjs');

test('pruneOpenClawRuntime keeps required bundled extensions', () => {
  assert.equal(shouldKeepBundledExtension('openai'), true);
  assert.equal(shouldKeepBundledExtension('browser'), true);
  assert.equal(shouldKeepBundledExtension('feishu'), true);
});

test('pruneOpenClawRuntime removes explicitly unwanted bundled extensions', () => {
  assert.equal(shouldKeepBundledExtension('amazon-bedrock'), false);
  assert.equal(shouldKeepBundledExtension('amazon-bedrock-mantle'), false);
  assert.equal(shouldKeepBundledExtension('slack'), false);
  assert.equal(shouldKeepBundledExtension('diffs'), false);
});
