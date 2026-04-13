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
});
