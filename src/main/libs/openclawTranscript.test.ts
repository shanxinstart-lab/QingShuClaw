import { describe, expect, test } from 'vitest';
import { buildTransientSessionFromOpenClawTranscript } from './openclawTranscript';

describe('buildTransientSessionFromOpenClawTranscript', () => {
  test('parses assistant tool blocks into tool messages', () => {
    const session = buildTransientSessionFromOpenClawTranscript({
      sessionKey: 'agent:qingshu-managed:run:11111111-1111-1111-1111-111111111111',
      fileContent: [
        JSON.stringify({
          type: 'message',
          timestamp: '2026-04-13T10:00:00.000Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: '帮我分析杭州灵工供需' }],
          },
        }),
        JSON.stringify({
          type: 'message',
          timestamp: '2026-04-13T10:00:05.000Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: '先做城市识别。' },
              { type: 'tool_use', id: 'tool-1', name: 'claw.dictionary.search', input: { keyword: '杭州', dictionaryCode: 'qingshu_city' } },
              { type: 'tool_result', tool_use_id: 'tool-1', content: [{ text: '杭州' }] },
              { type: 'text', text: '已识别为杭州。' },
            ],
          },
        }),
      ].join('\n'),
    });

    expect(session).not.toBeNull();
    expect(session?.messages.map((message) => message.type)).toEqual([
      'user',
      'assistant',
      'tool_use',
      'tool_result',
      'assistant',
    ]);
    expect(session?.messages[2]?.metadata?.toolName).toBe('claw.dictionary.search');
    expect(session?.messages[3]?.metadata?.toolUseId).toBe('tool-1');
  });

  test('parses openai style tool_calls and tool role results', () => {
    const session = buildTransientSessionFromOpenClawTranscript({
      sessionKey: 'agent:qingshu-managed:run:22222222-2222-2222-2222-222222222222',
      fileContent: [
        JSON.stringify({
          type: 'message',
          message: {
            role: 'assistant',
            content: '我来生成 PPT。',
            tool_calls: [
              {
                id: 'call-1',
                function: {
                  name: 'ppt-generator',
                  arguments: JSON.stringify({ topic: '杭州 vs 上海' }),
                },
              },
            ],
          },
        }),
        JSON.stringify({
          type: 'message',
          message: {
            role: 'tool',
            tool_call_id: 'call-1',
            content: '已生成 /tmp/demo.pptx',
          },
        }),
      ].join('\n'),
    });

    expect(session).not.toBeNull();
    expect(session?.messages.map((message) => message.type)).toEqual([
      'assistant',
      'tool_use',
      'tool_result',
    ]);
    expect(session?.messages[1]?.metadata?.toolInput).toEqual({ topic: '杭州 vs 上海' });
    expect(session?.messages[2]?.metadata?.toolUseId).toBe('call-1');
  });

  test('normalizes wrapped user prompts and preserves input_text content', () => {
    const session = buildTransientSessionFromOpenClawTranscript({
      sessionKey: 'agent:qingshu-managed:run:33333333-3333-3333-3333-333333333333',
      fileContent: [
        JSON.stringify({
          type: 'message',
          timestamp: '2026-04-16T10:00:00.000Z',
          message: {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: [
                  '## Local Time Context',
                  '- Current local datetime: 2026-04-16 18:00:00 (timezone: Asia/Shanghai, UTC+08:00)',
                  '',
                  '[Current user request]',
                  '帮我总结今天任务执行失败的原因',
                ].join('\n'),
              },
            ],
          },
        }),
        JSON.stringify({
          type: 'message',
          timestamp: '2026-04-16T10:00:05.000Z',
          message: {
            role: 'assistant',
            content: [
              { type: 'output_text', text: '我先检查错误日志。' },
            ],
          },
        }),
      ].join('\n'),
    });

    expect(session).not.toBeNull();
    expect(session?.messages.map((message) => message.type)).toEqual([
      'user',
      'assistant',
    ]);
    expect(session?.messages[0]?.content).toBe('帮我总结今天任务执行失败的原因');
    expect(session?.messages[1]?.content).toBe('我先检查错误日志。');
  });

  test('preserves assistant content stored as nested parts objects', () => {
    const session = buildTransientSessionFromOpenClawTranscript({
      sessionKey: 'agent:qingshu-managed:run:44444444-4444-4444-4444-444444444444',
      fileContent: [
        JSON.stringify({
          type: 'message',
          timestamp: '2026-04-16T10:01:00.000Z',
          message: {
            role: 'assistant',
            content: {
              parts: [
                { text: '第一段总结。' },
                { text: '第二段补充。' },
              ],
            },
          },
        }),
      ].join('\n'),
    });

    expect(session).not.toBeNull();
    expect(session?.messages.map((message) => message.type)).toEqual([
      'assistant',
    ]);
    expect(session?.messages[0]?.content).toBe('第一段总结。\n第二段补充。');
  });

  test('parses native openclaw toolCall and toolResult transcript entries', () => {
    const session = buildTransientSessionFromOpenClawTranscript({
      sessionKey: 'agent:main:cron:test-job:run:55555555-5555-5555-5555-555555555555',
      fileContent: [
        JSON.stringify({
          type: 'message',
          timestamp: '2026-04-16T10:02:00.000Z',
          message: {
            role: 'assistant',
            content: [
              {
                type: 'thinking',
                thinking: '先调用工具。',
              },
              {
                type: 'toolCall',
                id: 'call-native-1',
                name: 'exec',
                arguments: { command: 'echo hello' },
              },
            ],
          },
        }),
        JSON.stringify({
          type: 'message',
          timestamp: '2026-04-16T10:02:01.000Z',
          message: {
            role: 'toolResult',
            toolCallId: 'call-native-1',
            toolName: 'exec',
            content: [
              { type: 'text', text: 'hello' },
            ],
          },
        }),
      ].join('\n'),
    });

    expect(session).not.toBeNull();
    expect(session?.messages.map((message) => message.type)).toEqual([
      'assistant',
      'tool_use',
      'tool_result',
    ]);
    expect(session?.messages[1]?.metadata?.toolName).toBe('exec');
    expect(session?.messages[1]?.metadata?.toolInput).toEqual({ command: 'echo hello' });
    expect(session?.messages[2]?.metadata?.toolUseId).toBe('call-native-1');
    expect(session?.messages[2]?.content).toBe('hello');
  });
});
