import { PlatformRegistry } from '../../../shared/platform';

export interface ScheduledTaskHelperDeps {
  getIMGatewayManager: () => {
    getConfig: () => Record<string, unknown> | null;
  } | null;
}

let deps: ScheduledTaskHelperDeps | null = null;

export function initScheduledTaskHelpers(d: ScheduledTaskHelperDeps): void {
  deps = d;
}

const MULTI_INSTANCE_CONFIG_KEYS = new Set([
  'dingtalk',
  'discord',
  'feishu',
  'nim',
  'popo',
  'qq',
  'telegram',
  'wecom',
]);

function deriveNimRuntimeAccountId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const instance = value as { nimToken?: string; appKey?: string; account?: string };
  const nimToken = instance.nimToken?.trim();
  if (nimToken) {
    const delimiter = nimToken.includes('|') ? '|' : '-';
    const parts = nimToken.split(delimiter).map((part) => part.trim());
    if (parts.length === 3 && parts[0] && parts[1]) {
      return `${parts[0]}:${parts[1]}`;
    }
  }
  if (instance.appKey?.trim() && instance.account?.trim()) {
    return `${instance.appKey.trim()}:${instance.account.trim()}`;
  }
  return null;
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

export function listScheduledTaskChannels(): Array<{
  value: string;
  label: string;
  accountId?: string;
  filterAccountId?: string;
}> {
  const manager = deps?.getIMGatewayManager();
  const config = manager?.getConfig();
  if (!config) {
    return [...PlatformRegistry.channelOptions()];
  }

  const configRecord = config as unknown as Record<string, unknown>;
  const enabledPlatforms = new Set<string>();
  const instancesByPlatform = new Map<
    string,
    Array<{ accountId: string; instanceName: string; filterAccountId?: string }>
  >();

  for (const [key, value] of Object.entries(configRecord)) {
    if (!isConfigKeyEnabled(key, value)) continue;
    enabledPlatforms.add(key);

    if (MULTI_INSTANCE_CONFIG_KEYS.has(key)) {
      const instances = (value as { instances?: unknown[] }).instances ?? [];
      const entries = instances
        .filter((instance) => instance && typeof instance === 'object' && (instance as { enabled?: boolean }).enabled)
        .map((instance) => {
          const typedInstance = instance as { instanceId?: string; instanceName?: string };
          const nimAccountId = key === 'nim'
            ? ((typedInstance.instanceId ?? '').slice(0, 8) || deriveNimRuntimeAccountId(instance))
            : null;
          const accountId = nimAccountId ?? (typedInstance.instanceId ?? '').slice(0, 8);
          return {
            accountId,
            instanceName: typedInstance.instanceName || (accountId ?? (typedInstance.instanceId ?? '').slice(0, 8)),
            filterAccountId: accountId || undefined,
          };
        })
        .filter((entry) => entry.accountId);
      if (entries.length > 0) {
        instancesByPlatform.set(key, entries);
      }
    }
  }

  const result: Array<{
    value: string;
    label: string;
    accountId?: string;
    filterAccountId?: string;
  }> = [];

  for (const option of PlatformRegistry.channelOptions()) {
    const platform = PlatformRegistry.platformOfChannel(option.value);
    if (platform === undefined || !enabledPlatforms.has(platform)) {
      continue;
    }

    const instances = instancesByPlatform.get(platform);
    if (instances && instances.length > 0) {
      for (const instance of instances) {
        result.push({
          value: option.value,
          label: instance.instanceName,
          accountId: instance.accountId,
          filterAccountId: instance.filterAccountId,
        });
      }
      continue;
    }

    result.push(option);
  }

  return result;
}
