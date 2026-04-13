import type { Agent } from '../coworkStore';
import type { QingShuAgentToolBundleSelection, QingShuToolBundleId } from './types';

const normalizeToolBundleIds = (
  toolBundleIds: QingShuToolBundleId[],
  enabledToolBundles: Set<QingShuToolBundleId>,
): QingShuToolBundleId[] => {
  const deduped: QingShuToolBundleId[] = [];
  const seen = new Set<QingShuToolBundleId>();
  for (const toolBundleId of toolBundleIds) {
    const normalized = typeof toolBundleId === 'string' ? toolBundleId.trim() : '';
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    if (!enabledToolBundles.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(normalized);
  }
  return deduped.sort();
};

export const resolveAgentToolBundleSelections = (
  agents: Agent[],
  enabledToolBundles: QingShuToolBundleId[],
): QingShuAgentToolBundleSelection[] => {
  const enabledBundleSet = new Set(
    enabledToolBundles
      .map((toolBundleId) => toolBundleId.trim())
      .filter(Boolean),
  );

  return agents
    .filter((agent) => agent.enabled)
    .map((agent) => ({
      agentId: agent.id,
      toolBundleIds: normalizeToolBundleIds(agent.toolBundleIds ?? [], enabledBundleSet),
    }));
};
