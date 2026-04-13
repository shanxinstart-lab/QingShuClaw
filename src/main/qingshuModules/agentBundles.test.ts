import { describe, expect, test } from 'vitest';
import { resolveAgentToolBundleSelections } from './agentBundles';
import type { Agent } from '../coworkStore';

const createAgent = (overrides: Partial<Agent>): Agent => ({
  id: 'main',
  name: 'Main',
  description: '',
  systemPrompt: '',
  identity: '',
  model: '',
  icon: '',
  skillIds: [],
  toolBundleIds: [],
  enabled: true,
  isDefault: false,
  source: 'custom',
  presetId: '',
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe('resolveAgentToolBundleSelections', () => {
  test('returns enabled agent bundle selections filtered by enabled bundles', () => {
    const result = resolveAgentToolBundleSelections(
      [
        createAgent({
          id: 'main',
          toolBundleIds: ['lbs-analysis', 'inventory-readonly', 'lbs-analysis'],
        }),
        createAgent({
          id: 'writer',
          toolBundleIds: ['order-basic'],
        }),
      ],
      ['inventory-readonly', 'lbs-analysis'],
    );

    expect(result).toEqual([
      {
        agentId: 'main',
        toolBundleIds: ['inventory-readonly', 'lbs-analysis'],
      },
      {
        agentId: 'writer',
        toolBundleIds: [],
      },
    ]);
  });

  test('skips disabled agents and trims invalid bundle ids', () => {
    const result = resolveAgentToolBundleSelections(
      [
        createAgent({
          id: 'disabled',
          enabled: false,
          toolBundleIds: ['lbs-analysis'],
        }),
        createAgent({
          id: 'ops',
          toolBundleIds: ['  ', ' inventory-readonly '],
        }),
      ],
      ['inventory-readonly'],
    );

    expect(result).toEqual([
      {
        agentId: 'ops',
        toolBundleIds: ['inventory-readonly'],
      },
    ]);
  });
});
