import { ProviderName, ProviderRegistry, type ProviderConfig } from '../../shared/providers';

type ProviderRequestCredential = {
  apiKey: string;
  baseUrl: string;
  apiFormat?: ProviderConfig['apiFormat'];
};

const normalizeApiFormat = (apiFormat: unknown): 'anthropic' | 'openai' | 'gemini' => {
  if (apiFormat === 'openai') {
    return 'openai';
  }
  if (apiFormat === 'gemini') {
    return 'gemini';
  }
  return 'anthropic';
};

export const getFixedApiFormatForProvider = (
  provider: string,
): 'anthropic' | 'openai' | 'gemini' | null => {
  // Moonshot exposes switchable URLs in settings, but its regular Anthropic
  // endpoint is incomplete for the renderer chat flow.
  if (provider === ProviderName.Moonshot) {
    return 'openai';
  }
  const def = ProviderRegistry.get(provider);
  return def && !def.switchableBaseUrls ? def.defaultApiFormat : null;
};

export const getEffectiveProviderApiFormat = (
  provider: string,
  apiFormat: unknown,
): 'anthropic' | 'openai' | 'gemini' => (
  getFixedApiFormatForProvider(provider) ?? normalizeApiFormat(apiFormat)
);

export const shouldShowProviderApiFormatSelector = (provider: string): boolean => (
  getFixedApiFormatForProvider(provider) === null
);

export const resolveProviderRequestCredential = (
  provider: string,
  providerConfig: Pick<ProviderConfig, 'apiKey' | 'baseUrl' | 'apiFormat' | 'authType' | 'oauthAccessToken' | 'oauthBaseUrl'>,
): ProviderRequestCredential => {
  const oauthAccessToken = providerConfig.authType === 'oauth'
    ? providerConfig.oauthAccessToken?.trim() ?? ''
    : '';
  const apiKey = oauthAccessToken || providerConfig.apiKey.trim();
  const oauthBaseUrl = oauthAccessToken ? providerConfig.oauthBaseUrl?.trim() ?? '' : '';

  return {
    apiKey,
    baseUrl: oauthBaseUrl || providerConfig.baseUrl,
    apiFormat: provider === ProviderName.Minimax && oauthAccessToken
      ? 'anthropic'
      : providerConfig.apiFormat,
  };
};

export const buildOpenAICompatibleChatCompletionsUrl = (
  baseUrl: string,
  provider: string,
): string => {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) {
    return '/v1/chat/completions';
  }
  if (normalized.endsWith('/chat/completions')) {
    return normalized;
  }

  const isGeminiLike = provider === ProviderName.Gemini
    || normalized.includes('generativelanguage.googleapis.com');
  if (isGeminiLike) {
    if (normalized.endsWith('/v1beta/openai') || normalized.endsWith('/v1/openai')) {
      return `${normalized}/chat/completions`;
    }
    if (normalized.endsWith('/v1beta') || normalized.endsWith('/v1')) {
      const betaBase = normalized.endsWith('/v1')
        ? normalized.replace(/\/v1$/, '/v1beta')
        : normalized;
      return `${betaBase}/openai/chat/completions`;
    }
    return `${normalized}/v1beta/openai/chat/completions`;
  }

  if (/\/v\d+$/.test(normalized)) {
    return `${normalized}/chat/completions`;
  }
  if (provider === ProviderName.Copilot) {
    return `${normalized}/chat/completions`;
  }
  return `${normalized}/v1/chat/completions`;
};

export const buildOpenAIResponsesUrl = (baseUrl: string): string => {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) {
    return '/v1/responses';
  }
  if (normalized.endsWith('/responses')) {
    return normalized;
  }
  if (normalized.endsWith('/v1')) {
    return `${normalized}/responses`;
  }
  return `${normalized}/v1/responses`;
};

export const shouldUseOpenAIResponsesForProvider = (provider: string): boolean => (
  provider === ProviderName.OpenAI
);

export const shouldUseMaxCompletionTokensForOpenAI = (
  provider: string,
  modelId?: string,
): boolean => {
  if (provider !== ProviderName.OpenAI) {
    return false;
  }
  const normalizedModel = (modelId ?? '').trim().toLowerCase();
  const resolvedModel = normalizedModel.includes('/')
    ? normalizedModel.slice(normalizedModel.lastIndexOf('/') + 1)
    : normalizedModel;
  return resolvedModel.startsWith('gpt-5')
    || resolvedModel.startsWith('o1')
    || resolvedModel.startsWith('o3')
    || resolvedModel.startsWith('o4');
};
