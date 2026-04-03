import type { TtsSpeakOptions, TtsSpeakResult } from '../../shared/tts/constants';
import { VoiceProvider, type VoiceOpenAiProviderConfig } from '../../shared/voice/constants';

const DEFAULT_OPENAI_TTS_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_TTS_MODEL = 'gpt-4o-mini-tts';
const DEFAULT_OPENAI_TTS_VOICE = 'alloy';
const DEFAULT_AUDIO_MIME_TYPE = 'audio/mpeg';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const resolveSpeechEndpoint = (baseUrl?: string): string => {
  const normalized = trimTrailingSlash((baseUrl || DEFAULT_OPENAI_TTS_BASE_URL).trim() || DEFAULT_OPENAI_TTS_BASE_URL);
  if (normalized.endsWith('/audio/speech')) {
    return normalized;
  }
  if (normalized.endsWith('/audio')) {
    return `${normalized}/speech`;
  }
  return `${normalized}/audio/speech`;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const resolvePlaybackSpeed = (rate?: number): number => {
  if (typeof rate !== 'number' || Number.isNaN(rate)) {
    return 1;
  }
  return clamp(Number((rate * 2).toFixed(2)), 0.25, 2);
};

const extractErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json() as {
      error?: {
        message?: string;
      };
    };
    const message = payload?.error?.message?.trim();
    if (message) {
      return message;
    }
  } catch {
    // Ignore JSON parse failures and fall back to raw text.
  }

  try {
    const text = (await response.text()).trim();
    if (text) {
      return text;
    }
  } catch {
    // Ignore text extraction failures and fall back to status text.
  }

  return response.statusText || 'OpenAI TTS request failed.';
};

export class OpenAiVoiceService {
  async synthesizeSpeech(
    config: VoiceOpenAiProviderConfig,
    options: TtsSpeakOptions,
  ): Promise<TtsSpeakResult> {
    const text = options.text?.trim();
    if (!text) {
      return { success: false, error: 'empty_text' };
    }

    const apiKey = config.apiKey.trim();
    if (!apiKey) {
      return { success: false, error: 'missing_api_key' };
    }

    const requestUrl = resolveSpeechEndpoint(config.baseUrl);
    const requestBody = {
      model: config.ttsModel.trim() || DEFAULT_OPENAI_TTS_MODEL,
      voice: config.ttsVoice.trim() || options.voiceId?.trim() || DEFAULT_OPENAI_TTS_VOICE,
      input: text,
      format: 'mp3',
      speed: resolvePlaybackSpeed(options.rate),
    };

    try {
      const response = await fetch(requestUrl, {
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
          provider: VoiceProvider.CloudOpenAi,
        };
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      if (audioBuffer.length === 0) {
        return {
          success: false,
          error: 'empty_audio_response',
          provider: VoiceProvider.CloudOpenAi,
        };
      }

      return {
        success: true,
        audioDataUrl: `data:${DEFAULT_AUDIO_MIME_TYPE};base64,${audioBuffer.toString('base64')}`,
        provider: VoiceProvider.CloudOpenAi,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'OpenAI TTS request failed.',
        provider: VoiceProvider.CloudOpenAi,
      };
    }
  }
}
