import {
  AppConfig,
  CONFIG_KEYS,
  DEFAULT_SPEECH_INPUT_CONFIG,
  DEFAULT_TTS_CONFIG,
  DEFAULT_VOICE_POST_PROCESS_CONFIG,
  DEFAULT_WAKE_INPUT_CONFIG,
  defaultConfig,
  isCustomProvider,
} from '../config';
import { localStore } from './store';

const getFixedProviderApiFormat = (providerKey: string): 'anthropic' | 'openai' | 'gemini' | null => {
  if (providerKey === 'openai' || providerKey === 'stepfun' || providerKey === 'youdaozhiyun') {
    return 'openai';
  }
  if (providerKey === 'anthropic') {
    return 'anthropic';
  }
  if (providerKey === 'gemini') {
    return 'gemini';
  }
  return null;
};

const normalizeProviderBaseUrl = (providerKey: string, baseUrl: unknown): string => {
  if (typeof baseUrl !== 'string') {
    return '';
  }

  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (providerKey !== 'gemini') {
    return normalized;
  }

  if (!normalized || !normalized.includes('generativelanguage.googleapis.com')) {
    return normalized;
  }

  // Strip the /openai suffix for native Gemini API
  if (normalized.endsWith('/v1beta/openai')) {
    return normalized.slice(0, -'/openai'.length);
  }
  if (normalized.endsWith('/v1/openai')) {
    return normalized.slice(0, -'/openai'.length);
  }
  if (normalized.endsWith('/v1beta')) {
    return normalized;
  }
  if (normalized.endsWith('/v1')) {
    return `${normalized.slice(0, -3)}v1beta`;
  }

  return 'https://generativelanguage.googleapis.com/v1beta';
};

const normalizeProviderApiFormat = (providerKey: string, apiFormat: unknown): 'anthropic' | 'openai' | 'gemini' => {
  const fixed = getFixedProviderApiFormat(providerKey);
  if (fixed) {
    return fixed;
  }
  if (apiFormat === 'openai') {
    return 'openai';
  }
  return 'anthropic';
};

const normalizeProvidersConfig = (providers: AppConfig['providers']): AppConfig['providers'] => {
  if (!providers) {
    return providers;
  }

  return Object.fromEntries(
    Object.entries(providers).map(([providerKey, providerConfig]) => [
      providerKey,
      {
        ...providerConfig,
        baseUrl: normalizeProviderBaseUrl(providerKey, providerConfig.baseUrl),
        apiFormat: normalizeProviderApiFormat(providerKey, providerConfig.apiFormat),
      },
    ])
  ) as AppConfig['providers'];
};

const mergeSpeechInputConfig = (
  speechInput?: AppConfig['speechInput']
): NonNullable<AppConfig['speechInput']> => ({
  ...DEFAULT_SPEECH_INPUT_CONFIG,
  ...(speechInput ?? {}),
});

const mergeWakeInputConfig = (
  wakeInput?: AppConfig['wakeInput'] & { wakeWord?: string }
): NonNullable<AppConfig['wakeInput']> => {
  const normalizedWakeWords = Array.isArray(wakeInput?.wakeWords)
    ? wakeInput.wakeWords
      .map((wakeWord) => typeof wakeWord === 'string' ? wakeWord.trim() : '')
      .filter((wakeWord, index, items) => Boolean(wakeWord) && items.indexOf(wakeWord) === index)
    : [];
  const legacyWakeWord = typeof wakeInput?.wakeWord === 'string'
    ? wakeInput.wakeWord.trim()
    : '';

  return {
    ...DEFAULT_WAKE_INPUT_CONFIG,
    ...(wakeInput ?? {}),
    wakeWords: normalizedWakeWords.length > 0
      ? normalizedWakeWords
      : legacyWakeWord
        ? [legacyWakeWord]
        : [...DEFAULT_WAKE_INPUT_CONFIG.wakeWords],
  };
};

