import { describe, expect, test } from 'vitest';
import { DEFAULT_DESKTOP_ASSISTANT_CONFIG } from '../../shared/desktopAssistant/constants';
import { DEFAULT_SPEECH_INPUT_CONFIG, DEFAULT_TTS_CONFIG, DEFAULT_WAKE_INPUT_CONFIG, defaultConfig } from '../config';
import { mergeStoredAppConfig } from './config';

describe('mergeStoredAppConfig', () => {
  test('hydrates desktop assistant without mutating legacy voice fields', () => {
    const merged = mergeStoredAppConfig({
      ...defaultConfig,
      desktopAssistant: {
        ...DEFAULT_DESKTOP_ASSISTANT_CONFIG,
        masterEnabled: true,
      },
      voice: {
        ...defaultConfig.voice!,
      },
      speechInput: {
        ...DEFAULT_SPEECH_INPUT_CONFIG,
      },
      wakeInput: {
        ...DEFAULT_WAKE_INPUT_CONFIG,
      },
      tts: {
        ...DEFAULT_TTS_CONFIG,
      },
    });

    expect(merged.desktopAssistant).toEqual({
      ...DEFAULT_DESKTOP_ASSISTANT_CONFIG,
      masterEnabled: true,
    });
    expect(merged.speechInput).toEqual(DEFAULT_SPEECH_INPUT_CONFIG);
    expect(merged.wakeInput).toEqual(DEFAULT_WAKE_INPUT_CONFIG);
    expect(merged.tts).toEqual(DEFAULT_TTS_CONFIG);
  });
});
