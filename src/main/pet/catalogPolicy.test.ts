import { describe, expect, test } from 'vitest';

import { DEFAULT_PET_CONFIG } from '../../shared/pet/config';
import { PetAssetPolicy, PetSource } from '../../shared/pet/constants';
import type { PetCatalogEntry } from '../../shared/pet/types';
import { applyPetConfigToCatalog, canSelectPetEntry } from './catalogPolicy';

const entry = (overrides: Partial<PetCatalogEntry>): PetCatalogEntry => ({
  id: 'pet',
  displayName: 'Pet',
  description: '',
  source: PetSource.Bundled,
  bundled: true,
  installed: true,
  selectable: true,
  ...overrides,
});

describe('pet catalog policy', () => {
  test('blocks uncached downloaded pets when bundled-only policy is active', () => {
    const result = canSelectPetEntry(entry({
      source: PetSource.Downloaded,
      bundled: false,
      installed: false,
    }), {
      ...DEFAULT_PET_CONFIG,
      assetPolicy: PetAssetPolicy.BundledOnly,
    });

    expect(result.selectable).toBe(false);
    expect(result.error).toMatch(/download/i);
  });

  test('keeps cached downloaded pets selectable under bundled-only policy', () => {
    const result = canSelectPetEntry(entry({
      source: PetSource.Downloaded,
      bundled: false,
      installed: true,
    }), {
      ...DEFAULT_PET_CONFIG,
      assetPolicy: PetAssetPolicy.BundledOnly,
    });

    expect(result.selectable).toBe(true);
  });

  test('blocks custom pets when custom imports are disabled', () => {
    const pets = applyPetConfigToCatalog([
      entry({ id: 'local', source: PetSource.Custom, bundled: false }),
      entry({ id: 'codex:local', source: PetSource.CodexCustom, bundled: false }),
    ], {
      ...DEFAULT_PET_CONFIG,
      customPetsEnabled: false,
    });

    expect(pets[0].selectable).toBe(false);
    expect(pets[0].error).toMatch(/custom/i);
    expect(pets[1].selectable).toBe(false);
    expect(pets[1].error).toMatch(/custom/i);
  });

  test('blocks missing bundled pets without a download URL', () => {
    const result = canSelectPetEntry(entry({
      installed: false,
      downloadUrl: undefined,
      error: 'Bundled pet spritesheet is missing or invalid.',
    }), DEFAULT_PET_CONFIG);

    expect(result.selectable).toBe(false);
    expect(result.error).toMatch(/missing or invalid/i);
  });
});
