import { describe, expect, test } from 'vitest';

import type { Model } from '../../store/slices/modelSlice';
import {
  resolveAgentModelSelection,
  resolveEffectiveModel,
  shouldRepairAgentModelAfterSessionModelChange,
} from './agentModelSelection';

const availableModels: Model[] = [
  {
    id: 'kimi-k2.5',
    name: 'Kimi K2.5',
    provider: 'Moonshot',
    providerKey: 'moonshot',
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'DeepSeek',
    providerKey: 'deepseek',
  },
];

const visionModel: Model = {
  id: 'qwen3.5-plus',
  name: 'Qwen3.5 Plus',
  providerKey: 'qwen',
  supportsImage: true,
};

const nonVisionModel: Model = {
  id: 'glm-5.1',
  name: 'GLM 5.1',
  providerKey: 'zhipu',
  supportsImage: false,
};

describe('resolveAgentModelSelection', () => {
  test('prefers explicit session model when it can be resolved', () => {
    const result = resolveAgentModelSelection({
      sessionModel: 'moonshot/kimi-k2.5',
      agentModel: '',
      availableModels,
      fallbackModel: availableModels[1],
      engine: 'openclaw',
    });

    expect(result.selectedModel).toEqual(availableModels[0]);
    expect(result.usesFallback).toBe(false);
    expect(result.hasInvalidExplicitModel).toBe(false);
  });

  test('falls back silently when agent model cannot be resolved', () => {
    const result = resolveAgentModelSelection({
      sessionModel: '',
      agentModel: 'missing/provider-model',
      availableModels,
      fallbackModel: availableModels[1],
      engine: 'openclaw',
    });

    expect(result.selectedModel).toEqual(availableModels[1]);
    expect(result.usesFallback).toBe(true);
    expect(result.hasInvalidExplicitModel).toBe(false);
  });

  test('marks invalid session model override as explicit model error', () => {
    const result = resolveAgentModelSelection({
      sessionModel: 'missing/provider-model',
      agentModel: 'moonshot/kimi-k2.5',
      availableModels,
      fallbackModel: availableModels[1],
      engine: 'openclaw',
    });

    expect(result.selectedModel).toEqual(availableModels[1]);
    expect(result.usesFallback).toBe(true);
    expect(result.hasInvalidExplicitModel).toBe(true);
  });

  test('returns fallback when neither session nor agent model is configured', () => {
    const result = resolveAgentModelSelection({
      sessionModel: '',
      agentModel: '',
      availableModels,
      fallbackModel: availableModels[1],
      engine: 'yd_cowork',
    });

    expect(result.selectedModel).toEqual(availableModels[1]);
    expect(result.usesFallback).toBe(true);
    expect(result.hasInvalidExplicitModel).toBe(false);
  });
});

describe('resolveEffectiveModel', () => {
  test('uses global selected model on home page before a session exists', () => {
    const result = resolveEffectiveModel({
      sessionId: undefined,
      agentSelectedModel: visionModel,
      globalSelectedModel: nonVisionModel,
    });

    expect(result?.id).toBe('glm-5.1');
    expect(result?.supportsImage).toBe(false);
  });

  test('uses session resolved model after a session exists', () => {
    const result = resolveEffectiveModel({
      sessionId: 'session-1',
      agentSelectedModel: nonVisionModel,
      globalSelectedModel: visionModel,
    });

    expect(result?.id).toBe('glm-5.1');
    expect(result?.supportsImage).toBe(false);
  });
});

describe('shouldRepairAgentModelAfterSessionModelChange', () => {
  test('repairs the agent model only when the agent model is the stale reference', () => {
    expect(shouldRepairAgentModelAfterSessionModelChange({
      sessionModel: '',
      agentModel: 'missing/provider-model',
      availableModels,
    })).toBe(true);
  });

  test('does not repair the agent when the session override is the stale reference', () => {
    expect(shouldRepairAgentModelAfterSessionModelChange({
      sessionModel: 'missing/provider-model',
      agentModel: 'moonshot/kimi-k2.5',
      availableModels,
    })).toBe(false);
  });

  test('does not repair the agent when the agent model is valid', () => {
    expect(shouldRepairAgentModelAfterSessionModelChange({
      sessionModel: '',
      agentModel: 'moonshot/kimi-k2.5',
      availableModels,
    })).toBe(false);
  });
});
