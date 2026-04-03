import type { TtsSpeakOptions, TtsSpeakResult } from '../../shared/tts/constants';
import { VoiceProvider, type VoiceAliyunProviderConfig } from '../../shared/voice/constants';

const DEFAULT_ALIYUN_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';
const DEFAULT_ALIYUN_TTS_MODEL = 'qwen3-tts-flash';
const DEFAULT_ALIYUN_TTS_VOICE = 'Cherry';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const resolveRequestUrl = (baseUrl?: string): string => {
  const normalized = trimTrailingSlash((baseUrl || DEFAULT_ALIYUN_BASE_URL).trim() || DEFAULT_ALIYUN_BASE_URL);
  if (normalized.endsWith('/services/aigc/multimodal-generation/generation')) {
    return normalized;
  }
  return `${normalized}/services/aigc/multimodal-generation/generation`;
};

const resolveLanguage = (locale?: string): string => {
  const normalized = (locale || 'zh-CN').trim().toLowerCase();
  if (normalized.startsWith('zh')) {
    return 'Chinese';
  }
  if (normalized.startsWith('en')) {
    return 'English';
  }
  if (normalized.startsWith('ja')) {
    return 'Japanese';
  }
  if (normalized.startsWith('ko')) {
    return 'Korean';
  }
  return 'Chinese';
};

const extractErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json() as {
      message?: string;
      code?: string;
    };
    if (typeof payload?.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }
    if (typeof payload?.code === 'string' && payload.code.trim()) {
      return payload.code.trim();
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

  return response.statusText || 'Aliyun TTS request failed.';
};

export class AliyunVoiceService {
  async synthesizeSpeech(
    config: VoiceAliyunProviderConfig,
    options: TtsSpeakOptions,
  ): Promise<TtsSpeakResult> {
    const text = options.text?.trim();
    if (!text) {
      return { success: false, error: 'empty_text', provider: VoiceProvider.CloudAliyun };
    }

    const apiKey = config.apiKey.trim();
    if (!apiKey) {
      return { success: false, error: 'missing_api_key', provider: VoiceProvider.CloudAliyun };
    }

    const requestBody = {
      model: config.ttsModel.trim() || DEFAULT_ALIYUN_TTS_MODEL,
      input: {
        text,
        voice: config.ttsVoice.trim() || DEFAULT_ALIYUN_TTS_VOICE,
        language_type: resolveLanguage(config.locale),
      },
    };

    try {
      const response = await fetch(resolveRequestUrl(config.baseUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        return {
          success: false,
          error: await extractErrorMessage(response),
          provider: VoiceProvider.CloudAliyun,
        };
      }

      const payload = await response.json() as {
        output?: {
          audio?: {
            url?: string;
          };
        };
      };
      const audioUrl = payload?.output?.audio?.url?.trim();

      if (!audioUrl) {
        return {
          success: false,
          error: 'missing_audio_url',
          provider: VoiceProvider.CloudAliyun,
        };
      }

      return {
        success: true,
        audioUrl,
        provider: VoiceProvider.CloudAliyun,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Aliyun TTS request failed.',
        provider: VoiceProvider.CloudAliyun,
      };
    }
  }
}
