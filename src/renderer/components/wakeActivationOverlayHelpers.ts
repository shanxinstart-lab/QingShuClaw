import type { WakeInputDictationRequest } from '../../shared/wakeInput/constants';

export const WakeActivationOverlayPhase = {
  Preparing: 'preparing',
  Dictating: 'dictating',
  Submitting: 'submitting',
} as const;
export type WakeActivationOverlayPhase = typeof WakeActivationOverlayPhase[keyof typeof WakeActivationOverlayPhase];

export interface WakeActivationOverlayStateChange {
  visible: boolean;
  phase?: WakeActivationOverlayPhase;
  transcript?: string;
}

export const shouldShowWakeActivationOverlay = (
  source?: WakeInputDictationRequest['source']
): boolean => {
  return source === 'wake';
};

export const getWakeActivationOverlaySubtitleKey = (
  phase: WakeActivationOverlayPhase
): 'wakeActivationOverlaySubtitlePreparing' | 'wakeActivationOverlaySubtitleDictating' | 'wakeActivationOverlaySubtitleSubmitting' => {
  switch (phase) {
    case WakeActivationOverlayPhase.Dictating:
      return 'wakeActivationOverlaySubtitleDictating';
    case WakeActivationOverlayPhase.Submitting:
      return 'wakeActivationOverlaySubtitleSubmitting';
    case WakeActivationOverlayPhase.Preparing:
    default:
      return 'wakeActivationOverlaySubtitlePreparing';
  }
};

export const nextWakeActivationOverlaySequence = (current: number): number => {
  return current >= Number.MAX_SAFE_INTEGER ? 1 : current + 1;
};
