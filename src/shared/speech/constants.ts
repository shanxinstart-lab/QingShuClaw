import type { WakeInputDictationRequest } from '../wakeInput/constants';

export const SpeechIpcChannel = {
  GetAvailability: 'speech:getAvailability',
  Start: 'speech:start',
  Stop: 'speech:stop',
  StateChanged: 'speech:stateChanged',
  FollowUpArm: 'speech:followUp:arm',
  FollowUpDisarm: 'speech:followUp:disarm',
  FollowUpSetActiveSession: 'speech:followUp:setActiveSession',
} as const;

export const SpeechFeatureFlagKey = {
  MacInputEnabled: 'feature_mac_speech_input_enabled',
} as const;

export const SpeechPermissionStatus = {
  NotDetermined: 'not-determined',
  Denied: 'denied',
  Granted: 'granted',
  Restricted: 'restricted',
  Unsupported: 'unsupported',
} as const;
export type SpeechPermissionStatus = typeof SpeechPermissionStatus[keyof typeof SpeechPermissionStatus];

export const SpeechStateType = {
  Listening: 'listening',
  Partial: 'partial',
  Final: 'final',
  Stopped: 'stopped',
  Error: 'error',
} as const;
export type SpeechStateType = typeof SpeechStateType[keyof typeof SpeechStateType];

export const SpeechErrorCode = {
  UnsupportedPlatform: 'unsupported_platform',
  HelperUnavailable: 'helper_unavailable',
  RecognizerUnavailable: 'recognizer_unavailable',
  DevPermissionPromptUnsupported: 'dev_permission_prompt_unsupported',
  PermissionDenied: 'permission_denied',
  SpeechPermissionDenied: 'speech_permission_denied',
  MicrophonePermissionDenied: 'microphone_permission_denied',
  StartFailed: 'start_failed',
  RuntimeError: 'runtime_error',
  AlreadyListening: 'already_listening',
  InvalidResponse: 'invalid_response',
} as const;
export type SpeechErrorCode = typeof SpeechErrorCode[keyof typeof SpeechErrorCode];

export interface SpeechAvailability {
  enabled?: boolean;
  supported: boolean;
  platform: string;
  permission: SpeechPermissionStatus;
  speechAuthorization: SpeechPermissionStatus;
  microphoneAuthorization: SpeechPermissionStatus;
  locale?: string;
  listening: boolean;
  error?: string;
}

export interface SpeechStartOptions {
  locale?: string;
}

export interface SpeechStateEvent {
  type: SpeechStateType;
  text?: string;
  code?: SpeechErrorCode | string;
  message?: string;
}

export interface SpeechFollowUpArmRequest {
  sessionId: string | null;
  config: WakeInputDictationRequest;
}

export interface SpeechFollowUpActiveSessionRequest {
  sessionId: string | null;
}
