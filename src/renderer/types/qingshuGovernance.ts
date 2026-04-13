export type QingShuSkillDependencyValidationLevel = 'error' | 'warn' | 'info';

export interface QingShuSkillDeclaredDependency {
  toolBundles: string[];
  toolRefs: string[];
  capabilityRefs: string[];
}

export interface QingShuSkillDependencyParseResult {
  dependencies: QingShuSkillDeclaredDependency;
  hasDeclarations: boolean;
}

export interface QingShuSkillDependencyValidationIssue {
  level: QingShuSkillDependencyValidationLevel;
  code: string;
  message: string;
  field: 'toolBundles' | 'toolRefs' | 'capabilityRefs' | 'general';
  ref?: string;
}

export interface QingShuSharedToolCatalogSummary {
  generatedAt: number;
  modules: Array<{
    moduleId: string;
    version: string;
    status: 'active' | 'disabled' | 'failed';
    enabled: boolean;
    sharedToolsEnabled: boolean;
    builtInSkillsEnabled: boolean;
    sharedToolCount: number;
    bundles: string[];
    error?: string;
  }>;
  bundles: Array<{
    bundle: string;
    moduleIds: string[];
    toolNames: string[];
    toolCount: number;
  }>;
  tools: Array<{
    capabilityKey: string;
    toolName: string;
    description: string;
    module: string;
    bundle: string;
    visibility: 'internal' | 'shared' | 'experimental';
    audience: 'system' | 'user-skill' | 'both';
    stability: 'stable' | 'beta';
    dangerLevel: 'read' | 'write' | 'admin';
    inputSchema?: Record<string, unknown>;
  }>;
}

export interface QingShuSharedToolContractArtifacts {
  payload: {
    generatedAt: number;
    modules: QingShuSharedToolCatalogSummary['modules'];
    bundles: QingShuSharedToolCatalogSummary['bundles'];
    tools: QingShuSharedToolCatalogSummary['tools'];
  };
  markdown: string;
  json: string;
  suggestedMarkdownPath: string;
  suggestedJsonPath: string;
}

export interface QingShuSkillGovernanceResult {
  dependencies: QingShuSkillDependencyParseResult;
  validation: {
    valid: boolean;
    issues: QingShuSkillDependencyValidationIssue[];
    dependencies: QingShuSkillDeclaredDependency;
  };
  catalog: QingShuSharedToolCatalogSummary;
  contracts: QingShuSharedToolContractArtifacts;
}

export interface QingShuSkillGovernanceBatchItem {
  skillFilePath: string;
  governance: QingShuSkillGovernanceResult;
}

export interface QingShuGovernanceSkillItem {
  skillId: string;
  governance: QingShuSkillGovernanceResult;
}

export interface QingShuAgentGovernanceSummary {
  analyzedSkillCount: number;
  declaredSkillCount: number;
  issueCount: number;
  requiredBundles: string[];
  currentBundles: string[];
  missingBundles: string[];
  declaredToolRefs: string[];
}

export interface QingShuToolBundleOption {
  bundleId: string;
  moduleIds: string[];
  toolCount: number;
  toolNames: string[];
  hasActiveModules: boolean;
}
