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

export interface WakeInputConfig {
  enabled: boolean;
  wakeWords: string[];
  submitCommand: string;
  cancelCommand: string;
  sessionTimeoutMs: number;
  autoRestartAfterReply: boolean;
}

export interface WakeInputStatus {
  enabled: boolean;
  supported: boolean;
  platform: string;
  status: WakeInputStatusType;
  wakeWords: string[];
  submitCommand: string;
  cancelCommand: string;
  sessionTimeoutMs: number;
  autoRestartAfterReply: boolean;
  listening: boolean;
  error?: string;
}

export interface WakeInputDictationRequest {
  submitCommand: string;
  cancelCommand: string;
  sessionTimeoutMs: number;
  autoRestartAfterReply: boolean;
}
