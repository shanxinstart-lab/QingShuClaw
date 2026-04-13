import { describe, expect, test } from 'vitest';
import {
  WAKE_ACTIVATION_OVERLAY_DURATION_MS,
  WAKE_ACTIVATION_OVERLAY_REDUCED_DURATION_MS,
  getWakeActivationOverlayDuration,
  nextWakeActivationOverlaySequence,
  shouldShowWakeActivationOverlay,
} from './wakeActivationOverlayHelpers';

describe('shouldShowWakeActivationOverlay', () => {
  test('在 wake 来源时展示浮层', () => {
    expect(shouldShowWakeActivationOverlay('wake')).toBe(true);
  });

  test('在 follow_up 和空来源时不展示浮层', () => {
    expect(shouldShowWakeActivationOverlay('follow_up')).toBe(false);
    expect(shouldShowWakeActivationOverlay(undefined)).toBe(false);
  });
});

describe('getWakeActivationOverlayDuration', () => {
  test('常规模式返回标准时长', () => {
    expect(getWakeActivationOverlayDuration(false)).toBe(WAKE_ACTIVATION_OVERLAY_DURATION_MS);
  });

  test('减少动态模式返回更短时长', () => {
    expect(getWakeActivationOverlayDuration(true)).toBe(WAKE_ACTIVATION_OVERLAY_REDUCED_DURATION_MS);
  });
});

describe('nextWakeActivationOverlaySequence', () => {
  test('普通连续触发时递增序列号，用于重启动画', () => {
    expect(nextWakeActivationOverlaySequence(0)).toBe(1);
    expect(nextWakeActivationOverlaySequence(1)).toBe(2);
  });

  test('达到安全整数上限时回绕到 1', () => {
    expect(nextWakeActivationOverlaySequence(Number.MAX_SAFE_INTEGER)).toBe(1);
  });
});
