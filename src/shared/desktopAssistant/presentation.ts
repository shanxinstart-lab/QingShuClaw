export const PresentationLayoutHint = {
  Cover: 'cover',
  Focus: 'focus',
  Showcase: 'showcase',
  Steps: 'steps',
  Summary: 'summary',
} as const;
export type PresentationLayoutHint =
  typeof PresentationLayoutHint[keyof typeof PresentationLayoutHint];

export const PresentationPlaybackStatus = {
  Idle: 'idle',
  Active: 'active',
  Paused: 'paused',
  Stopped: 'stopped',
  Finished: 'finished',
} as const;
export type PresentationPlaybackStatus =
  typeof PresentationPlaybackStatus[keyof typeof PresentationPlaybackStatus];

export interface PresentationScene {
  id: string;
  title: string;
  narration: string;
  summary: string;
  bullets: string[];
  sourceAnchor?: string;
  durationMs: number;
  layoutHint: PresentationLayoutHint;
}

export interface PresentationDeck {
  id: string;
  title: string;
  subtitle: string;
  sourceMessageId: string;
  sourcePreviewTarget: string;
  scenes: PresentationScene[];
}
