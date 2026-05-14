import {
  DEFAULT_PET_ID,
  PET_FRAME_DEFAULTS,
  PET_SPRITESHEET_HEIGHT,
  PET_SPRITESHEET_WIDTH,
  PetSource,
} from '../../shared/pet/constants';
import type { PetCatalogEntry, PetManifest } from '../../shared/pet/types';
import { defaultPetAnimations } from './manifest';

const PET_CDN_BASE_URL = 'https://persistent.oaistatic.com/codex/pets/v1';

type BuiltinPet = {
  id: string;
  displayName: string;
  description: string;
  spritesheetFile: string;
  bundled: boolean;
};

export const BUILTIN_PETS: BuiltinPet[] = [
  {
    id: DEFAULT_PET_ID,
    displayName: 'Codex',
    description: 'The original Codex companion',
    spritesheetFile: 'codex-spritesheet-v4.webp',
    bundled: true,
  },
  {
    id: 'dewey',
    displayName: 'Dewey',
    description: 'A tidy duck for calm workspace days',
    spritesheetFile: 'dewey-spritesheet-v4.webp',
    bundled: true,
  },
  {
    id: 'fireball',
    displayName: 'Fireball',
    description: 'Hot path energy for fast iteration',
    spritesheetFile: 'fireball-spritesheet-v4.webp',
    bundled: true,
  },
  {
    id: 'rocky',
    displayName: 'Rocky',
    description: 'A steady rock when the diff gets large',
    spritesheetFile: 'rocky-spritesheet-v4.webp',
    bundled: true,
  },
  {
    id: 'seedy',
    displayName: 'Seedy',
    description: 'Small green shoots for new ideas',
    spritesheetFile: 'seedy-spritesheet-v4.webp',
    bundled: true,
  },
  {
    id: 'stacky',
    displayName: 'Stacky',
    description: 'A balanced stack for deep work',
    spritesheetFile: 'stacky-spritesheet-v4.webp',
    bundled: true,
  },
  {
    id: 'bsod',
    displayName: 'BSOD',
    description: 'A tiny blue-screen gremlin',
    spritesheetFile: 'bsod-spritesheet-v4.webp',
    bundled: true,
  },
  {
    id: 'null-signal',
    displayName: 'Null Signal',
    description: 'Quiet signal from the void',
    spritesheetFile: 'null-signal-spritesheet-v4.webp',
    bundled: true,
  },
];

export const builtinPetById = (id: string): BuiltinPet | undefined => (
  BUILTIN_PETS.find((pet) => pet.id === id)
);

export const builtinPetDownloadUrl = (spritesheetFile: string): string => (
  `${PET_CDN_BASE_URL}/${spritesheetFile}`
);

export const createBuiltinManifest = (pet: BuiltinPet, spritesheetPath: string): PetManifest => ({
  id: pet.id,
  displayName: pet.displayName,
  description: pet.description,
  spritesheetPath,
  frame: { ...PET_FRAME_DEFAULTS },
  animations: defaultPetAnimations(),
});

export const createBuiltinCatalogEntry = (
  pet: BuiltinPet,
  options: { installed: boolean; spritesheetPath?: string; error?: string },
): PetCatalogEntry => ({
  id: pet.id,
  displayName: pet.displayName,
  description: pet.description,
  source: pet.bundled ? PetSource.Bundled : PetSource.Downloaded,
  bundled: pet.bundled,
  installed: options.installed,
  selectable: options.installed || !pet.bundled,
  spritesheetFile: pet.spritesheetFile,
  downloadUrl: pet.bundled ? undefined : builtinPetDownloadUrl(pet.spritesheetFile),
  manifest: options.spritesheetPath ? createBuiltinManifest(pet, options.spritesheetPath) : undefined,
  error: options.error,
});

export const expectedSpritesheetSize = {
  width: PET_SPRITESHEET_WIDTH,
  height: PET_SPRITESHEET_HEIGHT,
} as const;
