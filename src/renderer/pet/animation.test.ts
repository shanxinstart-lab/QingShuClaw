import { describe, expect, test } from 'vitest';

import { PetStatus } from '../../shared/pet/constants';
import type { PetManifest } from '../../shared/pet/types';
import { nextPetFrameIndex, resolvePetAnimation } from './animation';

const manifest: PetManifest = {
  id: 'test',
  displayName: 'Test',
  description: '',
  spritesheetPath: '/tmp/sheet.png',
  frame: { width: 192, height: 208, columns: 8, rows: 9 },
  animations: {
    idle: { frames: [{ spriteIndex: 0, durationMs: 1000 }], loopStart: 0, fallback: 'idle' },
    running: { frames: [{ spriteIndex: 56, durationMs: 120 }], loopStart: 0, fallback: 'idle' },
    waiting: { frames: [{ spriteIndex: 48, durationMs: 150 }], loopStart: 0, fallback: 'idle' },
    review: { frames: [{ spriteIndex: 64, durationMs: 150 }], loopStart: 0, fallback: 'idle' },
    failed: { frames: [{ spriteIndex: 40, durationMs: 140 }], loopStart: 0, fallback: 'idle' },
  },
};

describe('pet animation mapping', () => {
  test.each([
    [PetStatus.Idle, 0],
    [PetStatus.Running, 56],
    [PetStatus.Waiting, 48],
    [PetStatus.Review, 64],
    [PetStatus.Failed, 40],
  ])('maps %s to the expected animation', (status, spriteIndex) => {
    expect(resolvePetAnimation(manifest, status).frames[0].spriteIndex).toBe(spriteIndex);
  });

  test('loops from the configured loop start', () => {
    expect(nextPetFrameIndex({
      frames: [
        { spriteIndex: 1, durationMs: 1 },
        { spriteIndex: 2, durationMs: 1 },
        { spriteIndex: 3, durationMs: 1 },
      ],
      loopStart: 1,
      fallback: 'idle',
    }, 2)).toBe(1);
  });

  test('falls back to idle when a status animation is missing', () => {
    const sparseManifest: PetManifest = {
      ...manifest,
      animations: {
        idle: manifest.animations.idle,
      },
    };

    expect(resolvePetAnimation(sparseManifest, PetStatus.Running).frames[0].spriteIndex).toBe(0);
  });
});
