import fs from 'fs';
import path from 'path';
import { describe, expect, test } from 'vitest';

import { PET_SPRITESHEET_HEIGHT, PET_SPRITESHEET_WIDTH } from '../../shared/pet/constants';
import { loadPetManifest, resolveManifestSpritesheetPath, validateSpritesheetDimensions } from './manifest';

const tinyPng = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8ffff3f0005fe02fea73581e80000000049454e44ae426082',
  'hex',
);

describe('pet manifest', () => {
  test('blocks spritesheet paths outside the pet directory', () => {
    expect(() => resolveManifestSpritesheetPath('/tmp/pet', '../secret.png')).toThrow(/inside/);
    expect(() => resolveManifestSpritesheetPath('/tmp/pet', 'sprites/../../secret.png')).toThrow(/inside/);
    expect(() => resolveManifestSpritesheetPath('/tmp/pet', '/tmp/secret.png')).toThrow(/relative/);
  });

  test('rejects invalid spritesheet dimensions', () => {
    const dir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-pet-'));
    try {
      const file = path.join(dir, 'spritesheet.png');
      fs.writeFileSync(file, tinyPng);
      expect(() => validateSpritesheetDimensions(file)).toThrow(`${PET_SPRITESHEET_WIDTH}x${PET_SPRITESHEET_HEIGHT}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('accepts Codex WebP spritesheets with VP8L dimensions', () => {
    const file = path.join(process.cwd(), 'resources', 'pets', 'codex-spritesheet-v4.webp');
    expect(() => validateSpritesheetDimensions(file)).not.toThrow();
  });

  test('requires a spritesheet file when loading manifest', () => {
    const dir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-pet-'));
    try {
      fs.writeFileSync(path.join(dir, 'pet.json'), JSON.stringify({ id: 'local' }));
      expect(() => loadPetManifest(dir, 'pet.json', 'local')).toThrow(/missing/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
