import { describe, expect, test } from 'vitest';
import {
  DEFAULT_SHERPA_ONNX_WAKE_MODEL_ID,
  SherpaOnnxWakeModelId,
  mergeVoiceConfig,
  normalizeSherpaOnnxWakeModelId,
  type VoiceConfig,
} from './constants';

describe('normalizeSherpaOnnxWakeModelId', () => {
  test('保留已知 wake 模型 ID', () => {
    expect(normalizeSherpaOnnxWakeModelId(SherpaOnnxWakeModelId.ZipformerZhEn3M20251220))
      .toBe(SherpaOnnxWakeModelId.ZipformerZhEn3M20251220);
    expect(normalizeSherpaOnnxWakeModelId(SherpaOnnxWakeModelId.ZipformerWenetSpeech33M20240101))
      .toBe(SherpaOnnxWakeModelId.ZipformerWenetSpeech33M20240101);
  });

  test('未知值回落到默认 zh-en 模型', () => {
    expect(normalizeSherpaOnnxWakeModelId(undefined)).toBe(DEFAULT_SHERPA_ONNX_WAKE_MODEL_ID);
    expect(normalizeSherpaOnnxWakeModelId('unexpected')).toBe(DEFAULT_SHERPA_ONNX_WAKE_MODEL_ID);
  });
});

describe('mergeVoiceConfig', () => {
  test('会为旧配置补齐默认 sherpa wakeModelId', () => {
    const legacyConfig = {
      providers: {
        sherpaOnnx: {
          enabled: true,
        },
      },
    } as Partial<VoiceConfig>;

    const merged = mergeVoiceConfig(legacyConfig);

    expect(merged.providers.sherpaOnnx.wakeModelId).toBe(DEFAULT_SHERPA_ONNX_WAKE_MODEL_ID);
  });
});
