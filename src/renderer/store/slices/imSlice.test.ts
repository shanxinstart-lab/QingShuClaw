import { describe, expect, test } from 'vitest';

import reducer, {
  addFeishuInstance,
  removeDingTalkInstance,
  removeFeishuInstance,
  removeQQInstance,
  removeWecomInstance,
  setConfig,
  setDingTalkInstances,
  setFeishuMultiInstanceConfig,
  setQQInstances,
  setFeishuInstanceConfig,
  setWecomMultiInstanceConfig,
  setNimConfig,
  setNimInstances,
  setPopoConfig,
  setPopoInstances,
} from './imSlice';
import {
  DEFAULT_FEISHU_OPENCLAW_CONFIG,
  DEFAULT_IM_CONFIG,
  DEFAULT_NIM_CONFIG,
  DEFAULT_POPO_CONFIG,
} from '../../types/im';

const withPlatformInstances = (
  platform: 'dingtalk' | 'feishu' | 'qq' | 'wecom',
  instanceIds: string[],
) => {
  const config = structuredClone(DEFAULT_IM_CONFIG);
  config[platform] = {
    instances: instanceIds.map((instanceId) => ({
      ...DEFAULT_FEISHU_OPENCLAW_CONFIG,
      instanceId,
      instanceName: `${platform}-${instanceId}`,
    })),
  } as never;
  return config;
};

