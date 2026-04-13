import type {
  QingShuModuleFeatureFlags,
  QingShuModuleFlagConfig,
} from './types';

export type QingShuAppConfigSnapshot = {
  qingshuModules?: Record<string, QingShuModuleFlagConfig | undefined>;
};

const resolveBooleanFlag = (value: unknown, fallback: boolean): boolean => {
  return typeof value === 'boolean' ? value : fallback;
};

export const resolveQingShuModuleFeatureFlagsFromConfig = (
  config: QingShuAppConfigSnapshot | undefined,
  moduleId: string,
  enabledByDefault: boolean,
): QingShuModuleFeatureFlags => {
  const moduleConfig = config?.qingshuModules?.[moduleId];
  return {
    enabled: resolveBooleanFlag(moduleConfig?.enabled, enabledByDefault),
    sharedToolsEnabled: resolveBooleanFlag(moduleConfig?.sharedToolsEnabled, false),
    builtInSkillsEnabled: resolveBooleanFlag(moduleConfig?.builtInSkillsEnabled, false),
  };
};
