import { expect, test } from 'vitest';

import {
  hasBindingSelectionChanges,
  hasCreateAgentDraftChanges,
  hasOrderedSelectionChanges,
} from './agentDraftState';

test('hasOrderedSelectionChanges 仅在顺序或内容变化时返回 true', () => {
  expect(hasOrderedSelectionChanges(['a', 'b'], ['a', 'b'])).toBe(false);
  expect(hasOrderedSelectionChanges(['a', 'b'], ['b', 'a'])).toBe(true);
  expect(hasOrderedSelectionChanges(['a'], ['a', 'b'])).toBe(true);
});

test('hasBindingSelectionChanges 按集合语义比较绑定项', () => {
  expect(
    hasBindingSelectionChanges(new Set(['qq', 'feishu:bot-a']), new Set(['feishu:bot-a', 'qq'])),
  ).toBe(false);
  expect(
    hasBindingSelectionChanges(new Set(['qq', 'feishu:bot-a']), new Set(['qq'])),
  ).toBe(true);
});

test('hasBindingSelectionChanges 按持久化语义忽略绑定项空白', () => {
  expect(
    hasBindingSelectionChanges(new Set([' feishu:bot-a ', ' qq ']), new Set(['feishu:bot-a', 'qq'])),
  ).toBe(false);
  expect(
    hasBindingSelectionChanges(new Set([' ', 'feishu:bot-a']), new Set(['feishu:bot-a'])),
  ).toBe(false);
});

test('hasCreateAgentDraftChanges 会忽略仅空白字符的未持久化差异', () => {
  expect(hasCreateAgentDraftChanges({
    name: '   ',
    description: '',
    systemPrompt: ' ',
    identity: '',
    workingDirectory: ' ',
    icon: '   ',
    skillIds: [],
    toolBundleIds: [],
    boundBindingKeys: new Set(),
  })).toBe(false);
});

test('hasCreateAgentDraftChanges 只关注会实际持久化的字段', () => {
  expect(hasCreateAgentDraftChanges({
    name: '',
    description: '',
    systemPrompt: '',
    identity: '',
    workingDirectory: '',
    icon: '',
    skillIds: ['skill-a'],
    toolBundleIds: [],
    boundBindingKeys: new Set(),
  })).toBe(true);

  expect(hasCreateAgentDraftChanges({
    name: '',
    description: '',
    systemPrompt: '',
    identity: '',
    workingDirectory: '',
    icon: '',
    skillIds: [],
    toolBundleIds: ['bundle-a'],
    boundBindingKeys: new Set(['qq']),
  })).toBe(true);
});

test('hasCreateAgentDraftChanges 会把默认工作目录变化视为可保存改动', () => {
  expect(hasCreateAgentDraftChanges(
    {
      name: 'Agent',
      description: '',
      systemPrompt: '',
      identity: '',
      workingDirectory: '/tmp/new-workspace',
      icon: '',
      skillIds: [],
      toolBundleIds: [],
      boundBindingKeys: new Set(),
    },
    {
      name: 'Agent',
      description: '',
      systemPrompt: '',
      identity: '',
      workingDirectory: '/tmp/old-workspace',
      icon: '',
      skillIds: [],
      toolBundleIds: [],
      boundBindingKeys: new Set(),
    },
  )).toBe(true);

  expect(hasCreateAgentDraftChanges(
    {
      name: 'Agent',
      description: '',
      systemPrompt: '',
      identity: '',
      workingDirectory: ' /tmp/workspace ',
      icon: '',
      skillIds: [],
      toolBundleIds: [],
      boundBindingKeys: new Set(),
    },
    {
      name: 'Agent',
      description: '',
      systemPrompt: '',
      identity: '',
      workingDirectory: '/tmp/workspace',
      icon: '',
      skillIds: [],
      toolBundleIds: [],
      boundBindingKeys: new Set(),
    },
  )).toBe(false);
});

test('hasCreateAgentDraftChanges 会把 IM 实例绑定变化视为可保存改动', () => {
  expect(hasCreateAgentDraftChanges(
    {
      name: 'Agent',
      description: '',
      systemPrompt: '',
      identity: '',
      icon: '',
      skillIds: [],
      toolBundleIds: [],
      boundBindingKeys: new Set(['feishu:bot-new']),
    },
    {
      name: 'Agent',
      description: '',
      systemPrompt: '',
      identity: '',
      icon: '',
      skillIds: [],
      toolBundleIds: [],
      boundBindingKeys: new Set(),
    },
  )).toBe(true);
});

test('hasCreateAgentDraftChanges 会在 IM 实例绑定未变化时保持不可保存', () => {
  expect(hasCreateAgentDraftChanges(
    {
      name: 'Agent',
      description: '',
      systemPrompt: '',
      identity: '',
      icon: '',
      skillIds: [],
      toolBundleIds: [],
      boundBindingKeys: new Set(['feishu:bot-a']),
    },
    {
      name: 'Agent',
      description: '',
      systemPrompt: '',
      identity: '',
      icon: '',
      skillIds: [],
      toolBundleIds: [],
      boundBindingKeys: new Set(['feishu:bot-a']),
    },
  )).toBe(false);
});

test('hasCreateAgentDraftChanges 会把 NIM 和 POPO 单实例绑定变化视为可保存改动', () => {
  expect(hasCreateAgentDraftChanges(
    {
      name: 'Agent',
      description: '',
      systemPrompt: '',
      identity: '',
      icon: '',
      skillIds: [],
      toolBundleIds: [],
      boundBindingKeys: new Set(['nim', 'popo']),
    },
    {
      name: 'Agent',
      description: '',
      systemPrompt: '',
      identity: '',
      icon: '',
      skillIds: [],
      toolBundleIds: [],
      boundBindingKeys: new Set(['nim']),
    },
  )).toBe(true);
});

test('hasCreateAgentDraftChanges 会在 NIM 和 POPO 单实例绑定未变化时保持不可保存', () => {
  expect(hasCreateAgentDraftChanges(
    {
      name: 'Agent',
      description: '',
      systemPrompt: '',
      identity: '',
      icon: '',
      skillIds: [],
      toolBundleIds: [],
      boundBindingKeys: new Set(['popo', 'nim']),
    },
    {
      name: 'Agent',
      description: '',
      systemPrompt: '',
      identity: '',
      icon: '',
      skillIds: [],
      toolBundleIds: [],
      boundBindingKeys: new Set(['nim', 'popo']),
    },
  )).toBe(false);
});

test('hasCreateAgentDraftChanges 会按持久化语义比较初始值', () => {
  expect(hasCreateAgentDraftChanges(
    {
      name: ' Demo ',
      description: 'desc',
      systemPrompt: '',
      identity: '',
      icon: ' 🤖 ',
      skillIds: ['skill-a'],
      toolBundleIds: ['bundle-a'],
      boundBindingKeys: new Set(['feishu:bot-a']),
    },
    {
      name: 'Demo',
      description: ' desc ',
      systemPrompt: '',
      identity: ' ',
      icon: '🤖',
      skillIds: ['skill-a'],
      toolBundleIds: ['bundle-a'],
      boundBindingKeys: new Set(['feishu:bot-a']),
    },
  )).toBe(false);
});
