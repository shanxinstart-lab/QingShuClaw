import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  GuidePreviewMode,
  buildGuideScenesFromLinkedPresentationManifest,
  decodeTextDataUrl,
  extractLinkedPresentationManifestFromHtml,
  loadGuidePreviewDescriptor,
  resolveGuidePreviewMode,
  toGuidePreviewFileUrl,
} from './guidePresentationBridge';

const readFileAsDataUrl = vi.fn();

beforeEach(() => {
  readFileAsDataUrl.mockReset();
  vi.stubGlobal('window', {
    atob: (value: string) => Buffer.from(value, 'base64').toString('binary'),
    electron: {
      dialog: {
        readFileAsDataUrl,
      },
    },
  });
});

describe('extractLinkedPresentationManifestFromHtml', () => {
  test('extracts linked scenes from presentation html contract', () => {
    const manifest = extractLinkedPresentationManifestFromHtml([
      '<!doctype html>',
      '<html data-qingshu-presentation="v1">',
      '<head><title>演示标题</title></head>',
      '<body>',
      '<main>',
      '<section id="hero" data-guide-scene-id="scene-hero" data-guide-scene-title="首页概览"><h1>首页概览</h1></section>',
      '<section id="pricing" data-guide-scene-id="scene-pricing"><h2>价格卡片</h2></section>',
      '</main>',
      '</body>',
      '</html>',
    ].join(''));

    expect(manifest).toEqual({
      version: 'v1',
      title: '演示标题',
      scenes: [
        { id: 'scene-hero', title: '首页概览', anchor: '#hero' },
        { id: 'scene-pricing', title: '价格卡片', anchor: '#pricing' },
      ],
    });
  });

  test('returns null for ordinary html without the linked presentation root marker', () => {
    expect(extractLinkedPresentationManifestFromHtml('<html><body><section id="hero">Hello</section></body></html>')).toBeNull();
  });
});

describe('guidePresentationBridge helpers', () => {
  test('builds guide scenes from a linked manifest', () => {
    const scenes = buildGuideScenesFromLinkedPresentationManifest({
      version: 'v1',
      scenes: [
        { id: 'scene-1', title: '第一页', anchor: '#hero' },
        { id: 'scene-2', title: '第二页', anchor: '#pricing' },
      ],
    });

    expect(scenes).toEqual([
      { id: 'scene-1', title: '第一页', summary: '第一页', anchor: '#hero' },
      { id: 'scene-2', title: '第二页', summary: '第二页', anchor: '#pricing' },
    ]);
  });

  test('resolves preview mode conservatively and preserves artifact mode', () => {
    expect(resolveGuidePreviewMode('#artifact-demo')).toBe(GuidePreviewMode.Artifact);
    expect(resolveGuidePreviewMode('/tmp/demo.html')).toBe(GuidePreviewMode.External);
    expect(resolveGuidePreviewMode('/tmp/demo.html', {
      type: 'assistant',
      content: '<html data-qingshu-presentation="v1"><section data-guide-scene-id="scene-1"></section></html>',
      metadata: {},
    })).toBe(GuidePreviewMode.Linked);
  });

  test('decodes data urls and resolves local file preview urls', () => {
    const dataUrl = `data:text/html;base64,${Buffer.from('<html></html>', 'utf8').toString('base64')}`;
    expect(decodeTextDataUrl(dataUrl)).toBe('<html></html>');
    expect(toGuidePreviewFileUrl('/tmp/demo file.html')).toBe('file:///tmp/demo%20file.html');
  });

  test('loads linked preview descriptors from local html files', async () => {
    readFileAsDataUrl.mockResolvedValue({
      success: true,
      dataUrl: `data:text/html;base64,${Buffer.from([
        '<!doctype html>',
        '<html data-qingshu-presentation="v1">',
        '<body>',
        '<section id="hero" data-guide-scene-id="scene-hero"><h1>首页概览</h1></section>',
        '</body>',
        '</html>',
      ].join(''), 'utf8').toString('base64')}`,
    });

    const descriptor = await loadGuidePreviewDescriptor({
      previewTarget: '/tmp/demo.html',
    });

    expect(descriptor.mode).toBe(GuidePreviewMode.Linked);
    expect(descriptor.previewUrl).toBe('file:///tmp/demo.html');
    expect(descriptor.linkedManifest?.scenes[0]?.id).toBe('scene-hero');
  });

  test('falls back to external mode when the local html cannot be parsed as linked', async () => {
    readFileAsDataUrl.mockResolvedValue({
      success: true,
      dataUrl: `data:text/html;base64,${Buffer.from('<html><body><section id="hero">hello</section></body></html>', 'utf8').toString('base64')}`,
    });

    const descriptor = await loadGuidePreviewDescriptor({
      previewTarget: '/tmp/demo.html',
    });

    expect(descriptor.mode).toBe(GuidePreviewMode.External);
    expect(descriptor.linkedManifest).toBeNull();
  });
});
