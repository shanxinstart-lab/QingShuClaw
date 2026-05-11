import { beforeEach, describe, expect, test } from 'vitest';

import { initScheduledTaskHelpers, listScheduledTaskChannels } from './helpers';

describe('scheduled task helpers', () => {
  beforeEach(() => {
    initScheduledTaskHelpers({
      getIMGatewayManager: () => ({
        getConfig: () => null,
      }),
    });
  });

  test('returns registry channel options when IM config is unavailable', () => {
    const channels = listScheduledTaskChannels();
    expect(channels.length).toBeGreaterThan(0);
    expect(channels.some((channel) => channel.value === 'dingtalk')).toBe(true);
    expect(channels.some((channel) => channel.value === 'feishu')).toBe(true);
  });

  test('expands enabled multi-instance platforms into per-instance channel options', () => {
    initScheduledTaskHelpers({
      getIMGatewayManager: () => ({
        getConfig: () => ({
          dingtalk: {
            instances: [
              {
                instanceId: 'dingtalk-00112233',
                instanceName: '钉钉一号',
                enabled: true,
              },
              {
                instanceId: 'dingtalk-disabled',
                instanceName: '钉钉二号',
                enabled: false,
              },
            ],
          },
          feishu: {
            instances: [
              {
                instanceId: 'feishu-aabbccdd',
                instanceName: '飞书机器人 A',
                enabled: true,
              },
            ],
          },
          weixin: {
            enabled: true,
          },
          qq: {
            instances: [],
          },
        }),
      }),
    });

    const channels = listScheduledTaskChannels();

    expect(channels).toContainEqual({
      value: 'dingtalk',
      label: '钉钉一号',
      accountId: 'dingtalk',
      filterAccountId: 'dingtalk',
    });
    expect(channels).toContainEqual({
      value: 'feishu',
      label: '飞书机器人 A',
      accountId: 'feishu-a',
      filterAccountId: 'feishu-a',
    });
    expect(channels).toContainEqual({
      value: 'openclaw-weixin',
      label: 'WeChat',
    });
    expect(channels.some((channel) => channel.label === '钉钉二号')).toBe(false);
  });

  test('derives NIM runtime account ids from token or app account when instance id is unavailable', () => {
    initScheduledTaskHelpers({
      getIMGatewayManager: () => ({
        getConfig: () => ({
          nim: {
            instances: [
              {
                instanceName: '云信 Token Bot',
                enabled: true,
                nimToken: 'app-key|accid-001|token-secret',
              },
              {
                instanceName: '云信账号 Bot',
                enabled: true,
                appKey: 'app-key-2',
                account: 'accid-002',
              },
              {
                instanceName: '云信不可用 Bot',
                enabled: true,
              },
            ],
          },
        }),
      }),
    });

    const channels = listScheduledTaskChannels();

    expect(channels).toContainEqual({
      value: 'nim',
      label: '云信 Token Bot',
      accountId: 'app-key:accid-001',
      filterAccountId: 'app-key:accid-001',
    });
    expect(channels).toContainEqual({
      value: 'nim',
      label: '云信账号 Bot',
      accountId: 'app-key-2:accid-002',
      filterAccountId: 'app-key-2:accid-002',
    });
    expect(channels.some((channel) => channel.label === '云信不可用 Bot')).toBe(false);
  });
});
