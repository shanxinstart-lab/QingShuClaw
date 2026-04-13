import fs from 'fs';
import yaml from 'js-yaml';
import type {
  QingShuCapabilityKey,
  QingShuSkillDeclaredDependency,
  QingShuSkillDependencyParseResult,
  QingShuToolBundleId,
} from './types';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

const EMPTY_DEPENDENCIES: QingShuSkillDeclaredDependency = {
  toolBundles: [],
  toolRefs: [],
  capabilityRefs: [],
};

const normalizeStringArray = <T extends string>(value: unknown): T[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of value) {
    const normalized = typeof item === 'string' ? item.trim() : '';
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized as T);
  }
  return result;
};

const parseFrontmatter = (raw: string): Record<string, unknown> => {
  const normalized = raw.replace(/^\uFEFF/, '');
  const match = normalized.match(FRONTMATTER_RE);
  if (!match) {
    return {};
  }

  try {
    const parsed = yaml.load(match[1]);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

export const parseQingShuSkillDependencies = (
  raw: string,
): QingShuSkillDependencyParseResult => {
  const frontmatter = parseFrontmatter(raw);
  const dependencies: QingShuSkillDeclaredDependency = {
    toolBundles: normalizeStringArray<QingShuToolBundleId>(frontmatter.toolBundles),
    toolRefs: normalizeStringArray<string>(frontmatter.toolRefs),
    capabilityRefs: normalizeStringArray<QingShuCapabilityKey>(frontmatter.capabilityRefs),
  };

  return {
    dependencies,
    hasDeclarations:
      dependencies.toolBundles.length > 0 ||
      dependencies.toolRefs.length > 0 ||
      dependencies.capabilityRefs.length > 0,
  };
};

export const readQingShuSkillDependencies = (
  skillFilePath: string,
): QingShuSkillDependencyParseResult => {
  try {
    const raw = fs.readFileSync(skillFilePath, 'utf-8');
    return parseQingShuSkillDependencies(raw);
  } catch {
    return {
      dependencies: { ...EMPTY_DEPENDENCIES },
      hasDeclarations: false,
    };
  }
};
