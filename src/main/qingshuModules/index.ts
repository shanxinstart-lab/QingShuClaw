import { DefaultQingShuExtensionHost } from './host';
export { createQingShuAuthFetchProvider } from './authFetchProvider';
export { resolveAgentToolBundleSelections } from './agentBundles';
export { generateQingShuSharedToolContracts } from './contractGenerator';
export { createQingShuGovernanceService } from './governanceService';
export { resolveQingShuModuleFeatureFlagsFromConfig } from './config';
export { summarizeQingShuSharedToolCatalog } from './sharedToolCatalog';
export {
  parseQingShuSkillDependencies,
  readQingShuSkillDependencies,
} from './skillDependencies';
export { validateQingShuSkillDependencies } from './skillDependencyValidator';
export {
  analyzeQingShuSkillGovernance,
  readQingShuSkillGovernance,
} from './skillGovernance';
import type {
  QingShuAgentToolBundleSelection,
  QingShuAuthFetchProvider,
  QingShuExtensionHost,
  QingShuExtensionModule,
  QingShuGovernanceService,
  QingShuInstalledSkillGovernanceItem,
  QingShuModuleFlagConfig,
  QingShuModuleFeatureFlags,
  QingShuSkillDeclaredDependency,
  QingShuSkillGovernanceBatchItem,
  QingShuSkillGovernanceResult,
  QingShuSkillDependencyParseResult,
  QingShuSkillDependencyValidationIssue,
  QingShuSkillDependencyValidationLevel,
  QingShuSkillDependencyValidationResult,
  QingShuSharedToolCatalog,
  QingShuSharedToolContractArtifacts,
  QingShuSharedToolContractPayload,
  QingShuSharedToolCatalogSummary,
  QingShuToolBundleId,
} from './types';

export type {
  QingShuAgentToolBundleSelection,
  QingShuAuthFetchProvider,
  QingShuExtensionHost,
  QingShuExtensionModule,
  QingShuGovernanceService,
  QingShuInstalledSkillGovernanceItem,
  QingShuModuleFeatureFlags,
  QingShuModuleFlagConfig,
  QingShuSkillDeclaredDependency,
  QingShuSkillGovernanceBatchItem,
  QingShuSkillGovernanceResult,
  QingShuSkillDependencyParseResult,
  QingShuSkillDependencyValidationIssue,
  QingShuSkillDependencyValidationLevel,
  QingShuSkillDependencyValidationResult,
  QingShuSharedToolCatalog,
  QingShuSharedToolContractArtifacts,
  QingShuSharedToolContractPayload,
  QingShuSharedToolCatalogSummary,
  QingShuToolBundleId,
} from './types';

export type QingShuExtensionHostDeps = {
  auth: QingShuAuthFetchProvider;
  resolveFeatureFlags: (moduleId: string, enabledByDefault: boolean) => QingShuModuleFeatureFlags;
  modules?: QingShuExtensionModule[];
};

export const createQingShuExtensionHost = (
  deps: QingShuExtensionHostDeps,
): QingShuExtensionHost => {
  const host = new DefaultQingShuExtensionHost({
    resolveFeatureFlags: deps.resolveFeatureFlags,
  });
  host.initialize(deps.modules ?? []);
  return host;
};
