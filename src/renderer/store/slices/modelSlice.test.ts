import { describe, expect, test } from 'vitest';

import reducer, {
  clearAgentSelectedModel,
  selectAgentSelectedModel,
  setAgentSelectedModel,
  setSelectedModel,
  setAvailableModels,
  type Model,
} from './modelSlice';

const globalModel: Model = {
  id: 'qwen3.5-plus',
  name: 'Qwen 3.5 Plus',
  providerKey: 'qwen',
};

const agentModel: Model = {
  id: 'deepseek-chat',
  name: 'DeepSeek Chat',
  providerKey: 'deepseek',
};

const overrideModel: Model = {
  id: 'kimi-k2.5',
  name: 'Kimi K2.5',
  providerKey: 'moonshot',
};

describe('modelSlice per-agent compatibility layer', () => {
  test('selectAgentSelectedModel prefers per-agent override', () => {
    const state = {
      selectedModel: globalModel,
      availableModels: [globalModel, agentModel, overrideModel],
      selectedModelByAgent: {
        agentA: overrideModel,
      },
    };

    expect(selectAgentSelectedModel(state, 'agentA', 'deepseek/deepseek-chat')).toBe(overrideModel);
  });

  test('selectAgentSelectedModel resolves agent model before global fallback', () => {
    const state = {
      selectedModel: globalModel,
      availableModels: [globalModel, agentModel],
      selectedModelByAgent: {},
    };

    expect(selectAgentSelectedModel(state, 'agentA', 'deepseek/deepseek-chat')).toBe(agentModel);
  });

  test('selectAgentSelectedModel falls back to global selected model', () => {
    const state = {
      selectedModel: globalModel,
      availableModels: [globalModel, agentModel],
      selectedModelByAgent: {},
    };

    expect(selectAgentSelectedModel(state, 'agentA', 'missing/provider-model')).toBe(globalModel);
  });

  test('clears stale per-agent override when available models change', () => {
    let state = reducer(undefined, setAgentSelectedModel({ agentId: 'agentA', model: overrideModel }));
    expect(state.selectedModelByAgent.agentA).toEqual(overrideModel);

    state = reducer(state, setAvailableModels([globalModel, agentModel]));
    expect(state.selectedModelByAgent.agentA).toBeUndefined();
  });

  test('can clear per-agent override explicitly', () => {
    let state = reducer(undefined, setAgentSelectedModel({ agentId: 'agentA', model: overrideModel }));
    state = reducer(state, clearAgentSelectedModel('agentA'));

    expect(state.selectedModelByAgent.agentA).toBeUndefined();
  });

  test('setSelectedModel keeps legacy global selected model behavior', () => {
    const state = reducer(undefined, setSelectedModel(globalModel));

    expect(state.selectedModel).toEqual(globalModel);
    expect(state.selectedModelDirty).toBe(true);
    expect(state.selectedModelByAgent.agentA).toBeUndefined();
  });

  test('setSelectedModel can store a per-agent selected model', () => {
    const state = reducer(undefined, setSelectedModel({ agentId: 'agentA', model: overrideModel }));

    expect(state.selectedModelByAgent.agentA).toEqual(overrideModel);
    expect(state.selectedModelDirty).toBe(false);
  });
});
