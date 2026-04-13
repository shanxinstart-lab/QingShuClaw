import { describe, expect, test } from 'vitest';
import { DefaultQingShuExtensionHost } from './host';
import { summarizeQingShuSharedToolCatalog } from './sharedToolCatalog';
import {
  QingShuToolAudience,
  QingShuToolDangerLevel,
  QingShuToolStability,
  QingShuToolVisibility,
  type QingShuExtensionModule,
} from './types';

const createModule = (moduleId: string, enabledByDefault = false): QingShuExtensionModule => ({
  register() {
    return {
      moduleId,
      version: '1.0.0',
      enabledByDefault,
      capabilities: [],
      toolBundles: [`${moduleId}-bundle`],
      sharedToolDescriptors: [
        {
          capabilityKey: `${moduleId}.query`,
          toolName: `qingshu_${moduleId}_query`,
          description: `${moduleId} query`,
          module: moduleId,
          bundle: `${moduleId}-bundle`,
          visibility: QingShuToolVisibility.Shared,
          audience: QingShuToolAudience.Both,
          stability: QingShuToolStability.Stable,
          dangerLevel: QingShuToolDangerLevel.Read,
        },
      ],
    };
  },
});

describe('DefaultQingShuExtensionHost', () => {
  test('keeps modules disabled by default when flags are off', () => {
    const host = new DefaultQingShuExtensionHost({
      resolveFeatureFlags: () => ({
        enabled: false,
        sharedToolsEnabled: false,
        builtInSkillsEnabled: false,
      }),
    });

    host.initialize([createModule('lbs')]);

    expect(host.listModuleStatuses()).toEqual([
      {
        moduleId: 'lbs',
        version: '1.0.0',
        status: 'disabled',
        enabled: false,
        sharedToolsEnabled: false,
        builtInSkillsEnabled: false,
      },
    ]);
    expect(host.getEnabledSharedTools()).toEqual([]);
    expect(host.getEnabledToolBundles()).toEqual([]);
  });

  test('exposes shared tools only for enabled modules with shared tools on', () => {
    const host = new DefaultQingShuExtensionHost({
      resolveFeatureFlags: () => ({
        enabled: true,
        sharedToolsEnabled: true,
        builtInSkillsEnabled: false,
      }),
    });

    host.initialize([createModule('order')]);

    expect(host.getEnabledToolBundles()).toEqual(['order-bundle']);
    expect(host.getEnabledSharedTools().map((tool) => tool.toolName)).toEqual([
      'qingshu_order_query',
    ]);
  });

  test('keeps runtime catalog empty when module is enabled but shared tools are off', () => {
    const host = new DefaultQingShuExtensionHost({
      resolveFeatureFlags: () => ({
        enabled: true,
        sharedToolsEnabled: false,
        builtInSkillsEnabled: true,
      }),
    });

    host.initialize([createModule('lbs')]);

    expect(host.listModuleStatuses()).toEqual([
      {
        moduleId: 'lbs',
        version: '1.0.0',
        status: 'active',
        enabled: true,
        sharedToolsEnabled: false,
        builtInSkillsEnabled: true,
      },
    ]);
    expect(host.getEnabledSharedTools()).toEqual([]);
    expect(host.getEnabledToolBundles()).toEqual([]);

    const summary = summarizeQingShuSharedToolCatalog(host.getSharedToolCatalog());
    expect(summary.bundles).toEqual([]);
    expect(summary.modules).toEqual([
      {
        moduleId: 'lbs',
        version: '1.0.0',
        status: 'active',
        enabled: true,
        sharedToolsEnabled: false,
        builtInSkillsEnabled: true,
        sharedToolCount: 0,
        bundles: [],
      },
    ]);
  });

  test('isolates module registration failures', () => {
    const host = new DefaultQingShuExtensionHost({
      resolveFeatureFlags: () => ({
        enabled: true,
        sharedToolsEnabled: true,
        builtInSkillsEnabled: true,
      }),
    });

    host.initialize([
      createModule('inventory'),
      {
        register() {
          throw new Error('boom');
        },
      },
    ]);

    expect(host.listModuleStatuses()).toHaveLength(2);
    expect(host.getEnabledSharedTools().map((tool) => tool.toolName)).toEqual([
      'qingshu_inventory_query',
    ]);
    expect(host.listModuleStatuses().some((item) => item.status === 'failed')).toBe(true);
  });
});
