import type { Platform } from '@shared/platform';

import type { IMGatewayConfig, IMPlatform } from '../../types/im';

export type AgentImBindingPlatform = IMPlatform | Platform;

export const normalizeAgentImBindingPlatform = (
  platform: AgentImBindingPlatform | string,
): Platform | Exclude<IMPlatform, 'xiaomifeng'> => {
  if (platform === 'xiaomifeng') {
    return 'netease-bee';
  }
  return platform as Platform | Exclude<IMPlatform, 'xiaomifeng'>;
};

export const isAgentImBindingPlatformConfigured = (
  config: IMGatewayConfig | null,
  platform: AgentImBindingPlatform,
): boolean => {
  if (!config) {
    return false;
  }

  const normalizedPlatform = normalizeAgentImBindingPlatform(platform);
  if (normalizedPlatform === 'dingtalk') {
    return config.dingtalk.instances.some((item) => item.enabled);
  }
  if (normalizedPlatform === 'feishu') {
    return config.feishu.instances.some((item) => item.enabled);
  }
  if (normalizedPlatform === 'qq') {
    return config.qq.instances.some((item) => item.enabled);
  }
  if (normalizedPlatform === 'wecom') {
    return config.wecom.instances.some((item) => item.enabled);
  }

  return Boolean(
    (config as unknown as Record<string, { enabled?: boolean } | undefined>)[normalizedPlatform]?.enabled,
  );
};

export const collectAgentBoundPlatforms = <TPlatform extends AgentImBindingPlatform>(
  bindings: Record<string, string> | undefined,
  agentId: string,
  visiblePlatforms: readonly TPlatform[],
): Set<TPlatform> => {
  const normalizedVisiblePlatformMap = new Map<string, TPlatform>();
  for (const platform of visiblePlatforms) {
    normalizedVisiblePlatformMap.set(normalizeAgentImBindingPlatform(platform), platform);
  }

  const boundPlatforms = new Set<TPlatform>();
  for (const [platform, boundAgentId] of Object.entries(bindings ?? {})) {
    if (boundAgentId !== agentId) {
      continue;
    }
    const visiblePlatform = normalizedVisiblePlatformMap.get(
      normalizeAgentImBindingPlatform(platform),
    );
    if (visiblePlatform) {
      boundPlatforms.add(visiblePlatform);
    }
  }
  return boundPlatforms;
};

export const buildAgentPlatformBindings = (
  bindings: Record<string, string> | undefined,
  agentId: string,
  boundPlatforms: Iterable<AgentImBindingPlatform>,
): Record<string, string> => {
  const nextBindings = { ...(bindings ?? {}) };
  for (const [platform, boundAgentId] of Object.entries(nextBindings)) {
    if (boundAgentId === agentId) {
      delete nextBindings[platform];
    }
  }

  for (const platform of boundPlatforms) {
    nextBindings[normalizeAgentImBindingPlatform(platform)] = agentId;
  }
  return nextBindings;
};
