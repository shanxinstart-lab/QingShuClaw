import { describe, expect, test } from 'vitest';
import { enforceLegacyFeishuPluginDisabled } from './openclawConfigGuards';

describe('openclawConfigGuards', () => {
  test('adds a disabled legacy Feishu plugin entry when missing', () => {
    const config: Record<string, unknown> = {};

    enforceLegacyFeishuPluginDisabled(config);

    expect(config).toEqual({
      plugins: {
        entries: {
          feishu: {
            enabled: false,
          },
        },
      },
    });
  });

  test('overrides an enabled legacy Feishu plugin entry', () => {
    const config: Record<string, unknown> = {
      plugins: {
        entries: {
          feishu: {
            enabled: true,
            config: {
              domain: 'feishu',
            },
          },
        },
      },
    };

    enforceLegacyFeishuPluginDisabled(config);

    expect(config.plugins).toEqual({
      entries: {
        feishu: {
          enabled: false,
          config: {
            domain: 'feishu',
          },
        },
      },
    });
  });
});
