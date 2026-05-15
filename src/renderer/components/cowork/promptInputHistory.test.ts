import { describe, expect, test } from 'vitest';

import {
  addPromptInputHistoryEntry,
  canNavigatePromptInputHistory,
  mergePromptInputHistoryEntries,
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

  test('merges session entries with newest value first', () => {
    const next = mergePromptInputHistoryEntries(['existing'], ['old', 'new']);

    expect(next.slice(0, 3)).toEqual(['new', 'old', 'existing']);
  });

  test('does not navigate history for multi-line prompts', () => {
    const textarea = {
      selectionStart: 5,
      selectionEnd: 5,
    } as HTMLTextAreaElement;

    expect(canNavigatePromptInputHistory(textarea, 'hello\nworld')).toBe(false);
    expect(canNavigatePromptInputHistory(textarea, 'hello\nworld', 'previous', 'hello\nworld')).toBe(false);
  });

  test('does not navigate history while text is selected', () => {
    const textarea = {
      selectionStart: 0,
      selectionEnd: 5,
    } as HTMLTextAreaElement;

    expect(canNavigatePromptInputHistory(textarea, 'hello')).toBe(false);
  });

  test('only navigates at the cursor boundary for the requested direction', () => {
    const atStart = {
      selectionStart: 0,
      selectionEnd: 0,
    } as HTMLTextAreaElement;
    const atEnd = {
      selectionStart: 5,
      selectionEnd: 5,
    } as HTMLTextAreaElement;
    const inMiddle = {
      selectionStart: 2,
      selectionEnd: 2,
    } as HTMLTextAreaElement;

    expect(canNavigatePromptInputHistory(atStart, 'hello', 'previous')).toBe(false);
    expect(canNavigatePromptInputHistory(atStart, 'hello', 'previous', 'hello')).toBe(true);
    expect(canNavigatePromptInputHistory(atStart, 'hello', 'next')).toBe(false);
    expect(canNavigatePromptInputHistory(atEnd, 'hello', 'previous', 'hello')).toBe(false);
    expect(canNavigatePromptInputHistory(atEnd, 'hello', 'next', 'hello')).toBe(true);
    expect(canNavigatePromptInputHistory(inMiddle, 'hello', 'previous')).toBe(false);
    expect(canNavigatePromptInputHistory(inMiddle, 'hello', 'next', 'hello')).toBe(false);
  });
});
