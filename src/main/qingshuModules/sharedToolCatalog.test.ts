import { describe, expect, test } from 'vitest';
import { summarizeQingShuSharedToolCatalog } from './sharedToolCatalog';
import {
  QingShuModuleStatusKind,
  QingShuToolAudience,
  QingShuToolDangerLevel,
  QingShuToolStability,
  QingShuToolVisibility,
  type QingShuSharedToolCatalog,
} from './types';

const createCatalog = (): QingShuSharedToolCatalog => ({
  generatedAt: 123,
  modules: [
    {
      moduleId: 'inventory',
      version: '1.0.0',
      status: QingShuModuleStatusKind.Active,
      enabled: true,
      sharedToolsEnabled: true,
      builtInSkillsEnabled: false,
    },
    {
      moduleId: 'lbs',
      version: '1.1.0',
      status: QingShuModuleStatusKind.Disabled,
      enabled: false,
      sharedToolsEnabled: false,
      builtInSkillsEnabled: false,
    },
  ],
  tools: [
    {
      capabilityKey: 'inventory.check',
      toolName: 'qingshu_inventory_check',
      description: 'check inventory',
      module: 'inventory',
      bundle: 'inventory-readonly',
      visibility: QingShuToolVisibility.Shared,
      audience: QingShuToolAudience.Both,
      stability: QingShuToolStability.Stable,
      dangerLevel: QingShuToolDangerLevel.Read,
    },
    {
      capabilityKey: 'inventory.list',
      toolName: 'qingshu_inventory_list',
      description: 'list inventory',
      module: 'inventory',
      bundle: 'inventory-readonly',
      visibility: QingShuToolVisibility.Shared,
      audience: QingShuToolAudience.Both,
      stability: QingShuToolStability.Stable,
      dangerLevel: QingShuToolDangerLevel.Read,
    },
  ],
});

describe('summarizeQingShuSharedToolCatalog', () => {
  test('builds stable bundle and module summaries from raw catalog', () => {
    const summary = summarizeQingShuSharedToolCatalog(createCatalog());

    expect(summary.generatedAt).toBe(123);
    expect(summary.bundles).toEqual([
      {
        bundle: 'inventory-readonly',
        moduleIds: ['inventory'],
        toolNames: ['qingshu_inventory_check', 'qingshu_inventory_list'],
        toolCount: 2,
      },
    ]);
    expect(summary.modules).toEqual([
      {
        moduleId: 'inventory',
        version: '1.0.0',
        status: 'active',
        enabled: true,
        sharedToolsEnabled: true,
        builtInSkillsEnabled: false,
        sharedToolCount: 2,
        bundles: ['inventory-readonly'],
      },
      {
        moduleId: 'lbs',
        version: '1.1.0',
        status: 'disabled',
        enabled: false,
        sharedToolsEnabled: false,
        builtInSkillsEnabled: false,
        sharedToolCount: 0,
        bundles: [],
      },
    ]);
  });

  test('keeps tools sorted by toolName for downstream consumers', () => {
    const summary = summarizeQingShuSharedToolCatalog({
      ...createCatalog(),
      tools: [...createCatalog().tools].reverse(),
    });

    expect(summary.tools.map((tool) => tool.toolName)).toEqual([
      'qingshu_inventory_check',
      'qingshu_inventory_list',
    ]);
  });
});
