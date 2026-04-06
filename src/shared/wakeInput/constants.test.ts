import { describe, expect, test } from 'vitest';
import {
  WakeInputProviderMode,
  normalizeWakeInputProviderMode,
} from './constants';

describe('normalizeWakeInputProviderMode', () => {
  test('保留已知 provider', () => {
    expect(normalizeWakeInputProviderMode(WakeInputProviderMode.Auto)).toBe(WakeInputProviderMode.Auto);
    expect(normalizeWakeInputProviderMode(WakeInputProviderMode.SherpaOnnx)).toBe(WakeInputProviderMode.SherpaOnnx);
    expect(normalizeWakeInputProviderMode(WakeInputProviderMode.TextMatch)).toBe(WakeInputProviderMode.TextMatch);
  });

  test('将旧的 porcupine 配置迁移为 auto', () => {
    expect(normalizeWakeInputProviderMode('porcupine')).toBe(WakeInputProviderMode.Auto);
  });

  test('未知值回落为 auto', () => {
    expect(normalizeWakeInputProviderMode(undefined)).toBe(WakeInputProviderMode.Auto);
    expect(normalizeWakeInputProviderMode('unexpected')).toBe(WakeInputProviderMode.Auto);
  });
});
