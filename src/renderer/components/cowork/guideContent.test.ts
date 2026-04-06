import { describe, expect, test } from 'vitest';
import { parseGuideContent, resolveGuideContentFromConversation, shouldShowGuideButton } from './guideContent';
import { DesktopAssistantMessageMetadataKey } from '../../../shared/desktopAssistant/constants';

const createAssistantMessage = (content: string, metadata?: Record<string, unknown>, id = 'message-1') => ({
  id,
  type: 'assistant' as const,
  content,
  timestamp: Date.now(),
  metadata,
});

describe('parseGuideContent', () => {
  test('accepts a single http url target', () => {
    const result = parseGuideContent(createAssistantMessage('请打开 https://example.com/docs\n## 概览\n内容'));
    expect(result.eligible).toBe(true);
    expect(result.previewTarget).toBe('https://example.com/docs');
    expect(result.scenes[0]?.title).toBe('概览');
  });

  test('extracts scene anchor and narration summary from heading sections', () => {
    const result = parseGuideContent(createAssistantMessage([
      '请打开 https://example.com/demo',
      '## 第一幕 [anchor=#hero]',
      '先介绍页面标题区和主按钮。',
      '## 第二幕',
      'anchor: #pricing',
      '这里重点讲价格卡片。',
    ].join('\n')));

    expect(result.eligible).toBe(true);
    expect(result.scenes).toHaveLength(2);
    expect(result.scenes[0]).toMatchObject({
      title: '第一幕',
      summary: '先介绍页面标题区和主按钮。',
      anchor: '#hero',
    });
    expect(result.scenes[1]).toMatchObject({
      title: '第二幕',
      summary: '这里重点讲价格卡片。',
      anchor: '#pricing',
    });
  });

  test('accepts a single local file target', () => {
    const result = parseGuideContent(createAssistantMessage('文件位置：/tmp/demo.html\n1. 第一步\n2. 第二步'));
    expect(result.eligible).toBe(true);
    expect(result.previewTarget).toBe('/tmp/demo.html');
    expect(result.scenes).toHaveLength(2);
  });

  test('accepts a file url target and normalizes it to a local path', () => {
    const result = parseGuideContent(createAssistantMessage(
      '你可以在浏览器中打开 [demo-presentation.html](file:///Users/test/demo-presentation.html) 查看效果。',
    ));

    expect(result.eligible).toBe(true);
    expect(result.previewTarget).toBe('/Users/test/demo-presentation.html');
  });

  test('accepts markdown file links when the visible label is also a file url', () => {
    const result = parseGuideContent(createAssistantMessage(
      '文件位置：[file:///Users/test/demo-presentation.html](file:///Users/test/demo-presentation.html)',
    ));

    expect(result.eligible).toBe(true);
    expect(result.previewTarget).toBe('/Users/test/demo-presentation.html');
  });

  test('resolves a relative local html path with cwd context', () => {
    const result = parseGuideContent(
      createAssistantMessage('文件位置：./artifacts/presentation/demo.html\n1. 第一步\n2. 第二步'),
      { cwd: '/workspace/qingshu' },
    );

    expect(result.eligible).toBe(true);
    expect(result.previewTarget).toBe('/workspace/qingshu/artifacts/presentation/demo.html');
  });

  test('accepts a single artifact anchor target', () => {
    const result = parseGuideContent(createAssistantMessage('查看 #artifact-report\n普通内容'));
    expect(result.eligible).toBe(true);
    expect(result.previewTarget).toBe('#artifact-report');
    expect(result.scenes[0]?.title).toBe('概览');
  });

  test('accepts inline html content as a local artifact-like guide target', () => {
    const result = parseGuideContent(createAssistantMessage([
      '```html',
      '<!doctype html>',
      '<html><head><title>演示页</title></head><body>',
      '<section id="hero"><h1>首页概览</h1><p>介绍产品定位</p></section>',
      '<section id="pricing"><h2>价格卡片</h2><p>介绍三档套餐</p></section>',
      '</body></html>',
      '```',
    ].join('\n'), undefined, 'message-html'));

    expect(result.eligible).toBe(true);
    expect(result.previewTarget).toBe('#artifact-message-html');
    expect(result.scenes).toHaveLength(2);
    expect(result.scenes[0]).toMatchObject({
      title: '首页概览',
      anchor: '#hero',
    });
  });

  test('prefers linked presentation manifest scenes for bridge-compatible html', () => {
    const result = parseGuideContent(createAssistantMessage([
      '```html',
      '<!doctype html>',
      '<html data-qingshu-presentation="v1"><body>',
      '<section id="hero" data-guide-scene-id="scene-hero" data-guide-scene-title="首页概览"><h1>首页概览</h1><p>介绍产品定位</p></section>',
      '<section id="pricing" data-guide-scene-id="scene-pricing"><h2>价格卡片</h2><p>介绍三档套餐</p></section>',
      '</body></html>',
      '```',
    ].join('\n'), undefined, 'message-linked-html'));

    expect(result.eligible).toBe(true);
    expect(result.scenes).toEqual([
      { id: 'scene-hero', title: '首页概览', summary: '首页概览', anchor: '#hero' },
      { id: 'scene-pricing', title: '价格卡片', summary: '价格卡片', anchor: '#pricing' },
    ]);
  });

  test('accepts artifact html code blocks with header metadata', () => {
    const result = parseGuideContent(createAssistantMessage([
      '```artifact:html title="演示页"',
      '<!doctype html>',
      '<html><body>',
      '<section id="hero"><h1>首页概览</h1><p>介绍产品定位</p></section>',
      '<section id="summary"><h2>总结结论</h2><p>回顾关键内容</p></section>',
      '</body></html>',
      '```',
    ].join('\n'), undefined, 'message-artifact-html'));

    expect(result.eligible).toBe(true);
    expect(result.previewTarget).toBe('#artifact-message-artifact-html');
    expect(result.scenes).toHaveLength(2);
    expect(result.scenes[1]).toMatchObject({
      title: '总结结论',
      anchor: '#summary',
    });
  });

  test('rejects multiple distinct preview targets', () => {
    const result = parseGuideContent(createAssistantMessage('https://a.com 和 https://b.com'));
    expect(result).toEqual({
      eligible: false,
      previewTarget: null,
      scenes: [],
    });
  });

  test('rejects non-final or non-assistant messages', () => {
    expect(parseGuideContent({
      ...createAssistantMessage('https://example.com'),
      metadata: { isStreaming: true },
    }).eligible).toBe(false);
    expect(parseGuideContent({
      id: 'message-2',
      type: 'user' as const,
      content: 'https://example.com',
      timestamp: Date.now(),
    }).eligible).toBe(false);
  });

  test('controls guide button visibility conservatively', () => {
    const message = createAssistantMessage('https://example.com');
    expect(shouldShowGuideButton(message, false)).toBe(false);
    expect(shouldShowGuideButton(message, true)).toBe(true);
  });

  test('can resolve a referenced previous preview target for demo-style replies', () => {
    const previousMessage = createAssistantMessage('文件位置：/tmp/demo.html\n## 场景一\n内容', undefined, 'message-prev');
    const currentMessage = createAssistantMessage('我来演示上面的html\n## 第一幕\n先看页面结构', undefined, 'message-current');
    const result = resolveGuideContentFromConversation(currentMessage, [previousMessage, currentMessage]);

    expect(result.eligible).toBe(true);
    expect(result.previewTarget).toBe('/tmp/demo.html');
    expect(result.scenes[0]?.title).toBe('第一幕');
  });

  test('does not resolve referenced preview targets without explicit demo intent', () => {
    const previousMessage = createAssistantMessage('文件位置：/tmp/demo.html\n## 场景一\n内容', undefined, 'message-prev');
    const currentMessage = createAssistantMessage('这个 html 看起来不错', undefined, 'message-current');
    const result = resolveGuideContentFromConversation(currentMessage, [previousMessage, currentMessage]);

    expect(result).toEqual({
      eligible: false,
      previewTarget: null,
      scenes: [],
    });
  });

  test('resolves a unique turn-scoped preview target from tool result metadata', () => {
    const userMessage = {
      id: 'user-1',
      type: 'user' as const,
      content: '请生成一个演示 HTML',
      timestamp: Date.now(),
      metadata: {
        [DesktopAssistantMessageMetadataKey.AutoAttachedSkillIds]: ['presentation-html'],
      },
    };
    const toolResultMessage = {
      id: 'tool-result-1',
      type: 'tool_result' as const,
      content: '',
      timestamp: Date.now(),
      metadata: {
        toolResult: 'Saved to ./artifacts/presentation/demo.html',
      },
    };
    const currentMessage = createAssistantMessage('已生成本地演示页，下面我来带你看这个 html。', undefined, 'message-current');

    const result = resolveGuideContentFromConversation(
      currentMessage,
      [userMessage, toolResultMessage, currentMessage],
      { cwd: '/workspace/qingshu' },
    );

    expect(result.eligible).toBe(true);
    expect(result.previewTarget).toBe('/workspace/qingshu/artifacts/presentation/demo.html');
  });

  test('resolves a unique turn-scoped preview target from tool input path metadata', () => {
    const userMessage = {
      id: 'user-1',
      type: 'user' as const,
      content: '请生成一个演示 HTML',
      timestamp: Date.now(),
      metadata: {
        skillIds: ['presentation-html'],
      },
    };
    const toolUseMessage = {
      id: 'tool-use-1',
      type: 'tool_use' as const,
      content: 'Using tool: write',
      timestamp: Date.now(),
      metadata: {
        toolName: 'write',
        toolInput: {
          path: '/workspace/qingshu/demo-presentation.html',
        },
      },
    };
    const currentMessage = createAssistantMessage('已生成演示 HTML 页面。', undefined, 'message-current');

    const result = resolveGuideContentFromConversation(
      currentMessage,
      [userMessage, toolUseMessage, currentMessage],
    );

    expect(result.eligible).toBe(true);
    expect(result.previewTarget).toBe('/workspace/qingshu/demo-presentation.html');
  });

  test('resolves the real session shape with a file url assistant reply', () => {
    const messages = [
      {
        id: 'user-real',
        type: 'user' as const,
        content: '请生成一个带三个模块的演示 HTML，包含首页、价格卡片、总结区，并输出可预览结果',
        timestamp: Date.now(),
        metadata: {
          skillIds: ['presentation-html'],
          desktopAssistantAutoAttachedSkillIds: ['presentation-html'],
        },
      },
      createAssistantMessage('我来为你生成一个包含三个模块的演示 HTML 页面。', {
        isStreaming: false,
        isFinal: true,
      }, 'assistant-intro'),
      {
        id: 'tool-use-real',
        type: 'tool_use' as const,
        content: 'Using tool: write',
        timestamp: Date.now(),
        metadata: {
          toolName: 'write',
          toolInput: {
            path: '/Users/wuyongsheng/lobsterai/project/demo-presentation.html',
          },
        },
      },
      {
        id: 'tool-result-real',
        type: 'tool_result' as const,
        content: '',
        timestamp: Date.now(),
        metadata: {
          toolResult: '',
          isError: false,
          isStreaming: false,
          isFinal: true,
        },
      },
      createAssistantMessage([
        '已生成演示 HTML 页面！[demo-presentation.html](file:///Users/wuyongsheng/lobsterai/project/demo-presentation.html) 包含三个模块：',
        '',
        '1. **首页概览** - 品牌介绍 + 三大核心特性卡片',
        '2. **价格卡片** - 基础版/专业版/企业版三档定价方案',
        '3. **总结区** - 核心数据指标 + 行动号召',
        '',
        '页面特点：',
        '- 渐变紫色主题，现代化设计风格',
        '- 响应式布局，适配各种屏幕',
        '- 悬停动画和渐入效果',
        '- 语义化 section 结构，便于场景提取',
        '',
        '可以直接在浏览器中打开预览！',
      ].join('\n'), {
        isStreaming: false,
        isFinal: true,
      }, 'assistant-real'),
    ];

    const result = resolveGuideContentFromConversation(
      messages[messages.length - 1] as any,
      messages as any,
      { cwd: '/Users/wuyongsheng/lobsterai/project' },
    );

    expect(result.eligible).toBe(true);
    expect(result.previewTarget).toBe('/Users/wuyongsheng/lobsterai/project/demo-presentation.html');
    expect(result.scenes).toHaveLength(3);
  });

  test('resolves the real session shape when the file url is used as both label and href', () => {
    const messages = [
      {
        id: 'user-real-2',
        type: 'user' as const,
        content: '请生成一个带三个模块的演示 HTML，包含首页、价格卡片、总结区，并输出可预览结果',
        timestamp: Date.now(),
        metadata: {
          skillIds: ['presentation-html'],
          desktopAssistantAutoAttachedSkillIds: ['presentation-html'],
        },
      },
      createAssistantMessage('我来为你生成一个包含首页、价格卡片和总结区的演示 HTML 页面。', {
        isStreaming: false,
        isFinal: true,
      }, 'assistant-intro-2'),
      {
        id: 'tool-use-real-2',
        type: 'tool_use' as const,
        content: 'Using tool: write',
        timestamp: Date.now(),
        metadata: {
          toolName: 'write',
          toolInput: {
            path: '/Users/wuyongsheng/lobsterai/project/artifacts/presentation/demo-presentation.html',
          },
        },
      },
      createAssistantMessage([
        '已生成演示 HTML 页面！',
        '',
        '文件位置：[file:///Users/wuyongsheng/lobsterai/project/artifacts/presentation/demo-presentation.html](file:///Users/wuyongsheng/lobsterai/project/artifacts/presentation/demo-presentation.html)',
        '',
        '页面包含三个模块：',
        '1. 首页概览',
        '2. 价格卡片',
        '3. 总结区',
      ].join('\n'), {
        isStreaming: false,
        isFinal: true,
      }, 'assistant-real-2'),
    ];

    const result = resolveGuideContentFromConversation(
      messages[messages.length - 1] as any,
      messages as any,
      { cwd: '/Users/wuyongsheng/lobsterai/project' },
    );

    expect(result.eligible).toBe(true);
    expect(result.previewTarget).toBe('/Users/wuyongsheng/lobsterai/project/artifacts/presentation/demo-presentation.html');
  });

  test('controls guide button visibility for relative html paths with cwd context', () => {
    const message = createAssistantMessage('文件位置：./artifacts/presentation/demo.html');

    expect(shouldShowGuideButton(message, true, [], { cwd: '/workspace/qingshu' })).toBe(true);
    expect(shouldShowGuideButton(message, true)).toBe(false);
  });
});
