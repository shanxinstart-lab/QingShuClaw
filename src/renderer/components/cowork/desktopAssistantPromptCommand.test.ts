import { describe, expect, test } from 'vitest';
import {
  DesktopAssistantPromptCommandAction,
  resolveDesktopAssistantPromptCommand,
} from './desktopAssistantPromptCommand';

describe('resolveDesktopAssistantPromptCommand', () => {
  test('matches explicit desktop assistant guide prompts conservatively', () => {
    expect(resolveDesktopAssistantPromptCommand('用桌面助手演示一下上面的 html')).toEqual({
      action: DesktopAssistantPromptCommandAction.StartLatestGuide,
      matchedText: '用桌面助手演示一下上面的html',
    });

    expect(resolveDesktopAssistantPromptCommand('演示一下上面的页面')).toEqual({
      action: DesktopAssistantPromptCommandAction.StartLatestGuide,
      matchedText: '演示一下上面的页面',
    });

    expect(resolveDesktopAssistantPromptCommand('开始讲解')).toEqual({
      action: DesktopAssistantPromptCommandAction.StartLatestGuide,
      matchedText: '开始讲解',
    });
  });

  test('rejects generic questions or normal generation requests', () => {
    expect(resolveDesktopAssistantPromptCommand('这个 html 是怎么实现的')).toEqual({
      action: null,
      matchedText: null,
    });

    expect(resolveDesktopAssistantPromptCommand('请生成一个可演示 html 页面')).toEqual({
      action: null,
      matchedText: null,
    });
  });
});
