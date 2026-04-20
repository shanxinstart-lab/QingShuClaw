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
    });
    expect(channels).toContainEqual({
      value: 'feishu',
      label: '飞书机器人 A',
      accountId: 'feishu-a',
    });
    expect(channels).toContainEqual({
      value: 'openclaw-weixin',
      label: 'WeChat',
    });
    expect(channels.some((channel) => channel.label === '钉钉二号')).toBe(false);
  });
});
