import { expect, test } from 'vitest';

import {
  hasCreateAgentDraftChanges,
  hasOrderedSelectionChanges,
  hasPlatformBindingChanges,
} from './agentDraftState';

test('hasOrderedSelectionChanges 仅在顺序或内容变化时返回 true', () => {
  expect(hasOrderedSelectionChanges(['a', 'b'], ['a', 'b'])).toBe(false);
  expect(hasOrderedSelectionChanges(['a', 'b'], ['b', 'a'])).toBe(true);
  expect(hasOrderedSelectionChanges(['a'], ['a', 'b'])).toBe(true);
});

test('hasPlatformBindingChanges 按集合语义比较平台绑定', () => {
  expect(
    hasPlatformBindingChanges(new Set(['qq', 'feishu']), new Set(['feishu', 'qq'])),
  ).toBe(false);
  expect(
    hasPlatformBindingChanges(new Set(['qq', 'feishu']), new Set(['qq'])),
  ).toBe(true);
});

test('hasCreateAgentDraftChanges 会忽略仅空白字符的未持久化差异', () => {
  expect(hasCreateAgentDraftChanges({
    name: '   ',
    description: '',
    systemPrompt: ' ',
    identity: '',
    icon: '   ',
    skillIds: [],
    toolBundleIds: [],
    boundPlatforms: new Set(),
  })).toBe(false);
});

test('hasCreateAgentDraftChanges 只关注会实际持久化的字段', () => {
  expect(hasCreateAgentDraftChanges({
    name: '',
    description: '',
    systemPrompt: '',
    identity: '',
    icon: '',
    skillIds: ['skill-a'],
    toolBundleIds: [],
    boundPlatforms: new Set(),
  })).toBe(true);

  expect(hasCreateAgentDraftChanges({
    name: '',
    description: '',
    systemPrompt: '',
    identity: '',
    icon: '',
    skillIds: [],
    toolBundleIds: ['bundle-a'],
    boundPlatforms: new Set(['qq']),
  })).toBe(true);
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
      boundPlatforms: new Set(['qq']),
    },
    {
      name: 'Demo',
      description: ' desc ',
      systemPrompt: '',
      identity: ' ',
      icon: '🤖',
      skillIds: ['skill-a'],
      toolBundleIds: ['bundle-a'],
      boundPlatforms: new Set(['qq']),
    },
  )).toBe(false);
});
