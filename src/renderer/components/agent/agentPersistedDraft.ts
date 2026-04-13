import type { CreateAgentRequest, UpdateAgentRequest } from '../../types/agent';

export interface CreateAgentDraft {
  name: string;
  description: string;
  systemPrompt: string;
  identity: string;
  icon: string;
  skillIds: string[];
  toolBundleIds?: string[];
  debugToolBundleIds?: string[];
}

export interface UpdateAgentDraft {
  name: string;
  description: string;
  systemPrompt: string;
  identity: string;
  icon: string;
  skillIds: string[];
  toolBundleIds?: string[];
  debugToolBundleIds?: string[];
}

export const buildPersistedCreateAgentRequest = (
  draft: CreateAgentDraft,
): CreateAgentRequest => ({
  name: draft.name.trim(),
  description: draft.description.trim(),
  systemPrompt: draft.systemPrompt.trim(),
  identity: draft.identity.trim(),
  icon: draft.icon.trim() || undefined,
  skillIds: draft.skillIds,
  toolBundleIds: draft.toolBundleIds ?? [],
});

export const buildPersistedUpdateAgentRequest = (
  draft: UpdateAgentDraft,
): UpdateAgentRequest => ({
  name: draft.name.trim(),
  description: draft.description.trim(),
  systemPrompt: draft.systemPrompt.trim(),
  identity: draft.identity.trim(),
  icon: draft.icon.trim(),
  skillIds: draft.skillIds,
  toolBundleIds: draft.toolBundleIds ?? [],
});
