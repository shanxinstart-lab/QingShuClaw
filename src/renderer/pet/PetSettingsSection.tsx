import React, { useMemo, useState } from 'react';

import { PET_BUILTIN_CATALOG_ORDER, PetAnchor, PetAssetPolicy, PetMode, PetSource } from '../../shared/pet/constants';
import type { PetCatalogEntry } from '../../shared/pet/types';
import { i18nService } from '../services/i18n';
import PetCompanion, { PetSprite } from './PetCompanion';
import { petService } from './petService';
import { usePetState } from './usePetState';

const sourceText = (pet: PetCatalogEntry): string => {
  if (pet.source === PetSource.Custom) return i18nService.t('petSourceCustom');
  if (pet.source === PetSource.LegacyAvatar) return i18nService.t('petSourceLegacyAvatar');
  if (pet.source === PetSource.CodexCustom) return i18nService.t('petSourceCodexCustom');
  if (pet.bundled) return i18nService.t('petSourceBundled');
  return pet.installed ? i18nService.t('petSourceDownloaded') : i18nService.t('petSourceOnDemand');
};

const petActionText = (pet: PetCatalogEntry, selected: boolean): string => {
  if (selected) return i18nService.t('petSelected');
  if (!pet.installed && pet.downloadUrl) return i18nService.t('petDownloadAndSelect');
  return i18nService.t('petSelect');
};

const petSortOrder = (pet: PetCatalogEntry): number => {
  const builtinIndex = PET_BUILTIN_CATALOG_ORDER.findIndex((id) => id === pet.id);
  if (builtinIndex >= 0 && (pet.source === PetSource.Bundled || pet.source === PetSource.Downloaded)) {
    return builtinIndex;
  }
  if (pet.source === PetSource.Custom || pet.source === PetSource.LegacyAvatar || pet.source === PetSource.CodexCustom) {
    return PET_BUILTIN_CATALOG_ORDER.length + 1;
  }
  return PET_BUILTIN_CATALOG_ORDER.length;
};

