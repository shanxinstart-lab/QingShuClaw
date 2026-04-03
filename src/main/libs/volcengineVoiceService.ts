import type { TtsSpeakOptions, TtsSpeakResult } from '../../shared/tts/constants';
import { VoiceProvider, type VoiceVolcengineProviderConfig } from '../../shared/voice/constants';

const DEFAULT_VOLCENGINE_BASE_URL = 'https://sami.bytedance.com';
const DEFAULT_VOLCENGINE_VERSION = 'v4';
const DEFAULT_VOLCENGINE_NAMESPACE = 'TTS';
const DEFAULT_VOLCENGINE_VOICE = 'zh_female_qingxin';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const resolveInvokeUrl = (baseUrl?: string, appKey?: string, accessToken?: string): string => {
  const normalizedBaseUrl = trimTrailingSlash((baseUrl || DEFAULT_VOLCENGINE_BASE_URL).trim() || DEFAULT_VOLCENGINE_BASE_URL);
  const params = new URLSearchParams({
    version: DEFAULT_VOLCENGINE_VERSION,
    namespace: DEFAULT_VOLCENGINE_NAMESPACE,
    appkey: appKey || '',
    token: accessToken || '',
  });
  return `${normalizedBaseUrl}/api/v1/invoke?${params.toString()}`;
};

const resolveSpeechRate = (rate?: number): number => {
  if (typeof rate !== 'number' || Number.isNaN(rate)) {
    return 0;
  }
  const scaled = Math.round((rate - 0.5) * 200);
  return Math.max(-50, Math.min(100, scaled));
};

const extractErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json() as {
      status_text?: string;
      payload?: string;
    };
    if (typeof payload?.status_text === 'string' && payload.status_text.trim()) {
      return payload.status_text.trim();
    }
    if (typeof payload?.payload === 'string' && payload.payload.trim()) {
      return payload.payload.trim();
    }
  } catch {
    // Ignore parse failures and fall back below.
  }

  try {
    const text = (await response.text()).trim();
    if (text) {
      return text;
    }
  } catch {
    // Ignore text extraction failures and fall back below.
  }

  return response.statusText || 'Volcengine TTS request failed.';
};

export class VolcengineVoiceService {
  async synthesizeSpeech(
    config: VoiceVolcengineProviderConfig,
    options: TtsSpeakOptions,
  ): Promise<TtsSpeakResult> {
    const text = options.text?.trim();
    if (!text) {
      return { success: false, error: 'empty_text', provider: VoiceProvider.CloudVolcengine };
    }

    const appKey = config.appKey.trim();
    const accessToken = config.accessToken.trim();
    if (!appKey || !accessToken) {
      return { success: false, error: 'provider_config_required', provider: VoiceProvider.CloudVolcengine };
    }

    const payload = {
      speaker: config.ttsVoice.trim() || DEFAULT_VOLCENGINE_VOICE,
      text,
      audio_config: {
        format: 'mp3',
        sample_rate: 24000,
        speech_rate: resolveSpeechRate(options.rate),
      },
    };

    try {
      const response = await fetch(resolveInvokeUrl(config.baseUrl, appKey, accessToken), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appkey: appKey,
          token: accessToken,
          namespace: DEFAULT_VOLCENGINE_NAMESPACE,
          payload: JSON.stringify(payload),
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: await extractErrorMessage(response),
          provider: VoiceProvider.CloudVolcengine,
        };
      }

      const result = await response.json() as {
        data?: string;
        status_code?: number;
        status_text?: string;
      };

      if (result.status_code && result.status_code !== 20000000) {
        return {
          success: false,
          error: result.status_text || `Volcengine TTS failed with status ${result.status_code}.`,
          provider: VoiceProvider.CloudVolcengine,
        };
      }

      const audioBase64 = typeof result.data === 'string' ? result.data.trim() : '';
      if (!audioBase64) {
        return {
          success: false,
          error: 'missing_audio_data',
          provider: VoiceProvider.CloudVolcengine,
        };
      }

      return {
        success: true,
        audioDataUrl: `data:audio/mpeg;base64,${audioBase64}`,
        provider: VoiceProvider.CloudVolcengine,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Volcengine TTS request failed.',
        provider: VoiceProvider.CloudVolcengine,
      };
    }
  }
}
