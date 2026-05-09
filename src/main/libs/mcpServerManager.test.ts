import { describe, expect, test } from 'vitest';

import { __mcpServerManagerTestUtils,McpServerManager } from './mcpServerManager';

describe('mcpServerManager abort handling', () => {
  test('raceAbortSignal rejects when aborted before the tool promise resolves', async () => {
    const controller = new AbortController();
    const slowTool = new Promise<string>((resolve) => {
      setTimeout(() => resolve('too late'), 50);
    });

    const raced = __mcpServerManagerTestUtils.raceAbortSignal(
      slowTool,
      controller.signal,
      'Tool aborted',
    );
    controller.abort();

    await expect(raced).rejects.toThrow('Tool aborted');
  });

  test('raceAbortSignal resolves normally when the tool promise wins', async () => {
    const controller = new AbortController();

    await expect(
      __mcpServerManagerTestUtils.raceAbortSignal(
        Promise.resolve('ok'),
        controller.signal,
        'Tool aborted',
      ),
    ).resolves.toBe('ok');
  });

  test('local MCP tools honor abort signals', async () => {
    const manager = new McpServerManager();
    const controller = new AbortController();

    manager.registerLocalServer({
      name: 'local-test',
      tools: [{
        server: 'local-test',
        name: 'slow_tool',
        description: '',
        inputSchema: {},
      }],
      callTool: async () => new Promise((resolve) => {
        setTimeout(() => resolve({
          content: [{ type: 'text', text: 'too late' }],
          isError: false,
        }), 50);
      }),
    });

    const resultPromise = manager.callTool('local-test', 'slow_tool', {}, {
      signal: controller.signal,
    });
    controller.abort();

    await expect(resultPromise).resolves.toMatchObject({
      content: [{ type: 'text', text: 'Tool execution error: Tool "slow_tool" aborted' }],
      isError: true,
    });
  });
});
