import { describe, expect, test } from 'vitest';

import { __mcpServerManagerTestUtils } from './mcpServerManager';

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
});
