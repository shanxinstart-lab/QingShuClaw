import { DEFAULT_PET_CONFIG, normalizePetConfig } from '../../shared/pet/config';
import type { PetConfig } from '../../shared/pet/types';
import type { SqliteStore } from '../sqliteStore';

type AppConfigWithPet = {
  pet?: unknown;
  [key: string]: unknown;
};

export class PetConfigStore {
  constructor(private readonly store: SqliteStore) {}

  getConfig(): PetConfig {
    const appConfig = this.store.get<AppConfigWithPet>('app_config') ?? {};
    return normalizePetConfig(appConfig.pet);
  }

  setConfig(update: Partial<PetConfig>): PetConfig {
    const appConfig = this.store.get<AppConfigWithPet>('app_config') ?? {};
    const currentPetConfig = normalizePetConfig(appConfig.pet);
    const next = normalizePetConfig({
      ...DEFAULT_PET_CONFIG,
      ...currentPetConfig,
      ...update,
      floatingWindow: {
        ...currentPetConfig.floatingWindow,
        ...(update.floatingWindow ?? {}),
      },
    });
    this.store.set('app_config', {
      ...appConfig,
      pet: next,
    });
    return next;
  }
}
