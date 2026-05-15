import { describe, expect, test } from 'vitest';

import type { McpServerConfig } from '../../types/mcp';
import type { LocalizedQuickAction } from '../../types/quickAction';
import type { Skill } from '../../types/skill';
import {
  applyPromptSlashCommand,
  filterPromptSlashCommands,
  getBuiltinPromptSlashCommands,
  getDefaultPromptForAction,
  parsePromptSlashCommand,
  PromptBuiltinSlashCommandId,
  PromptSlashCommandKind,
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

const builtinCommands = getBuiltinPromptSlashCommands({
  newSession: '新建会话',
  clearInput: '清空输入',
  manageSkills: '管理技能',
  helpPrompt: '整理下一步',
});

const skills: Skill[] = [
  {
    id: 'docx',
    name: '文档生成',
    description: '生成 Word 文档',
    enabled: true,
    isOfficial: true,
    isBuiltIn: true,
    updatedAt: 1,
    prompt: '文档技能提示词',
    skillPath: '/skills/docx/SKILL.md',
  },
];

const mcpServers: McpServerConfig[] = [
  {
    id: 'context7',
    name: 'Context7',
    description: '查询官方文档',
    enabled: true,
    transportType: 'stdio',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp@latest'],
    isBuiltIn: true,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'disabled-mcp',
    name: 'Disabled MCP',
    description: '不应出现在结果里',
    enabled: false,
    transportType: 'stdio',
    command: 'npx',
    isBuiltIn: false,
    createdAt: 1,
    updatedAt: 1,
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

  test('filters builtin commands before quick action prompts', () => {
    const matches = filterPromptSlashCommands(actions, '/skill', { builtinCommands });

    expect(matches[0]).toMatchObject({
      kind: PromptSlashCommandKind.Builtin,
      id: PromptBuiltinSlashCommandId.ManageSkills,
    });
    expect(matches.some((match) => match.kind === PromptSlashCommandKind.QuickActionPrompt)).toBe(true);
  });

  test('includes installed skills and enabled MCP servers in slash search', () => {
    const skillMatches = filterPromptSlashCommands(actions, '/word', { skills });
    expect(skillMatches[0]).toMatchObject({
      kind: PromptSlashCommandKind.Skill,
      skill: { id: 'docx' },
    });

    const mcpMatches = filterPromptSlashCommands(actions, '/context7', { mcpServers });
    expect(mcpMatches[0]).toMatchObject({
      kind: PromptSlashCommandKind.McpServer,
      server: { id: 'context7' },
    });
    expect(filterPromptSlashCommands(actions, '/disabled', { mcpServers })).toHaveLength(0);
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
