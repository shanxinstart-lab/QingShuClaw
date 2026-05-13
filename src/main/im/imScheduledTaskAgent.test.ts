import { describe, expect, test } from 'vitest';

import { DEFAULT_MANAGED_AGENT_ID } from '../libs/openclawChannelSessionSync';
import { resolveIMScheduledTaskAgentId } from './imScheduledTaskAgent';

describe('resolveIMScheduledTaskAgentId', () => {
  test('uses the agent from the IM cowork session', () => {
    const coworkStore = {
      getSession: () => ({ agentId: 'sales-agent' }),
    };

    expect(resolveIMScheduledTaskAgentId(coworkStore, 'session-1')).toBe('sales-agent');
  });

  test('falls back to the managed main agent for legacy or missing sessions', () => {
    expect(resolveIMScheduledTaskAgentId({
      getSession: () => ({ agentId: '' }),
    }, 'session-1')).toBe(DEFAULT_MANAGED_AGENT_ID);

    expect(resolveIMScheduledTaskAgentId({
      getSession: () => null,
    }, 'missing-session')).toBe(DEFAULT_MANAGED_AGENT_ID);
  });
});
