import type {
  QingShuManagedInstaller,
  QingShuObjectSourceType,
} from './constants';

export interface QingShuManagedToolDescriptor {
  toolName: string;
  description: string;
  toolType: string;
  toolDomain?: string;
  allowed: boolean;
  policyNote?: string;
  ownerSkillRefs: string[];
  capabilityKey?: string;
  bundleId?: string;
  inputSchema?: Record<string, unknown>;
  dangerLevel?: 'read' | 'write' | 'admin';
  sourceType: typeof import('./constants').QingShuObjectSourceType.QingShuManaged;
  readOnly: true;
  catalogVersion: string;
  backendToolName?: string;
}

export interface QingShuManagedSkillDescriptor {
  skillId: string;
  name: string;
  description: string;
  toolRefs: string[];
  promptTemplate?: string;
  version: string;
  packageUrl: string;
  packageChecksum?: string;
  backendAgentIds: string[];
  enabled: boolean;
  allowed: boolean;
  policyNote?: string;
  sourceType: typeof import('./constants').QingShuObjectSourceType.QingShuManaged;
  readOnly: true;
  catalogVersion: string;
}

export interface QingShuManagedAgentDescriptor {
  agentId: string;
  name: string;
  description: string;
  systemPrompt?: string;
  identity?: string;
  skillIds: string[];
  toolNames: string[];
  enabled: boolean;
  allowed: boolean;
  policyNote?: string;
  sourceType: typeof import('./constants').QingShuObjectSourceType.QingShuManaged;
  readOnly: true;
  catalogVersion: string;
}

export interface QingShuManagedCatalogSnapshot {
  catalogVersion: string;
  syncedAt: number;
  agents: QingShuManagedAgentDescriptor[];
  skills: QingShuManagedSkillDescriptor[];
  tools: QingShuManagedToolDescriptor[];
}

export interface QingShuManagedSkillMeta {
  sourceType: typeof import('./constants').QingShuObjectSourceType.QingShuManaged;
  readOnly: true;
  backendSkillId: string;
  backendAgentIds: string[];
  packageUrl: string;
  version: string;
  packageChecksum?: string;
  catalogVersion: string;
  installedBy: QingShuManagedInstaller;
  toolRefs?: string[];
  policyNote?: string;
  allowed?: boolean;
}

export interface QingShuSkillSourceMeta {
  sourceType?: QingShuObjectSourceType;
  readOnly?: boolean;
  backendSkillId?: string;
  backendAgentIds?: string[];
  packageUrl?: string;
  version?: string;
  packageChecksum?: string;
  catalogVersion?: string;
  installedBy?: QingShuManagedInstaller;
  toolRefs?: string[];
  policyNote?: string;
  allowed?: boolean;
}
