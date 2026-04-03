import { SpeechErrorCode } from '../../shared/speech/constants';

export type ForegroundSpeechOrigin = 'manual' | 'wake' | 'follow_up';

export const isRecoverableSpeechErrorCode = (code?: string): boolean => {
  return code === SpeechErrorCode.SpeechProcessInterrupted
    || code === SpeechErrorCode.SpeechProcessInvalidated
    || code === SpeechErrorCode.SpeechRequestCancelled;
};

export const shouldRetryForegroundSpeech = (
  origin: ForegroundSpeechOrigin,
  attempts: number,
  code?: string,
): boolean => {
  if (!isRecoverableSpeechErrorCode(code)) {
    return false;
  }
  if (origin === 'wake') {
    return false;
  }
  return attempts < 1;
};

export const resolveForegroundSpeechRetryDelayMs = (origin: ForegroundSpeechOrigin): number => {
  if (origin === 'follow_up') {
    return 650;
  }
  return 320;
};

export const resolveSpeechLogLevel = (code?: string): 'warn' | 'debug' => {
  return isRecoverableSpeechErrorCode(code) ? 'debug' : 'warn';
};
