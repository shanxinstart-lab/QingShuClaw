import fs from 'fs';
import path from 'path';
import { describe, expect, test } from 'vitest';

import { PetSource } from '../../shared/pet/constants';
import { BUILTIN_PETS } from './catalog';
import { isAllowedPetAssetDownloadUrl, PetStore } from './petStore';

const fixtureSpritesheet = fs.readFileSync(path.join(process.cwd(), 'resources', 'pets', 'codex-spritesheet-v4.webp'));

const makeTempDir = (): string => fs.mkdtempSync(path.join(process.cwd(), 'tmp-pet-store-'));

const writePetPackage = (dir: string, input?: {
  manifestFile?: 'pet.json' | 'avatar.json';
  id?: string;
  displayName?: string;
  spritesheetPath?: string;
}): void => {
  const manifestFile = input?.manifestFile ?? 'pet.json';
  const spritesheetPath = input?.spritesheetPath ?? 'spritesheet.png';
  fs.writeFileSync(path.join(dir, spritesheetPath), fixtureSpritesheet);
  fs.writeFileSync(path.join(dir, manifestFile), JSON.stringify({
    id: input?.id ?? 'local-pet',
    displayName: input?.displayName ?? 'Local Pet',
    spritesheetPath,
  }));
};

describe('pet asset download policy', () => {
  test('allows only the Codex pets HTTPS asset path', () => {
    expect(isAllowedPetAssetDownloadUrl(
      'https://persistent.oaistatic.com/codex/pets/v1/dewey-spritesheet-v4.webp',
    )).toBe(true);
    expect(isAllowedPetAssetDownloadUrl(
      'http://persistent.oaistatic.com/codex/pets/v1/dewey-spritesheet-v4.webp',
    )).toBe(false);
    expect(isAllowedPetAssetDownloadUrl(
      'https://example.com/codex/pets/v1/dewey-spritesheet-v4.webp',
    )).toBe(false);
    expect(isAllowedPetAssetDownloadUrl(
      'https://persistent.oaistatic.com/other/dewey-spritesheet-v4.webp',
    )).toBe(false);
  });
});

