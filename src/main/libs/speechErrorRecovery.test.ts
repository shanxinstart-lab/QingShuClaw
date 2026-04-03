import { describe, expect, test } from 'vitest';
import {
  isRecoverableSpeechErrorCode,
  resolveForegroundSpeechRetryDelayMs,
  shouldRetryForegroundSpeech,
} from './speechErrorRecovery';
import { SpeechErrorCode } from '../../shared/speech/constants';

describe('speechErrorRecovery', () => {
  test('treats interrupted and invalidated speech errors as recoverable', () => {
    expect(isRecoverableSpeechErrorCode(SpeechErrorCode.SpeechProcessInterrupted)).toBe(true);
    expect(isRecoverableSpeechErrorCode(SpeechErrorCode.SpeechProcessInvalidated)).toBe(true);
  });

  test('does not retry foreground wake dictation automatically', () => {
    expect(shouldRetryForegroundSpeech('wake', 0, SpeechErrorCode.SpeechProcessInterrupted)).toBe(false);
  });

  test('retries manual speech once for recoverable interruptions', () => {
    expect(shouldRetryForegroundSpeech('manual', 0, SpeechErrorCode.SpeechProcessInterrupted)).toBe(true);
    expect(shouldRetryForegroundSpeech('manual', 1, SpeechErrorCode.SpeechProcessInterrupted)).toBe(false);
  });

  test('uses longer retry delay for follow-up speech', () => {
    expect(resolveForegroundSpeechRetryDelayMs('follow_up')).toBeGreaterThan(resolveForegroundSpeechRetryDelayMs('manual'));
  });
});
