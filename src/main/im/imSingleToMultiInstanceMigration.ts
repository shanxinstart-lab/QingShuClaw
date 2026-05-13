import type { NimConfig, PopoOpenClawConfig } from './types';

export const ImSingleToMultiInstancePlatform = {
  Nim: 'nim',
  Popo: 'popo',
} as const;
export type ImSingleToMultiInstancePlatform =
  typeof ImSingleToMultiInstancePlatform[keyof typeof ImSingleToMultiInstancePlatform];

export const ImSingleToMultiInstanceSkipReason = {
  ExistingInstances: 'existing-instances',
  EmptyConfig: 'empty-config',
} as const;
export type ImSingleToMultiInstanceSkipReason =
  typeof ImSingleToMultiInstanceSkipReason[keyof typeof ImSingleToMultiInstanceSkipReason];

export type PlannedImInstanceConfig<TConfig extends Record<string, unknown>> = TConfig & {
  instanceId: string;
  instanceName: string;
};

export interface PlanSingleToMultiInstanceMigrationOptions<TConfig extends Record<string, unknown>> {
  platform: ImSingleToMultiInstancePlatform;
  singleConfig?: TConfig | null;
  existingInstanceIds?: readonly string[];
  platformAgentBindings?: Record<string, string>;
  createInstanceId: (platform: ImSingleToMultiInstancePlatform) => string;
  defaultInstanceName: string;
  shouldMigrateConfig: (config: TConfig) => boolean;
}

export interface PlannedSingleToMultiInstanceMigration<TConfig extends Record<string, unknown>> {
  shouldMigrate: boolean;
  platform: ImSingleToMultiInstancePlatform;
  skipReason?: ImSingleToMultiInstanceSkipReason;
  instanceKey?: string;
  instance?: PlannedImInstanceConfig<TConfig>;
  platformAgentBindings: Record<string, string>;
}

export const hasMeaningfulNimSingleConfig = (
  config: Partial<NimConfig & { nimToken?: string }> | null | undefined,
): boolean => {
  if (!config) {
    return false;
  }
  const legacyToken = config.nimToken?.trim();
  const hasCredentialTriplet = Boolean(
    config.appKey?.trim() && config.account?.trim() && config.token?.trim(),
  );
  return Boolean(legacyToken || hasCredentialTriplet);
};

export const hasMeaningfulPopoSingleConfig = (
  config: Partial<PopoOpenClawConfig> | null | undefined,
): boolean => {
  if (!config) {
    return false;
  }
  return Boolean(
    config.enabled
    || config.appKey?.trim()
    || config.appSecret?.trim()
    || config.token?.trim()
    || config.aesKey?.trim()
  );
};

export function planSingleToMultiInstanceMigration<TConfig extends Record<string, unknown>>(
  options: PlanSingleToMultiInstanceMigrationOptions<TConfig>,
): PlannedSingleToMultiInstanceMigration<TConfig> {
  const platformAgentBindings = { ...(options.platformAgentBindings ?? {}) };
  if ((options.existingInstanceIds ?? []).length > 0) {
    return {
      shouldMigrate: false,
      platform: options.platform,
      skipReason: ImSingleToMultiInstanceSkipReason.ExistingInstances,
      platformAgentBindings,
    };
  }

  if (!options.singleConfig || !options.shouldMigrateConfig(options.singleConfig)) {
    return {
      shouldMigrate: false,
      platform: options.platform,
      skipReason: ImSingleToMultiInstanceSkipReason.EmptyConfig,
      platformAgentBindings,
    };
  }

  const instanceId = options.createInstanceId(options.platform);
  const instanceKey = `${options.platform}:${instanceId}`;
  const instance = {
    ...options.singleConfig,
    instanceId,
    instanceName: options.defaultInstanceName,
  };

  const boundAgentId = platformAgentBindings[options.platform];
  if (boundAgentId) {
    platformAgentBindings[instanceKey] = boundAgentId;
    delete platformAgentBindings[options.platform];
  }

  return {
    shouldMigrate: true,
    platform: options.platform,
    instanceKey,
    instance,
    platformAgentBindings,
  };
}
