export const TtsIpcChannel = {
  GetAvailability: 'tts:getAvailability',
  GetVoices: 'tts:getVoices',
  Prepare: 'tts:prepare',
  Speak: 'tts:speak',
  Stop: 'tts:stop',
  ReportAssistantReplyPlayback: 'tts:reportAssistantReplyPlayback',
  StateChanged: 'tts:stateChanged',
} as const;

export const TtsEngine = {
  MacosNative: 'macos_native',
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

export const TtsWorkerStatus = {
  Idle: 'idle',
  Starting: 'starting',
  Ready: 'ready',
  Error: 'error',
} as const;
export type TtsWorkerStatus = typeof TtsWorkerStatus[keyof typeof TtsWorkerStatus];

export const TtsStateType = {
  Idle: 'idle',
  Speaking: 'speaking',
  Stopped: 'stopped',
  Error: 'error',
  AvailabilityChanged: 'availability_changed',
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

export const TtsPlaybackMode = {
  System: 'system',
  AudioData: 'audio_data',
} as const;
export type TtsPlaybackMode = typeof TtsPlaybackMode[keyof typeof TtsPlaybackMode];

export interface TtsAvailability {
  enabled?: boolean;
  supported: boolean;
  platform: string;
  speaking: boolean;
  error?: string;
  currentEngine: TtsEngine;
  availableEngines: TtsEngine[];
  prepareStatus: TtsPrepareStatus;
  workerStatus?: TtsWorkerStatus;
  recentError?: string;
  lastRequestedEngine?: TtsEngine;
  lastResolvedEngine?: TtsEngine;
  lastFallbackReason?: string;
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
  playbackMode?: TtsPlaybackMode;
}

export interface TtsSpeakResult {
  success: boolean;
  error?: string;
  audioDataUrl?: string;
  audioUrl?: string;
  provider?: string;
  engine?: TtsEngine;
}

export interface TtsStateEvent {
  type: TtsStateType;
  voiceId?: string;
  code?: string;
  message?: string;
  availability?: TtsAvailability;
  engine?: TtsEngine;
}

export const TtsAssistantReplyPlaybackState = {
  Pending: 'pending',
  Settled: 'settled',
} as const;
export type TtsAssistantReplyPlaybackState =
  typeof TtsAssistantReplyPlaybackState[keyof typeof TtsAssistantReplyPlaybackState];

export interface TtsAssistantReplyPlaybackReport {
  sessionId?: string;
  state: TtsAssistantReplyPlaybackState;
}
