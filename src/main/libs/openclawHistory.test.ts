import { describe, expect, test } from 'vitest';
import {
  buildScheduledReminderSystemMessage,
  extractGatewayHistoryEntries,
  extractGatewayHistoryEntry,
  extractGatewayMessageText,
  isHeartbeatAckText,
  isHeartbeatPromptText,
  isTransientGatewayStatusText,
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

  test('joins text content blocks separated by toolCall blocks', () => {
    const text = extractGatewayMessageText({
      content: [
        { type: 'text', text: 'First line' },
        { type: 'toolCall', name: 'cron', arguments: { action: 'add' } },
        { type: 'text', text: 'Second line' },
      ],
    });
    expect(text).toBe('First line\nSecond line');
  });

  test('keeps system messages', () => {
    const entry = extractGatewayHistoryEntry({
      role: 'system',
      content: [{ type: 'text', text: 'Reminder fired' }],
    });
    expect(entry).toEqual({ role: 'system', text: 'Reminder fired' });
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

  test('extracts the real user question from wrapped managed-agent prompt templates', () => {
    expect(
      normalizeGatewayHistoryText(
        'user',
        [
          'Sender (untrusted metadata):',
          '```json',
          '{',
          '  "label": "LobsterAI (gateway-client)"',
          '}',
          '```',
          '',
          '[Thu 2026-04-16 16:00 GMT+8] [LobsterAI system instructions]',
          'Apply the instructions below as the highest-priority guidance for this session.',
          '',
          '[Current user request]',
          '## 角色',
          '你是一名经验丰富的报告生成助手。',
          '',
          '## 总体要求',
          '- 报告必须全程使用中文输出。',
          '- 内容要尽量详细完整。',
          '',
          '## 执行步骤',
          '1. 规划报告结构。',
          '2. 提取相关信息。',
          '3. 丰富输出细节。',
          '',
          '## 数据趋势的体现（可选）：',
          '- 若知识中涉及数据趋势，可以适当体现数据随时间维度变化的趋势 结合上面内容帮我分析：帮我查一下合肥和武汉的老乡鸡品牌的流量供需情况',
        ].join('\n'),
      ),
    ).toBe('帮我查一下合肥和武汉的老乡鸡品牌的流量供需情况');
  });

  test('keeps assistant text unchanged when current request marker appears in content', () => {
    const text = '[Current user request]\n这是模型解释该标记含义时的正常输出';
    expect(normalizeGatewayHistoryText('assistant', text)).toBe(text);
  });

  test('filters transient gateway restart assistant status from history entries', () => {
    const text = '网关正在重启中。等待重启完成后，我将继续创建飞书文档保存杭州和上海老乡鸡的流量供需分析数据。';

    expect(isTransientGatewayStatusText(text)).toBe(true);
    expect(
      extractGatewayHistoryEntry({
        role: 'assistant',
        content: [{ type: 'text', text }],
      }),
    ).toBeNull();
  });

  test('does not treat normal gateway troubleshooting answers as transient status', () => {
    const text = [
      '可以按下面步骤检查 OpenClaw 网关重启问题：',
      '1. 先查看 gateway.log。',
      '2. 再确认 openclaw.json 是否有效。',
    ].join('\n');

    expect(isTransientGatewayStatusText(text)).toBe(false);
  });

  test('filters heartbeat prompt user messages from history entries', () => {
    const entry = extractGatewayHistoryEntry({
      role: 'user',
      content: `Read HEARTBEAT.md if it exists (workspace context). Follow it strictly.
When reading HEARTBEAT.md, use workspace file /tmp/HEARTBEAT.md.
Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`,
    });
    expect(entry).toBeNull();
  });

  test('filters pure heartbeat ack assistant messages', () => {
    const entry = extractGatewayHistoryEntry({
      role: 'assistant',
      content: [{ type: 'text', text: 'HEARTBEAT_OK' }],
    });
    expect(entry).toBeNull();
  });

  test('filters pure heartbeat ack system messages with punctuation wrappers', () => {
    const entry = extractGatewayHistoryEntry({
      role: 'system',
      content: [{ type: 'text', text: '("HEARTBEAT_OK")' }],
    });
    expect(entry).toBeNull();
  });

  test('filters unsupported roles and empty messages', () => {
    const entries = extractGatewayHistoryEntries([
      { role: 'user', content: 'Set a reminder' },
      { role: 'system', content: [{ type: 'text', text: 'Reminder fired' }] },
      { role: 'tool', content: 'ignored' },
      { role: 'assistant', content: [{ type: 'toolCall', name: 'cron', arguments: {} }] },
      { role: 'assistant', content: 'Done' },
    ]);
    expect(entries).toEqual([
      { role: 'user', text: 'Set a reminder' },
      { role: 'system', text: 'Reminder fired' },
      { role: 'assistant', text: 'Done' },
    ]);
  });

  test('remaps scheduled reminder prompts to system messages', () => {
    const entry = extractGatewayHistoryEntry({
      role: 'user',
      content: `A scheduled reminder has been triggered. The reminder content is:

⏰ 提醒：该去买菜了！

Handle this reminder internally. Do not relay it to the user unless explicitly requested.
Current time: Sunday, March 15th, 2026 — 11:27 (Asia/Shanghai)`,
    });
    expect(entry).toEqual({ role: 'system', text: '⏰ 提醒：该去买菜了！' });
  });

  test('remaps plain scheduled reminder text to a system message', () => {
    const entry = extractGatewayHistoryEntry({
      role: 'user',
      content: '⏰ 提醒：该去钉钉打卡啦！别忘了打卡哦～',
    });
    expect(entry).toEqual({ role: 'system', text: '⏰ 提醒：该去钉钉打卡啦！别忘了打卡哦～' });
  });

  test('buildScheduledReminderSystemMessage returns null for regular user text', () => {
    expect(buildScheduledReminderSystemMessage('普通聊天消息')).toBeNull();
  });

  test('isHeartbeatAckText only matches lightweight HEARTBEAT_OK wrappers', () => {
    expect(isHeartbeatAckText('HEARTBEAT_OK')).toBe(true);
    expect(isHeartbeatAckText('`HEARTBEAT_OK`')).toBe(true);
    expect(isHeartbeatAckText('HEARTBEAT_OK: all clear')).toBe(false);
  });

  test('isHeartbeatPromptText only matches canonical heartbeat instructions', () => {
    expect(
      isHeartbeatPromptText(`Read HEARTBEAT.md if it exists.
When reading HEARTBEAT.md, use workspace file /tmp/HEARTBEAT.md.
Do not infer or repeat old tasks from prior chats.
If nothing needs attention, reply HEARTBEAT_OK.`)
    ).toBe(true);
    expect(isHeartbeatPromptText('Please read README.md and reply OK.')).toBe(false);
  });
});
