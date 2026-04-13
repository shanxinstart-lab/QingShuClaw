import { describe, expect, test } from 'vitest';
import { buildQingShuToolBundleOptions } from './qingshuToolBundles';
import type { QingShuSharedToolCatalogSummary } from '../types/qingshuGovernance';

const createSummary = (): QingShuSharedToolCatalogSummary => ({
  generatedAt: 1,
  modules: [
    {
      moduleId: 'lbs',
      version: '1.0.0',
      status: 'active',
      enabled: true,
      sharedToolsEnabled: true,
      builtInSkillsEnabled: false,
      sharedToolCount: 2,
      bundles: ['lbs-analysis'],
    },
    {
      moduleId: 'inventory',
      version: '1.0.0',
      status: 'disabled',
      enabled: false,
      sharedToolsEnabled: false,
      builtInSkillsEnabled: false,
      sharedToolCount: 0,
      bundles: [],
    },
  ],
  bundles: [
    {
      bundle: 'order-basic',
      moduleIds: ['inventory'],
      toolNames: ['qingshu_order_query'],
      toolCount: 1,
    },
    {
      bundle: 'lbs-analysis',
      moduleIds: ['lbs'],
      toolNames: ['qingshu_lbs_city_analysis', 'qingshu_lbs_supply_demand'],
      toolCount: 2,
    },
  ],
  tools: [],
});

describe('buildQingShuToolBundleOptions', () => {
  test('returns sorted bundle options with active module hints', () => {
    expect(buildQingShuToolBundleOptions(createSummary())).toEqual([
      {
        bundleId: 'lbs-analysis',
        moduleIds: ['lbs'],
        toolCount: 2,
        toolNames: ['qingshu_lbs_city_analysis', 'qingshu_lbs_supply_demand'],
        hasActiveModules: true,
      },
      {
        bundleId: 'order-basic',
        moduleIds: ['inventory'],
        toolCount: 1,
        toolNames: ['qingshu_order_query'],
        hasActiveModules: false,
      },
    ]);
  });

  test('returns an empty list when catalog summary is missing', () => {
    expect(buildQingShuToolBundleOptions(null)).toEqual([]);
  });
});
