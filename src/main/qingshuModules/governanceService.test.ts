import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, test } from 'vitest';
import { createQingShuGovernanceService } from './governanceService';
import { summarizeQingShuSharedToolCatalog } from './sharedToolCatalog';
import {
  QingShuModuleStatusKind,
  QingShuToolAudience,
  QingShuToolDangerLevel,
  QingShuToolStability,
  QingShuToolVisibility,
  type QingShuSharedToolCatalog,
} from './types';

const tempFiles: string[] = [];

afterEach(() => {
  for (const filePath of tempFiles.splice(0, tempFiles.length)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore cleanup failures
    }
  }
});

const createCatalogSummary = () => summarizeQingShuSharedToolCatalog({
  generatedAt: 7,
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

describe('createQingShuGovernanceService', () => {
  test('analyzes raw skill content against current catalog summary', () => {
    const service = createQingShuGovernanceService({
      getSharedToolCatalogSummary: createCatalogSummary,
    });

    const result = service.analyzeSkillContent(`---
toolBundles:
  - order-basic
toolRefs:
  - qingshu_order_query
---
`);

    expect(result.validation.valid).toBe(true);
    expect(result.catalog.generatedAt).toBe(7);
  });

  test('returns null when skill id cannot be resolved', () => {
    const service = createQingShuGovernanceService({
      getSharedToolCatalogSummary: createCatalogSummary,
      resolveSkillPathById: () => null,
    });

    expect(service.analyzeSkillById('missing-skill')).toBeNull();
  });

  test('analyzes multiple skill files in order and fails closed per file', () => {
    const existingPath = path.join(os.tmpdir(), `qingshu-batch-${Date.now()}.md`);
    tempFiles.push(existingPath);
    fs.writeFileSync(existingPath, `---
toolRefs:
  - qingshu_order_query
---
`, 'utf-8');

    const service = createQingShuGovernanceService({
      getSharedToolCatalogSummary: createCatalogSummary,
    });

    const results = service.analyzeSkillFiles([
      existingPath,
      '/tmp/qingshu-missing-skill.md',
    ]);

    expect(results).toHaveLength(2);
    expect(results[0]?.skillFilePath).toBe(existingPath);
    expect(results[0]?.governance.dependencies.dependencies.toolRefs).toEqual([
      'qingshu_order_query',
    ]);
    expect(results[1]?.skillFilePath).toBe('/tmp/qingshu-missing-skill.md');
    expect(results[1]?.governance.dependencies.hasDeclarations).toBe(false);
  });

  test('analyzes installed skills using provided skill registry snapshot', () => {
    const existingPath = path.join(os.tmpdir(), `qingshu-installed-${Date.now()}.md`);
    tempFiles.push(existingPath);
    fs.writeFileSync(existingPath, `---
toolBundles:
  - order-basic
---
`, 'utf-8');

    const service = createQingShuGovernanceService({
      getSharedToolCatalogSummary: createCatalogSummary,
      listInstalledSkills: () => [
        {
          id: 'order-audit',
          skillPath: existingPath,
        },
      ],
    });

    const results = service.analyzeInstalledSkills();

    expect(results).toEqual([
      expect.objectContaining({
        skillId: 'order-audit',
        skillFilePath: existingPath,
      }),
    ]);
    expect(results[0]?.governance.validation.valid).toBe(true);
  });

  test('fails closed when catalog summary is empty after modules are turned off', () => {
    const service = createQingShuGovernanceService({
      getSharedToolCatalogSummary: () => summarizeQingShuSharedToolCatalog({
        generatedAt: 9,
        modules: [
          {
            moduleId: 'order',
            version: '1.0.0',
            status: QingShuModuleStatusKind.Active,
            enabled: true,
            sharedToolsEnabled: false,
            builtInSkillsEnabled: false,
          },
        ],
        tools: [],
      }),
    });

    const result = service.analyzeSkillContent(`---
toolBundles:
  - order-basic
toolRefs:
  - qingshu_order_query
capabilityRefs:
  - order.query
---
`);

    expect(result.catalog.bundles).toEqual([]);
    expect(result.contracts.payload.tools).toEqual([]);
    expect(result.validation.valid).toBe(false);
    expect(result.validation.issues.map((issue) => issue.code)).toEqual([
      'tool_bundle_not_found',
      'tool_ref_not_found',
      'capability_ref_not_found',
    ]);
  });
});
