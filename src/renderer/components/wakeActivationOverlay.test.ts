import { describe, expect, test } from 'vitest';
import {
  getWakeActivationOverlaySubtitleKey,
  nextWakeActivationOverlaySequence,
  shouldShowWakeActivationOverlay,
  WakeActivationOverlayPhase,
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

describe('getWakeActivationOverlaySubtitleKey', () => {
  test('不同阶段返回对应的副标题 key', () => {
    expect(getWakeActivationOverlaySubtitleKey(WakeActivationOverlayPhase.Preparing)).toBe('wakeActivationOverlaySubtitlePreparing');
    expect(getWakeActivationOverlaySubtitleKey(WakeActivationOverlayPhase.Dictating)).toBe('wakeActivationOverlaySubtitleDictating');
    expect(getWakeActivationOverlaySubtitleKey(WakeActivationOverlayPhase.Submitting)).toBe('wakeActivationOverlaySubtitleSubmitting');
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
