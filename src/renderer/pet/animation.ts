import { PetStatus } from '../../shared/pet/constants';
import type { PetAnimation, PetManifest } from '../../shared/pet/types';

export const PetInteractionState = {
  None: 'none',
  Hover: 'hover',
  Dragging: 'dragging',
  DraggingLeft: 'dragging-left',
  DraggingRight: 'dragging-right',
} as const;

export type PetInteractionState = typeof PetInteractionState[keyof typeof PetInteractionState];

const statusAnimationName = (status: PetStatus): string => {
  switch (status) {
    case PetStatus.Running:
      return 'running';
    case PetStatus.Waiting:
      return 'waiting';
    case PetStatus.Review:
      return 'review';
    case PetStatus.Failed:
      return 'failed';
    case PetStatus.Idle:
    default:
      return 'idle';
  }
};

const interactionAnimationNames = (interaction: PetInteractionState): string[] => {
  switch (interaction) {
    case PetInteractionState.DraggingRight:
      return ['running-right', 'move_right', 'running', 'bounce', 'jumping', 'wave'];
    case PetInteractionState.DraggingLeft:
      return ['running-left', 'move_left', 'running', 'bounce', 'jumping', 'wave'];
    case PetInteractionState.Dragging:
      return ['running-right', 'move_right', 'running-left', 'move_left', 'running', 'bounce', 'jumping', 'wave'];
    case PetInteractionState.Hover:
      return ['jumping', 'bounce', 'wave'];
    case PetInteractionState.None:
    default:
      return [];
  }
};

export const resolvePetAnimation = (
  manifest: PetManifest,
  status: PetStatus,
  interaction: PetInteractionState = PetInteractionState.None,
): PetAnimation => (
  interactionAnimationNames(interaction)
    .map((name) => manifest.animations[name])
    .find(Boolean)
  ?? manifest.animations[statusAnimationName(status)]
  ?? manifest.animations.idle
  ?? {
    frames: [{ spriteIndex: 0, durationMs: 1000 }],
    loopStart: 0,
    fallback: 'idle',
  }
);

export const resolveFramePosition = (
  spriteIndex: number,
  columns: number,
): { row: number; column: number } => ({
  row: Math.floor(spriteIndex / columns),
  column: spriteIndex % columns,
});

export const nextPetFrameIndex = (
  animation: PetAnimation,
  currentIndex: number,
): number => {
  if (animation.frames.length <= 1) return 0;
  const next = currentIndex + 1;
  if (next < animation.frames.length) return next;
  return animation.loopStart ?? Math.max(0, animation.frames.length - 1);
};