describe('imSlice multi-instance bindings', () => {
  test('setConfig removes stale multi-instance bindings from loaded config', () => {
    const nextState = reducer(undefined, setConfig({
      ...structuredClone(DEFAULT_IM_CONFIG),
      feishu: {
        instances: [
          {
            ...DEFAULT_FEISHU_OPENCLAW_CONFIG,
            instanceId: 'kept',
            instanceName: 'Kept Bot',
          },
        ],
      },
      settings: {
        skillsEnabled: true,
        platformAgentBindings: {
          'feishu:removed': 'agent-removed',
          'feishu:kept': 'agent-kept',
          telegram: 'telegram-agent',
        },
      },
    }));

    expect(nextState.config.settings.platformAgentBindings).toEqual({
      'feishu:kept': 'agent-kept',
      telegram: 'telegram-agent',
    });
  });

  test('setConfig removes stale NIM instance bindings without removing legacy platform binding', () => {
    const nextState = reducer(undefined, setConfig({
      ...structuredClone(DEFAULT_IM_CONFIG),
      nim: {
        instances: [
          {
            ...DEFAULT_NIM_CONFIG,
            instanceId: 'kept',
            instanceName: 'Kept NIM',
            enabled: true,
            appKey: 'nim-app',
            account: 'nim-bot',
            token: 'nim-token',
          },
        ],
      },
      settings: {
        skillsEnabled: true,
        platformAgentBindings: {
          nim: 'legacy-agent',
          'nim:removed': 'agent-removed',
          'nim:kept': 'agent-kept',
        },
      },
    }));

    expect(nextState.config.settings.platformAgentBindings).toEqual({
      nim: 'legacy-agent',
      'nim:kept': 'agent-kept',
    });
  });

  test('setConfig removes stale POPO instance bindings without removing legacy platform binding', () => {
    const nextState = reducer(undefined, setConfig({
      ...structuredClone(DEFAULT_IM_CONFIG),
      popo: {
        instances: [
          {
            ...DEFAULT_POPO_CONFIG,
            instanceId: 'kept',
            instanceName: 'Kept POPO',
            enabled: true,
            appKey: 'popo-app',
            appSecret: 'popo-secret',
            aesKey: 'popo-aes',
          },
        ],
      },
      settings: {
        skillsEnabled: true,
        platformAgentBindings: {
          popo: 'legacy-agent',
          'popo:removed': 'agent-removed',
          'popo:kept': 'agent-kept',
        },
      },
    }));

    expect(nextState.config.settings.platformAgentBindings).toEqual({
      popo: 'legacy-agent',
      'popo:kept': 'agent-kept',
    });
  });

  test.each([
    ['dingtalk', removeDingTalkInstance],
    ['feishu', removeFeishuInstance],
    ['qq', removeQQInstance],
    ['wecom', removeWecomInstance],
  ] as const)('removes stale %s agent binding when an instance is removed', (platform, actionCreator) => {
    const initialState = reducer(undefined, setConfig({
      ...withPlatformInstances(platform, ['deleted', 'kept']),
      settings: {
        skillsEnabled: true,
        platformAgentBindings: {
          [`${platform}:deleted`]: 'agent-deleted',
          [`${platform}:kept`]: 'agent-kept',
          telegram: 'telegram-agent',
        },
      },
    }));

    const nextState = reducer(initialState, actionCreator('deleted'));

    expect(nextState.config.settings.platformAgentBindings).toEqual({
      [`${platform}:kept`]: 'agent-kept',
      telegram: 'telegram-agent',
    });
  });

  test.each([
    ['dingtalk', setDingTalkInstances, 'instances'],
    ['feishu', setFeishuMultiInstanceConfig, 'multi'],
    ['qq', setQQInstances, 'instances'],
    ['wecom', setWecomMultiInstanceConfig, 'multi'],
  ] as const)('cleans stale %s bindings when local instances are replaced', (platform, actionCreator, payloadKind) => {
    const initialState = reducer(undefined, setConfig({
      ...withPlatformInstances(platform, ['removed', 'kept']),
      settings: {
        skillsEnabled: true,
        platformAgentBindings: {
          [`${platform}:removed`]: 'agent-removed',
          [`${platform}:kept`]: 'agent-kept',
          telegram: 'telegram-agent',
        },
      },
    }));
    const nextInstances = [
      {
        ...DEFAULT_FEISHU_OPENCLAW_CONFIG,
        instanceId: 'kept',
        instanceName: 'Kept Bot',
      },
    ];
    const payload = payloadKind === 'multi'
      ? { instances: nextInstances }
      : nextInstances;

    const nextState = reducer(initialState, actionCreator(payload as never));

    expect(nextState.config.settings.platformAgentBindings).toEqual({
      [`${platform}:kept`]: 'agent-kept',
      telegram: 'telegram-agent',
    });
  });

  test('updates an existing instance locally without replacing the full config', () => {
    const initialState = reducer(undefined, addFeishuInstance({
      ...DEFAULT_FEISHU_OPENCLAW_CONFIG,
      instanceId: 'feishu-1',
      instanceName: 'Feishu Bot 1',
      appId: 'old-app',
    }));

    const nextState = reducer(initialState, setFeishuInstanceConfig({
      instanceId: 'feishu-1',
      config: {
        appId: 'new-app',
        enabled: true,
      },
    }));

    expect(nextState.config.feishu.instances).toHaveLength(1);
    expect(nextState.config.feishu.instances[0]).toMatchObject({
      instanceId: 'feishu-1',
      instanceName: 'Feishu Bot 1',
      appId: 'new-app',
      enabled: true,
    });
  });

  test('setNimInstances replaces the projection and removes stale instance bindings', () => {
    const initialState = reducer(undefined, setConfig({
      ...structuredClone(DEFAULT_IM_CONFIG),
      nim: {
        ...DEFAULT_NIM_CONFIG,
        instances: [
          {
            ...DEFAULT_NIM_CONFIG,
            instanceId: 'removed',
            instanceName: 'Removed NIM',
          },
          {
            ...DEFAULT_NIM_CONFIG,
            instanceId: 'kept',
            instanceName: 'Kept NIM',
          },
        ],
      },
      settings: {
        skillsEnabled: true,
        platformAgentBindings: {
          nim: 'legacy-agent',
          'nim:removed': 'agent-removed',
          'nim:kept': 'agent-kept',
        },
      },
    }));

    const nextState = reducer(initialState, setNimInstances([
      {
        ...DEFAULT_NIM_CONFIG,
        instanceId: 'kept',
        instanceName: 'Kept NIM',
      },
    ]));

    expect(nextState.config.nim.instances).toEqual([
      {
        ...DEFAULT_NIM_CONFIG,
        instanceId: 'kept',
        instanceName: 'Kept NIM',
      },
    ]);
    expect(nextState.config.settings.platformAgentBindings).toEqual({
      nim: 'legacy-agent',
      'nim:kept': 'agent-kept',
    });
  });

  test('setNimConfig keeps the primary instance projection in sync', () => {
    const initialState = reducer(undefined, setConfig({
      ...structuredClone(DEFAULT_IM_CONFIG),
      nim: {
        instances: [
          {
            ...DEFAULT_NIM_CONFIG,
            instanceId: 'primary',
            instanceName: 'Primary NIM',
            appKey: 'old-app',
            account: 'old-account',
            token: 'old-token',
          },
        ],
      },
    }));

    const nextState = reducer(initialState, setNimConfig({
      appKey: 'new-app',
      account: 'new-account',
      token: 'new-token',
    }));

    expect(nextState.config.nim.instances[0]).toMatchObject({
      instanceId: 'primary',
      instanceName: 'Primary NIM',
      appKey: 'new-app',
      account: 'new-account',
      token: 'new-token',
    });
  });

  test('setPopoInstances replaces the projection and removes stale instance bindings', () => {
    const initialState = reducer(undefined, setConfig({
      ...structuredClone(DEFAULT_IM_CONFIG),
      popo: {
        ...DEFAULT_POPO_CONFIG,
        instances: [
          {
            ...DEFAULT_POPO_CONFIG,
            instanceId: 'removed',
            instanceName: 'Removed POPO',
          },
          {
            ...DEFAULT_POPO_CONFIG,
            instanceId: 'kept',
            instanceName: 'Kept POPO',
          },
        ],
      },
      settings: {
        skillsEnabled: true,
        platformAgentBindings: {
          popo: 'legacy-agent',
          'popo:removed': 'agent-removed',
          'popo:kept': 'agent-kept',
        },
      },
    }));

    const nextState = reducer(initialState, setPopoInstances([
      {
        ...DEFAULT_POPO_CONFIG,
        instanceId: 'kept',
        instanceName: 'Kept POPO',
      },
    ]));

    expect(nextState.config.popo.instances).toEqual([
      {
        ...DEFAULT_POPO_CONFIG,
        instanceId: 'kept',
        instanceName: 'Kept POPO',
      },
    ]);
    expect(nextState.config.settings.platformAgentBindings).toEqual({
      popo: 'legacy-agent',
      'popo:kept': 'agent-kept',
    });
  });

  test('setPopoConfig keeps the primary instance projection in sync', () => {
    const initialState = reducer(undefined, setConfig({
      ...structuredClone(DEFAULT_IM_CONFIG),
      popo: {
        instances: [
          {
            ...DEFAULT_POPO_CONFIG,
            instanceId: 'primary',
            instanceName: 'Primary POPO',
            appKey: 'old-app',
            appSecret: 'old-secret',
            aesKey: 'old-aes',
          },
        ],
      },
    }));

    const nextState = reducer(initialState, setPopoConfig({
      appKey: 'new-app',
      appSecret: 'new-secret',
      aesKey: 'new-aes',
    }));

    expect(nextState.config.popo.instances[0]).toMatchObject({
      instanceId: 'primary',
      instanceName: 'Primary POPO',
      appKey: 'new-app',
      appSecret: 'new-secret',
      aesKey: 'new-aes',
    });
  });
});
