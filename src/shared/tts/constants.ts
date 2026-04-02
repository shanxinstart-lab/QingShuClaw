export const TtsIpcChannel = {
  GetAvailability: 'tts:getAvailability',
  GetVoices: 'tts:getVoices',
  Speak: 'tts:speak',
  Stop: 'tts:stop',
  StateChanged: 'tts:stateChanged',
} as const;

export const TtsStateType = {
  Idle: 'idle',
  Speaking: 'speaking',
  Stopped: 'stopped',
  Error: 'error',
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
  error?: string;
}

export interface TtsVoice {
  identifier: string;
  name: string;
  language: string;
  quality: TtsVoiceQuality;
  isPersonalVoice: boolean;
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
}
