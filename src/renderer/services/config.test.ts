import { afterEach, expect, test, vi } from 'vitest';

import { OpenClawProviderId, ProviderName } from '../../shared/providers';
import { CONFIG_KEYS, defaultConfig } from '../config';

const mockStoredConfig = vi.hoisted(() => ({
  value: null as unknown,
  saved: null as unknown,
}));

vi.mock('./store', () => ({
  localStore: {
    getItem: vi.fn(async (key: string) => (
      key === CONFIG_KEYS.APP_CONFIG ? mockStoredConfig.value : null
    )),
    setItem: vi.fn(async (_key: string, value: unknown) => {
      mockStoredConfig.saved = value;
    }),
    removeItem: vi.fn(),
  },
}));

afterEach(() => {
  mockStoredConfig.value = null;
  mockStoredConfig.saved = null;
  vi.resetModules();
});

test('configService fills missing provider model names from model ids', async () => {
  const defaultProviders = defaultConfig.providers!;
  mockStoredConfig.value = {
    ...defaultConfig,
    providers: {
      ...defaultProviders,
      openai: {
        ...defaultProviders.openai,
        models: [
          { id: 'custom-openai-model' },
        ],
      },
    },
  };

  const { configService } = await import('./config');
  await configService.init();

  expect(configService.getConfig().providers!.openai.models?.find(
    (model) => model.id === 'custom-openai-model',
  )?.name).toBe('custom-openai-model');
});

test('configService preserves model-level OpenClaw provider ids', async () => {
  const defaultProviders = defaultConfig.providers!;
  mockStoredConfig.value = {
    ...defaultConfig,
    providers: {
      ...defaultProviders,
      openai: {
        ...defaultProviders.openai,
        models: [
          {
            id: 'gpt-5.3-codex',
            name: 'GPT-5.3 Codex',
            supportsImage: true,
            openClawProviderId: OpenClawProviderId.OpenAICodex,
          },
        ],
      },
    },
  };

  const { configService } = await import('./config');
  await configService.init();

  expect(configService.getConfig().providers!.openai.models?.find(
    (model) => model.id === 'gpt-5.3-codex',
  )?.openClawProviderId).toBe(OpenClawProviderId.OpenAICodex);
});

test('configService updateConfig preserves stored providers when applying partial updates', async () => {
  const defaultProviders = defaultConfig.providers!;
  mockStoredConfig.value = {
    ...defaultConfig,
    providers: {
      ...defaultProviders,
      openai: {
        ...defaultProviders.openai,
        apiKey: 'stored-openai-key',
        models: [
          { id: 'stored-only-model', name: 'Stored Only Model', supportsImage: false },
        ],
      },
    },
  };

  const { configService } = await import('./config');
  await configService.updateConfig({
    model: {
      ...defaultConfig.model,
      defaultModel: 'stored-only-model',
    },
  });

  const savedConfig = mockStoredConfig.saved as typeof defaultConfig;
  expect(savedConfig.providers!.openai.apiKey).toBe('stored-openai-key');
  expect(savedConfig.providers!.openai.models?.map((model) => model.id)).toContain('stored-only-model');
});

test('configService preserves MiniMax OAuth runtime fields', async () => {
  const defaultProviders = defaultConfig.providers!;
  mockStoredConfig.value = {
    ...defaultConfig,
    providers: {
      ...defaultProviders,
      minimax: {
        ...defaultProviders.minimax,
        authType: 'oauth',
        oauthAccessToken: 'oauth-access-token',
        oauthBaseUrl: 'https://api.minimaxi.com/anthropic',
        oauthRefreshToken: 'oauth-refresh-token',
        oauthTokenExpiresAt: 1234567890,
      },
    },
  };

  const { configService } = await import('./config');
  await configService.init();

  expect(configService.getConfig().providers!.minimax.oauthAccessToken).toBe('oauth-access-token');
  expect(configService.getConfig().providers!.minimax.oauthBaseUrl).toBe('https://api.minimaxi.com/anthropic');
  expect(configService.getConfig().providers!.minimax.oauthRefreshToken).toBe('oauth-refresh-token');
});

test('configService normalizes fixed provider api formats from provider registry', async () => {
  const defaultProviders = defaultConfig.providers!;
  mockStoredConfig.value = {
    ...defaultConfig,
    providers: {
      ...defaultProviders,
      [ProviderName.Qianfan]: {
        ...defaultProviders[ProviderName.Qianfan],
        apiFormat: 'anthropic',
      },
      [ProviderName.Copilot]: {
        ...defaultProviders[ProviderName.Copilot],
        apiFormat: 'anthropic',
      },
      [ProviderName.Moonshot]: {
        ...defaultProviders[ProviderName.Moonshot],
        apiFormat: 'anthropic',
      },
    },
  };

  const { configService } = await import('./config');
  await configService.init();

  expect(configService.getConfig().providers![ProviderName.Qianfan].apiFormat).toBe('openai');
  expect(configService.getConfig().providers![ProviderName.Copilot].apiFormat).toBe('openai');
  expect(configService.getConfig().providers![ProviderName.Moonshot].apiFormat).toBe('openai');
});
