import { describe, expect, test } from 'vitest';

import {
  hasMeaningfulNimSingleConfig,
  hasMeaningfulPopoSingleConfig,
  ImSingleToMultiInstancePlatform,
  ImSingleToMultiInstanceSkipReason,
  planSingleToMultiInstanceMigration,
} from './imSingleToMultiInstanceMigration';
import { DEFAULT_NIM_CONFIG, DEFAULT_POPO_CONFIG } from './types';

describe('imSingleToMultiInstanceMigration', () => {
  test('detects meaningful NIM single-instance credentials', () => {
    expect(hasMeaningfulNimSingleConfig(DEFAULT_NIM_CONFIG)).toBe(false);
    expect(hasMeaningfulNimSingleConfig({
      ...DEFAULT_NIM_CONFIG,
      appKey: 'app-key',
      account: 'bot',
      token: 'token',
    })).toBe(true);
    expect(hasMeaningfulNimSingleConfig({
      ...DEFAULT_NIM_CONFIG,
      nimToken: 'app-key|bot|token',
    })).toBe(true);
  });

  test('detects meaningful POPO single-instance credentials', () => {
    expect(hasMeaningfulPopoSingleConfig(DEFAULT_POPO_CONFIG)).toBe(false);
    expect(hasMeaningfulPopoSingleConfig({
      ...DEFAULT_POPO_CONFIG,
      appKey: 'app-key',
    })).toBe(true);
    expect(hasMeaningfulPopoSingleConfig({
      ...DEFAULT_POPO_CONFIG,
      enabled: true,
    })).toBe(true);
  });

  test('plans NIM migration from platform binding to instance binding', () => {
    const plan = planSingleToMultiInstanceMigration({
      platform: ImSingleToMultiInstancePlatform.Nim,
      singleConfig: {
        ...DEFAULT_NIM_CONFIG,
        enabled: true,
        appKey: 'nim-app-key',
        account: 'nim-bot',
        token: 'nim-token',
      },
      existingInstanceIds: [],
      platformAgentBindings: {
        nim: 'agent-nim',
        popo: 'agent-popo',
      },
      createInstanceId: () => 'nim-primary',
      defaultInstanceName: 'NIM Bot 1',
      shouldMigrateConfig: hasMeaningfulNimSingleConfig,
    });

    expect(plan).toMatchObject({
      shouldMigrate: true,
      platform: 'nim',
      instanceKey: 'nim:nim-primary',
      instance: {
        instanceId: 'nim-primary',
        instanceName: 'NIM Bot 1',
        appKey: 'nim-app-key',
        account: 'nim-bot',
        token: 'nim-token',
      },
      platformAgentBindings: {
        'nim:nim-primary': 'agent-nim',
        popo: 'agent-popo',
      },
    });
    expect(plan.platformAgentBindings).not.toHaveProperty('nim');
  });

  test('plans POPO migration while preserving unrelated bindings', () => {
    const plan = planSingleToMultiInstanceMigration({
      platform: ImSingleToMultiInstancePlatform.Popo,
      singleConfig: {
        ...DEFAULT_POPO_CONFIG,
        enabled: true,
        appKey: 'popo-app-key',
        appSecret: 'popo-secret',
        aesKey: 'popo-aes',
      },
      existingInstanceIds: [],
      platformAgentBindings: {
        popo: 'agent-popo',
        'feishu:bot-a': 'agent-feishu',
      },
      createInstanceId: () => 'popo-primary',
      defaultInstanceName: 'POPO Bot 1',
      shouldMigrateConfig: hasMeaningfulPopoSingleConfig,
    });

    expect(plan.platformAgentBindings).toEqual({
      'popo:popo-primary': 'agent-popo',
      'feishu:bot-a': 'agent-feishu',
    });
  });

  test('skips migration when multi-instance records already exist', () => {
    const plan = planSingleToMultiInstanceMigration({
      platform: ImSingleToMultiInstancePlatform.Nim,
      singleConfig: {
        ...DEFAULT_NIM_CONFIG,
        appKey: 'nim-app-key',
        account: 'nim-bot',
        token: 'nim-token',
      },
      existingInstanceIds: ['nim-existing'],
      platformAgentBindings: {
        nim: 'agent-nim',
      },
      createInstanceId: () => 'nim-primary',
      defaultInstanceName: 'NIM Bot 1',
      shouldMigrateConfig: hasMeaningfulNimSingleConfig,
    });

    expect(plan).toEqual({
      shouldMigrate: false,
      platform: 'nim',
      skipReason: ImSingleToMultiInstanceSkipReason.ExistingInstances,
      platformAgentBindings: {
        nim: 'agent-nim',
      },
    });
  });

  test('skips migration when the single-instance config is empty', () => {
    const plan = planSingleToMultiInstanceMigration({
      platform: ImSingleToMultiInstancePlatform.Popo,
      singleConfig: DEFAULT_POPO_CONFIG,
      existingInstanceIds: [],
      platformAgentBindings: {
        popo: 'agent-popo',
      },
      createInstanceId: () => 'popo-primary',
      defaultInstanceName: 'POPO Bot 1',
      shouldMigrateConfig: hasMeaningfulPopoSingleConfig,
    });

    expect(plan).toEqual({
      shouldMigrate: false,
      platform: 'popo',
      skipReason: ImSingleToMultiInstanceSkipReason.EmptyConfig,
      platformAgentBindings: {
        popo: 'agent-popo',
      },
    });
  });
});