const mergeTtsConfig = (
  tts?: AppConfig['tts']
): NonNullable<AppConfig['tts']> => ({
  ...DEFAULT_TTS_CONFIG,
  ...(tts ?? {}),
});

const mergeVoicePostProcessConfig = (
  postProcess?: NonNullable<NonNullable<AppConfig['voice']>['postProcess']>
): NonNullable<NonNullable<AppConfig['voice']>['postProcess']> => {
  const nextKeywords = Array.isArray(postProcess?.ttsSkipKeywords)
    ? postProcess.ttsSkipKeywords
      .map((keyword) => typeof keyword === 'string' ? keyword.trim() : '')
      .filter((keyword, index, items) => Boolean(keyword) && items.indexOf(keyword) === index)
    : DEFAULT_VOICE_POST_PROCESS_CONFIG.ttsSkipKeywords;

  return {
    ...DEFAULT_VOICE_POST_PROCESS_CONFIG,
    ...(postProcess ?? {}),
    ttsSkipKeywords: nextKeywords,
  };
};

/**
 * Migrate legacy single `custom` provider to `custom_0`.
 */
const migrateCustomProviders = (config: AppConfig): AppConfig => {
  const providers = config.providers;
  if (!providers) return config;

  // Migrate legacy `custom` key (without underscore) to `custom_0`
  if ('custom' in providers && !isCustomProvider('custom')) {
    const legacyCustom = providers['custom'];
    if (legacyCustom) {
      const updatedProviders = { ...providers };
      updatedProviders['custom_0'] = { ...legacyCustom };
      delete updatedProviders['custom'];
      return {
        ...config,
        providers: updatedProviders as AppConfig['providers'],
      };
    }
  }

  return config;
};

// Model IDs that have been removed from specific providers.
// These will be filtered out from saved configs during migration.
const REMOVED_PROVIDER_MODELS: Record<string, string[]> = {
  deepseek: ['deepseek-chat'],
  openai: ['gpt-5.2-2025-12-11'],
};

