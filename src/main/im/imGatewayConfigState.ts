import type { Platform } from '../../shared/platform';
import type { IMGatewayConfig, IMGatewayStatus } from './types';

export const pickConfiguredInstance = <T extends { enabled: boolean }>(
  instances: T[],
  isConfigured: (instance: T) => boolean,
): T | undefined => (
  instances.find((instance) => instance.enabled && isConfigured(instance))
  || instances.find((instance) => instance.enabled)
  || instances[0]
);

export const isPlatformEnabled = (
  config: IMGatewayConfig,
  platform: Platform,
): boolean => {
  if (platform === 'dingtalk') return config.dingtalk.instances.some((item) => item.enabled);
  if (platform === 'feishu') return config.feishu.instances.some((item) => item.enabled);
  if (platform === 'nim') return config.nim.instances.some((item) => item.enabled);
  if (platform === 'popo') return config.popo.instances.some((item) => item.enabled);
  if (platform === 'qq') return config.qq.instances.some((item) => item.enabled);
  if (platform === 'wecom') return config.wecom.instances.some((item) => item.enabled);
  return Boolean(config[platform]?.enabled);
};

export const isAnyGatewayConnected = (status: IMGatewayStatus): boolean => (
  status.dingtalk.instances.some((item) => item.connected)
  || status.feishu.instances.some((item) => item.connected)
  || Boolean(status.telegram.connected)
  || Boolean(status.discord.connected)
  || status.qq.instances.some((item) => item.connected)
  || status.wecom.instances.some((item) => item.connected)
  || Boolean(status.weixin.connected)
  || Boolean(status.popo.connected)
  || Boolean(status.nim.connected)
  || Boolean(status['netease-bee'].connected)
);
