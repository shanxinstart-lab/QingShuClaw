import { Buffer } from 'buffer';
import type { TtsSpeakOptions, TtsSpeakResult } from '../../shared/tts/constants';
import { VoiceProvider, type VoiceAzureProviderConfig } from '../../shared/voice/constants';

const DEFAULT_AZURE_TTS_VOICE = 'zh-CN-XiaoxiaoNeural';
const DEFAULT_AUDIO_MIME_TYPE = 'audio/mpeg';
const DEFAULT_AUDIO_OUTPUT_FORMAT = 'audio-24khz-96kbitrate-mono-mp3';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const escapeXml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const resolveVoiceLocale = (config: VoiceAzureProviderConfig): string => {
  const locale = config.locale.trim();
  if (locale) {
    return locale;
  }
  const voice = config.ttsVoice.trim();
  const match = /^([a-z]{2,3}-[A-Z][a-zA-Z]+-[A-Za-z]+)/.exec(voice);
  return match?.[1] || 'zh-CN';
};

const resolveRequestUrl = (config: VoiceAzureProviderConfig): string => {
  const endpoint = trimTrailingSlash(config.endpoint.trim());
  if (endpoint) {
    return endpoint.endsWith('/cognitiveservices/v1')
      ? endpoint
      : `${endpoint}/cognitiveservices/v1`;
  }

  const region = config.region.trim();
  if (!region) {
    return '';
  }
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
};

const resolveRate = (rate?: number): string | null => {
  if (typeof rate !== 'number' || Number.isNaN(rate)) {
    return null;
  }
  const percent = Math.round((rate - 0.5) * 200);
  if (percent === 0) {
    return null;
  }
  return `${percent > 0 ? '+' : ''}${percent}%`;
};

const buildSsml = (config: VoiceAzureProviderConfig, options: TtsSpeakOptions): string => {
  const voice = config.ttsVoice.trim() || options.voiceId?.trim() || DEFAULT_AZURE_TTS_VOICE;
  const locale = resolveVoiceLocale(config);
  const rate = resolveRate(options.rate);
  const text = escapeXml(options.text.trim());

  if (!rate) {
    return `<speak version="1.0" xml:lang="${locale}"><voice name="${voice}">${text}</voice></speak>`;
  }

  return `<speak version="1.0" xml:lang="${locale}"><voice name="${voice}"><prosody rate="${rate}">${text}</prosody></voice></speak>`;
};

const extractErrorMessage = async (response: Response): Promise<string> => {
  const text = (await response.text()).trim();
  if (!text) {
    return response.statusText || 'Azure TTS request failed.';
  }
  return text;
};

export class AzureVoiceService {
  async synthesizeSpeech(
    config: VoiceAzureProviderConfig,
    options: TtsSpeakOptions,
  ): Promise<TtsSpeakResult> {
    const text = options.text?.trim();
    if (!text) {
      return { success: false, error: 'empty_text', provider: VoiceProvider.CloudAzure };
    }

    const apiKey = config.apiKey.trim();
    const requestUrl = resolveRequestUrl(config);
    if (!apiKey || !requestUrl) {
      return { success: false, error: 'provider_config_required', provider: VoiceProvider.CloudAzure };
    }

    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': DEFAULT_AUDIO_OUTPUT_FORMAT,
          'User-Agent': 'QingShuClaw',
        },
        body: buildSsml(config, options),
      });

      if (!response.ok) {
        return {
          success: false,
          error: await extractErrorMessage(response),
          provider: VoiceProvider.CloudAzure,
        };
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      if (audioBuffer.length === 0) {
        return {
          success: false,
          error: 'empty_audio_response',
          provider: VoiceProvider.CloudAzure,
        };
      }

      return {
        success: true,
        audioDataUrl: `data:${DEFAULT_AUDIO_MIME_TYPE};base64,${audioBuffer.toString('base64')}`,
        provider: VoiceProvider.CloudAzure,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Azure TTS request failed.',
        provider: VoiceProvider.CloudAzure,
      };
    }
  }
}
