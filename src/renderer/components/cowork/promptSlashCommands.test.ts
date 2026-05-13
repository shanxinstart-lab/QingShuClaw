import { describe, expect, test } from 'vitest';

import type { LocalizedQuickAction } from '../../types/quickAction';
import {
  applyPromptSlashCommand,
  filterPromptSlashCommands,
  getDefaultPromptForAction,
  parsePromptSlashCommand,
} from './promptSlashCommands';

const actions: LocalizedQuickAction[] = [
  {
    id: 'market-analysis',
    label: '市场分析',
    icon: 'ChartBarIcon',
    color: '#000000',
    skillMapping: 'market-skill',
    prompts: [
      {
        id: 'default',
        label: '供需分析',
        description: '分析城市供需',
        prompt: '请分析供需情况',
      },
    ],
  },
  {
    id: 'empty-action',
    label: '空动作',
    icon: 'ChartBarIcon',
    color: '#000000',
    skillMapping: 'empty-skill',
    prompts: [
      {
        id: 'empty',
        label: '空提示',
        prompt: '   ',
      },
    ],
  },
];

describe('promptSlashCommands', () => {
  test('parses single-line slash command queries', () => {
    expect(parsePromptSlashCommand('/')).toBe('');
    expect(parsePromptSlashCommand('  /市场  ')).toBe('市场');
    expect(parsePromptSlashCommand('hello /市场')).toBeNull();
    expect(parsePromptSlashCommand('/市场\n继续输入')).toBeNull();
  });

  test('filters quick actions by action and prompt text', () => {
    expect(filterPromptSlashCommands(actions, '/供需')).toHaveLength(1);
    expect(filterPromptSlashCommands(actions, '/market')).toHaveLength(1);
    expect(filterPromptSlashCommands(actions, '/missing')).toHaveLength(0);
  });

  test('skips actions without usable prompt text', () => {
    expect(getDefaultPromptForAction(actions[1]!)).toBeNull();
    expect(filterPromptSlashCommands(actions, '/')).toHaveLength(1);
  });

  test('applies selected prompt only when the input is a slash command', () => {
    expect(applyPromptSlashCommand('/供需', '请分析供需情况')).toBe('请分析供需情况');
    expect(applyPromptSlashCommand('普通输入', '请分析供需情况')).toBe('普通输入');
  });
});
