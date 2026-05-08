import { describe, expect, test } from 'vitest';

import {
  buildAgentEntry,
  buildManagedAgentEntries,
  parsePrimaryModelRef,
  resolveManagedSessionModelTarget,
  resolveQualifiedAgentModelRef,
} from './openclawAgentModels';

describe('buildAgentEntry', () => {
  test('为主 agent 输出显式 model.primary', () => {
    const result = buildAgentEntry({
      id: 'main',
      name: 'main',
      description: '',
      systemPrompt: '',
      identity: '',
      model: 'lobsterai-server/deepseek-v3.2',
      icon: '',
      skillIds: [],
      toolBundleIds: [],
      enabled: true,
      isDefault: true,
      source: 'custom',
      presetId: '',
      createdAt: 0,
      updatedAt: 0,
    }, 'anthropic/claude-sonnet-4');

    expect(result).toMatchObject({
      id: 'main',
      default: true,
      model: { primary: 'lobsterai-server/deepseek-v3.2' },
    });
  });

  test('当 agent model 是裸 modelId 时回退到默认模型', () => {
    const result = buildAgentEntry({
      id: 'main',
      name: 'main',
      description: '',
      systemPrompt: '',
      identity: '',
      model: 'deepseek-v3.2',
      icon: '',
      skillIds: [],
      toolBundleIds: [],
      enabled: true,
      isDefault: true,
      source: 'custom',
      presetId: '',
      createdAt: 0,
      updatedAt: 0,
    }, 'anthropic/claude-sonnet-4');

    expect(result).toMatchObject({
      id: 'main',
      model: { primary: 'anthropic/claude-sonnet-4' },
    });
  });

  test('当旧 provider-qualified model 已迁移到新 provider 时自动改写', () => {
    const result = buildAgentEntry({
      id: 'main',
      name: 'main',
      description: '',
      systemPrompt: '',
      identity: '',
      model: 'openai/gpt-5.3-codex',
      icon: '',
      skillIds: [],
      toolBundleIds: [],
      enabled: true,
      isDefault: true,
      source: 'custom',
      presetId: '',
      createdAt: 0,
      updatedAt: 0,
    }, 'deepseek/deepseek-v4-flash', {
      availableProviders: {
        'openai-codex': { models: [{ id: 'gpt-5.3-codex' }] },
      },
    });

    expect(result).toMatchObject({
      id: 'main',
      model: { primary: 'openai-codex/gpt-5.3-codex' },
    });
  });
});

