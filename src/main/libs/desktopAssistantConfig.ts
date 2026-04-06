import {
  mergeDesktopAssistantConfig,
  type DesktopAssistantConfig,
} from '../../shared/desktopAssistant/constants';
import type { AppConfigSettings } from './voiceFeatureConfig';

export const getDesktopAssistantConfigFromAppConfig = (
  config?: AppConfigSettings,
): DesktopAssistantConfig => {
  return mergeDesktopAssistantConfig(config?.desktopAssistant);
};

export const mergeDesktopAssistantConfigIntoAppConfig = (
  appConfig: AppConfigSettings | undefined,
  partialConfig?: Partial<DesktopAssistantConfig>,
): { nextAppConfig: AppConfigSettings; nextDesktopAssistantConfig: DesktopAssistantConfig } => {
  const currentAppConfig = appConfig ?? {};
  const nextDesktopAssistantConfig = mergeDesktopAssistantConfig({
    ...getDesktopAssistantConfigFromAppConfig(currentAppConfig),
    ...(partialConfig ?? {}),
  });

  return {
    nextAppConfig: {
      ...currentAppConfig,
      desktopAssistant: nextDesktopAssistantConfig,
    },
    nextDesktopAssistantConfig,
  };
};
