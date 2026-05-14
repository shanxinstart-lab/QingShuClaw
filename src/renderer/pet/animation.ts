import { PetStatus } from '../../shared/pet/constants';
import type { PetAnimation, PetManifest } from '../../shared/pet/types';

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

export const resolvePetAnimation = (
  manifest: PetManifest,
  status: PetStatus,
): PetAnimation => (
  manifest.animations[statusAnimationName(status)]
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
