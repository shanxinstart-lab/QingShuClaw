import type { WakeInputDictationRequest } from '../../shared/wakeInput/constants';

export const WAKE_ACTIVATION_OVERLAY_DURATION_MS = 900;
export const WAKE_ACTIVATION_OVERLAY_REDUCED_DURATION_MS = 520;

export const shouldShowWakeActivationOverlay = (
  source?: WakeInputDictationRequest['source']
): boolean => {
  return source === 'wake';
};

export const getWakeActivationOverlayDuration = (prefersReducedMotion: boolean): number => {
  return prefersReducedMotion
    ? WAKE_ACTIVATION_OVERLAY_REDUCED_DURATION_MS
    : WAKE_ACTIVATION_OVERLAY_DURATION_MS;
};

export const nextWakeActivationOverlaySequence = (current: number): number => {
  return current >= Number.MAX_SAFE_INTEGER ? 1 : current + 1;
};
