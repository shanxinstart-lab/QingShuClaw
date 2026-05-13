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

  test('expands NIM and POPO instances after OpenClaw account routing is enabled', () => {
    initScheduledTaskHelpers({
      getIMGatewayManager: () => ({
        getConfig: () => ({
          nim: {
            instances: [
              {
                instanceId: 'nim-token-001',
                instanceName: '云信 Token Bot',
                enabled: true,
                nimToken: 'app-key|accid-001|token-secret',
              },
              {
                instanceId: 'nim-account-002',
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
          popo: {
            instances: [
              {
                instanceId: 'popo-extra-001',
                instanceName: 'POPO 二号',
                enabled: true,
                appKey: 'popo-extra',
                appSecret: 'popo-extra-secret',
                aesKey: 'popo-extra-aes',
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
      accountId: 'nim-toke',
      filterAccountId: 'nim-toke',
    });
    expect(channels).toContainEqual({
      value: 'nim',
      label: '云信账号 Bot',
      accountId: 'nim-acco',
      filterAccountId: 'nim-acco',
    });
    expect(channels).toContainEqual({
      value: 'moltbot-popo',
      label: 'POPO 二号',
      accountId: 'popo-ext',
      filterAccountId: 'popo-ext',
    });
    expect(channels.some((channel) => channel.label === '云信不可用 Bot')).toBe(false);
  });
});
