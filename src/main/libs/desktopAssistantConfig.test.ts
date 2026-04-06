import { describe, expect, test } from 'vitest';
import { DEFAULT_DESKTOP_ASSISTANT_CONFIG } from '../../shared/desktopAssistant/constants';
import { getDesktopAssistantConfigFromAppConfig, mergeDesktopAssistantConfigIntoAppConfig } from './desktopAssistantConfig';

describe('desktopAssistantConfig', () => {
  test('returns defaults when desktop assistant config is missing', () => {
    expect(getDesktopAssistantConfigFromAppConfig({})).toEqual(DEFAULT_DESKTOP_ASSISTANT_CONFIG);
  });

  test('merges desktop assistant config into app config without dropping other fields', () => {
    const result = mergeDesktopAssistantConfigIntoAppConfig({
      language: 'zh',
      voice: {
        strategy: 'native_first',
      } as any,
    }, {
      masterEnabled: true,
      autoOpenPreviewGuide: false,
    });

    expect(result.nextAppConfig.language).toBe('zh');
    expect(result.nextAppConfig.voice).toEqual({
      strategy: 'native_first',
    });
    expect(result.nextDesktopAssistantConfig).toEqual({
      ...DEFAULT_DESKTOP_ASSISTANT_CONFIG,
      masterEnabled: true,
      autoOpenPreviewGuide: false,
    });
  });
});
