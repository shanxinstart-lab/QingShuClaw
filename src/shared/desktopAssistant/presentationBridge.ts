import type { PresentationPlaybackStatus } from './presentation';

export const PresentationBridgeVersion = {
  V1: 'v1',
} as const;
export type PresentationBridgeVersion =
  typeof PresentationBridgeVersion[keyof typeof PresentationBridgeVersion];

export const PresentationBridgeCommandType = {
  Handshake: 'handshake',
  GoToScene: 'goToScene',
  SetPlaybackStatus: 'setPlaybackStatus',
  HighlightScene: 'highlightScene',
  QueryState: 'queryState',
} as const;
export type PresentationBridgeCommandType =
  typeof PresentationBridgeCommandType[keyof typeof PresentationBridgeCommandType];

export const PresentationBridgeEventType = {
  Ready: 'ready',
  SceneChanged: 'sceneChanged',
  StateChanged: 'stateChanged',
  Error: 'error',
} as const;
export type PresentationBridgeEventType =
  typeof PresentationBridgeEventType[keyof typeof PresentationBridgeEventType];

export const PresentationBridgeMessageSource = {
  Host: 'qingshu-host',
  Runtime: 'qingshu-runtime',
} as const;
export type PresentationBridgeMessageSource =
  typeof PresentationBridgeMessageSource[keyof typeof PresentationBridgeMessageSource];

export interface LinkedPresentationScene {
  id: string;
  title: string;
  anchor?: string;
}

export interface LinkedPresentationManifest {
  version: PresentationBridgeVersion;
  title?: string;
  scenes: LinkedPresentationScene[];
}

export interface PresentationBridgeCommand {
  source: typeof PresentationBridgeMessageSource.Host;
  version: PresentationBridgeVersion;
  type: PresentationBridgeCommandType;
  sceneId?: string;
  playbackStatus?: PresentationPlaybackStatus;
}

export interface PresentationBridgeEvent {
  source: typeof PresentationBridgeMessageSource.Runtime;
  version: PresentationBridgeVersion;
  type: PresentationBridgeEventType;
  sceneId?: string;
  playbackStatus?: PresentationPlaybackStatus;
  error?: string;
}