describe('buildManagedAgentEntries', () => {
  test('为启用的非 main agent 输出显式 model.primary', () => {
    const result = buildManagedAgentEntries({
      agents: [
        {
          id: 'writer',
          name: 'Writer',
          description: '',
          systemPrompt: '',
          identity: '',
          model: 'openai/gpt-4o',
          icon: '✍️',
          skillIds: ['docx'],
          toolBundleIds: [],
          enabled: true,
          isDefault: false,
          source: 'custom',
          presetId: '',
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      fallbackPrimaryModel: 'anthropic/claude-sonnet-4',
    });

    expect(result).toContainEqual(expect.objectContaining({
      id: 'writer',
      model: { primary: 'openai/gpt-4o' },
      skills: ['docx'],
    }));
  });

  test('当 agent model 为空时回退到默认 primary model', () => {
    const result = buildManagedAgentEntries({
      agents: [
        {
          id: 'writer',
          name: 'Writer',
          description: '',
          systemPrompt: '',
          identity: '',
          model: '',
          icon: '✍️',
          skillIds: [],
          toolBundleIds: [],
          enabled: true,
          isDefault: false,
          source: 'custom',
          presetId: '',
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      fallbackPrimaryModel: 'anthropic/claude-sonnet-4',
    });

    expect(result[0]).toMatchObject({
      id: 'writer',
      model: { primary: 'anthropic/claude-sonnet-4' },
    });
  });

  test('当提供 stateDir 时为非 main agent 写入显式 workspace', () => {
    const result = buildManagedAgentEntries({
      agents: [
        {
          id: 'crab-boss',
          name: 'CrabBoss',
          description: '',
          systemPrompt: '',
          identity: '',
          model: 'openai/gpt-4o',
          icon: '🦀',
          skillIds: [],
          toolBundleIds: [],
          enabled: true,
          isDefault: false,
          source: 'custom',
          presetId: '',
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      fallbackPrimaryModel: 'anthropic/claude-sonnet-4',
      stateDir: '/mock/state',
    });

    expect(result[0]).toMatchObject({
      id: 'crab-boss',
      workspace: expect.stringContaining('workspace-crab-boss'),
    });
  });
});

describe('parsePrimaryModelRef', () => {
  test('能解析带 provider 的 primary model ref', () => {
    expect(parsePrimaryModelRef('lobsterai-server/deepseek-v3.2')).toEqual({
      providerId: 'lobsterai-server',
      modelId: 'deepseek-v3.2',
      primaryModel: 'lobsterai-server/deepseek-v3.2',
    });
  });

  test('对裸 model id 返回 null', () => {
    expect(parsePrimaryModelRef('deepseek-v3.2')).toBeNull();
  });
});

describe('resolveManagedSessionModelTarget', () => {
  const availableProviders = {
    'lobsterai-server': { models: [{ id: 'qwen3.5-plus' }, { id: 'deepseek-v3.2' }] },
    minimax: { models: [{ id: 'MiniMax-M2.7' }] },
  };

  test('当 agent model 为空时使用 fallback target', () => {
    expect(resolveManagedSessionModelTarget({
      agentModel: '',
      fallbackPrimaryModel: 'lobsterai-server/qwen3.5-plus',
      availableProviders,
    })).toEqual({
      providerId: 'lobsterai-server',
      modelId: 'qwen3.5-plus',
      primaryModel: 'lobsterai-server/qwen3.5-plus',
    });
  });

  test('保留显式 provider-qualified model', () => {
    expect(resolveManagedSessionModelTarget({
      agentModel: 'minimax/MiniMax-M2.7',
      fallbackPrimaryModel: 'lobsterai-server/qwen3.5-plus',
      availableProviders,
    })).toEqual({
      providerId: 'minimax',
      modelId: 'MiniMax-M2.7',
      primaryModel: 'minimax/MiniMax-M2.7',
    });
  });

  test('能根据 provider catalog 解析裸 model id', () => {
    expect(resolveManagedSessionModelTarget({
      agentModel: 'deepseek-v3.2',
      fallbackPrimaryModel: 'lobsterai-server/qwen3.5-plus',
      availableProviders,
    })).toEqual({
      providerId: 'lobsterai-server',
      modelId: 'deepseek-v3.2',
      primaryModel: 'lobsterai-server/deepseek-v3.2',
    });
  });

  test('裸 model 无法唯一解析时回退到当前 provider', () => {
    expect(resolveManagedSessionModelTarget({
      agentModel: 'unknown-model',
      fallbackPrimaryModel: 'lobsterai-server/qwen3.5-plus',
      availableProviders,
      currentProviderId: 'lobsterai-server',
    })).toEqual({
      providerId: 'lobsterai-server',
      modelId: 'unknown-model',
      primaryModel: 'lobsterai-server/unknown-model',
    });
  });
});

describe('resolveQualifiedAgentModelRef', () => {
  test('当且仅当唯一 provider 命中时自动补全裸 model id', () => {
    expect(resolveQualifiedAgentModelRef({
      agentModel: 'deepseek-v3.2',
      availableProviders: {
        'lobsterai-server': { models: [{ id: 'deepseek-v3.2' }] },
        minimax: { models: [{ id: 'MiniMax-M2.7' }] },
      },
    })).toEqual({
      status: 'qualified',
      primaryModel: 'lobsterai-server/deepseek-v3.2',
    });
  });

  test('多个 provider 同时命中时不自动补全裸 model id', () => {
    expect(resolveQualifiedAgentModelRef({
      agentModel: 'deepseek-v3.2',
      availableProviders: {
        anthropic: { models: [{ id: 'deepseek-v3.2' }] },
        'lobsterai-server': { models: [{ id: 'deepseek-v3.2' }] },
      },
    })).toEqual({
      status: 'ambiguous',
      modelId: 'deepseek-v3.2',
      providerIds: ['anthropic', 'lobsterai-server'],
    });
  });

  test('旧 provider-qualified ref 的 model 仅在新 provider 命中时自动改写', () => {
    expect(resolveQualifiedAgentModelRef({
      agentModel: 'openai/gpt-5.3-codex',
      availableProviders: {
        'openai-codex': { models: [{ id: 'gpt-5.3-codex' }] },
      },
    })).toEqual({
      status: 'qualified',
      primaryModel: 'openai-codex/gpt-5.3-codex',
    });
  });
});
