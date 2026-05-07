import { describe, expect, test } from 'vitest';

import { rewriteRenamedProviderModelRef } from './agentManager';

describe('rewriteRenamedProviderModelRef', () => {
  test('rewrites stale provider prefix while preserving model id', () => {
    expect(rewriteRenamedProviderModelRef(
      'github-copilot/gpt-5.3-codex',
      { 'github-copilot': 'lobsterai-copilot' },
    )).toBe('lobsterai-copilot/gpt-5.3-codex');
  });

  test('leaves current provider prefix unchanged', () => {
    expect(rewriteRenamedProviderModelRef(
      'lobsterai-copilot/gpt-5.3-codex',
      { 'github-copilot': 'lobsterai-copilot' },
    )).toBe('lobsterai-copilot/gpt-5.3-codex');
  });

  test('leaves bare model ids unchanged', () => {
    expect(rewriteRenamedProviderModelRef(
      'gpt-5.3-codex',
      { 'github-copilot': 'lobsterai-copilot' },
    )).toBe('gpt-5.3-codex');
  });
});
