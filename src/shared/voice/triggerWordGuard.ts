export const ASSISTANT_SPEECH_TRIGGER_GUARD_MS = 1_500;

export const getAssistantSpeechTriggerGuardDeadline = (
  referenceTimeMs: number,
  guardMs: number = ASSISTANT_SPEECH_TRIGGER_GUARD_MS
): number => {
  return referenceTimeMs + Math.max(guardMs, 0);
};

export const isAssistantSpeechTriggerSuppressed = (options: {
  isAssistantSpeaking: boolean;
  suppressedUntilMs?: number;
  nowMs?: number;
}): boolean => {
  if (options.isAssistantSpeaking) {
    return true;
  }
  const suppressedUntilMs = options.suppressedUntilMs ?? 0;
  const nowMs = options.nowMs ?? Date.now();
  return suppressedUntilMs > nowMs;
};
