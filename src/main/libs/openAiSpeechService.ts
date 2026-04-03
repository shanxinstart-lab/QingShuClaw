import { Buffer } from 'buffer';
import type { SpeechTranscribeAudioOptions, SpeechTranscribeAudioResult } from '../../shared/speech/constants';
import { VoiceProvider, type VoiceOpenAiProviderConfig } from '../../shared/voice/constants';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_STT_MODEL = 'gpt-4o-mini-transcribe';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const resolveRequestUrl = (baseUrl?: string): string => {
  const normalized = trimTrailingSlash((baseUrl || DEFAULT_OPENAI_BASE_URL).trim() || DEFAULT_OPENAI_BASE_URL);
  if (normalized.endsWith('/audio/transcriptions')) {
    return normalized;
  }
  if (normalized.endsWith('/audio')) {
    return `${normalized}/transcriptions`;
  }
  if (normalized.endsWith('/v1')) {
    return `${normalized}/audio/transcriptions`;
  }
  return `${normalized}/v1/audio/transcriptions`;
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
  const rawText = (await response.text()).trim();
  if (!rawText) {
    return response.statusText || 'OpenAI speech recognition request failed.';
  }

  try {
    const payload = JSON.parse(rawText) as {
      error?: {
        message?: string;
        code?: string;
      };
    };
    const message = payload?.error?.message?.trim();
    if (message) {
      return message;
    }
    const code = payload?.error?.code?.trim();
    if (code) {
      return code;
    }
  } catch {
    // Ignore parse failures and return raw text below.
  }

  return rawText;
};

export class OpenAiSpeechService {
  async transcribeAudio(
    config: VoiceOpenAiProviderConfig,
    options: SpeechTranscribeAudioOptions,
  ): Promise<SpeechTranscribeAudioResult> {
    const audioBase64 = options.audioBase64?.trim();
    const mimeType = options.mimeType?.trim() || 'audio/wav';
    if (!audioBase64) {
      return {
        success: false,
        error: 'empty_audio',
        provider: VoiceProvider.CloudOpenAi,
      };
    }

    const apiKey = config.apiKey.trim();
    if (!apiKey) {
      return {
        success: false,
        error: 'provider_config_required',
        provider: VoiceProvider.CloudOpenAi,
      };
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    if (audioBuffer.length === 0) {
      return {
        success: false,
        error: 'empty_audio',
        provider: VoiceProvider.CloudOpenAi,
      };
    }

    const requestBody = new FormData();
    requestBody.append('model', config.sttModel.trim() || DEFAULT_OPENAI_STT_MODEL);
    requestBody.append('file', new Blob([audioBuffer], { type: mimeType }), 'speech.wav');
    requestBody.append('response_format', 'text');
    const language = resolveLanguage(config.locale);
    if (language) {
      requestBody.append('language', language);
    }

    try {
      const response = await fetch(resolveRequestUrl(config.baseUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: requestBody,
      });

      if (!response.ok) {
        return {
          success: false,
          error: await extractErrorMessage(response),
          provider: VoiceProvider.CloudOpenAi,
        };
      }

      const text = (await response.text()).trim();
      if (!text) {
        return {
          success: false,
          error: 'empty_transcript',
          provider: VoiceProvider.CloudOpenAi,
        };
      }

      return {
        success: true,
        text,
        provider: VoiceProvider.CloudOpenAi,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OpenAI speech recognition request failed.',
        provider: VoiceProvider.CloudOpenAi,
      };
    }
  }
}
