import { expect, test } from 'vitest';
import {
  applyTtsSkipKeywords,
  buildSpeakableAssistantText,
  extractReadableAssistantText,
  sanitizeTtsDraftText,
} from './coworkTtsText';

test('extractReadableAssistantText removes markdown wrappers and code blocks', () => {
  expect(extractReadableAssistantText('# Title\n\n```ts\nconst a = 1;\n```\n- item\n[link](https://a.com)'))
    .toBe('Title\n\nitem\nlink');
});

test('sanitizeTtsDraftText removes emoji and slash noise', () => {
  expect(sanitizeTtsDraftText('Hello / world 😀 **bold**')).toBe('Hello world bold');
});

test('applyTtsSkipKeywords removes configured keywords', () => {
  expect(applyTtsSkipKeywords('开始 思考中 再继续 工具调用 结束', ['思考中', '工具调用']))
    .toBe('开始 再继续 结束');
});

test('buildSpeakableAssistantText applies extraction, sanitization, and keyword skipping', () => {
  expect(buildSpeakableAssistantText('## 结果\n\n继续/发送 😀', { skipKeywords: ['结果'] }))
    .toBe('继续 发送');
});
