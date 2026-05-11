import { describe, expect, test } from 'vitest';

import { buildOpenAIChatCompletionsURL } from './coworkFormatTransform';

describe('buildOpenAIChatCompletionsURL', () => {
  test('uses default OpenAI chat completions endpoint for empty base URL', () => {
    expect(buildOpenAIChatCompletionsURL('')).toBe('/v1/chat/completions');
    expect(buildOpenAIChatCompletionsURL('   ')).toBe('/v1/chat/completions');
  });

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

  test('appends chat completions to versioned OpenAI-compatible endpoints', () => {
    expect(buildOpenAIChatCompletionsURL('https://example.com/v1')).toBe(
      'https://example.com/v1/chat/completions',
    );
    expect(buildOpenAIChatCompletionsURL('https://example.com/v4/')).toBe(
      'https://example.com/v4/chat/completions',
    );
  });

  test('maps Gemini OpenAI-compatible base URLs to v1beta openai chat completions', () => {
    expect(buildOpenAIChatCompletionsURL('https://generativelanguage.googleapis.com')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
    expect(buildOpenAIChatCompletionsURL('https://generativelanguage.googleapis.com/v1')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
    expect(buildOpenAIChatCompletionsURL('https://generativelanguage.googleapis.com/v1beta/openai')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
  });
});
