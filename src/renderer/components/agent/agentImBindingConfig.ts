import type { Platform } from '@shared/platform';

import type {
  DingTalkInstanceConfig,
  FeishuInstanceConfig,
  IMGatewayConfig,
  IMPlatform,
  QQInstanceConfig,
  WecomInstanceConfig,
} from '../../types/im';

export type AgentImBindingPlatform = IMPlatform | Platform;
export const MultiInstanceAgentBindingPlatform = {
  DingTalk: 'dingtalk',
  Feishu: 'feishu',
  QQ: 'qq',
  Wecom: 'wecom',
} as const;
export type MultiInstanceAgentBindingPlatform =
  typeof MultiInstanceAgentBindingPlatform[keyof typeof MultiInstanceAgentBindingPlatform];

type MultiInstanceAgentBindingConfig =
  | DingTalkInstanceConfig
  | FeishuInstanceConfig
  | QQInstanceConfig
  | WecomInstanceConfig;

const MULTI_INSTANCE_AGENT_BINDING_PLATFORMS = new Set<Platform>(
  Object.values(MultiInstanceAgentBindingPlatform),
);

export const normalizeAgentImBindingPlatform = (
  platform: AgentImBindingPlatform | string,
): Platform | Exclude<IMPlatform, 'xiaomifeng'> => {
  if (platform === 'xiaomifeng') {
    return 'netease-bee';
  }
  return platform as Platform | Exclude<IMPlatform, 'xiaomifeng'>;
};

export const normalizeAgentImBindingKey = (bindingKey: string): string => {
  const separatorIndex = bindingKey.indexOf(':');
  if (separatorIndex === -1) {
    return normalizeAgentImBindingPlatform(bindingKey);
  }

  const platform = bindingKey.slice(0, separatorIndex);
  return `${normalizeAgentImBindingPlatform(platform)}${bindingKey.slice(separatorIndex)}`;
};

export const isMultiInstanceAgentBindingPlatform = (
  platform: AgentImBindingPlatform | string,
): platform is MultiInstanceAgentBindingPlatform => (
  MULTI_INSTANCE_AGENT_BINDING_PLATFORMS.has(
    normalizeAgentImBindingPlatform(platform) as Platform,
  )
);

const getMultiInstanceAgentBindingConfigs = (
  config: IMGatewayConfig | null,
  platform: MultiInstanceAgentBindingPlatform,
): MultiInstanceAgentBindingConfig[] => {
  if (!config) {
    return [];
  }

  if (platform === MultiInstanceAgentBindingPlatform.DingTalk) {
    return config.dingtalk.instances;
  }
  if (platform === MultiInstanceAgentBindingPlatform.Feishu) {
    return config.feishu.instances;
  }
  if (platform === MultiInstanceAgentBindingPlatform.QQ) {
    return config.qq.instances;
  }
  return config.wecom.instances;
};

export const getAgentImBindingEnabledInstances = (
  config: IMGatewayConfig | null,
  platform: MultiInstanceAgentBindingPlatform,
): MultiInstanceAgentBindingConfig[] => (
  getMultiInstanceAgentBindingConfigs(config, platform).filter((instance) => instance.enabled)
);

export const isAgentImBindingPlatformConfigured = (
  config: IMGatewayConfig | null,
  platform: AgentImBindingPlatform,
): boolean => {
  if (!config) {
    return false;
  }

  const normalizedPlatform = normalizeAgentImBindingPlatform(platform);
  if (isMultiInstanceAgentBindingPlatform(normalizedPlatform)) {
    return getAgentImBindingEnabledInstances(config, normalizedPlatform).length > 0;
  }

  return Boolean(
    (config as unknown as Record<string, { enabled?: boolean } | undefined>)[normalizedPlatform]?.enabled,
  );
};

export const collectAgentBoundBindingKeys = <TPlatform extends AgentImBindingPlatform>(
  bindings: Record<string, string> | undefined,
  agentId: string,
  visiblePlatforms?: readonly TPlatform[],
): Set<string> => {
  const normalizedVisiblePlatforms = visiblePlatforms
    ? new Set(visiblePlatforms.map((platform) => normalizeAgentImBindingPlatform(platform)))
    : null;

  const boundKeys = new Set<string>();
  for (const [bindingKey, boundAgentId] of Object.entries(bindings ?? {})) {
    if (boundAgentId !== agentId) {
      continue;
    }

    const normalizedBindingKey = normalizeAgentImBindingKey(bindingKey);
    const separatorIndex = normalizedBindingKey.indexOf(':');
    const normalizedPlatform = normalizeAgentImBindingPlatform(
      separatorIndex === -1
        ? normalizedBindingKey
        : normalizedBindingKey.slice(0, separatorIndex),
    );
    if (normalizedVisiblePlatforms && !normalizedVisiblePlatforms.has(normalizedPlatform)) {
      continue;
    }

    boundKeys.add(normalizedBindingKey);
  }
  return boundKeys;
};

export const buildAgentBindingKeyBindings = (
  bindings: Record<string, string> | undefined,
  agentId: string,
  boundBindingKeys: Iterable<string>,
): Record<string, string> => {
  const nextBindings = { ...(bindings ?? {}) };
  for (const [bindingKey, boundAgentId] of Object.entries(nextBindings)) {
    if (boundAgentId === agentId) {
      delete nextBindings[bindingKey];
    }
  }

  for (const bindingKey of boundBindingKeys) {
    nextBindings[normalizeAgentImBindingKey(bindingKey)] = agentId;
  }
  return nextBindings;
};
