import { store } from '../store';
import {
  setAgents,
  setCurrentAgentId,
  setLoading,
  addAgent,
  updateAgent as updateAgentAction,
  removeAgent,
} from '../store/slices/agentSlice';
import { setActiveSkillIds, clearActiveSkills } from '../store/slices/skillSlice';
import { clearCurrentSession } from '../store/slices/coworkSlice';
import type { Agent, PresetAgent } from '../types/agent';
import { i18nService } from './i18n';
import { AppCustomEvent } from '../constants/app';

class AgentService {
  private showManagedUnavailableToast() {
    window.dispatchEvent(new CustomEvent(AppCustomEvent.ShowToast, {
      detail: i18nService.t('managedUnavailableHint'),
    }));
  }

  private showManagedForbiddenToast(message?: string) {
    window.dispatchEvent(new CustomEvent(AppCustomEvent.ShowToast, {
      detail: message || i18nService.t('managedForbiddenHint'),
    }));
  }

  async loadAgents(): Promise<void> {
    store.dispatch(setLoading(true));
    try {
      const agents = await window.electron?.agents?.list();
      if (agents) {
        const isLoggedIn = store.getState().auth.isLoggedIn;
        const normalizedAgents = agents.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          icon: a.icon,
          enabled: a.sourceType === 'qingshu-managed'
            ? (a.allowed === false ? false : (isLoggedIn ? a.enabled : false))
            : a.enabled,
          isDefault: a.isDefault,
          source: a.source,
          sourceType: a.sourceType,
          readOnly: a.readOnly,
          allowed: a.allowed,
          backendAgentId: a.backendAgentId,
          managedToolNames: a.managedToolNames ?? [],
          managedBaseSkillIds: a.managedBaseSkillIds ?? [],
          managedExtraSkillIds: a.managedExtraSkillIds ?? [],
          policyNote: a.policyNote,
          skillIds: a.skillIds ?? [],
          toolBundleIds: a.toolBundleIds ?? [],
        }));
        store.dispatch(setAgents(normalizedAgents));

        const currentAgentId = store.getState().agent.currentAgentId;
        const currentAgent = normalizedAgents.find((agent) => agent.id === currentAgentId);
        if (
          currentAgent
          && currentAgent.sourceType === 'qingshu-managed'
          && (!isLoggedIn || currentAgent.allowed === false)
        ) {
          store.dispatch(setCurrentAgentId('main'));
          store.dispatch(clearActiveSkills());
          store.dispatch(clearCurrentSession());
        }
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    } finally {
      store.dispatch(setLoading(false));
    }
  }

  async createAgent(request: {
    name: string;
    description?: string;
    systemPrompt?: string;
    identity?: string;
    model?: string;
    icon?: string;
    skillIds?: string[];
    toolBundleIds?: string[];
  }): Promise<Agent | null> {
    try {
      const agent = await window.electron?.agents?.create(request);
      if (agent) {
        store.dispatch(addAgent({
          id: agent.id,
          name: agent.name,
          description: agent.description,
          icon: agent.icon,
          enabled: agent.enabled,
          isDefault: agent.isDefault,
          source: agent.source,
          sourceType: agent.sourceType,
          readOnly: agent.readOnly,
          allowed: agent.allowed,
          backendAgentId: agent.backendAgentId,
          managedToolNames: agent.managedToolNames ?? [],
          managedBaseSkillIds: agent.managedBaseSkillIds ?? [],
          managedExtraSkillIds: agent.managedExtraSkillIds ?? [],
          policyNote: agent.policyNote,
          skillIds: agent.skillIds ?? [],
          toolBundleIds: agent.toolBundleIds ?? [],
        }));
        return agent;
      }
      return null;
    } catch (error) {
      console.error('Failed to create agent:', error);
      return null;
    }
  }

  async updateAgent(id: string, updates: {
    name?: string;
    description?: string;
    systemPrompt?: string;
    identity?: string;
    model?: string;
    icon?: string;
    skillIds?: string[];
    toolBundleIds?: string[];
    enabled?: boolean;
  }): Promise<Agent | null> {
    try {
      const agent = await window.electron?.agents?.update(id, updates);
      if (agent) {
        store.dispatch(updateAgentAction({
          id: agent.id,
          updates: {
            name: agent.name,
            description: agent.description,
            icon: agent.icon,
            enabled: agent.enabled,
            sourceType: agent.sourceType,
            readOnly: agent.readOnly,
            allowed: agent.allowed,
            backendAgentId: agent.backendAgentId,
            managedToolNames: agent.managedToolNames ?? [],
            managedBaseSkillIds: agent.managedBaseSkillIds ?? [],
            managedExtraSkillIds: agent.managedExtraSkillIds ?? [],
            policyNote: agent.policyNote,
            skillIds: agent.skillIds ?? [],
            toolBundleIds: agent.toolBundleIds ?? [],
          },
        }));
        return agent;
      }
      return null;
    } catch (error) {
      console.error('Failed to update agent:', error);
      return null;
    }
  }

  async deleteAgent(id: string): Promise<boolean> {
    try {
      const wasCurrentAgent = store.getState().agent.currentAgentId === id;
      await window.electron?.agents?.delete(id);
      store.dispatch(removeAgent(id));
      if (wasCurrentAgent) {
        this.switchAgent('main');
        const { coworkService } = await import('./cowork');
        coworkService.loadSessions('main');
      }
      return true;
    } catch (error) {
      console.error('Failed to delete agent:', error);
      return false;
    }
  }

  async getPresets(): Promise<PresetAgent[]> {
    try {
      const presets = await window.electron?.agents?.presets();
      return presets ?? [];
    } catch (error) {
      console.error('Failed to get presets:', error);
      return [];
    }
  }

  async addPreset(presetId: string): Promise<Agent | null> {
    try {
      const agent = await window.electron?.agents?.addPreset(presetId);
      if (agent) {
        store.dispatch(addAgent({
          id: agent.id,
          name: agent.name,
          description: agent.description,
          icon: agent.icon,
          enabled: agent.enabled,
          isDefault: agent.isDefault,
          source: agent.source,
          sourceType: agent.sourceType,
          readOnly: agent.readOnly,
          allowed: agent.allowed,
          backendAgentId: agent.backendAgentId,
          managedToolNames: agent.managedToolNames ?? [],
          managedBaseSkillIds: agent.managedBaseSkillIds ?? [],
          managedExtraSkillIds: agent.managedExtraSkillIds ?? [],
          policyNote: agent.policyNote,
          skillIds: agent.skillIds ?? [],
          toolBundleIds: agent.toolBundleIds ?? [],
        }));
        return agent;
      }
      return null;
    } catch (error) {
      console.error('Failed to add preset agent:', error);
      return null;
    }
  }

  switchAgent(agentId: string): boolean {
    const targetAgent = store.getState().agent.agents.find((a) => a.id === agentId);
    if (targetAgent?.sourceType === 'qingshu-managed' && !store.getState().auth.isLoggedIn) {
      this.showManagedUnavailableToast();
      return false;
    }
    if (targetAgent?.sourceType === 'qingshu-managed' && targetAgent.allowed === false) {
      this.showManagedForbiddenToast(targetAgent.policyNote);
      return false;
    }
    store.dispatch(setCurrentAgentId(agentId));
    store.dispatch(clearCurrentSession());
    const agent = store.getState().agent.agents.find((a) => a.id === agentId);
    if (agent?.skillIds?.length) {
      store.dispatch(setActiveSkillIds(agent.skillIds));
    } else {
      store.dispatch(clearActiveSkills());
    }
    return true;
  }
}

export const agentService = new AgentService();
