import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
  },
}));

vi.mock('./coworkOpenAICompatProxy', () => ({
  configureCoworkOpenAICompatProxy: vi.fn(),
  getCoworkOpenAICompatProxyBaseURL: () => 'http://127.0.0.1:12345/v1',
  getCoworkOpenAICompatProxyStatus: () => ({ running: true }),
}));

import {
  resolveAllEnabledProviderConfigs,
  resolveAllProviderApiKeys,
  resolveRawApiConfig,
  setStoreGetter,
} from './claudeSettings';

const createStore = (appConfig: unknown) => ({
  get: (key: string) => (key === 'app_config' ? appConfig : undefined),
});

describe('claudeSettings MiniMax OAuth credentials', () => {
  beforeEach(() => {
    setStoreGetter(() => null);
  });

  test('rejects MiniMax OAuth when login has not completed', () => {
    setStoreGetter(() => createStore({
      model: {
        defaultModel: 'MiniMax-M2.7',
        defaultModelProvider: 'minimax',
      },
      providers: {
        minimax: {
          enabled: true,
          apiKey: 'legacy-api-key',
          baseUrl: 'https://api.minimaxi.com/v1',
          apiFormat: 'anthropic',
          authType: 'oauth',
          models: [{ id: 'MiniMax-M2.7', name: 'MiniMax M2.7' }],
        },
      },
    }) as never);

    const raw = resolveRawApiConfig();
    const envKeys = resolveAllProviderApiKeys();
    const providerConfigs = resolveAllEnabledProviderConfigs();

    expect(raw.config).toBeNull();
    expect(raw.error).toBe('MiniMax OAuth mode selected but login not completed.');
    expect(envKeys).not.toHaveProperty('MINIMAX');
    expect(providerConfigs).toHaveLength(0);
  });

  test('uses MiniMax OAuth access token when login has completed', () => {
    setStoreGetter(() => createStore({
      model: {
        defaultModel: 'MiniMax-M2.7',
        defaultModelProvider: 'minimax',
      },
      providers: {
        minimax: {
          enabled: true,
          apiKey: 'legacy-api-key',
          baseUrl: 'https://api.minimaxi.com/v1',
          apiFormat: 'openai',
          authType: 'oauth',
          oauthAccessToken: 'oauth-access-token',
          oauthBaseUrl: 'https://api.minimaxi.com/anthropic',
          models: [{ id: 'MiniMax-M2.7', name: 'MiniMax M2.7' }],
        },
      },
    }) as never);

    const raw = resolveRawApiConfig();
    const envKeys = resolveAllProviderApiKeys();
    const providerConfigs = resolveAllEnabledProviderConfigs();

    expect(raw.config).toMatchObject({
      apiKey: 'oauth-access-token',
      baseURL: 'https://api.minimaxi.com/anthropic',
      apiType: 'anthropic',
    });
    expect(envKeys.MINIMAX).toBe('oauth-access-token');
    expect(providerConfigs[0]).toMatchObject({
      providerName: 'minimax',
      apiKey: 'oauth-access-token',
      baseURL: 'https://api.minimaxi.com/anthropic',
      apiType: 'anthropic',
    });
  });
});
