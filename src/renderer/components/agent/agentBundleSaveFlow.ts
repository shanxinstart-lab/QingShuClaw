import { evaluateAgentBundleSaveGuard } from './agentBundleSaveGuard';

export interface AgentBundleSaveFlowInput {
  skillIds: string[];
  toolBundleIds: string[];
  missingBundles: string[];
  acknowledgedSignature: string | null;
}

export interface AgentBundleSaveFlowResult {
  allowSave: boolean;
  nextAcknowledgedSignature: string | null;
  nextMissingBundles: string[];
  shouldFocusSkillsTab: boolean;
}

export const resolveAgentBundleSaveFlow = ({
  skillIds,
  toolBundleIds,
  missingBundles,
  acknowledgedSignature,
}: AgentBundleSaveFlowInput): AgentBundleSaveFlowResult => {
  const saveGuard = evaluateAgentBundleSaveGuard({
    skillIds,
    toolBundleIds,
    missingBundles,
    acknowledgedSignature,
  });

  if (saveGuard.shouldConfirm) {
    return {
      allowSave: false,
      nextAcknowledgedSignature: saveGuard.warningSignature,
      nextMissingBundles: missingBundles,
      shouldFocusSkillsTab: true,
    };
  }

  return {
    allowSave: true,
    nextAcknowledgedSignature: saveGuard.warningSignature,
    nextMissingBundles: missingBundles,
    shouldFocusSkillsTab: false,
  };
};
