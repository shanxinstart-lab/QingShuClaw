import { randomUUID } from 'crypto';
import type { SpeechTranscribeAudioOptions, SpeechTranscribeAudioResult } from '../../shared/speech/constants';
import { VoiceProvider, type VoiceVolcengineProviderConfig } from '../../shared/voice/constants';

const DEFAULT_VOLCENGINE_SPEECH_BASE_URL = 'https://openspeech.bytedance.com';
const DEFAULT_VOLCENGINE_SPEECH_RESOURCE = 'volc.bigasr.sauc.duration';
const DEFAULT_VOLCENGINE_SPEECH_CLUSTER = 'volcengine_streaming_common';
const DEFAULT_AUDIO_FORMAT = 'wav';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const resolveRequestUrl = (baseUrl?: string): string => {
  const normalized = trimTrailingSlash((baseUrl || DEFAULT_VOLCENGINE_SPEECH_BASE_URL).trim() || DEFAULT_VOLCENGINE_SPEECH_BASE_URL);
  if (normalized.includes('/api/v') || normalized.includes('/bigmodel/api')) {
    return normalized;
  }
  return `${normalized}/api/v3/auc/bigmodel/recognize/flash`;
};

const extractErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json() as {
      error?: string;
      message?: string;
      code?: string | number;
    };
    if (typeof payload?.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }
    if (typeof payload?.error === 'string' && payload.error.trim()) {
      return payload.error.trim();
    }
    if (payload?.code !== undefined) {
      return String(payload.code);
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

  return response.statusText || 'Volcengine speech recognition request failed.';
};

const resolveRecognizedText = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const result = payload as {
    result?: {
      text?: string;
      utterances?: Array<{ text?: string }>;
    };
  };

  if (typeof result.result?.text === 'string' && result.result.text.trim()) {
    return result.result.text.trim();
  }

  if (Array.isArray(result.result?.utterances)) {
    const text = result.result.utterances
      .map((item) => (typeof item?.text === 'string' ? item.text.trim() : ''))
      .filter(Boolean)
      .join('');
    if (text) {
      return text;
    }
  }

  return '';
};

export class VolcengineSpeechService {
  async transcribeAudio(
    config: VoiceVolcengineProviderConfig,
    options: SpeechTranscribeAudioOptions,
  ): Promise<SpeechTranscribeAudioResult> {
    const audioBase64 = options.audioBase64?.trim();
    if (!audioBase64) {
      return {
        success: false,
        error: 'empty_audio',
        provider: VoiceProvider.CloudVolcengine,
      };
    }

    const appKey = config.appKey.trim();
    const accessToken = config.accessToken.trim();
    if (!appKey || !accessToken) {
      return {
        success: false,
        error: 'provider_config_required',
        provider: VoiceProvider.CloudVolcengine,
      };
    }

    const body = {
      user: {
        uid: randomUUID(),
      },
      audio: {
        format: DEFAULT_AUDIO_FORMAT,
        data: audioBase64,
      },
      request: {
        model_name: DEFAULT_VOLCENGINE_SPEECH_CLUSTER,
        enable_itn: true,
        enable_punc: true,
        show_utterances: true,
      },
    };

    try {
      const response = await fetch(resolveRequestUrl(config.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer; ${accessToken}`,
          'X-Api-App-Key': appKey,
          'X-Api-Resource-Id': DEFAULT_VOLCENGINE_SPEECH_RESOURCE,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return {
          success: false,
          error: await extractErrorMessage(response),
          provider: VoiceProvider.CloudVolcengine,
        };
      }

      const payload = await response.json();
      const text = resolveRecognizedText(payload);
      if (!text) {
        return {
          success: false,
          error: 'empty_transcript',
          provider: VoiceProvider.CloudVolcengine,
        };
      }

      return {
        success: true,
        text,
        provider: VoiceProvider.CloudVolcengine,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Volcengine speech recognition request failed.',
        provider: VoiceProvider.CloudVolcengine,
      };
    }
  }
}
