import { describe, expect, test } from 'vitest';

import { buildAssistantMetadataItems, getAssistantMessageModelLabel } from './assistantMetadata';

describe('assistantMetadata', () => {
  test('uses the model id tail as the display label', () => {
    expect(getAssistantMessageModelLabel({ model: 'openai/gpt-5-mini' })).toBe('gpt-5-mini');
    expect(getAssistantMessageModelLabel({ model: 'deepseek-v4-flash' })).toBe('deepseek-v4-flash');
  });

  test('hides cache read metadata when the value is zero', () => {
    expect(buildAssistantMetadataItems({
      usage: {
        inputTokens: 1000,
        outputTokens: 2000,
        cacheReadTokens: 0,
      },
    })).toEqual(['Tokens 1k in / 2k out']);
  });

  test('does not expose agent name in assistant metadata items', () => {
    expect(buildAssistantMetadataItems({
      model: 'openai/gpt-5-mini',
      contextPercent: 42,
      agentName: 'Hidden Agent',
      usage: {
        inputTokens: 1000,
        outputTokens: 2000,
        cacheReadTokens: 3000,
      },
    })).toEqual([
      'Model gpt-5-mini',
      'Tokens 1k in / 2k out',
      'Cache read 3k',
      'Ctx 42%',
    ]);
  });
});
