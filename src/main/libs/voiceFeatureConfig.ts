import { TtsEngine } from '../../shared/tts/constants';
import {
  WakeInputProviderMode,
  normalizeWakeInputProviderMode,
  type WakeInputConfig,
} from '../../shared/wakeInput/constants';
import {
  DEFAULT_VOICE_CONFIG,
  createVoiceConfigFromLegacy,
  deriveLegacyWakeInputConfig,
  normalizeWakeWords,
  type VoiceConfig,
} from '../../shared/voice/constants';
import type { DesktopAssistantConfig } from '../../shared/desktopAssistant/constants';
import type { AuthConfig } from '../../common/auth';

export type AppConfigSettings = {
  theme?: string;
  language?: string;
  useSystemProxy?: boolean;
  auth?: Partial<AuthConfig>;
  speechInput?: {
    stopCommand: string;
    submitCommand: string;
  };
  wakeInput?: Partial<WakeInputConfig>;
  tts?: {
    enabled: boolean;
    autoPlayAssistantReply: boolean;
    engine: TtsEngine;
    voiceId: string;
    rate: number;
    volume: number;
  };
  voice?: Partial<VoiceConfig>;
  desktopAssistant?: Partial<DesktopAssistantConfig>;
};

export const DEFAULT_WAKE_INPUT_CONFIG: WakeInputConfig = deriveLegacyWakeInputConfig(DEFAULT_VOICE_CONFIG);

export const FOREGROUND_SPEECH_RECOVERY_DELAY_MS = 900;
export const FOREGROUND_SPEECH_ALREADY_LISTENING_RETRY_DELAY_MS = 250;
export const FOLLOW_UP_ASSISTANT_REPLY_SETTLE_GUARD_MS = 700;
export const SPEECH_DEBUG_BUILD_MARKER = 'speech-debug-2026-04-05-1912-v1';

export const getVoiceConfigFromAppConfig = (config?: AppConfigSettings): VoiceConfig => {
  return createVoiceConfigFromLegacy({
    voice: config?.voice,
    speechInput: config?.speechInput,
    wakeInput: config?.wakeInput,
    tts: config?.tts,
  });
};

export const mergeWakeInputConfig = (config?: Partial<WakeInputConfig>): WakeInputConfig => {
  return {
    ...DEFAULT_WAKE_INPUT_CONFIG,
    ...(config ?? {}),
    provider: normalizeWakeInputProviderMode(config?.provider),
    wakeWords: normalizeWakeWords(config?.wakeWords, config?.wakeWord),
  };
};

export const getWakeInputConfigFromAppConfig = (config?: AppConfigSettings): WakeInputConfig => {
  const voiceConfig = getVoiceConfigFromAppConfig(config);
  return mergeWakeInputConfig({
    ...deriveLegacyWakeInputConfig(voiceConfig),
    provider: config?.wakeInput?.provider ?? WakeInputProviderMode.Auto,
  });
};

export const mergeVoiceConfigIntoAppConfig = (
  appConfig: AppConfigSettings | undefined,
  partialConfig?: Partial<VoiceConfig>,
): { nextAppConfig: AppConfigSettings; nextVoiceConfig: VoiceConfig } => {
  const currentAppConfig = appConfig ?? {};
  const currentVoiceConfig = getVoiceConfigFromAppConfig(currentAppConfig);
  const nextVoiceConfig = createVoiceConfigFromLegacy({
    voice: {
      ...currentVoiceConfig,
      ...(partialConfig ?? {}),
      capabilities: {
        ...currentVoiceConfig.capabilities,
        ...(partialConfig?.capabilities ?? {}),
      },
      commands: {
        ...currentVoiceConfig.commands,
        ...(partialConfig?.commands ?? {}),
      },
      providers: {
        ...currentVoiceConfig.providers,
        ...(partialConfig?.providers ?? {}),
      },
      postProcess: {
        ...currentVoiceConfig.postProcess,
        ...(partialConfig?.postProcess ?? {}),
      },
    },
  });

  return {
    nextAppConfig: {
      ...currentAppConfig,
      voice: nextVoiceConfig,
    },
    nextVoiceConfig,
  };
};
