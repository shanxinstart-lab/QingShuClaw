export const QingShuToolVisibility = {
  Internal: 'internal',
  Shared: 'shared',
  Experimental: 'experimental',
} as const;

export type QingShuToolVisibility =
  typeof QingShuToolVisibility[keyof typeof QingShuToolVisibility];

export const QingShuToolAudience = {
  System: 'system',
  UserSkill: 'user-skill',
  Both: 'both',
} as const;

export type QingShuToolAudience =
  typeof QingShuToolAudience[keyof typeof QingShuToolAudience];

export const QingShuToolStability = {
  Stable: 'stable',
  Beta: 'beta',
} as const;

export type QingShuToolStability =
  typeof QingShuToolStability[keyof typeof QingShuToolStability];

export const QingShuToolDangerLevel = {
  Read: 'read',
  Write: 'write',
  Admin: 'admin',
} as const;

export type QingShuToolDangerLevel =
  typeof QingShuToolDangerLevel[keyof typeof QingShuToolDangerLevel];

export type QingShuToolBundleId = string;
export type QingShuCapabilityKey = string;

export type QingShuFetchJsonOptions = RequestInit & {
  query?: Record<string, string | number | boolean | null | undefined>;
};

export interface QingShuAuthFetchProvider {
  fetchJsonWithAuth<T>(path: string, options?: QingShuFetchJsonOptions): Promise<T>;
  getCurrentUser(): Promise<{ success: boolean; user?: any; quota?: any }>;
  refreshIfNeeded(reason?: string): Promise<{ success: boolean; accessToken?: string }>;
}

export interface QingShuCapabilityInvokeContext {
  auth: QingShuAuthFetchProvider;
}

export interface QingShuCapabilityManifest {
  key: QingShuCapabilityKey;
  toolName: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  module: string;
  visibility: QingShuToolVisibility;
  bundle: QingShuToolBundleId;
  audience: QingShuToolAudience;
  stability: QingShuToolStability;
  dangerLevel: QingShuToolDangerLevel;
  invoke?: (
    args: Record<string, unknown>,
    context: QingShuCapabilityInvokeContext
  ) => Promise<unknown>;
}

export interface QingShuSharedToolDescriptor {
  capabilityKey: QingShuCapabilityKey;
  toolName: string;
  description: string;
  module: string;
  bundle: QingShuToolBundleId;
  visibility: QingShuToolVisibility;
  audience: QingShuToolAudience;
  stability: QingShuToolStability;
  dangerLevel: QingShuToolDangerLevel;
  inputSchema?: Record<string, unknown>;
}

export interface QingShuPluginDescriptor {
  pluginId: string;
  category?: 'channel' | 'bridge' | 'runtime';
  sourceType?: 'bundled' | 'local-extension' | 'module';
}

export interface QingShuSkillDescriptor {
  skillId: string;
  description?: string;
}

export interface QingShuModuleRegistration {
  moduleId: string;
  version: string;
  enabledByDefault: boolean;
  capabilities: QingShuCapabilityManifest[];
  toolBundles: QingShuToolBundleId[];
  sharedToolDescriptors: QingShuSharedToolDescriptor[];
  pluginDescriptors?: QingShuPluginDescriptor[];
  skillDescriptors?: QingShuSkillDescriptor[];
}

export interface QingShuExtensionModule {
  register(): QingShuModuleRegistration;
}

export const QingShuModuleStatusKind = {
  Active: 'active',
  Disabled: 'disabled',
  Failed: 'failed',
} as const;

export type QingShuModuleStatusKind =
  typeof QingShuModuleStatusKind[keyof typeof QingShuModuleStatusKind];

export interface QingShuModuleStatus {
  moduleId: string;
  version: string;
  status: QingShuModuleStatusKind;
  enabled: boolean;
  sharedToolsEnabled: boolean;
  builtInSkillsEnabled: boolean;
  error?: string;
}

export interface QingShuModuleFeatureFlags {
  enabled: boolean;
  sharedToolsEnabled: boolean;
  builtInSkillsEnabled: boolean;
}

export interface QingShuModuleFlagConfig {
  enabled?: boolean;
  sharedToolsEnabled?: boolean;
  builtInSkillsEnabled?: boolean;
}

