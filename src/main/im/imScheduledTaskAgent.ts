import { DEFAULT_MANAGED_AGENT_ID } from '../libs/openclawChannelSessionSync';

export interface IMScheduledTaskAgentSession {
  agentId?: string | null;
}

export interface IMScheduledTaskAgentStore {
  getSession(sessionId: string): IMScheduledTaskAgentSession | null;
}

export function resolveIMScheduledTaskAgentId(
  coworkStore: IMScheduledTaskAgentStore,
  sessionId: string,
): string {
  const session = coworkStore.getSession(sessionId);
  const agentId = session?.agentId?.trim();
  return agentId || DEFAULT_MANAGED_AGENT_ID;
}
