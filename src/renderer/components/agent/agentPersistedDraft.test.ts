import { describe, expect, test } from 'vitest';

import {
  buildPersistedCreateAgentRequest,
  buildPersistedUpdateAgentRequest,
} from './agentPersistedDraft';

describe('agentPersistedDraft', () => {
  test('buildPersistedCreateAgentRequest excludes debug tool bundle draft state', () => {
    const result = buildPersistedCreateAgentRequest({
      name: '  Data Agent  ',
      description: '  desc  ',
      systemPrompt: '  prompt  ',
      identity: '  identity  ',
      workingDirectory: '  /tmp/qingshu  ',
      icon: '  🤖  ',
      skillIds: ['skill-a'],
      toolBundleIds: ['order-basic'],
      debugToolBundleIds: ['order-basic', 'lbs-analysis'],
    });

    expect(result).toEqual({
      name: 'Data Agent',
      description: 'desc',
      systemPrompt: 'prompt',
      identity: 'identity',
      workingDirectory: '/tmp/qingshu',
      icon: '🤖',
      skillIds: ['skill-a'],
      toolBundleIds: ['order-basic'],
    });
    expect(result.toolBundleIds).toEqual(['order-basic']);
  });

  test('buildPersistedUpdateAgentRequest excludes debug tool bundle draft state', () => {
    const result = buildPersistedUpdateAgentRequest({
      name: '  Data Agent  ',
      description: '  desc  ',
      systemPrompt: '  prompt  ',
      identity: '  identity  ',
      workingDirectory: '  /tmp/agent  ',
      icon: '  🤖  ',
      skillIds: ['skill-a'],
      toolBundleIds: ['inventory-readonly'],
      debugToolBundleIds: ['order-basic'],
    });

    expect(result).toEqual({
      name: 'Data Agent',
      description: 'desc',
      systemPrompt: 'prompt',
      identity: 'identity',
      workingDirectory: '/tmp/agent',
      icon: '🤖',
      skillIds: ['skill-a'],
      toolBundleIds: ['inventory-readonly'],
    });
    expect(result.toolBundleIds).toEqual(['inventory-readonly']);
  });

  test('buildPersistedCreateAgentRequest omits empty icon while update keeps empty string', () => {
    const createResult = buildPersistedCreateAgentRequest({
      name: 'Agent',
      description: '',
      systemPrompt: '',
      identity: '',
      workingDirectory: '   ',
      icon: '   ',
      skillIds: [],
      toolBundleIds: [],
    });
    const updateResult = buildPersistedUpdateAgentRequest({
      name: 'Agent',
      description: '',
      systemPrompt: '',
      identity: '',
      workingDirectory: '   ',
      icon: '   ',
      skillIds: [],
      toolBundleIds: [],
    });

    expect(createResult.icon).toBeUndefined();
    expect(updateResult.icon).toBe('');
    expect(createResult.workingDirectory).toBe('');
    expect(updateResult.workingDirectory).toBe('');
    expect(createResult.toolBundleIds).toEqual([]);
    expect(updateResult.toolBundleIds).toEqual([]);
  });
});
