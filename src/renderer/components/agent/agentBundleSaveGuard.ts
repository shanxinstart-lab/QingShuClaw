const normalizeIds = (values: string[]): string[] => Array.from(new Set(
  values
    .map((value) => value.trim())
    .filter(Boolean),
)).sort();

export interface AgentBundleSaveGuardInput {
  skillIds: string[];
  toolBundleIds: string[];
  missingBundles: string[];
  acknowledgedSignature: string | null;
}

export interface AgentBundleSaveGuardResult {
  warningSignature: string | null;
  shouldConfirm: boolean;
}

export interface AgentBundleSaveWarningState {
  missingBundles: string[];
  previewBundles: string[];
  hiddenBundleCount: number;
}

export const buildAgentBundleSaveWarningSignature = (
  skillIds: string[],
  toolBundleIds: string[],
  missingBundles: string[],
): string | null => {
  const normalizedMissingBundles = normalizeIds(missingBundles);
  if (normalizedMissingBundles.length === 0) {
    return null;
  }

  return JSON.stringify({
    skillIds: normalizeIds(skillIds),
    toolBundleIds: normalizeIds(toolBundleIds),
    missingBundles: normalizedMissingBundles,
  });
};

export const evaluateAgentBundleSaveGuard = ({
  skillIds,
  toolBundleIds,
  missingBundles,
  acknowledgedSignature,
}: AgentBundleSaveGuardInput): AgentBundleSaveGuardResult => {
  const warningSignature = buildAgentBundleSaveWarningSignature(skillIds, toolBundleIds, missingBundles);
  return {
    warningSignature,
    shouldConfirm: !!warningSignature && warningSignature !== acknowledgedSignature,
  };
};

export const buildAgentBundleSaveWarningState = (
  missingBundles: string[],
  previewLimit = 3,
): AgentBundleSaveWarningState | null => {
  const normalizedMissingBundles = normalizeIds(missingBundles);
  if (normalizedMissingBundles.length === 0) {
    return null;
  }

  return {
    missingBundles: normalizedMissingBundles,
    previewBundles: normalizedMissingBundles.slice(0, previewLimit),
    hiddenBundleCount: Math.max(normalizedMissingBundles.length - previewLimit, 0),
  };
};
