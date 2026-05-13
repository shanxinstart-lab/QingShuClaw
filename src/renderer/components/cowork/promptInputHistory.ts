const MAX_PROMPT_INPUT_HISTORY = 50;

export function normalizePromptInputHistoryEntry(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function addPromptInputHistoryEntry(history: string[], value: string): string[] {
  const normalized = normalizePromptInputHistoryEntry(value);
  if (!normalized) return history;

  const next = history.filter((item) => item !== normalized);
  next.unshift(normalized);
  return next.slice(0, MAX_PROMPT_INPUT_HISTORY);
}

export function canNavigatePromptInputHistory(textarea: HTMLTextAreaElement, value: string): boolean {
  if (value.includes('\n')) return false;
  return textarea.selectionStart === textarea.selectionEnd;
}
