import type { QingShuObjectSourceType } from '@shared/qingshuManaged/constants';

export type AgentSource = 'custom' | 'preset' | 'managed';

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  identity: string;
  model: string;
  workingDirectory: string;
  icon: string;
  skillIds: string[];
  toolBundleIds: string[];
  enabled: boolean;
  isDefault: boolean;
  source: AgentSource;
  sourceType?: QingShuObjectSourceType;
  readOnly?: boolean;
  allowed?: boolean;
  backendAgentId?: string;
  managedToolNames?: string[];
  managedBaseSkillIds?: string[];
  managedExtraSkillIds?: string[];
  policyNote?: string;
  presetId: string;
  createdAt: number;
  updatedAt: number;
}

export interface PresetAgent {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  descriptionEn: string;
  systemPrompt: string;
  systemPromptEn: string;
  skillIds: string[];
  installed: boolean;
}

export interface CreateAgentRequest {
  id?: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  identity?: string;
  model?: string;
  workingDirectory?: string;
  icon?: string;
  skillIds?: string[];
  toolBundleIds?: string[];
  source?: string;
  presetId?: string;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  systemPrompt?: string;
  identity?: string;
  model?: string;
  workingDirectory?: string;
  icon?: string;
  skillIds?: string[];
  toolBundleIds?: string[];
  enabled?: boolean;
}
