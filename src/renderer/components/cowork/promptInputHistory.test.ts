import { describe, expect, test } from 'vitest';

import {
  addPromptInputHistoryEntry,
  canNavigatePromptInputHistory,
  normalizePromptInputHistoryEntry,
} from './promptInputHistory';

describe('promptInputHistory', () => {
  test('normalizes whitespace for stored prompt history entries', () => {
    expect(normalizePromptInputHistoryEntry('  hello\nworld  ')).toBe('hello world');
  });

  test('moves duplicate entries to the front and caps history length', () => {
    const longHistory = Array.from({ length: 50 }, (_, index) => `prompt ${index}`);
    const next = addPromptInputHistoryEntry(longHistory, 'prompt 20');

    expect(next[0]).toBe('prompt 20');
    expect(next).toHaveLength(50);
    expect(next.filter((item) => item === 'prompt 20')).toHaveLength(1);
  });

  test('does not navigate history for multi-line prompts', () => {
    const textarea = {
      selectionStart: 5,
      selectionEnd: 5,
    } as HTMLTextAreaElement;

    expect(canNavigatePromptInputHistory(textarea, 'hello\nworld')).toBe(false);
  });

  test('does not navigate history while text is selected', () => {
    const textarea = {
      selectionStart: 0,
      selectionEnd: 5,
    } as HTMLTextAreaElement;

    expect(canNavigatePromptInputHistory(textarea, 'hello')).toBe(false);
  });
});
