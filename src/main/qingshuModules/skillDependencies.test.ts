import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, test } from 'vitest';
import {
  parseQingShuSkillDependencies,
  readQingShuSkillDependencies,
} from './skillDependencies';

const tempFiles: string[] = [];

afterEach(() => {
  for (const filePath of tempFiles.splice(0, tempFiles.length)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore cleanup failures in tests
    }
  }
});

describe('parseQingShuSkillDependencies', () => {
  test('parses tool bundle and tool references from frontmatter', () => {
    const result = parseQingShuSkillDependencies(`---
name: qingshu-order-audit
toolBundles:
  - order-basic
toolRefs:
  - qingshu_order_query
capabilityRefs:
  - order.query
---

# Skill
`);

    expect(result).toEqual({
      dependencies: {
        toolBundles: ['order-basic'],
        toolRefs: ['qingshu_order_query'],
        capabilityRefs: ['order.query'],
      },
      hasDeclarations: true,
    });
  });

  test('ignores invalid values and deduplicates normalized strings', () => {
    const result = parseQingShuSkillDependencies(`---
toolBundles:
  - " inventory-readonly "
  - inventory-readonly
  - 1
toolRefs:
  - qingshu_inventory_check
  - ""
capabilityRefs:
  - inventory.check
  - null
---
`);

    expect(result.dependencies).toEqual({
      toolBundles: ['inventory-readonly'],
      toolRefs: ['qingshu_inventory_check'],
      capabilityRefs: ['inventory.check'],
    });
    expect(result.hasDeclarations).toBe(true);
  });

  test('returns empty declarations when frontmatter is missing', () => {
    const result = parseQingShuSkillDependencies('# Plain skill');

    expect(result).toEqual({
      dependencies: {
        toolBundles: [],
        toolRefs: [],
        capabilityRefs: [],
      },
      hasDeclarations: false,
    });
  });
});

describe('readQingShuSkillDependencies', () => {
  test('reads dependencies from skill file path', () => {
    const filePath = path.join(os.tmpdir(), `qingshu-skill-${Date.now()}.md`);
    tempFiles.push(filePath);
    fs.writeFileSync(filePath, `---
toolBundles:
  - lbs-analysis
---
`, 'utf-8');

    expect(readQingShuSkillDependencies(filePath)).toEqual({
      dependencies: {
        toolBundles: ['lbs-analysis'],
        toolRefs: [],
        capabilityRefs: [],
      },
      hasDeclarations: true,
    });
  });

  test('fails closed for missing files', () => {
    expect(readQingShuSkillDependencies('/tmp/not-found-skill.md')).toEqual({
      dependencies: {
        toolBundles: [],
        toolRefs: [],
        capabilityRefs: [],
      },
      hasDeclarations: false,
    });
  });
});
