import { describe, expect, test } from 'vitest';
import { buildQingShuAgentGovernanceSummary } from './qingshuGovernanceSummary';
import type { QingShuGovernanceSkillItem } from '../types/qingshuGovernance';

const createGovernanceItem = (
  skillId: string,
  options: {
    hasDeclarations: boolean;
    toolBundles: string[];
    toolRefs: string[];
    issueCodes: string[];
  },
): QingShuGovernanceSkillItem => ({
  skillId,
  governance: {
    dependencies: {
      hasDeclarations: options.hasDeclarations,
      dependencies: {
        toolBundles: options.toolBundles,
        toolRefs: options.toolRefs,
        capabilityRefs: [],
      },
    },
    validation: {
      valid: options.issueCodes.length === 0,
      issues: options.issueCodes.map((code) => ({
        level: 'warn',
        code,
        message: code,
        field: 'general',
      })),
      dependencies: {
        toolBundles: options.toolBundles,
        toolRefs: options.toolRefs,
        capabilityRefs: [],
      },
    },
    catalog: {
      generatedAt: 1,
      modules: [],
      bundles: [],
      tools: [],
    },
    contracts: {
      payload: {
        generatedAt: 1,
        modules: [],
        bundles: [],
        tools: [],
      },
      markdown: '',
      json: '',
      suggestedMarkdownPath: 'generated/qingshu-shared-tools.md',
      suggestedJsonPath: 'generated/qingshu-shared-tools.json',
    },
  },
});

describe('buildQingShuAgentGovernanceSummary', () => {
  test('dedupes and sorts bundles/tool refs while computing missing bundles', () => {
    const summary = buildQingShuAgentGovernanceSummary([
      createGovernanceItem('skill-a', {
        hasDeclarations: true,
        toolBundles: [' lbs-analysis ', 'order-basic'],
        toolRefs: ['qingshu_order_query', 'qingshu_lbs_city_analysis'],
        issueCodes: ['tool_bundle_not_declared'],
      }),
      createGovernanceItem('skill-b', {
        hasDeclarations: false,
        toolBundles: ['order-basic', 'inventory-readonly'],
        toolRefs: ['qingshu_order_query', 'qingshu_inventory_check'],
        issueCodes: ['tool_ref_not_found', 'capability_ref_not_found'],
      }),
    ], [' inventory-readonly ', 'order-basic', 'order-basic']);

    expect(summary).toEqual({
      analyzedSkillCount: 2,
      declaredSkillCount: 1,
      issueCount: 3,
      requiredBundles: ['inventory-readonly', 'lbs-analysis', 'order-basic'],
      currentBundles: ['inventory-readonly', 'order-basic'],
      missingBundles: ['lbs-analysis'],
      declaredToolRefs: [
        'qingshu_inventory_check',
        'qingshu_lbs_city_analysis',
        'qingshu_order_query',
      ],
    });
  });

  test('returns an empty summary when no skills are analyzed', () => {
    expect(buildQingShuAgentGovernanceSummary([], [])).toEqual({
      analyzedSkillCount: 0,
      declaredSkillCount: 0,
      issueCount: 0,
      requiredBundles: [],
      currentBundles: [],
      missingBundles: [],
      declaredToolRefs: [],
    });
  });
});