// Models to inject into existing saved configs (for existing users).
// These models will be added on every startup if missing from the stored config.
// Note: users cannot permanently remove these models — they will be re-injected
// on next launch. Once all users have upgraded, entries here should be removed
// so the models follow normal user-editable behavior (same as other models).
// position: 'start' inserts at the beginning, 'end' appends at the end.
const ADDED_PROVIDER_MODELS: Record<string, { models: Array<{ id: string; name: string; supportsImage?: boolean }>; position: 'start' | 'end' }> = {
  minimax: {
    models: [
      { id: 'MiniMax-M2.7', name: 'MiniMax M2.7', supportsImage: false },
    ],
    position: 'start',
  },
  openai: {
    models: [
      { id: 'gpt-5.4', name: 'GPT-5.4', supportsImage: true },
      { id: 'gpt-5.2', name: 'GPT-5.2', supportsImage: true },
      { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', supportsImage: true },
    ],
    position: 'start',
  },
};

class ConfigService {
  private config: AppConfig = defaultConfig;

  async init() {
    try {
      const storedConfig = await localStore.getItem<AppConfig>(CONFIG_KEYS.APP_CONFIG);
      if (storedConfig) {
        const mergedProviders = storedConfig.providers
          ? Object.fromEntries(
              Object.entries({
                ...(defaultConfig.providers ?? {}),
                ...storedConfig.providers,
              }).map(([providerKey, providerConfig]) => [
                providerKey,
                (() => {
                  const mergedProvider = {
                    ...(defaultConfig.providers as Record<string, any>)?.[providerKey],
                    ...providerConfig,
                  };
                  // Filter out removed models
                  const removedIds = REMOVED_PROVIDER_MODELS[providerKey];
                  if (removedIds && mergedProvider.models) {
                    mergedProvider.models = mergedProvider.models.filter(
                      (m: { id: string }) => !removedIds.includes(m.id)
                    );
                  }
                  // Inject added models (for existing users who already have saved config)
                  const addedConfig = ADDED_PROVIDER_MODELS[providerKey];
                  if (addedConfig && mergedProvider.models) {
                    const existingIds = new Set(mergedProvider.models.map((m: { id: string }) => m.id));
                    const newModels = addedConfig.models.filter(m => !existingIds.has(m.id));
                    if (newModels.length > 0) {
                      mergedProvider.models = addedConfig.position === 'start'
                        ? [...newModels, ...mergedProvider.models]
                        : [...mergedProvider.models, ...newModels];
                    }
                  }
                  return {
                    ...mergedProvider,
                    baseUrl: normalizeProviderBaseUrl(providerKey, mergedProvider.baseUrl),
                    apiFormat: normalizeProviderApiFormat(providerKey, mergedProvider.apiFormat),
                  };
                })(),
              ])
            )
          : defaultConfig.providers;

        // Migrate model.defaultModel if it was removed
        const allRemovedIds = Object.values(REMOVED_PROVIDER_MODELS).flat();
        const migratedModel = { ...defaultConfig.model, ...storedConfig.model };
        if (allRemovedIds.includes(migratedModel.defaultModel)) {
          migratedModel.defaultModel = defaultConfig.model.defaultModel;
        }
        if (migratedModel.availableModels) {
          migratedModel.availableModels = migratedModel.availableModels.filter(
            (m: { id: string }) => !allRemovedIds.includes(m.id)
          );
        }

        this.config = migrateCustomProviders({
          ...defaultConfig,
          ...storedConfig,
          api: {
            ...defaultConfig.api,
            ...storedConfig.api,
          },
          model: migratedModel,
          app: {
            ...defaultConfig.app,
            ...storedConfig.app,
          },
          shortcuts: {
            ...defaultConfig.shortcuts!,
            ...(storedConfig.shortcuts ?? {}),
          } as AppConfig['shortcuts'],
          speechInput: mergeSpeechInputConfig(storedConfig.speechInput),
          wakeInput: mergeWakeInputConfig(storedConfig.wakeInput),
          tts: mergeTtsConfig(storedConfig.tts),
          voice: {
            postProcess: mergeVoicePostProcessConfig(storedConfig.voice?.postProcess),
          },
          providers: mergedProviders as AppConfig['providers'],
        });
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  getConfig(): AppConfig {
    return this.config;
  }

  async updateConfig(newConfig: Partial<AppConfig>) {
    const normalizedProviders = normalizeProvidersConfig(newConfig.providers as AppConfig['providers'] | undefined);
    const mergedSpeechInput = newConfig.speechInput
      ? mergeSpeechInputConfig({
          ...this.config.speechInput,
          ...newConfig.speechInput,
        })
      : this.config.speechInput;
    const mergedWakeInput = newConfig.wakeInput
      ? mergeWakeInputConfig({
          ...this.config.wakeInput,
          ...newConfig.wakeInput,
        })
      : this.config.wakeInput;
    const mergedTts = newConfig.tts
      ? mergeTtsConfig({
          ...this.config.tts,
          ...newConfig.tts,
        })
      : this.config.tts;
    const mergedVoice = newConfig.voice
      ? {
          postProcess: mergeVoicePostProcessConfig({
            ...this.config.voice?.postProcess,
            ...newConfig.voice.postProcess,
          }),
        }
      : this.config.voice;

    this.config = {
      ...this.config,
      ...newConfig,
      ...(normalizedProviders ? { providers: normalizedProviders } : {}),
      ...(newConfig.speechInput ? { speechInput: mergedSpeechInput } : {}),
      ...(newConfig.wakeInput ? { wakeInput: mergedWakeInput } : {}),
      ...(newConfig.tts ? { tts: mergedTts } : {}),
      ...(newConfig.voice ? { voice: mergedVoice } : {}),
    };
    await localStore.setItem(CONFIG_KEYS.APP_CONFIG, this.config);
  }

  getApiConfig() {
    return {
      apiKey: this.config.api.key,
      baseUrl: this.config.api.baseUrl,
    };
  }
}

export const configService = new ConfigService(); 
