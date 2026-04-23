import { describe, expect, test } from 'vitest';

import { ProviderName } from '../../shared/providers';
import {
  buildOpenAICompatibleChatCompletionsUrl,
  buildOpenAIResponsesUrl,
  getEffectiveProviderApiFormat,
  getFixedApiFormatForProvider,
  shouldShowProviderApiFormatSelector,
  shouldUseMaxCompletionTokensForOpenAI,
  shouldUseOpenAIResponsesForProvider,
} from './providerRequestConfig';

describe('providerRequestConfig', () => {
  test('forces fixed formats for special providers', () => {
    expect(getFixedApiFormatForProvider(ProviderName.Copilot)).toBe('openai');
    expect(getFixedApiFormatForProvider(ProviderName.Moonshot)).toBe('openai');
    expect(getFixedApiFormatForProvider(ProviderName.Anthropic)).toBe('anthropic');
    expect(getFixedApiFormatForProvider(ProviderName.Gemini)).toBe('gemini');
  });

  test('falls back to selected format for switchable providers', () => {
    expect(getEffectiveProviderApiFormat(ProviderName.DeepSeek, 'openai')).toBe('openai');
    expect(getEffectiveProviderApiFormat(ProviderName.DeepSeek, 'anthropic')).toBe('anthropic');
    expect(shouldShowProviderApiFormatSelector(ProviderName.DeepSeek)).toBe(true);
    expect(shouldShowProviderApiFormatSelector(ProviderName.Copilot)).toBe(false);
  });

  test('builds Copilot chat completions url without forcing /v1 prefix', () => {
    expect(buildOpenAICompatibleChatCompletionsUrl('https://api.individual.githubcopilot.com', ProviderName.Copilot))
      .toBe('https://api.individual.githubcopilot.com/chat/completions');
  });

  test('builds Gemini OpenAI-compatible endpoint correctly', () => {
    expect(buildOpenAICompatibleChatCompletionsUrl('https://generativelanguage.googleapis.com/v1', ProviderName.Gemini))
      .toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
  });

  test('builds responses url for openai-style providers', () => {
    expect(buildOpenAIResponsesUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/responses');
    expect(shouldUseOpenAIResponsesForProvider(ProviderName.OpenAI)).toBe(true);
    expect(shouldUseOpenAIResponsesForProvider(ProviderName.Copilot)).toBe(false);
  });

  test('detects models that require max_completion_tokens', () => {
    expect(shouldUseMaxCompletionTokensForOpenAI(ProviderName.OpenAI, 'gpt-5-mini')).toBe(true);
    expect(shouldUseMaxCompletionTokensForOpenAI(ProviderName.OpenAI, 'openai/o3')).toBe(true);
    expect(shouldUseMaxCompletionTokensForOpenAI(ProviderName.OpenAI, 'gpt-4.1')).toBe(false);
    expect(shouldUseMaxCompletionTokensForOpenAI(ProviderName.Copilot, 'gpt-5')).toBe(false);
  });
});