export interface QingShuAgentToolBundleSelection {
  agentId: string;
  toolBundleIds: QingShuToolBundleId[];
}

export interface QingShuSkillDeclaredDependency {
  toolBundles: QingShuToolBundleId[];
  toolRefs: string[];
  capabilityRefs: QingShuCapabilityKey[];
}

export interface QingShuSkillDependencyParseResult {
  dependencies: QingShuSkillDeclaredDependency;
  hasDeclarations: boolean;
}

export const QingShuSkillDependencyValidationLevel = {
  Error: 'error',
  Warn: 'warn',
  Info: 'info',
} as const;

export type QingShuSkillDependencyValidationLevel =
  typeof QingShuSkillDependencyValidationLevel[keyof typeof QingShuSkillDependencyValidationLevel];

export interface QingShuSkillDependencyValidationIssue {
  level: QingShuSkillDependencyValidationLevel;
  code: string;
  message: string;
  field: 'toolBundles' | 'toolRefs' | 'capabilityRefs' | 'general';
  ref?: string;
}

export interface QingShuSkillDependencyValidationResult {
  valid: boolean;
  issues: QingShuSkillDependencyValidationIssue[];
  dependencies: QingShuSkillDeclaredDependency;
}

export interface QingShuSharedToolCatalog {
  generatedAt: number;
  modules: QingShuModuleStatus[];
  tools: QingShuSharedToolDescriptor[];
}

export interface QingShuSharedToolBundleSummary {
  bundle: QingShuToolBundleId;
  moduleIds: string[];
  toolNames: string[];
  toolCount: number;
}

export interface QingShuSharedToolModuleSummary {
  moduleId: string;
  version: string;
  status: QingShuModuleStatusKind;
  enabled: boolean;
  sharedToolsEnabled: boolean;
  builtInSkillsEnabled: boolean;
  sharedToolCount: number;
  bundles: QingShuToolBundleId[];
  error?: string;
}

export interface QingShuSharedToolCatalogSummary {
  generatedAt: number;
  modules: QingShuSharedToolModuleSummary[];
  bundles: QingShuSharedToolBundleSummary[];
  tools: QingShuSharedToolDescriptor[];
}

export interface QingShuSharedToolContractPayload {
  generatedAt: number;
  modules: QingShuSharedToolModuleSummary[];
  bundles: QingShuSharedToolBundleSummary[];
  tools: QingShuSharedToolDescriptor[];
}

export interface QingShuSharedToolContractArtifacts {
  payload: QingShuSharedToolContractPayload;
  markdown: string;
  json: string;
  suggestedMarkdownPath: string;
  suggestedJsonPath: string;
}

export interface QingShuSkillGovernanceResult {
  dependencies: QingShuSkillDependencyParseResult;
  validation: QingShuSkillDependencyValidationResult;
  catalog: QingShuSharedToolCatalogSummary;
  contracts: QingShuSharedToolContractArtifacts;
}

export interface QingShuSkillGovernanceBatchItem {
  skillFilePath: string;
  governance: QingShuSkillGovernanceResult;
}

export interface QingShuInstalledSkillGovernanceItem extends QingShuSkillGovernanceBatchItem {
  skillId: string;
}

export interface QingShuGovernanceService {
  getSharedToolCatalogSummary(): QingShuSharedToolCatalogSummary;
  analyzeSkillContent(rawSkillContent: string): QingShuSkillGovernanceResult;
  analyzeSkillFile(skillFilePath: string): QingShuSkillGovernanceResult;
  analyzeSkillFiles(skillFilePaths: string[]): QingShuSkillGovernanceBatchItem[];
  analyzeInstalledSkills(): QingShuInstalledSkillGovernanceItem[];
  analyzeSkillById(skillId: string): QingShuSkillGovernanceResult | null;
}

export interface QingShuExtensionHost {
  initialize(modules: QingShuExtensionModule[]): void;
  listModuleStatuses(): QingShuModuleStatus[];
  getSharedToolCatalog(): QingShuSharedToolCatalog;
  getEnabledSharedTools(): QingShuSharedToolDescriptor[];
  getEnabledToolBundles(): QingShuToolBundleId[];
  getPluginDescriptors(): QingShuPluginDescriptor[];
}
