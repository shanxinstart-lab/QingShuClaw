import { PlatformRegistry } from '../../../shared/platform';

export interface ScheduledTaskHelperDeps {
  getIMGatewayManager: () => {
    getConfig: () => Record<string, unknown> | null;
  } | null;
}

let deps: ScheduledTaskHelperDeps | null = null;

const MULTI_INSTANCE_CONFIG_KEYS = new Set(['dingtalk', 'feishu', 'qq', 'wecom']);

export function initScheduledTaskHelpers(d: ScheduledTaskHelperDeps): void {
  deps = d;
}

function isConfigKeyEnabled(key: string, value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;

  if (MULTI_INSTANCE_CONFIG_KEYS.has(key)) {
    const instances = (value as { instances?: unknown[] }).instances;
    if (!Array.isArray(instances) || instances.length === 0) return false;
    return instances.some(
      (instance) => instance && typeof instance === 'object' && (instance as { enabled?: boolean }).enabled,
    );
  }

  return (value as { enabled?: boolean }).enabled === true;
}

export function listScheduledTaskChannels(): Array<{ value: string; label: string; accountId?: string }> {
  const manager = deps?.getIMGatewayManager();
  const config = manager?.getConfig();
  if (!config) {
    return [...PlatformRegistry.channelOptions()];
  }

  const configRecord = config as unknown as Record<string, unknown>;
  const enabledPlatforms = new Set<string>();
  const instancesByPlatform = new Map<string, Array<{ accountId: string; instanceName: string }>>();

  for (const [key, value] of Object.entries(configRecord)) {
    if (!isConfigKeyEnabled(key, value)) continue;
    enabledPlatforms.add(key);

    if (MULTI_INSTANCE_CONFIG_KEYS.has(key)) {
      const instances = (value as { instances?: unknown[] }).instances ?? [];
      const entries = instances
        .filter((instance) => instance && typeof instance === 'object' && (instance as { enabled?: boolean }).enabled)
        .map((instance) => {
          const typedInstance = instance as { instanceId?: string; instanceName?: string };
          return {
            accountId: (typedInstance.instanceId ?? '').slice(0, 8),
            instanceName: typedInstance.instanceName || (typedInstance.instanceId ?? '').slice(0, 8),
          };
        })
        .filter((entry) => entry.accountId);
      if (entries.length > 0) {
        instancesByPlatform.set(key, entries);
      }
    }
  }

  const result: Array<{ value: string; label: string; accountId?: string }> = [];

  for (const option of PlatformRegistry.channelOptions()) {
    const platform = PlatformRegistry.platformOfChannel(option.value);
    if (platform === undefined || !enabledPlatforms.has(platform)) {
      continue;
    }

    const instances = instancesByPlatform.get(platform);
    if (instances && instances.length > 0) {
      for (const instance of instances) {
        result.push({ value: option.value, label: instance.instanceName, accountId: instance.accountId });
      }
      continue;
    }

    result.push(option);
  }

  return result;
}
