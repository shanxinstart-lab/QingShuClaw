const MAX_PROMPT_INPUT_HISTORY = 50;

export type PromptInputHistoryDirection = 'previous' | 'next';

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

export function mergePromptInputHistoryEntries(history: string[], values: string[]): string[] {
  return values.reduce((nextHistory, value) => (
    addPromptInputHistoryEntry(nextHistory, value)
  ), history);
}

export function canNavigatePromptInputHistory(
  textarea: HTMLTextAreaElement,
  value: string,
  direction: PromptInputHistoryDirection = 'previous',
  activeHistoryValue?: string | null,
): boolean {
  if (textarea.selectionStart !== textarea.selectionEnd) return false;
  if (!value) return true;
  if (activeHistoryValue !== value) return false;
  if (value.includes('\n')) return false;
  return direction === 'previous'
    ? textarea.selectionStart === 0
    : textarea.selectionStart === value.length;
}
