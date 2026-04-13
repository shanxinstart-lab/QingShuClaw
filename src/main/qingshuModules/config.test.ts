import { describe, expect, test } from 'vitest';
import { resolveQingShuModuleFeatureFlagsFromConfig } from './config';

describe('resolveQingShuModuleFeatureFlagsFromConfig', () => {
  test('falls back to disabled shared tools and built-in skills by default', () => {
    expect(
      resolveQingShuModuleFeatureFlagsFromConfig(undefined, 'lbs', false),
    ).toEqual({
      enabled: false,
      sharedToolsEnabled: false,
      builtInSkillsEnabled: false,
    });
  });

  test('inherits enabledByDefault when module config is missing', () => {
    expect(
      resolveQingShuModuleFeatureFlagsFromConfig({ qingshuModules: {} }, 'order', true),
    ).toEqual({
      enabled: true,
      sharedToolsEnabled: false,
      builtInSkillsEnabled: false,
    });
  });

  test('prefers explicit boolean flags from app config', () => {
    expect(
      resolveQingShuModuleFeatureFlagsFromConfig(
        {
          qingshuModules: {
            inventory: {
              enabled: true,
              sharedToolsEnabled: true,
              builtInSkillsEnabled: false,
            },
          },
        },
        'inventory',
        false,
      ),
    ).toEqual({
      enabled: true,
      sharedToolsEnabled: true,
      builtInSkillsEnabled: false,
    });
  });

  test('ignores invalid flag values and keeps safe defaults', () => {
    expect(
      resolveQingShuModuleFeatureFlagsFromConfig(
        {
          qingshuModules: {
            lbs: {
              enabled: 'yes' as unknown as boolean,
              sharedToolsEnabled: 1 as unknown as boolean,
              builtInSkillsEnabled: null as unknown as boolean,
            },
          },
        },
        'lbs',
        false,
      ),
    ).toEqual({
      enabled: false,
      sharedToolsEnabled: false,
      builtInSkillsEnabled: false,
    });
  });
});
