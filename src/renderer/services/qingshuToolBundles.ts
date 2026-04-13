import type {
  QingShuSharedToolCatalogSummary,
  QingShuToolBundleOption,
} from '../types/qingshuGovernance';

export const buildQingShuToolBundleOptions = (
  summary: QingShuSharedToolCatalogSummary | null,
): QingShuToolBundleOption[] => {
  if (!summary) {
    return [];
  }

  const activeModuleIds = new Set(
    summary.modules
      .filter((module) => module.enabled && module.sharedToolsEnabled && module.status === 'active')
      .map((module) => module.moduleId),
  );

  return summary.bundles
    .map((bundle) => ({
      bundleId: bundle.bundle,
      moduleIds: [...bundle.moduleIds].sort(),
      toolCount: bundle.toolCount,
      toolNames: [...bundle.toolNames].sort(),
      hasActiveModules: bundle.moduleIds.some((moduleId) => activeModuleIds.has(moduleId)),
    }))
    .sort((left, right) => left.bundleId.localeCompare(right.bundleId));
};
