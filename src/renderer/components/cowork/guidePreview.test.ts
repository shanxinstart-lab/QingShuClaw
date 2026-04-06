import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  GuidePreviewEvent,
  materializeInlineGuidePreviewTarget,
  openGuidePreview,
  openGuideScenePreview,
  prepareGuideStartContext,
  resolveGuidePreviewMode,
  resolveGuideScenePreviewTarget,
} from './guidePreview';
import { GuidePreviewMode } from './guidePresentationBridge';

const openExternal = vi.fn();
const openPath = vi.fn();
const saveInlineFile = vi.fn();
const readFileAsDataUrl = vi.fn();
const dispatchEvent = vi.fn();
class MockCustomEvent extends Event {
  detail: unknown;

  constructor(type: string, init?: CustomEventInit<unknown>) {
    super(type);
    this.detail = init?.detail;
  }
}

beforeEach(() => {
  openExternal.mockReset();
  openPath.mockReset();
  saveInlineFile.mockReset();
  readFileAsDataUrl.mockReset();
  dispatchEvent.mockReset();
  vi.stubGlobal('CustomEvent', MockCustomEvent);
  vi.stubGlobal('window', {
    atob: (value: string) => Buffer.from(value, 'base64').toString('binary'),
    dispatchEvent,
    shell: {
      openExternal: undefined,
      openPath: undefined,
    },
    electron: {
      dialog: {
        saveInlineFile,
        readFileAsDataUrl,
      },
      shell: {
        openExternal,
        openPath,
      },
    },
  });
});

describe('materializeInlineGuidePreviewTarget', () => {
  test('keeps existing local preview targets unchanged', async () => {
    const result = await materializeInlineGuidePreviewTarget({
      message: {
        id: 'message-1',
        type: 'assistant',
        content: '文件位置：/tmp/demo.html',
      },
      previewTarget: '/tmp/demo.html',
      cwd: '/tmp',
    });

    expect(result).toEqual({
      success: true,
      previewTarget: '/tmp/demo.html',
      materialized: false,
    });
    expect(saveInlineFile).not.toHaveBeenCalled();
  });

  test('writes inline html guides to a local html file', async () => {
    saveInlineFile.mockResolvedValue({
      success: true,
      path: '/tmp/generated-demo.html',
    });

    const result = await materializeInlineGuidePreviewTarget({
      message: {
        id: 'message-inline',
        type: 'assistant',
        content: [
          '```html',
          '<!doctype html>',
          '<html><head><title>演示页</title></head><body><section id="hero"><h1>首页概览</h1><p>介绍</p></section></body></html>',
          '```',
        ].join('\n'),
      },
      previewTarget: '#artifact-message-inline',
      cwd: '/tmp/demo-workspace',
    });

    expect(result).toEqual({
      success: true,
      previewTarget: '/tmp/generated-demo.html',
      materialized: true,
    });
    expect(saveInlineFile).toHaveBeenCalledTimes(1);
    expect(saveInlineFile.mock.calls[0]?.[0]).toMatchObject({
      fileName: '演示页.html',
      mimeType: 'text/html',
      cwd: '/tmp/demo-workspace',
    });
  });

  test('returns an error when inline html materialization fails', async () => {
    saveInlineFile.mockResolvedValue({
      success: false,
      path: null,
      error: 'write failed',
    });

    const result = await materializeInlineGuidePreviewTarget({
      message: {
        id: 'message-inline',
        type: 'assistant',
        content: [
          '```html',
          '<!doctype html>',
          '<html><body><section><h1>首页概览</h1><p>介绍</p></section></body></html>',
          '```',
        ].join('\n'),
      },
      previewTarget: '#artifact-message-inline',
    });

    expect(result).toEqual({
      success: false,
      previewTarget: '#artifact-message-inline',
      materialized: false,
      error: 'write failed',
    });
  });
});

