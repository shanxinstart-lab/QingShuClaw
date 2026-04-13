import type {
  QingShuSharedToolBundleSummary,
  QingShuSharedToolCatalog,
  QingShuSharedToolCatalogSummary,
  QingShuSharedToolDescriptor,
  QingShuSharedToolModuleSummary,
  QingShuToolBundleId,
} from './types';

const buildBundleSummaries = (
  tools: QingShuSharedToolDescriptor[],
): QingShuSharedToolBundleSummary[] => {
  const bundleMap = new Map<QingShuToolBundleId, { moduleIds: Set<string>; toolNames: Set<string> }>();

  for (const tool of tools) {
    const entry = bundleMap.get(tool.bundle) ?? {
      moduleIds: new Set<string>(),
      toolNames: new Set<string>(),
    };
    entry.moduleIds.add(tool.module);
    entry.toolNames.add(tool.toolName);
    bundleMap.set(tool.bundle, entry);
  }

  return Array.from(bundleMap.entries())
    .map(([bundle, entry]) => ({
      bundle,
      moduleIds: Array.from(entry.moduleIds).sort(),
      toolNames: Array.from(entry.toolNames).sort(),
      toolCount: entry.toolNames.size,
    }))
    .sort((left, right) => left.bundle.localeCompare(right.bundle));
};

const buildModuleSummaries = (
  catalog: QingShuSharedToolCatalog,
): QingShuSharedToolModuleSummary[] => {
  return catalog.modules
    .map((moduleStatus) => {
      const moduleTools = catalog.tools.filter((tool) => tool.module === moduleStatus.moduleId);
      const bundles = Array.from(new Set(moduleTools.map((tool) => tool.bundle))).sort();
      return {
        moduleId: moduleStatus.moduleId,
        version: moduleStatus.version,
        status: moduleStatus.status,
        enabled: moduleStatus.enabled,
        sharedToolsEnabled: moduleStatus.sharedToolsEnabled,
        builtInSkillsEnabled: moduleStatus.builtInSkillsEnabled,
        sharedToolCount: moduleTools.length,
        bundles,
        ...(moduleStatus.error ? { error: moduleStatus.error } : {}),
      };
    })
    .sort((left, right) => left.moduleId.localeCompare(right.moduleId));
};

export const summarizeQingShuSharedToolCatalog = (
  catalog: QingShuSharedToolCatalog,
): QingShuSharedToolCatalogSummary => {
  const tools = [...catalog.tools].sort((left, right) => left.toolName.localeCompare(right.toolName));
  return {
    generatedAt: catalog.generatedAt,
    modules: buildModuleSummaries({
      ...catalog,
      tools,
    }),
    bundles: buildBundleSummaries(tools),
    tools,
  };
};
