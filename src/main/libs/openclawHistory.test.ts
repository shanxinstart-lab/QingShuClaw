import { describe, expect, test } from 'vitest';
import {
  extractGatewayHistoryEntry,
  extractGatewayMessageText,
  normalizeGatewayHistoryText,
} from './openclawHistory';

describe('openclawHistory', () => {
  test('extracts plain text content blocks', () => {
    expect(
      extractGatewayMessageText({
        content: [{ type: 'text', text: 'hello world' }],
      })
    ).toBe('hello world');
  });

  test('extracts output_text style content blocks', () => {
    expect(
      extractGatewayMessageText({
        content: [{ type: 'output_text', text: 'gemini output' }],
      })
    ).toBe('gemini output');
  });

  test('extracts nested parts content blocks', () => {
    expect(
      extractGatewayMessageText({
        content: {
          parts: [
            { text: 'first line' },
            { type: 'toolCall', name: 'message', arguments: { action: 'send' } },
            { text: 'second line' },
          ],
        },
      })
    ).toBe('first line\nsecond line');
  });

  test('builds history entry from assistant message with non-anthropic text shape', () => {
    expect(
      extractGatewayHistoryEntry({
        role: 'assistant',
        content: [{ type: 'output_text', text: 'final answer' }],
      })
    ).toEqual({
      role: 'assistant',
      text: 'final answer',
    });
  });

  test('strips injected local time context and current request wrapper for user history text', () => {
    expect(
      normalizeGatewayHistoryText(
        'user',
        [
          '## Local Time Context',
          '- Current local datetime: 2026-04-13 10:36:08 (timezone: Asia/Shanghai, UTC+08:00)',
          '',
          '[Current user request]',
          '将杭州的流量供需情况和上海的流量供需情况对比生成ppt演示，并用默认的浏览器打开',
        ].join('\n'),
      ),
    ).toBe('将杭州的流量供需情况和上海的流量供需情况对比生成ppt演示，并用默认的浏览器打开');
  });

  test('keeps assistant text unchanged when current request marker appears in content', () => {
    const text = '[Current user request]\n这是模型解释该标记含义时的正常输出';
    expect(normalizeGatewayHistoryText('assistant', text)).toBe(text);
  });
});