describe('openGuidePreview', () => {
  test('opens http urls with shell.openExternal', async () => {
    openExternal.mockResolvedValue({ success: true });

    const result = await openGuidePreview('https://example.com/demo');

    expect(openExternal).toHaveBeenCalledWith('https://example.com/demo');
    expect(result).toEqual({ success: true });
  });

  test('opens localfile targets and absolute paths with shell.openPath', async () => {
    openPath.mockResolvedValue({ success: true });

    const localFileResult = await openGuidePreview('localfile:///tmp/demo.html');
    const absolutePathResult = await openGuidePreview('/tmp/demo.html');

    expect(openPath).toHaveBeenNthCalledWith(1, '/tmp/demo.html');
    expect(openPath).toHaveBeenNthCalledWith(2, '/tmp/demo.html');
    expect(localFileResult).toEqual({ success: true });
    expect(absolutePathResult).toEqual({ success: true });
  });

  test('dispatches artifact anchor events locally', async () => {
    const result = await openGuidePreview('#artifact-report');

    expect(result).toEqual({ success: true });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    const dispatchedEvent = dispatchEvent.mock.calls[0]?.[0];
    expect(dispatchedEvent).toBeInstanceOf(MockCustomEvent);
    expect(dispatchedEvent?.type).toBe(GuidePreviewEvent.OpenArtifactAnchor);
  });

  test('rejects unsupported preview targets', async () => {
    const result = await openGuidePreview('relative/path/demo.html');

    expect(result).toEqual({
      success: false,
      error: 'Unsupported guide preview target.',
    });
    expect(openExternal).not.toHaveBeenCalled();
    expect(openPath).not.toHaveBeenCalled();
  });

  test('resolves scene anchors onto preview targets conservatively', () => {
    expect(resolveGuideScenePreviewTarget('https://example.com/demo', '#scene-2')).toBe('https://example.com/demo#scene-2');
    expect(resolveGuideScenePreviewTarget('localfile:///tmp/demo.html', '#scene-2')).toBe('localfile:///tmp/demo.html#scene-2');
    expect(resolveGuideScenePreviewTarget('/tmp/demo.html', '#scene-2')).toBe('file:///tmp/demo.html#scene-2');
    expect(resolveGuideScenePreviewTarget('https://example.com/demo', '#artifact-report')).toBe('https://example.com/demo');
  });

  test('opens scene-specific preview targets for html scenes', async () => {
    openExternal.mockResolvedValue({ success: true });

    const result = await openGuideScenePreview('/tmp/demo.html', '#scene-2');

    expect(result).toEqual({ success: true });
    expect(openExternal).toHaveBeenCalledWith('file:///tmp/demo.html#scene-2');
  });

  test('prefers local artifact anchor dispatch for artifact scenes', async () => {
    const result = await openGuideScenePreview('https://example.com/demo', '#artifact-report');

    expect(result).toEqual({ success: true });
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  test('resolves linked preview mode for bridge-compatible inline html', () => {
    expect(resolveGuidePreviewMode('/tmp/demo.html', {
      type: 'assistant',
      content: '<html data-qingshu-presentation="v1"><section data-guide-scene-id="scene-1"></section></html>',
      metadata: {},
    })).toBe(GuidePreviewMode.Linked);
  });

  test('prepares guide start context with linked scenes from the local html contract', async () => {
    readFileAsDataUrl.mockResolvedValue({
      success: true,
      dataUrl: `data:text/html;base64,${Buffer.from([
        '<!doctype html>',
        '<html data-qingshu-presentation="v1">',
        '<body>',
        '<section id="hero" data-guide-scene-id="scene-hero" data-guide-scene-title="首页概览"><h1>首页概览</h1></section>',
        '<section id="pricing" data-guide-scene-id="scene-pricing"><h2>价格卡片</h2></section>',
        '</body>',
        '</html>',
      ].join(''), 'utf8').toString('base64')}`,
    });

    const result = await prepareGuideStartContext({
      message: {
        id: 'message-1',
        type: 'assistant',
        content: '文件位置：/tmp/demo.html',
      },
      previewTarget: '/tmp/demo.html',
      scenes: [{ id: 'fallback', title: '概览', summary: '概览' }],
    });

    expect(result.success).toBe(true);
    expect(result.previewDescriptor?.mode).toBe(GuidePreviewMode.Linked);
    expect(result.scenes).toEqual([
      { id: 'scene-hero', title: '首页概览', summary: '首页概览', anchor: '#hero' },
      { id: 'scene-pricing', title: '价格卡片', summary: '价格卡片', anchor: '#pricing' },
    ]);
  });
});