const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
      disabled ? 'cursor-not-allowed opacity-50' : ''
    } ${checked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

const PetSettingsSection: React.FC = () => {
  const state = usePetState();
  const [error, setError] = useState<string | null>(null);
  const [busyPetId, setBusyPetId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const sortedPets = useMemo(
    () => [...(state?.pets ?? [])].sort((left, right) => {
      const orderDelta = petSortOrder(left) - petSortOrder(right);
      return orderDelta || left.displayName.localeCompare(right.displayName);
    }),
    [state?.pets],
  );

  if (!state) {
    return (
      <div className="rounded-lg border border-border bg-surface-subtle p-4 text-sm text-secondary">
        {i18nService.t('petLoadingConfig')}
      </div>
    );
  }

  const updateConfig = async (patch: Parameters<typeof petService.setConfig>[0]) => {
    setError(null);
    try {
      await petService.setConfig(patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : i18nService.t('petSaveConfigFailed'));
    }
  };

  return (
    <div id="pet-settings-section" className="space-y-5 rounded-lg border border-border bg-surface-subtle p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-sm font-medium text-foreground">{i18nService.t('petSettingsTitle')}</h4>
          <p className="mt-1 text-xs leading-5 text-secondary">
            {i18nService.t('petSettingsDescription')}
          </p>
        </div>
        <Toggle
          checked={state.config.enabled}
          onChange={(enabled) => void updateConfig({ enabled })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_180px]">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-secondary">{i18nService.t('petDisplayMode')}</span>
            <select
              value={state.config.mode}
              onChange={(event) => void updateConfig({ mode: event.target.value as PetMode })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none"
            >
              <option value={PetMode.Embedded}>{i18nService.t('petModeEmbedded')}</option>
              <option value={PetMode.Floating}>{i18nService.t('petModeFloating')}</option>
              <option value={PetMode.Both}>{i18nService.t('petModeBoth')}</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-secondary">{i18nService.t('petAnchor')}</span>
            <select
              value={state.config.anchor}
              onChange={(event) => void updateConfig({ anchor: event.target.value as PetAnchor })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none"
            >
              <option value={PetAnchor.Composer}>{i18nService.t('petAnchorComposer')}</option>
              <option value={PetAnchor.AppBottom}>{i18nService.t('petAnchorAppBottom')}</option>
              <option value={PetAnchor.ScreenBottom}>{i18nService.t('petAnchorScreenBottom')}</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-secondary">{i18nService.t('petAssetPolicy')}</span>
            <select
              value={state.config.assetPolicy}
              onChange={(event) => void updateConfig({ assetPolicy: event.target.value as PetAssetPolicy })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none"
            >
              <option value={PetAssetPolicy.Mixed}>{i18nService.t('petAssetPolicyMixed')}</option>
              <option value={PetAssetPolicy.BundledOnly}>{i18nService.t('petAssetPolicyBundledOnly')}</option>
              <option value={PetAssetPolicy.DownloadOnDemand}>{i18nService.t('petAssetPolicyDownloadOnDemand')}</option>
            </select>
            <span className="mt-1 block text-xs text-secondary">{i18nService.t('petAssetPolicyHint')}</span>
          </label>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-foreground">{i18nService.t('petAnimations')}</div>
              <div className="text-xs text-secondary">{i18nService.t('petAnimationsHint')}</div>
            </div>
            <Toggle
              checked={state.config.animationsEnabled}
              onChange={(animationsEnabled) => void updateConfig({ animationsEnabled })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-foreground">{i18nService.t('petFloatingWindow')}</div>
              <div className="text-xs text-secondary">{i18nService.t('petFloatingWindowHint')}</div>
            </div>
            <Toggle
              checked={state.config.floatingWindow.visible}
              disabled={state.config.mode === PetMode.Embedded}
              onChange={(visible) => {
                setError(null);
                void petService.setFloatingVisible(visible).catch((err) => {
                  setError(err instanceof Error ? err.message : i18nService.t('petSaveConfigFailed'));
                });
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-foreground">{i18nService.t('petCustomPets')}</div>
              <div className="text-xs text-secondary">{i18nService.t('petCustomPetsHint')}</div>
            </div>
            <Toggle
              checked={state.config.customPetsEnabled}
              onChange={(customPetsEnabled) => void updateConfig({ customPetsEnabled })}
            />
          </div>
        </div>

        <div className="flex min-h-[170px] items-center justify-center rounded-lg border border-border bg-surface">
          {state.activePet?.manifest ? (
            <PetCompanion state={state} />
          ) : (
            <span className="text-xs text-secondary">{i18nService.t('petPreviewEmpty')}</span>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h5 className="text-xs font-medium uppercase tracking-wide text-secondary">{i18nService.t('petSelectTitle')}</h5>
          <button
            type="button"
            disabled={!state.config.customPetsEnabled || importing}
            onClick={async () => {
              setError(null);
              setImporting(true);
              try {
                await petService.importPet();
              } catch (err) {
                setError(err instanceof Error ? err.message : i18nService.t('petImportFailed'));
              } finally {
                setImporting(false);
              }
            }}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? i18nService.t('petImporting') : i18nService.t('petImport')}
          </button>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {sortedPets.map((pet) => {
            const selected = pet.id === state.config.selectedPetId;
            const busy = busyPetId === pet.id;
            return (
              <div
                key={`${pet.source}-${pet.id}`}
                className={`flex min-h-[112px] items-center gap-4 border-b border-border px-4 py-3 last:border-b-0 ${
                  selected ? 'bg-primary/5' : ''
                } ${pet.selectable ? '' : 'opacity-70'}`}
              >
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-subtle">
                  {pet.manifest ? (
                    <PetSprite
                      pet={pet}
                      status={state.status}
                      animationsEnabled={false}
                      size={56}
                    />
                  ) : (
                    <span className="px-2 text-center text-[10px] leading-4 text-secondary">{i18nService.t('petPendingDownload')}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-medium text-foreground">{pet.displayName}</div>
                  <div className="mt-1 line-clamp-2 text-sm leading-5 text-secondary">
                    {pet.description || sourceText(pet)}
                  </div>
                  {pet.error && <div className="truncate text-xs text-red-500">{pet.error}</div>}
                </div>
                <button
                  type="button"
                  disabled={!pet.selectable || busy}
                  title={pet.error || undefined}
                  onClick={async () => {
                    setError(null);
                    setBusyPetId(pet.id);
                    try {
                      await petService.selectPet(pet.id);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : i18nService.t('petSaveConfigFailed'));
                    } finally {
                      setBusyPetId(null);
                    }
                  }}
                  className={`shrink-0 rounded-xl px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? 'bg-surface-subtle text-secondary'
                      : 'bg-surface-subtle text-foreground hover:bg-surface-hover'
                  }`}
                >
                  {busy ? i18nService.t('petLoading') : petActionText(pet, selected)}
                </button>
                {(pet.source === PetSource.Custom || pet.source === PetSource.LegacyAvatar) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setError(null);
                      setBusyPetId(pet.id);
                      try {
                        await petService.deletePet(pet.id);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : i18nService.t('petSaveConfigFailed'));
                      } finally {
                        setBusyPetId(null);
                      }
                    }}
                    className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {i18nService.t('petDelete')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
};

export default PetSettingsSection;
