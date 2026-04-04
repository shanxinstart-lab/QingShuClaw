export const APP_NAME = 'QingShuClaw';
export const APP_ID = 'lobsterai';
export const EXPORT_FORMAT_TYPE = 'lobsterai.providers';
export const EXPORT_PASSWORD = 'lobsterai-APP';

export const AppCustomEvent = {
  ShowToast: 'app:showToast',
  ShowLoginWelcome: 'app:showLoginWelcome',
  FocusCoworkInput: 'app:focusCoworkInput',
  StartWakeDictation: 'app:startWakeDictation',
  AssistantReplyPlaybackStateChanged: 'app:assistantReplyPlaybackStateChanged',
} as const;
export type AppCustomEvent = typeof AppCustomEvent[keyof typeof AppCustomEvent];
