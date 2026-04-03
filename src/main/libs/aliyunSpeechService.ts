import type { SpeechTranscribeAudioOptions, SpeechTranscribeAudioResult } from '../../shared/speech/constants';
import { VoiceProvider, type VoiceAliyunProviderConfig } from '../../shared/voice/constants';

const DEFAULT_ALIYUN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_ALIYUN_STT_MODEL = 'qwen3-asr-flash';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const resolveRequestUrl = (baseUrl?: string): string => {
  const normalized = trimTrailingSlash((baseUrl || DEFAULT_ALIYUN_BASE_URL).trim() || DEFAULT_ALIYUN_BASE_URL);
  if (normalized.endsWith('/chat/completions')) {
    return normalized;
  }
  if (normalized.endsWith('/compatible-mode/v1')) {
    return `${normalized}/chat/completions`;
  }
  const normalizedOrigin = normalized
    .replace(/\/services\/aigc\/multimodal-generation\/generation$/i, '')
    .replace(/\/api\/v1$/i, '')
    .replace(/\/compatible-mode\/v1$/i, '');
  return `${normalizedOrigin}/compatible-mode/v1/chat/completions`;
};

const resolveLanguage = (locale?: string): string | undefined => {
  const normalized = (locale || 'zh-CN').trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized.startsWith('zh-hk') || normalized.startsWith('zh-mo') || normalized.startsWith('yue')) {
    return 'yue';
  }
  if (normalized.startsWith('zh')) {
    return 'zh';
  }
  if (normalized.startsWith('en')) {
    return 'en';
  }
  if (normalized.startsWith('ja')) {
    return 'ja';
  }
  if (normalized.startsWith('ko')) {
    return 'ko';
  }
  return undefined;
};

const extractErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json() as {
      error?: {
        message?: string;
        code?: string;
      };
      message?: string;
      code?: string;
    };
    const errorMessage = payload?.error?.message?.trim();
    if (errorMessage) {
      return errorMessage;
    }
    const message = payload?.message?.trim();
    if (message) {
      return message;
    }
    const errorCode = payload?.error?.code?.trim();
    if (errorCode) {
      return errorCode;
    }
    const code = payload?.code?.trim();
    if (code) {
      return code;
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

  return response.statusText || 'Aliyun speech recognition request failed.';
};

const resolveRecognizedText = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const result = payload as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const content = result.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }
  if (Array.isArray(content)) {
    const text = content
      .map((item) => (typeof item?.text === 'string' ? item.text.trim() : ''))
      .filter(Boolean)
      .join('');
    if (text) {
      return text;
    }
  }
  return '';
};

export class AliyunSpeechService {
  async transcribeAudio(
    config: VoiceAliyunProviderConfig,
    options: SpeechTranscribeAudioOptions,
  ): Promise<SpeechTranscribeAudioResult> {
    const audioBase64 = options.audioBase64?.trim();
    const mimeType = options.mimeType?.trim() || 'audio/wav';
    if (!audioBase64) {
      return {
        success: false,
        error: 'empty_audio',
        provider: VoiceProvider.CloudAliyun,
      };
    }

    const apiKey = config.apiKey.trim();
    if (!apiKey) {
      return {
        success: false,
        error: 'provider_config_required',
        provider: VoiceProvider.CloudAliyun,
      };
    }

    const audioDataUrl = `data:${mimeType};base64,${audioBase64}`;
    const language = resolveLanguage(config.locale);
    const requestBody = {
      model: config.sttModel.trim() || DEFAULT_ALIYUN_STT_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: {
                data: audioDataUrl,
              },
            },
          ],
        },
      ],
      stream: false,
      asr_options: {
        enable_itn: true,
        ...(language ? { language } : {}),
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

      const payload = await response.json();
      const text = resolveRecognizedText(payload);
      if (!text) {
        return {
          success: false,
          error: 'empty_transcript',
          provider: VoiceProvider.CloudAliyun,
        };
      }

      return {
        success: true,
        text,
        provider: VoiceProvider.CloudAliyun,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Aliyun speech recognition request failed.',
        provider: VoiceProvider.CloudAliyun,
      };
    }
  }
}
