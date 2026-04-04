export const TtsIpcChannel = {
  GetAvailability: 'tts:getAvailability',
  GetVoices: 'tts:getVoices',
  Prepare: 'tts:prepare',
  Speak: 'tts:speak',
  Stop: 'tts:stop',
  StateChanged: 'tts:stateChanged',
} as const;

export const TtsEngine = {
  MacOsNative: 'macos_native',
  EdgeTts: 'edge_tts',
} as const;
export type TtsEngine = typeof TtsEngine[keyof typeof TtsEngine];

export const TtsPrepareStatus = {
  Idle: 'idle',
  Installing: 'installing',
  Ready: 'ready',
  Error: 'error',
} as const;
export type TtsPrepareStatus = typeof TtsPrepareStatus[keyof typeof TtsPrepareStatus];

export const TtsStateType = {
  Idle: 'idle',
  Speaking: 'speaking',
  Stopped: 'stopped',
  Error: 'error',
  AvailabilityChanged: 'availability',
} as const;
export type TtsStateType = typeof TtsStateType[keyof typeof TtsStateType];

export const TtsVoiceQuality = {
  Default: 'default',
  Enhanced: 'enhanced',
  Premium: 'premium',
  Personal: 'personal',
  Unknown: 'unknown',
} as const;
export type TtsVoiceQuality = typeof TtsVoiceQuality[keyof typeof TtsVoiceQuality];

export interface TtsAvailability {
  enabled?: boolean;
  supported: boolean;
  platform: string;
  speaking: boolean;
  currentEngine: TtsEngine;
  availableEngines: TtsEngine[];
  prepareStatus: TtsPrepareStatus;
  error?: string;
}

export interface TtsVoice {
  identifier: string;
  name: string;
  language: string;
  quality: TtsVoiceQuality;
  isPersonalVoice: boolean;
  engine: TtsEngine;
}

export interface TtsSpeakOptions {
  text: string;
  voiceId?: string;
  rate?: number;
  volume?: number;
}

export interface TtsStateEvent {
  type: TtsStateType;
  voiceId?: string;
  code?: string;
  message?: string;
  availability?: TtsAvailability;
}

export interface TtsPrepareOptions {
  engine?: TtsEngine;
  force?: boolean;
}
