import { expect, test } from 'vitest';

import {
  DEFAULT_IM_CONFIG,
  type DingTalkInstanceConfig,
  type FeishuInstanceConfig,
  type IMGatewayConfig,
} from '../../types/im';
import {
  buildAgentBindingKeyBindings,
  collectAgentBoundBindingKeys,
  getAgentImBindingEnabledInstances,
  isAgentImBindingPlatformConfigured,
  isMultiInstanceAgentBindingPlatform,
  normalizeAgentImBindingKey,
  normalizeAgentImBindingPlatform,
} from './agentImBindingConfig';

const createConfig = (patch: Partial<IMGatewayConfig>): IMGatewayConfig => ({
  ...DEFAULT_IM_CONFIG,
  ...patch,
});

test('normalizeAgentImBindingPlatform 兼容 xiaomifeng 旧别名', () => {
  expect(normalizeAgentImBindingPlatform('xiaomifeng')).toBe('netease-bee');
  expect(normalizeAgentImBindingPlatform('weixin')).toBe('weixin');
});

test('normalizeAgentImBindingKey 会标准化绑定 key 的平台部分', () => {
  expect(normalizeAgentImBindingKey('xiaomifeng')).toBe('netease-bee');
  expect(normalizeAgentImBindingKey('feishu:bot-a')).toBe('feishu:bot-a');
});

test('isAgentImBindingPlatformConfigured 支持多实例与 netease-bee', () => {
  const config = createConfig({
    dingtalk: {
      instances: [
        { instanceId: 'a', instanceName: 'A', enabled: false } as unknown as DingTalkInstanceConfig,
        { instanceId: 'b', instanceName: 'B', enabled: true } as unknown as DingTalkInstanceConfig,
      ],
    },
    'netease-bee': {
      ...DEFAULT_IM_CONFIG['netease-bee'],
      enabled: true,
      clientId: 'bee-client',
      secret: 'bee-secret',
    },
  });

  expect(isAgentImBindingPlatformConfigured(config, 'dingtalk')).toBe(true);
  expect(isAgentImBindingPlatformConfigured(config, 'xiaomifeng')).toBe(true);
  expect(isAgentImBindingPlatformConfigured(config, 'weixin')).toBe(false);
});

test('isMultiInstanceAgentBindingPlatform 能识别多实例平台', () => {
  expect(isMultiInstanceAgentBindingPlatform('feishu')).toBe(true);
  expect(isMultiInstanceAgentBindingPlatform('weixin')).toBe(false);
});

test('getAgentImBindingEnabledInstances 仅返回已启用实例', () => {
  const config = createConfig({
    feishu: {
      instances: [
        { instanceId: 'a', instanceName: 'A', enabled: false } as unknown as FeishuInstanceConfig,
        { instanceId: 'b', instanceName: 'B', enabled: true } as unknown as FeishuInstanceConfig,
      ],
    },
  });

  expect(
    getAgentImBindingEnabledInstances(config, 'feishu').map((instance) => instance.instanceId),
  ).toEqual(['b']);
});

test('collectAgentBoundBindingKeys 会按可见平台列表回填绑定 key', () => {
  expect(
    collectAgentBoundBindingKeys(
      {
        'netease-bee': 'agent-1',
        'qq:bot-1': 'agent-1',
        weixin: 'agent-2',
      },
      'agent-1',
      ['qq', 'netease-bee'],
    ),
  ).toEqual(new Set(['qq:bot-1', 'netease-bee']));
});

test('buildAgentBindingKeyBindings 会清理旧绑定并写入标准 key', () => {
  expect(
    buildAgentBindingKeyBindings(
      {
        'qq:bot-1': 'agent-1',
        'netease-bee': 'agent-1',
        weixin: 'agent-2',
      },
      'agent-1',
      ['xiaomifeng', 'wecom:corp-1'],
    ),
  ).toEqual({
    weixin: 'agent-2',
    'netease-bee': 'agent-1',
    'wecom:corp-1': 'agent-1',
  });
});