describe('PetStore custom imports', () => {
  test('loads every bundled Codex pet with a preview manifest', () => {
    const root = makeTempDir();
    try {
      const store = new PetStore({
        bundledPetsDir: path.join(process.cwd(), 'resources', 'pets'),
        userDataDir: path.join(root, 'userData'),
      });

      const pets = store.listPets();
      for (const builtin of BUILTIN_PETS) {
        const pet = pets.find((entry) => entry.id === builtin.id);
        expect(pet?.source).toBe(PetSource.Bundled);
        expect(pet?.installed).toBe(true);
        expect(pet?.selectable).toBe(true);
        expect(pet?.manifest?.spritesheetPath).toContain(builtin.spritesheetFile);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('imports a manifest file by copying its containing directory', async () => {
    const root = makeTempDir();
    try {
      const source = path.join(root, 'source');
      fs.mkdirSync(source);
      writePetPackage(source, { id: 'manifest-file-pet', displayName: 'Manifest File Pet' });
      const userDataDir = path.join(root, 'userData');
      const store = new PetStore({
        bundledPetsDir: path.join(root, 'bundled'),
        userDataDir,
      });

      const result = await store.importPet({ path: path.join(source, 'pet.json') });

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.pet?.id).toBe('manifest-file-pet');
      expect(fs.existsSync(path.join(userDataDir, 'pets', 'custom', 'manifest-file-pet', 'pet.json'))).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('deletes legacy avatar directories', async () => {
    const root = makeTempDir();
    try {
      const avatarDir = path.join(root, 'userData', 'pets', 'avatars', 'legacy-one');
      fs.mkdirSync(avatarDir, { recursive: true });
      writePetPackage(avatarDir, {
        manifestFile: 'avatar.json',
        id: 'legacy-one',
        displayName: 'Legacy One',
      });
      const store = new PetStore({
        bundledPetsDir: path.join(root, 'bundled'),
        userDataDir: path.join(root, 'userData'),
      });

      expect(store.listPets().find((pet) => pet.id === 'legacy-one')?.source).toBe(PetSource.LegacyAvatar);
      expect(store.deletePet('legacy-one')).toBe(true);
      expect(fs.existsSync(avatarDir)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('lists Codex home pets as read-only custom entries', () => {
    const root = makeTempDir();
    try {
      const codexHome = path.join(root, 'codexHome');
      const daguDir = path.join(codexHome, 'pets', 'dagu');
      fs.mkdirSync(daguDir, { recursive: true });
      writePetPackage(daguDir, {
        id: 'dagu',
        displayName: 'Dagu',
      });
      const store = new PetStore({
        bundledPetsDir: path.join(root, 'bundled'),
        userDataDir: path.join(root, 'userData'),
        codexHomeDir: codexHome,
      });

      const dagu = store.listPets().find((pet) => pet.id === 'codex:dagu');

      expect(dagu?.displayName).toBe('Dagu');
      expect(dagu?.source).toBe(PetSource.CodexCustom);
      expect(dagu?.installed).toBe(true);
      expect(dagu?.selectable).toBe(true);
      expect(store.deletePet('codex:dagu')).toBe(false);
      expect(fs.existsSync(daguDir)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('prefers Codex pets over duplicate legacy avatars', () => {
    const root = makeTempDir();
    try {
      const codexHome = path.join(root, 'codexHome');
      const petDir = path.join(codexHome, 'pets', 'xiaoling');
      const avatarDir = path.join(codexHome, 'avatars', 'xiaoling');
      fs.mkdirSync(petDir, { recursive: true });
      fs.mkdirSync(avatarDir, { recursive: true });
      writePetPackage(petDir, {
        id: 'xiaoling',
        displayName: 'Xiaoling Pet',
      });
      writePetPackage(avatarDir, {
        manifestFile: 'avatar.json',
        id: 'xiaoling',
        displayName: 'Xiaoling Avatar',
      });
      const store = new PetStore({
        bundledPetsDir: path.join(root, 'bundled'),
        userDataDir: path.join(root, 'userData'),
        codexHomeDir: codexHome,
      });

      const matches = store.listPets().filter((pet) => pet.id === 'codex:xiaoling');

      expect(matches).toHaveLength(1);
      expect(matches[0].displayName).toBe('Xiaoling Pet');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('skips invalid Codex custom pets', () => {
    const root = makeTempDir();
    try {
      const codexHome = path.join(root, 'codexHome');
      const invalidDir = path.join(codexHome, 'pets', 'invalid');
      fs.mkdirSync(invalidDir, { recursive: true });
      fs.writeFileSync(path.join(invalidDir, 'pet.json'), JSON.stringify({
        id: 'invalid',
        displayName: 'Invalid',
        spritesheetPath: '../escape.webp',
      }));
      const store = new PetStore({
        bundledPetsDir: path.join(root, 'bundled'),
        userDataDir: path.join(root, 'userData'),
        codexHomeDir: codexHome,
      });

      expect(store.listPets().some((pet) => pet.id === 'codex:invalid')).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('keeps invalid bundled spritesheets uninstalled', () => {
    const root = makeTempDir();
    try {
      const bundledDir = path.join(root, 'bundled');
      fs.mkdirSync(bundledDir);
      fs.writeFileSync(path.join(bundledDir, 'codex-spritesheet-v4.webp'), Buffer.from('invalid'));
      const store = new PetStore({
        bundledPetsDir: bundledDir,
        userDataDir: path.join(root, 'userData'),
      });

      const codex = store.listPets().find((pet) => pet.id === 'codex');

      expect(codex?.installed).toBe(false);
      expect(codex?.selectable).toBe(false);
      expect(codex?.error).toMatch(/missing or invalid/i);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
