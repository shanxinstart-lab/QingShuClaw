import { describe, expect, test } from 'vitest';
import { generateQingShuSharedToolContracts } from './contractGenerator';
import { summarizeQingShuSharedToolCatalog } from './sharedToolCatalog';
import {
  QingShuModuleStatusKind,
  QingShuToolAudience,
  QingShuToolDangerLevel,
  QingShuToolStability,
  QingShuToolVisibility,
  type QingShuSharedToolCatalog,
} from './types';

const createSummary = () => summarizeQingShuSharedToolCatalog({
  generatedAt: 123456,
  modules: [
    {
      moduleId: 'lbs',
      version: '1.0.0',
      status: QingShuModuleStatusKind.Active,
      enabled: true,
      sharedToolsEnabled: true,
      builtInSkillsEnabled: false,
    },
  ],
  tools: [
    {
      capabilityKey: 'lbs.city.analysis',
      toolName: 'qingshu_lbs_city_analysis',
      description: 'Analyze city traffic trends',
      module: 'lbs',
      bundle: 'lbs-analysis',
      visibility: QingShuToolVisibility.Shared,
      audience: QingShuToolAudience.Both,
      stability: QingShuToolStability.Stable,
      dangerLevel: QingShuToolDangerLevel.Read,
      inputSchema: {
        type: 'object',
        properties: {
          cityId: {
            type: 'string',
          },
        },
      },
    },
  ],
} satisfies QingShuSharedToolCatalog);

describe('generateQingShuSharedToolContracts', () => {
  test('generates stable contract payload and suggested output paths', () => {
    const artifacts = generateQingShuSharedToolContracts(createSummary());

    expect(artifacts.suggestedMarkdownPath).toBe('generated/qingshu-shared-tools.md');
    expect(artifacts.suggestedJsonPath).toBe('generated/qingshu-shared-tools.json');
    expect(artifacts.payload.generatedAt).toBe(123456);
    expect(artifacts.payload.bundles).toHaveLength(1);
    expect(artifacts.payload.tools).toHaveLength(1);
  });

  test('renders markdown with bundle and tool sections', () => {
    const artifacts = generateQingShuSharedToolContracts(createSummary());

    expect(artifacts.markdown).toContain('# QingShu Shared Tools');
    expect(artifacts.markdown).toContain('## Bundles');
    expect(artifacts.markdown).toContain('## Tools');
    expect(artifacts.markdown).toContain('`lbs-analysis`');
    expect(artifacts.markdown).toContain('`qingshu_lbs_city_analysis`');
    expect(artifacts.markdown).toContain('Analyze city traffic trends');
  });

  test('renders json payload that round-trips to the same generated data', () => {
    const artifacts = generateQingShuSharedToolContracts(createSummary());

    expect(JSON.parse(artifacts.json)).toEqual(artifacts.payload);
  });
});
