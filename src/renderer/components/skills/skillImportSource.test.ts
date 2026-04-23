import { expect, test } from 'vitest';

import {
  SkillImportSourceType,
  validateSkillImportSource,
} from './skillImportSource';

test('允许 GitHub owner/repo 简写', () => {
  expect(validateSkillImportSource('owner/repo', SkillImportSourceType.GitHub)).toBeNull();
});

test('GitHub 导入会拦截非 GitHub 地址', () => {
  expect(
    validateSkillImportSource(
      'https://clawhub.ai/skills/demo/example',
      SkillImportSourceType.GitHub,
    ),
  ).toBe('importSourceMismatchGithub');
});

test('允许 ClawHub 技能页面地址', () => {
  expect(
    validateSkillImportSource(
      'https://clawhub.ai/skills/demo/example',
      SkillImportSourceType.ClawHub,
    ),
  ).toBeNull();
});

test('ClawHub 导入会拦截非 clawhub 地址与 owner/repo 简写', () => {
  expect(
    validateSkillImportSource('owner/repo', SkillImportSourceType.ClawHub),
  ).toBe('importSourceMismatchClawhub');
  expect(
    validateSkillImportSource(
      'https://github.com/demo/repo',
      SkillImportSourceType.ClawHub,
    ),
  ).toBe('importSourceMismatchClawhub');
});
