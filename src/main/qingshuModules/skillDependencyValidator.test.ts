import { describe, expect, test } from 'vitest';
import { validateQingShuSkillDependencies } from './skillDependencyValidator';
import { summarizeQingShuSharedToolCatalog } from './sharedToolCatalog';
import {
  QingShuModuleStatusKind,
  QingShuSkillDependencyValidationLevel,
  QingShuToolAudience,
  QingShuToolDangerLevel,
  QingShuToolStability,
  QingShuToolVisibility,
  type QingShuSharedToolCatalog,
  type QingShuSkillDeclaredDependency,
} from './types';

const createCatalogSummary = () => summarizeQingShuSharedToolCatalog({
  generatedAt: 1,
  modules: [
    {
      moduleId: 'order',
      version: '1.0.0',
      status: QingShuModuleStatusKind.Active,
      enabled: true,
      sharedToolsEnabled: true,
      builtInSkillsEnabled: false,
    },
  ],
  tools: [
    {
      capabilityKey: 'order.query',
      toolName: 'qingshu_order_query',
      description: 'query order',
      module: 'order',
      bundle: 'order-basic',
      visibility: QingShuToolVisibility.Shared,
      audience: QingShuToolAudience.Both,
      stability: QingShuToolStability.Stable,
      dangerLevel: QingShuToolDangerLevel.Read,
    },
  ],
} satisfies QingShuSharedToolCatalog);

describe('validateQingShuSkillDependencies', () => {
  test('returns info when no qingshu dependencies are declared', () => {
    const result = validateQingShuSkillDependencies({
      toolBundles: [],
      toolRefs: [],
      capabilityRefs: [],
    }, createCatalogSummary());

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([
      expect.objectContaining({
        level: QingShuSkillDependencyValidationLevel.Info,
        code: 'no_dependencies_declared',
      }),
    ]);
  });

  test('returns errors for missing bundle, tool, and capability references', () => {
    const dependencies: QingShuSkillDeclaredDependency = {
      toolBundles: ['missing-bundle'],
      toolRefs: ['qingshu_missing_tool'],
      capabilityRefs: ['missing.capability'],
    };

    const result = validateQingShuSkillDependencies(dependencies, createCatalogSummary());

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'tool_bundle_not_found',
      'tool_ref_not_found',
      'capability_ref_not_found',
    ]);
  });

  test('returns warnings when tool refs and capability refs are not covered by declared bundles', () => {
    const dependencies: QingShuSkillDeclaredDependency = {
      toolBundles: [],
      toolRefs: ['qingshu_order_query'],
      capabilityRefs: ['order.query'],
    };

    const result = validateQingShuSkillDependencies(dependencies, createCatalogSummary());

    expect(result.valid).toBe(true);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'tool_bundle_not_declared',
      'capability_bundle_not_declared',
    ]);
    expect(result.issues.every((issue) => issue.level === QingShuSkillDependencyValidationLevel.Warn)).toBe(true);
  });

  test('passes cleanly when declared bundles cover referenced shared tools', () => {
    const dependencies: QingShuSkillDeclaredDependency = {
      toolBundles: ['order-basic'],
      toolRefs: ['qingshu_order_query'],
      capabilityRefs: ['order.query'],
    };

    const result = validateQingShuSkillDependencies(dependencies, createCatalogSummary());

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
