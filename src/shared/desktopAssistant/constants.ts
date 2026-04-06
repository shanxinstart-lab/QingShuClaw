export const DesktopAssistantIpcChannel = {
  GetConfig: 'desktopAssistant:getConfig',
  UpdateConfig: 'desktopAssistant:updateConfig',
  GetStatus: 'desktopAssistant:getStatus',
  StartGuide: 'desktopAssistant:startGuide',
  PauseGuide: 'desktopAssistant:pauseGuide',
  ResumeGuide: 'desktopAssistant:resumeGuide',
  StopGuide: 'desktopAssistant:stopGuide',
  NextScene: 'desktopAssistant:nextScene',
  PreviousScene: 'desktopAssistant:previousScene',
  GoToScene: 'desktopAssistant:goToScene',
  ReplayScene: 'desktopAssistant:replayScene',
  StateChanged: 'desktopAssistant:stateChanged',
} as const;

export const DesktopAssistantMessageMetadataKey = {
  AutoAttachedSkillIds: 'desktopAssistantAutoAttachedSkillIds',
} as const;

export const DesktopAssistantReplySpeakMode = {
  Summary: 'summary',
  Detailed: 'detailed',
} as const;
export type DesktopAssistantReplySpeakMode =
  typeof DesktopAssistantReplySpeakMode[keyof typeof DesktopAssistantReplySpeakMode];

export const DesktopAssistantState = {
  Idle: 'idle',
  WakeListening: 'wake_listening',
  Dictating: 'dictating',
  AssistantReplying: 'assistant_replying',
  AssistantSpeaking: 'assistant_speaking',
  GuideActive: 'guide_active',
  Paused: 'paused',
  Error: 'error',
} as const;
export type DesktopAssistantState = typeof DesktopAssistantState[keyof typeof DesktopAssistantState];

export const GuideSource = {
  Manual: 'manual',
  Auto: 'auto',
} as const;
export type GuideSource = typeof GuideSource[keyof typeof GuideSource];

export const GuideStatus = {
  Active: 'active',
  Paused: 'paused',
  Stopped: 'stopped',
} as const;
export type GuideStatus = typeof GuideStatus[keyof typeof GuideStatus];

export interface DesktopAssistantConfig {
  masterEnabled: boolean;
  launchAtLogin: boolean;
  autoOpenPreviewGuide: boolean;
  autoEnterSceneGuide: boolean;
  guideVoiceCommandsEnabled: boolean;
  assistantReplySpeakMode: DesktopAssistantReplySpeakMode;
}

export interface GuideScene {
  id: string;
  title: string;
  summary: string;
  anchor?: string;
}

export interface GuideSession {
  id: string;
  sessionId: string;
  messageId: string;
  source: GuideSource;
  status: GuideStatus;
  previewTarget: string;
  scenes: GuideScene[];
  currentSceneIndex: number;
  sceneReplayNonce?: number;
}

export interface DesktopAssistantStatus {
  masterEnabled: boolean;
  state: DesktopAssistantState;
  guideSession: GuideSession | null;
  lastError?: string;
}

export interface StartGuideRequest {
  sessionId: string;
  messageId: string;
  source: GuideSource;
  previewTarget: string;
  scenes: GuideScene[];
}

export const DEFAULT_DESKTOP_ASSISTANT_CONFIG: DesktopAssistantConfig = {
  masterEnabled: false,
  launchAtLogin: true,
  autoOpenPreviewGuide: true,
  autoEnterSceneGuide: true,
  guideVoiceCommandsEnabled: true,
  assistantReplySpeakMode: DesktopAssistantReplySpeakMode.Summary,
};

export const mergeDesktopAssistantConfig = (
  config?: Partial<DesktopAssistantConfig> | null,
): DesktopAssistantConfig => {
  return {
    ...DEFAULT_DESKTOP_ASSISTANT_CONFIG,
    ...(config ?? {}),
    assistantReplySpeakMode: config?.assistantReplySpeakMode === DesktopAssistantReplySpeakMode.Detailed
      ? DesktopAssistantReplySpeakMode.Detailed
      : DesktopAssistantReplySpeakMode.Summary,
  };
};
