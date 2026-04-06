export const WakeInputIpcChannel = {
  GetStatus: 'wakeInput:getStatus',
  UpdateConfig: 'wakeInput:updateConfig',
  StateChanged: 'wakeInput:stateChanged',
  DictationRequested: 'wakeInput:dictationRequested',
} as const;

export const WakeInputStatusType = {
  Disabled: 'disabled',
  Idle: 'idle',
  Listening: 'listening',
  WakeTriggered: 'wake_triggered',
  Dictating: 'dictating',
  Cooldown: 'cooldown',
  Error: 'error',
} as const;
export type WakeInputStatusType = typeof WakeInputStatusType[keyof typeof WakeInputStatusType];

export const WakeInputProviderMode = {
  Auto: 'auto',
  SherpaOnnx: 'sherpa_onnx',
  TextMatch: 'text_match',
} as const;
export type WakeInputProviderMode = typeof WakeInputProviderMode[keyof typeof WakeInputProviderMode];

export const WakeInputRuntimeProvider = {
  None: 'none',
  SherpaOnnx: 'sherpa_onnx',
  TextMatch: 'text_match',
} as const;
export type WakeInputRuntimeProvider = typeof WakeInputRuntimeProvider[keyof typeof WakeInputRuntimeProvider];

const LEGACY_PORCUPINE_PROVIDER = 'porcupine';

export const normalizeWakeInputProviderMode = (value: unknown): WakeInputProviderMode => {
  if (value === WakeInputProviderMode.TextMatch) {
    return WakeInputProviderMode.TextMatch;
  }
  if (value === WakeInputProviderMode.SherpaOnnx) {
    return WakeInputProviderMode.SherpaOnnx;
  }
  if (value === LEGACY_PORCUPINE_PROVIDER) {
    return WakeInputProviderMode.Auto;
  }
  return WakeInputProviderMode.Auto;
};

export interface WakeInputConfig {
  enabled: boolean;
  provider?: WakeInputProviderMode;
  wakeWords: string[];
  wakeWord: string;
  submitCommand: string;
  cancelCommand: string;
  sessionTimeoutMs: number;
  activationReplyEnabled: boolean;
  activationReplyText: string;
}

export interface WakeInputStatus {
  enabled: boolean;
  supported: boolean;
  platform: string;
  status: WakeInputStatusType;
  requestedProvider: WakeInputProviderMode;
  provider: WakeInputRuntimeProvider;
  fallbackActive: boolean;
  wakeWords: string[];
  wakeWord: string;
  submitCommand: string;
  cancelCommand: string;
  sessionTimeoutMs: number;
  activationReplyEnabled: boolean;
  activationReplyText: string;
  listening: boolean;
  error?: string;
}

export interface WakeInputDictationRequest {
  submitCommand: string;
  cancelCommand: string;
  sessionTimeoutMs: number;
}
