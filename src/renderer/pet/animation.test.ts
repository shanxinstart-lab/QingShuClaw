import { describe, expect, test } from 'vitest';

import { PetStatus } from '../../shared/pet/constants';
import type { PetManifest } from '../../shared/pet/types';
import { nextPetFrameIndex, PetInteractionState, resolvePetAnimation } from './animation';

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
    jumping: { frames: [{ spriteIndex: 32, durationMs: 140 }], loopStart: 0, fallback: 'idle' },
    bounce: { frames: [{ spriteIndex: 33, durationMs: 140 }], loopStart: 0, fallback: 'idle' },
    'running-right': { frames: [{ spriteIndex: 8, durationMs: 120 }], loopStart: 0, fallback: 'idle' },
    'running-left': { frames: [{ spriteIndex: 16, durationMs: 120 }], loopStart: 0, fallback: 'idle' },
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

  test('uses jumping animation while hovering over the pet', () => {
    expect(resolvePetAnimation(manifest, PetStatus.Idle, PetInteractionState.Hover).frames[0].spriteIndex).toBe(32);
  });

  test('uses Codex running animation while dragging the pet', () => {
    expect(resolvePetAnimation(manifest, PetStatus.Running, PetInteractionState.Dragging).frames[0].spriteIndex).toBe(8);
    expect(resolvePetAnimation(manifest, PetStatus.Running, PetInteractionState.DraggingRight).frames[0].spriteIndex).toBe(8);
    expect(resolvePetAnimation(manifest, PetStatus.Running, PetInteractionState.DraggingLeft).frames[0].spriteIndex).toBe(16);
  });

  test('supports legacy move animation names while dragging the pet', () => {
    const legacyManifest: PetManifest = {
      ...manifest,
      animations: {
        idle: manifest.animations.idle,
        running: manifest.animations.running,
        move_right: { frames: [{ spriteIndex: 8, durationMs: 120 }], loopStart: 0, fallback: 'idle' },
        move_left: { frames: [{ spriteIndex: 16, durationMs: 120 }], loopStart: 0, fallback: 'idle' },
      },
    };

    expect(resolvePetAnimation(legacyManifest, PetStatus.Running, PetInteractionState.DraggingRight).frames[0].spriteIndex).toBe(8);
    expect(resolvePetAnimation(legacyManifest, PetStatus.Running, PetInteractionState.DraggingLeft).frames[0].spriteIndex).toBe(16);
  });

  test('falls back to the status animation when interaction animation is missing', () => {
    const sparseManifest: PetManifest = {
      ...manifest,
      animations: {
        idle: manifest.animations.idle,
        running: manifest.animations.running,
      },
    };

    expect(resolvePetAnimation(sparseManifest, PetStatus.Running, PetInteractionState.Dragging).frames[0].spriteIndex).toBe(56);
  });
});
