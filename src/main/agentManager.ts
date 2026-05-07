import type { CoworkStore, Agent, CreateAgentRequest, UpdateAgentRequest } from './coworkStore';
import { PRESET_AGENTS, presetToCreateRequest, type PresetAgent } from './presetAgents';

type AgentManagerDeps = {
  getManagedAgents?: () => Agent[];
};

export function rewriteRenamedProviderModelRef(
  modelRef: string,
  renamedProviderIds: Record<string, string>,
): string {
  const normalized = modelRef.trim();
  const slashIdx = normalized.indexOf('/');
  if (slashIdx <= 0) {
    return modelRef;
  }

  const providerId = normalized.slice(0, slashIdx);
  const renamedProviderId = renamedProviderIds[providerId];
  if (!renamedProviderId) {
    return modelRef;
  }

  return `${renamedProviderId}${normalized.slice(slashIdx)}`;
}

/**
 * AgentManager handles CRUD operations for agents and preset agent installation.
 * Agents are stored in the SQLite `agents` table via CoworkStore.
 */
export class AgentManager {
  private store: CoworkStore;
  private readonly getManagedAgents: () => Agent[];

  constructor(store: CoworkStore, deps: AgentManagerDeps = {}) {
    this.store = store;
    this.getManagedAgents = deps.getManagedAgents ?? (() => []);
  }

  listAgents(): Agent[] {
    return [...this.store.listAgents(), ...this.getManagedAgents()];
  }

  getAgent(agentId: string): Agent | null {
    return this.store.getAgent(agentId)
      || this.getManagedAgents().find((agent) => agent.id === agentId)
      || null;
  }

  getDefaultAgent(): Agent {
    const agents = this.store.listAgents();
    return agents.find(a => a.isDefault) || agents[0];
  }

  createAgent(request: CreateAgentRequest): Agent {
    return this.store.createAgent(request);
  }

  updateAgent(agentId: string, updates: UpdateAgentRequest): Agent | null {
    if (this.getManagedAgents().some((agent) => agent.id === agentId)) {
      throw new Error('Managed agents are read-only');
    }
    return this.store.updateAgent(agentId, updates);
  }

  migrateRenamedProviderModelRefs(renamedProviderIds: Record<string, string>): number {
    let changed = 0;
    for (const agent of this.store.listAgents()) {
      const nextModel = rewriteRenamedProviderModelRef(agent.model, renamedProviderIds);
      if (nextModel === agent.model) {
        continue;
      }
      this.store.updateAgent(agent.id, { model: nextModel });
      changed += 1;
    }
    return changed;
  }

  deleteAgent(agentId: string): boolean {
    if (this.getManagedAgents().some((agent) => agent.id === agentId)) {
      throw new Error('Managed agents cannot be deleted');
    }
    return this.store.deleteAgent(agentId);
  }

  // --- Preset agents ---

  getPresetAgents(): PresetAgent[] {
    const existingAgents = this.store.listAgents();
    const existingPresetIds = new Set(
      existingAgents.filter(a => a.source === 'preset').map(a => a.presetId)
    );
    // Only return presets that haven't been added yet
    return PRESET_AGENTS.filter(p => !existingPresetIds.has(p.id));
  }

  getAllPresetAgents(): PresetAgent[] {
    return PRESET_AGENTS;
  }

  addPresetAgent(presetId: string): Agent | null {
    const preset = PRESET_AGENTS.find(p => p.id === presetId);
    if (!preset) return null;

    // Check if already installed
    const existing = this.store.getAgent(preset.id);
    if (existing) return existing;

    return this.store.createAgent(presetToCreateRequest(preset));
  }
}
