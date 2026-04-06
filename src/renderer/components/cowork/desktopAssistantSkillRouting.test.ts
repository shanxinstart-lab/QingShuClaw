import { describe, expect, test } from 'vitest';
import {
  buildAutoAttachedPresentationHtmlRuntimeContract,
  buildDesktopAssistantAutoSkillMetadata,
  DesktopAssistantAutoSkill,
  getDesktopAssistantAutoAttachedSkillIds,
  resolveAutoAttachedDesktopAssistantSkill,
  shouldAutoAttachPresentationHtmlSkill,
} from './desktopAssistantSkillRouting';

const presentationSkill = {
  id: DesktopAssistantAutoSkill.PresentationHtml,
  name: 'presentation-html',
  description: 'presentation skill',
  enabled: true,
  isOfficial: false,
  isBuiltIn: true,
  updatedAt: Date.now(),
  prompt: 'skill prompt',
  skillPath: '/tmp/presentation-html/SKILL.md',
};

describe('shouldAutoAttachPresentationHtmlSkill', () => {
  test('matches explicit presentation html generation prompts conservatively', () => {
    expect(shouldAutoAttachPresentationHtmlSkill({
      prompt: '请生成一个可预览的 html 页面，用于演示这个产品',
      desktopAssistantEnabled: true,
    })).toBe(true);

    expect(shouldAutoAttachPresentationHtmlSkill({
      prompt: '帮我做一个 ppt 风格的演示页',
      desktopAssistantEnabled: true,
    })).toBe(true);

    expect(shouldAutoAttachPresentationHtmlSkill({
      prompt: '请生成一个带三个模块的演示 HTML，包含首页、价格卡片、总结区，并输出可预览结果',
      desktopAssistantEnabled: true,
    })).toBe(true);
  });

  test('does not attach when desktop assistant is disabled or the prompt is generic', () => {
    expect(shouldAutoAttachPresentationHtmlSkill({
      prompt: '请生成一个普通后台管理页面',
      desktopAssistantEnabled: true,
    })).toBe(false);

    expect(shouldAutoAttachPresentationHtmlSkill({
      prompt: '请生成一个可预览的 html 页面',
      desktopAssistantEnabled: false,
    })).toBe(false);
  });

  test('does not attach for generic html generation without presentation intent', () => {
    expect(shouldAutoAttachPresentationHtmlSkill({
      prompt: '请生成一个可预览的 html 页面，用于活动报名',
      desktopAssistantEnabled: true,
    })).toBe(false);

    expect(shouldAutoAttachPresentationHtmlSkill({
      prompt: '请做一个 landing page，用于官网首页',
      desktopAssistantEnabled: true,
    })).toBe(false);
  });

  test('matches conservative english presentation prompts', () => {
    expect(shouldAutoAttachPresentationHtmlSkill({
      prompt: 'Create a previewable HTML slides page for a guided walkthrough of this product',
      desktopAssistantEnabled: true,
    })).toBe(true);
  });
});

describe('resolveAutoAttachedDesktopAssistantSkill', () => {
  test('returns the presentation skill when the route is eligible', () => {
    const skill = resolveAutoAttachedDesktopAssistantSkill({
      prompt: '请生成一个适合讲解的 html 页面',
      desktopAssistantEnabled: true,
      skills: [presentationSkill],
      activeSkillIds: [],
    });

    expect(skill?.id).toBe(DesktopAssistantAutoSkill.PresentationHtml);
  });

  test('does not duplicate an already active skill', () => {
    const skill = resolveAutoAttachedDesktopAssistantSkill({
      prompt: '请生成一个适合讲解的 html 页面',
      desktopAssistantEnabled: true,
      skills: [presentationSkill],
      activeSkillIds: [DesktopAssistantAutoSkill.PresentationHtml],
    });

    expect(skill).toBeNull();
  });
});

describe('desktop assistant auto skill metadata', () => {
  test('builds message metadata for the auto-attached skill', () => {
    expect(buildDesktopAssistantAutoSkillMetadata(presentationSkill)).toEqual({
      desktopAssistantAutoAttachedSkillIds: [DesktopAssistantAutoSkill.PresentationHtml],
    });
  });

  test('extracts auto-attached skill ids conservatively', () => {
    expect(getDesktopAssistantAutoAttachedSkillIds({
      desktopAssistantAutoAttachedSkillIds: [DesktopAssistantAutoSkill.PresentationHtml, 123, ''],
    })).toEqual([DesktopAssistantAutoSkill.PresentationHtml]);

    expect(getDesktopAssistantAutoAttachedSkillIds(undefined)).toEqual([]);
  });

  test('builds a stronger runtime contract for presentation html auto skills', () => {
    const contract = buildAutoAttachedPresentationHtmlRuntimeContract(presentationSkill);

    expect(contract).toContain('文件位置：/absolute/path/to/file.html');
    expect(contract).toContain('Do not return only a ```html``` code block');
  });
});
