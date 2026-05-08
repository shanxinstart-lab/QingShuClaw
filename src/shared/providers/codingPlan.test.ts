import { test, expect, describe } from 'vitest';
import { resolveCodingPlanBaseUrl } from './codingPlan';
import { ProviderName, ProviderRegistry } from './constants';

describe('resolveCodingPlanBaseUrl', () => {
  test('returns currentBaseUrl unchanged when codingPlanEnabled is false', () => {
    const result = resolveCodingPlanBaseUrl(ProviderName.Zhipu, false, 'anthropic', 'https://custom.url');
    expect(result.baseUrl).toBe('https://custom.url');
    expect(result.effectiveFormat).toBe('anthropic');
  });

  test('returns currentBaseUrl unchanged for provider without codingPlan support', () => {
    const result = resolveCodingPlanBaseUrl(ProviderName.OpenAI, true, 'openai', 'https://api.openai.com/v1');
    expect(result.baseUrl).toBe('https://api.openai.com/v1');
    expect(result.effectiveFormat).toBe('openai');
  });

  test('falls back to currentBaseUrl when the preferred coding plan URL is missing', () => {
    const def = ProviderRegistry.get(ProviderName.Qwen);
    if (!def?.codingPlanUrls) {
      throw new Error('Qwen coding plan fixture is missing');
    }
    const originalAnthropicUrl = def.codingPlanUrls.anthropic;
    (def.codingPlanUrls as { anthropic: string }).anthropic = '';
    try {
      const result = resolveCodingPlanBaseUrl(ProviderName.Qwen, true, 'anthropic', 'https://custom.qwen.example');
      expect(result.baseUrl).toBe('https://custom.qwen.example');
      expect(result.effectiveFormat).toBe('anthropic');
    } finally {
      (def.codingPlanUrls as { anthropic: string }).anthropic = originalAnthropicUrl;
    }
  });

  describe('Zhipu — preferredCodingPlanFormat=openai', () => {
    test('forces openai URL even when caller passes anthropic format', () => {
      const result = resolveCodingPlanBaseUrl(ProviderName.Zhipu, true, 'anthropic', 'https://open.bigmodel.cn/api/anthropic');
      expect(result.baseUrl).toBe('https://open.bigmodel.cn/api/coding/paas/v4');
      expect(result.effectiveFormat).toBe('openai');
    });

    test('uses openai URL when caller also passes openai format', () => {
      const result = resolveCodingPlanBaseUrl(ProviderName.Zhipu, true, 'openai', 'https://open.bigmodel.cn/api/paas/v4');
      expect(result.baseUrl).toBe('https://open.bigmodel.cn/api/coding/paas/v4');
      expect(result.effectiveFormat).toBe('openai');
    });
  });

  describe('Moonshot — preferredCodingPlanFormat: anthropic', () => {
    test('returns anthropic coding plan URL when caller passes anthropic', () => {
      const result = resolveCodingPlanBaseUrl(ProviderName.Moonshot, true, 'anthropic', '');
      expect(result.baseUrl).toBe('https://api.kimi.com/coding');
      expect(result.effectiveFormat).toBe('anthropic');
    });

    test('overrides caller openai format to anthropic', () => {
      const result = resolveCodingPlanBaseUrl(ProviderName.Moonshot, true, 'openai', '');
      expect(result.baseUrl).toBe('https://api.kimi.com/coding');
      expect(result.effectiveFormat).toBe('anthropic');
    });
  });

  describe('Volcengine — no preferredCodingPlanFormat', () => {
    test('returns anthropic coding plan URL', () => {
      const result = resolveCodingPlanBaseUrl(ProviderName.Volcengine, true, 'anthropic', '');
      expect(result.baseUrl).toBe('https://ark.cn-beijing.volces.com/api/coding');
      expect(result.effectiveFormat).toBe('anthropic');
    });

    test('returns openai coding plan URL', () => {
      const result = resolveCodingPlanBaseUrl(ProviderName.Volcengine, true, 'openai', '');
      expect(result.baseUrl).toBe('https://ark.cn-beijing.volces.com/api/coding/v3');
      expect(result.effectiveFormat).toBe('openai');
    });
  });

  describe('Qwen — no preferredCodingPlanFormat', () => {
    test('returns anthropic coding plan URL', () => {
      const result = resolveCodingPlanBaseUrl(ProviderName.Qwen, true, 'anthropic', '');
      expect(result.baseUrl).toBe('https://coding.dashscope.aliyuncs.com/apps/anthropic');
      expect(result.effectiveFormat).toBe('anthropic');
    });

    test('returns openai coding plan URL', () => {
      const result = resolveCodingPlanBaseUrl(ProviderName.Qwen, true, 'openai', '');
      expect(result.baseUrl).toBe('https://coding.dashscope.aliyuncs.com/v1');
      expect(result.effectiveFormat).toBe('openai');
    });
  });
});
