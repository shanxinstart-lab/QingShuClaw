import { describe, expect, test } from 'vitest';
import {
  ASSISTANT_SPEECH_TRIGGER_GUARD_MS,
  getAssistantSpeechTriggerGuardDeadline,
  isAssistantSpeechTriggerSuppressed,
} from './triggerWordGuard';

describe('getAssistantSpeechTriggerGuardDeadline', () => {
  test('adds the default guard duration to the reference time', () => {
    expect(getAssistantSpeechTriggerGuardDeadline(2_000)).toBe(
      2_000 + ASSISTANT_SPEECH_TRIGGER_GUARD_MS
    );
  });

  test('treats negative guard durations as zero', () => {
    expect(getAssistantSpeechTriggerGuardDeadline(2_000, -100)).toBe(2_000);
  });
});

describe('isAssistantSpeechTriggerSuppressed', () => {
  test('suppresses trigger matching while assistant speech is active', () => {
    expect(isAssistantSpeechTriggerSuppressed({ isAssistantSpeaking: true, suppressedUntilMs: 0 })).toBe(true);
  });

  test('suppresses trigger matching during the cooldown window after speech stops', () => {
    expect(isAssistantSpeechTriggerSuppressed({
      isAssistantSpeaking: false,
      suppressedUntilMs: 1_500,
      nowMs: 1_000,
    })).toBe(true);
  });

  test('allows trigger matching after the cooldown window expires', () => {
    expect(isAssistantSpeechTriggerSuppressed({
      isAssistantSpeaking: false,
      suppressedUntilMs: 1_500,
      nowMs: 1_500,
    })).toBe(false);
  });
});
