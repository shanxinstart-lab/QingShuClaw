import type {
  QingShuAgentGovernanceSummary,
  QingShuGovernanceSkillItem,
} from '../types/qingshuGovernance';
import { qingshuGovernanceService } from './qingshuGovernance';

const normalizeIds = (values: string[]): string[] => Array.from(new Set(
  values
    .map((value) => value.trim())
    .filter(Boolean),
)).sort();

export const buildQingShuAgentGovernanceSummary = (
  items: QingShuGovernanceSkillItem[],
  toolBundleIds: string[],
): QingShuAgentGovernanceSummary => {
  const requiredBundles = normalizeIds(
    items.flatMap((item) => item.governance.dependencies.dependencies.toolBundles),
  );
  const currentBundles = normalizeIds(toolBundleIds);
  const currentBundleSet = new Set(currentBundles);
  const missingBundles = requiredBundles.filter((bundle) => !currentBundleSet.has(bundle));
  const declaredToolRefs = normalizeIds(
    items.flatMap((item) => item.governance.dependencies.dependencies.toolRefs),
  );

  return {
    analyzedSkillCount: items.length,
    declaredSkillCount: items.filter((item) => item.governance.dependencies.hasDeclarations).length,
    issueCount: items.reduce((count, item) => count + item.governance.validation.issues.length, 0),
    requiredBundles,
    currentBundles,
    missingBundles,
    declaredToolRefs,
  };
};

export const loadQingShuAgentGovernanceSummary = async (
  skillIds: string[],
  toolBundleIds: string[],
): Promise<QingShuAgentGovernanceSummary> => {
  const normalizedSkillIds = normalizeIds(skillIds);
  if (normalizedSkillIds.length === 0) {
    return buildQingShuAgentGovernanceSummary([], toolBundleIds);
  }

  const items = await qingshuGovernanceService.analyzeSkillIds(normalizedSkillIds);
  return buildQingShuAgentGovernanceSummary(items, toolBundleIds);
};
