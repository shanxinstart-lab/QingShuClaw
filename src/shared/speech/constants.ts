export const SpeechIpcChannel = {
  GetAvailability: 'speech:getAvailability',
  Start: 'speech:start',
  Stop: 'speech:stop',
  TranscribeAudio: 'speech:transcribeAudio',
  StateChanged: 'speech:stateChanged',
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
  SpeechProcessInterrupted: 'speech_process_interrupted',
  SpeechProcessInvalidated: 'speech_process_invalidated',
  SpeechRequestCancelled: 'speech_request_cancelled',
  SpeechNoMatch: 'speech_no_match',
  AssistantReplyPlaybackTimeout: 'assistant_reply_playback_timeout',
  AssistantReplyPlaybackPending: 'assistant_reply_playback_pending',
} as const;
export type SpeechErrorCode = typeof SpeechErrorCode[keyof typeof SpeechErrorCode];

const RECOVERABLE_SPEECH_ERROR_CODES = new Set<string>([
  SpeechErrorCode.SpeechProcessInterrupted,
  SpeechErrorCode.SpeechProcessInvalidated,
]);

export const isRecoverableSpeechErrorCode = (value?: string | null): boolean => {
  if (!value) {
    return false;
  }
  return RECOVERABLE_SPEECH_ERROR_CODES.has(value);
};

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
  requestedProvider?: string;
  actualProvider?: string;
  fallbackActive?: boolean;
  fallbackReason?: string;
}

export const SpeechStartSource = {
  Manual: 'manual',
  Wake: 'wake',
  FollowUp: 'follow_up',
} as const;
export type SpeechStartSource = typeof SpeechStartSource[keyof typeof SpeechStartSource];

export interface SpeechStartOptions {
  locale?: string;
  source?: SpeechStartSource;
}

export const SpeechStopReason = {
  ManualToggle: 'manual_toggle',
  VoiceCommandStop: 'voice_command_stop',
} as const;
export type SpeechStopReason = typeof SpeechStopReason[keyof typeof SpeechStopReason];

export interface SpeechStopOptions {
  reason?: SpeechStopReason;
  suppressWakeInputResumeMs?: number;
}

export interface SpeechTranscribeAudioOptions {
  audioBase64: string;
  mimeType: string;
  source?: SpeechStartSource;
}

export interface SpeechTranscribeAudioResult {
  success: boolean;
  text?: string;
  error?: string;
  provider?: string;
}

export interface SpeechStateEvent {
  type: SpeechStateType;
  text?: string;
  code?: SpeechErrorCode | string;
  message?: string;
}
