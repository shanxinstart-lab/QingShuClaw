import { expect, test } from 'vitest';

import { DEFAULT_IM_CONFIG, type IMGatewayConfig } from '../../types/im';
import {
  buildAgentPlatformBindings,
  collectAgentBoundPlatforms,
  isAgentImBindingPlatformConfigured,
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

test('isAgentImBindingPlatformConfigured 支持多实例与 netease-bee', () => {
  const config = createConfig({
    dingtalk: {
      instances: [
        { instanceId: 'a', instanceName: 'A', enabled: false } as any,
        { instanceId: 'b', instanceName: 'B', enabled: true } as any,
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

test('collectAgentBoundPlatforms 会按可见平台列表回填绑定', () => {
  expect(
    collectAgentBoundPlatforms(
      {
        'netease-bee': 'agent-1',
        qq: 'agent-1',
        weixin: 'agent-2',
      },
      'agent-1',
      ['qq', 'netease-bee'],
    ),
  ).toEqual(new Set(['qq', 'netease-bee']));
});

test('buildAgentPlatformBindings 会清理旧绑定并写入标准 key', () => {
  expect(
    buildAgentPlatformBindings(
      {
        qq: 'agent-1',
        'netease-bee': 'agent-1',
        weixin: 'agent-2',
      },
      'agent-1',
      ['xiaomifeng', 'wecom'],
    ),
  ).toEqual({
    weixin: 'agent-2',
    'netease-bee': 'agent-1',
    wecom: 'agent-1',
  });
});
