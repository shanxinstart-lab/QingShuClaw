import { describe, expect, test } from 'vitest';
import {
  DEFAULT_DESKTOP_ASSISTANT_CONFIG,
  DesktopAssistantReplySpeakMode,
  mergeDesktopAssistantConfig,
} from './constants';

describe('mergeDesktopAssistantConfig', () => {
  test('returns defaults when config is missing', () => {
    expect(mergeDesktopAssistantConfig()).toEqual(DEFAULT_DESKTOP_ASSISTANT_CONFIG);
  });

  test('merges partial config without dropping defaults', () => {
    expect(mergeDesktopAssistantConfig({
      masterEnabled: true,
      autoOpenPreviewGuide: false,
    })).toEqual({
      ...DEFAULT_DESKTOP_ASSISTANT_CONFIG,
      masterEnabled: true,
      autoOpenPreviewGuide: false,
    });
  });

  test('normalizes unsupported speak mode back to summary', () => {
    expect(mergeDesktopAssistantConfig({
      assistantReplySpeakMode: 'unexpected' as typeof DesktopAssistantReplySpeakMode.Summary,
    }).assistantReplySpeakMode).toBe(DesktopAssistantReplySpeakMode.Summary);
  });

  test('keeps detailed speak mode when it is explicitly enabled', () => {
    expect(mergeDesktopAssistantConfig({
      assistantReplySpeakMode: DesktopAssistantReplySpeakMode.Detailed,
    }).assistantReplySpeakMode).toBe(DesktopAssistantReplySpeakMode.Detailed);
  });
});
