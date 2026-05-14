import { PetAssetPolicy, PetSource } from '../../shared/pet/constants';
import type { PetCatalogEntry, PetConfig } from '../../shared/pet/types';

const CUSTOM_DISABLED_ERROR = 'Custom pets are disabled.';
const DOWNLOAD_DISABLED_ERROR = 'Pet downloads are disabled by asset policy.';

export const canSelectPetEntry = (
  pet: PetCatalogEntry,
  config: PetConfig,
): { selectable: boolean; error?: string } => {
  if (
    (pet.source === PetSource.Custom || pet.source === PetSource.LegacyAvatar || pet.source === PetSource.CodexCustom)
    && !config.customPetsEnabled
  ) {
    return { selectable: false, error: CUSTOM_DISABLED_ERROR };
  }

  if (
    config.assetPolicy === PetAssetPolicy.BundledOnly
    && pet.source === PetSource.Downloaded
    && !pet.installed
  ) {
    return { selectable: false, error: DOWNLOAD_DISABLED_ERROR };
  }

  if (!pet.installed && !pet.downloadUrl) {
    return { selectable: false, error: pet.error };
  }

  return { selectable: pet.selectable, error: pet.error };
};

export const applyPetConfigToCatalog = (
  pets: PetCatalogEntry[],
  config: PetConfig,
): PetCatalogEntry[] => pets.map((pet) => {
  const policy = canSelectPetEntry(pet, config);
  return {
    ...pet,
    selectable: policy.selectable,
    error: policy.error,
  };
});
