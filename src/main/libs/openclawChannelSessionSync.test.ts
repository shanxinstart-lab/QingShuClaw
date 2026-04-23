import { describe, expect, test } from 'vitest';

import {
  extractAccountIdFromKey,
  parseChannelSessionKey,
  resolveAgentBinding,
} from './openclawChannelSessionSync';

describe('openclawChannelSessionSync', () => {
  test('keeps account scope in multi-instance channel session keys', () => {
    const parsed = parseChannelSessionKey('agent:main:dingtalk:abcd1234:direct:ou_123456');

    expect(parsed).toEqual({
      platform: 'dingtalk',
      conversationId: 'abcd1234:direct:ou_123456',
    });
  });

  test('extracts account id from json session context keys', () => {
    const accountId = extractAccountIdFromKey(
      'agent:main:openai-user:{"channel":"feishu","accountid":"feishu001","peerid":"oc_abc"}',
    );

    expect(accountId).toBe('feishu001');
  });

  test('prefers per-instance agent bindings for multi-instance platforms', () => {
    const agentId = resolveAgentBinding(
      {
        dingtalk: 'main',
        'dingtalk:abcd1234-full-instance-id': 'sales-agent',
      },
      'dingtalk',
      'abcd1234',
    );

    expect(agentId).toBe('sales-agent');
  });

  test('falls back to platform binding when instance binding is missing', () => {
    const agentId = resolveAgentBinding(
      {
        feishu: 'support-agent',
      },
      'feishu',
      'missing123',
    );

    expect(agentId).toBe('support-agent');
  });
});
