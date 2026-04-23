import { describe, expect, test } from 'vitest';

import { DEFAULT_IM_CONFIG, DEFAULT_IM_STATUS } from './types';
import {
  isAnyGatewayConnected,
  isPlatformEnabled,
  pickConfiguredInstance,
} from './imGatewayConfigState';

describe('imGatewayConfigState', () => {
  test('pickConfiguredInstance prefers enabled and configured instances', () => {
    const instances = [
      { enabled: true, appId: '', appSecret: '', instanceId: 'a' },
      { enabled: false, appId: 'disabled', appSecret: 'disabled', instanceId: 'b' },
      { enabled: true, appId: 'filled', appSecret: 'filled', instanceId: 'c' },
    ];

    expect(pickConfiguredInstance(
      instances,
      (instance) => Boolean(instance.appId && instance.appSecret),
    )?.instanceId).toBe('c');
  });

  test('pickConfiguredInstance falls back to enabled instance, then first instance', () => {
    const enabledFallback = [
      { enabled: false, botId: '', secret: '', instanceId: 'a' },
      { enabled: true, botId: '', secret: '', instanceId: 'b' },
    ];
    expect(pickConfiguredInstance(
      enabledFallback,
      (instance) => Boolean(instance.botId && instance.secret),
    )?.instanceId).toBe('b');

    const firstFallback = [
      { enabled: false, botId: '', secret: '', instanceId: 'a' },
      { enabled: false, botId: '', secret: '', instanceId: 'b' },
    ];
    expect(pickConfiguredInstance(
      firstFallback,
      (instance) => Boolean(instance.botId && instance.secret),
    )?.instanceId).toBe('a');
  });

  test('isPlatformEnabled handles multi-instance and single-instance platforms', () => {
    const config = structuredClone(DEFAULT_IM_CONFIG);
    config.feishu.instances = [
      {
        enabled: true,
        instanceId: 'feishu-1',
        instanceName: 'Feishu 1',
        appId: '',
        appSecret: '',
        domain: 'feishu',
        dmPolicy: 'open',
        allowFrom: [],
        groupPolicy: 'open',
        groupAllowFrom: [],
        groups: {},
        historyLimit: 20,
        streaming: true,
        replyMode: 'auto',
        blockStreaming: false,
        footer: {},
        mediaMaxMb: 10,
        debug: false,
      },
    ];
    config.telegram.enabled = true;

    expect(isPlatformEnabled(config, 'feishu')).toBe(true);
    expect(isPlatformEnabled(config, 'telegram')).toBe(true);
    expect(isPlatformEnabled(config, 'qq')).toBe(false);
  });

  test('isAnyGatewayConnected reports whether any platform is connected', () => {
    const status = structuredClone(DEFAULT_IM_STATUS);
    expect(isAnyGatewayConnected(status)).toBe(false);

    status.wecom.instances = [
      {
        connected: true,
        startedAt: null,
        lastError: null,
        botId: null,
        lastInboundAt: null,
        lastOutboundAt: null,
        instanceId: 'wecom-1',
        instanceName: 'Wecom 1',
      },
    ];
    expect(isAnyGatewayConnected(status)).toBe(true);
  });
});
