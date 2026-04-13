import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, test } from 'vitest';
import {
  analyzeQingShuSkillGovernance,
  readQingShuSkillGovernance,
} from './skillGovernance';
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
  generatedAt: 42,
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

describe('analyzeQingShuSkillGovernance', () => {
  test('returns unified governance result from raw skill content', () => {
    const result = analyzeQingShuSkillGovernance(`---
toolBundles:
  - order-basic
toolRefs:
  - qingshu_order_query
capabilityRefs:
  - order.query
---
`, createCatalogSummary());

    expect(result.dependencies.hasDeclarations).toBe(true);
    expect(result.validation.valid).toBe(true);
    expect(result.validation.issues).toEqual([]);
    expect(result.catalog.generatedAt).toBe(42);
    expect(result.contracts.payload.tools).toHaveLength(1);
    expect(result.contracts.markdown).toContain('`qingshu_order_query`');
  });
});

describe('readQingShuSkillGovernance', () => {
  test('returns governance result from skill file path', () => {
    const filePath = path.join(os.tmpdir(), `qingshu-governance-${Date.now()}.md`);
    tempFiles.push(filePath);
    fs.writeFileSync(filePath, `---
toolRefs:
  - qingshu_order_query
---
`, 'utf-8');

    const result = readQingShuSkillGovernance(filePath, createCatalogSummary());

    expect(result.dependencies.dependencies.toolRefs).toEqual(['qingshu_order_query']);
    expect(result.validation.valid).toBe(true);
    expect(result.validation.issues.map((issue) => issue.code)).toEqual([
      'tool_bundle_not_declared',
    ]);
  });

  test('fails closed for missing skill files while still returning contract artifacts', () => {
    const result = readQingShuSkillGovernance('/tmp/not-found-skill.md', createCatalogSummary());

    expect(result.dependencies.hasDeclarations).toBe(false);
    expect(result.validation.valid).toBe(true);
    expect(result.validation.issues.map((issue) => issue.code)).toEqual([
      'no_dependencies_declared',
    ]);
    expect(result.contracts.payload.bundles).toHaveLength(1);
  });
});
