import { describe, expect, test } from 'vitest';

import { buildOpenAIChatCompletionsURL } from './coworkFormatTransform';

describe('buildOpenAIChatCompletionsURL', () => {
  test('uses the Copilot chat completions endpoint without adding v1', () => {
    expect(buildOpenAIChatCompletionsURL('https://api.individual.githubcopilot.com')).toBe(
      'https://api.individual.githubcopilot.com/chat/completions',
    );
  });

  test('keeps existing chat completions endpoint unchanged', () => {
    expect(buildOpenAIChatCompletionsURL('https://example.com/v1/chat/completions')).toBe(
      'https://example.com/v1/chat/completions',
    );
  });
});
