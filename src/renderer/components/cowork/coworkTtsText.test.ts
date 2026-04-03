import { describe, expect, test } from 'vitest';
import {
  applyTtsSkipKeywords,
  buildSpeakableAssistantText,
  extractSpeakableAssistantText,
  sanitizeTtsDraftText,
} from './coworkTtsText';

describe('extractSpeakableAssistantText', () => {
  test('removes code blocks and markdown markers', () => {
    expect(extractSpeakableAssistantText('# 标题\n- 列表\n```ts\nconst a = 1;\n```')).toBe('标题\n列表');
  });
});

describe('sanitizeTtsDraftText', () => {
  test('removes emoji and standalone slash separators', () => {
    expect(sanitizeTtsDraftText('你好 😀 / 世界')).toBe('你好 世界');
  });
});

describe('applyTtsSkipKeywords', () => {
  test('removes configured snippets and collapses whitespace', () => {
    expect(applyTtsSkipKeywords('你好 [工具结果] 世界', ['[工具结果]'])).toBe('你好 世界');
  });
});

describe('buildSpeakableAssistantText', () => {
  test('applies extraction, cleanup, and skip keywords in order', () => {
    expect(buildSpeakableAssistantText('## 标题\n处理中 / 😀\n[链接](https://example.com)', {
      skipKeywords: ['处理中'],
    })).toBe('标题\n\n链接');
  });
});
