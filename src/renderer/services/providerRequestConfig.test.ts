import { describe, expect, test } from 'vitest';

import { ProviderName } from '../../shared/providers';
import {
  buildOpenAICompatibleChatCompletionsUrl,
  buildOpenAIResponsesUrl,
  getEffectiveProviderApiFormat,
  getFixedApiFormatForProvider,
  resolveProviderRequestCredential,
  shouldShowProviderApiFormatSelector,
  shouldUseMaxCompletionTokensForOpenAI,
  shouldUseOpenAIResponsesForProvider,
} from './providerRequestConfig';

describe('providerRequestConfig', () => {
  test('forces fixed formats for special providers', () => {
    expect(getFixedApiFormatForProvider(ProviderName.OpenAI)).toBe('openai');
    expect(getFixedApiFormatForProvider(ProviderName.Copilot)).toBe('openai');
    expect(getFixedApiFormatForProvider(ProviderName.Moonshot)).toBe('openai');
    expect(getFixedApiFormatForProvider(ProviderName.Anthropic)).toBe('anthropic');
    expect(getFixedApiFormatForProvider(ProviderName.Gemini)).toBe('gemini');
    expect(getFixedApiFormatForProvider(ProviderName.Qianfan)).toBe('openai');
    expect(getFixedApiFormatForProvider(ProviderName.StepFun)).toBe('openai');
    expect(getFixedApiFormatForProvider(ProviderName.Youdaozhiyun)).toBe('openai');
  });

  test('falls back to selected format for switchable providers', () => {
    expect(getEffectiveProviderApiFormat(ProviderName.DeepSeek, 'openai')).toBe('openai');
    expect(getEffectiveProviderApiFormat(ProviderName.DeepSeek, 'anthropic')).toBe('anthropic');
    expect(shouldShowProviderApiFormatSelector(ProviderName.DeepSeek)).toBe(true);
    expect(shouldShowProviderApiFormatSelector(ProviderName.Ollama)).toBe(true);
    expect(shouldShowProviderApiFormatSelector(ProviderName.LmStudio)).toBe(true);
    expect(shouldShowProviderApiFormatSelector(ProviderName.OpenAI)).toBe(false);
    expect(shouldShowProviderApiFormatSelector(ProviderName.Copilot)).toBe(false);
  });

  test('uses oauth credential ahead of legacy api key', () => {
    expect(resolveProviderRequestCredential(ProviderName.OpenAI, {
      apiKey: ' legacy-key ',
      baseUrl: 'https://api.openai.com/v1',
      apiFormat: 'openai',
      authType: 'oauth',
      oauthAccessToken: ' oauth-token ',
      oauthBaseUrl: ' https://oauth.example.com/v1 ',
    })).toEqual({
      apiKey: 'oauth-token',
      baseUrl: 'https://oauth.example.com/v1',
      apiFormat: 'openai',
    });
  });

  test('forces MiniMax oauth requests to Anthropic format', () => {
    expect(resolveProviderRequestCredential(ProviderName.Minimax, {
      apiKey: 'legacy-key',
      baseUrl: 'https://api.minimax.io/v1',
      apiFormat: 'openai',
      authType: 'oauth',
      oauthAccessToken: ' oauth-token ',
      oauthBaseUrl: 'https://api.minimax.io/anthropic',
    })).toEqual({
      apiKey: 'oauth-token',
      baseUrl: 'https://api.minimax.io/anthropic',
      apiFormat: 'anthropic',
    });
  });

  test('builds Copilot chat completions url without forcing /v1 prefix', () => {
    expect(buildOpenAICompatibleChatCompletionsUrl('https://api.individual.githubcopilot.com', ProviderName.Copilot))
      .toBe('https://api.individual.githubcopilot.com/chat/completions');
  });

  test('builds Gemini OpenAI-compatible endpoint correctly', () => {
    expect(buildOpenAICompatibleChatCompletionsUrl('https://generativelanguage.googleapis.com/v1', ProviderName.Gemini))
      .toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(buildOpenAICompatibleChatCompletionsUrl('https://generativelanguage.googleapis.com/v1beta/openai', ProviderName.Gemini))
      .toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(buildOpenAICompatibleChatCompletionsUrl('https://generativelanguage.googleapis.com', ProviderName.Gemini))
      .toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
  });

  test('builds local OpenAI-compatible endpoints without duplicating v1', () => {
    expect(buildOpenAICompatibleChatCompletionsUrl('http://localhost:1234/v1', ProviderName.LmStudio))
      .toBe('http://localhost:1234/v1/chat/completions');
    expect(buildOpenAICompatibleChatCompletionsUrl('http://localhost:11434/v1/chat/completions', ProviderName.Ollama))
      .toBe('http://localhost:11434/v1/chat/completions');
  });

  test('builds responses url for openai-style providers', () => {
    expect(buildOpenAIResponsesUrl('')).toBe('/v1/responses');
    expect(buildOpenAIResponsesUrl('https://api.openai.com')).toBe('https://api.openai.com/v1/responses');
    expect(buildOpenAIResponsesUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/responses');
    expect(buildOpenAIResponsesUrl('https://api.openai.com/v1/responses')).toBe('https://api.openai.com/v1/responses');
    expect(buildOpenAIResponsesUrl('https://api.openai.com/v1/responses/')).toBe('https://api.openai.com/v1/responses');
    expect(shouldUseOpenAIResponsesForProvider(ProviderName.OpenAI)).toBe(true);
    expect(shouldUseOpenAIResponsesForProvider(ProviderName.Copilot)).toBe(false);
  });

  test('detects models that require max_completion_tokens', () => {
    expect(shouldUseMaxCompletionTokensForOpenAI(ProviderName.OpenAI, 'gpt-5-mini')).toBe(true);
    expect(shouldUseMaxCompletionTokensForOpenAI(ProviderName.OpenAI, 'openai/o3')).toBe(true);
    expect(shouldUseMaxCompletionTokensForOpenAI(ProviderName.OpenAI, ' openai/o4-mini ')).toBe(true);
    expect(shouldUseMaxCompletionTokensForOpenAI(ProviderName.OpenAI, 'gpt-4.1')).toBe(false);
    expect(shouldUseMaxCompletionTokensForOpenAI(ProviderName.Copilot, 'gpt-5')).toBe(false);
  });
});
