import { OpenClawProviderId, ProviderRegistry } from '../../shared/providers/constants';

import type { Model } from '../store/slices/modelSlice';

export function toOpenClawModelRef(model: Pick<Model, 'id' | 'providerKey' | 'isServerModel'>): string {
  if (model.isServerModel) {
    return `${OpenClawProviderId.LobsteraiServer}/${model.id}`;
  }

  const providerId = ProviderRegistry.get(model.providerKey ?? '')?.openClawProviderId
    ?? model.providerKey
    ?? OpenClawProviderId.Lobster;
  return `${providerId}/${model.id}`;
}

export function matchesOpenClawModelRef(
  modelRef: string,
  model: Pick<Model, 'id' | 'providerKey' | 'isServerModel'>,
): boolean {
  const normalizedRef = modelRef.trim();
  if (!normalizedRef) return false;
  if (normalizedRef.includes('/')) {
    return normalizedRef === toOpenClawModelRef(model);
  }
  return normalizedRef === model.id;
}

export function resolveOpenClawModelRef<T extends Pick<Model, 'id' | 'providerKey' | 'isServerModel'>>(
  modelRef: string,
  availableModels: T[],
): T | null {
  const normalizedRef = modelRef.trim();
  if (!normalizedRef) return null;

  if (normalizedRef.includes('/')) {
    return availableModels.find((model) => toOpenClawModelRef(model) === normalizedRef) ?? null;
  }

  const matchingModels = availableModels.filter((model) => model.id === normalizedRef);
  return matchingModels.length === 1 ? matchingModels[0] : null;
}
