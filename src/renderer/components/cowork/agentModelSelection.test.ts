import { describe, expect, test } from 'vitest';

import type { Model } from '../../store/slices/modelSlice';
import { resolveAgentModelSelection } from './agentModelSelection';

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
