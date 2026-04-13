import type {
  QingShuSharedToolCatalogSummary,
  QingShuSkillDeclaredDependency,
  QingShuSkillDependencyValidationIssue,
  QingShuSkillDependencyValidationResult,
  QingShuToolBundleId,
} from './types';
import { QingShuSkillDependencyValidationLevel } from './types';

const buildIssue = (
  issue: QingShuSkillDependencyValidationIssue,
): QingShuSkillDependencyValidationIssue => issue;

export const validateQingShuSkillDependencies = (
  dependencies: QingShuSkillDeclaredDependency,
  catalog: QingShuSharedToolCatalogSummary,
): QingShuSkillDependencyValidationResult => {
  const issues: QingShuSkillDependencyValidationIssue[] = [];
  const bundleSet = new Set(catalog.bundles.map((bundle) => bundle.bundle));
  const toolByName = new Map(catalog.tools.map((tool) => [tool.toolName, tool]));
  const toolByCapability = new Map(catalog.tools.map((tool) => [tool.capabilityKey, tool]));
  const declaredBundleSet = new Set<QingShuToolBundleId>(dependencies.toolBundles);

  if (
    dependencies.toolBundles.length === 0 &&
    dependencies.toolRefs.length === 0 &&
    dependencies.capabilityRefs.length === 0
  ) {
    issues.push(buildIssue({
      level: QingShuSkillDependencyValidationLevel.Info,
      code: 'no_dependencies_declared',
      message: 'Skill 未声明任何 QingShu 依赖，将按兼容模式处理。',
      field: 'general',
    }));
  }

  for (const bundle of dependencies.toolBundles) {
    if (!bundleSet.has(bundle)) {
      issues.push(buildIssue({
        level: QingShuSkillDependencyValidationLevel.Error,
        code: 'tool_bundle_not_found',
        message: `未找到共享 tool bundle: ${bundle}`,
        field: 'toolBundles',
        ref: bundle,
      }));
    }
  }

  for (const toolRef of dependencies.toolRefs) {
    const tool = toolByName.get(toolRef);
    if (!tool) {
      issues.push(buildIssue({
        level: QingShuSkillDependencyValidationLevel.Error,
        code: 'tool_ref_not_found',
        message: `未找到共享 tool: ${toolRef}`,
        field: 'toolRefs',
        ref: toolRef,
      }));
      continue;
    }
    if (!declaredBundleSet.has(tool.bundle)) {
      issues.push(buildIssue({
        level: QingShuSkillDependencyValidationLevel.Warn,
        code: 'tool_bundle_not_declared',
        message: `Tool ${toolRef} 属于 bundle ${tool.bundle}，但 skill 未声明该 bundle。`,
        field: 'toolRefs',
        ref: toolRef,
      }));
    }
  }

  for (const capabilityRef of dependencies.capabilityRefs) {
    const tool = toolByCapability.get(capabilityRef);
    if (!tool) {
      issues.push(buildIssue({
        level: QingShuSkillDependencyValidationLevel.Error,
        code: 'capability_ref_not_found',
        message: `未找到共享 capability: ${capabilityRef}`,
        field: 'capabilityRefs',
        ref: capabilityRef,
      }));
      continue;
    }
    if (!declaredBundleSet.has(tool.bundle)) {
      issues.push(buildIssue({
        level: QingShuSkillDependencyValidationLevel.Warn,
        code: 'capability_bundle_not_declared',
        message: `Capability ${capabilityRef} 属于 bundle ${tool.bundle}，但 skill 未声明该 bundle。`,
        field: 'capabilityRefs',
        ref: capabilityRef,
      }));
    }
  }

  return {
    valid: !issues.some((issue) => issue.level === QingShuSkillDependencyValidationLevel.Error),
    issues,
    dependencies,
  };
};
