import { describe, expect, test } from 'vitest';
import {
  PresentationLayoutHint,
  PresentationPlaybackStatus,
  type PresentationDeck,
} from '../../../../shared/desktopAssistant/presentation';
import { buildPresentationRuntimeHtml } from './presentationRuntimeDocument';

const createDeck = (): PresentationDeck => ({
  id: 'deck-1',
  title: '演示稿标题',
  subtitle: '3 幕自动讲解',
  sourceMessageId: 'message-1',
  sourcePreviewTarget: '/tmp/demo.html',
  scenes: [
    {
      id: 'scene-1',
      title: '第一页',
      narration: '第一页讲解词',
      summary: '第一页摘要',
      bullets: ['亮点一', '亮点二'],
      sourceAnchor: '#hero',
      durationMs: 1800,
      layoutHint: PresentationLayoutHint.Cover,
    },
    {
      id: 'scene-2',
      title: '第二页',
      narration: '第二页讲解词',
      summary: '第二页摘要',
      bullets: ['步骤一', '步骤二'],
      sourceAnchor: '#steps',
      durationMs: 2400,
      layoutHint: PresentationLayoutHint.Steps,
    },
    {
      id: 'scene-3',
      title: '第三页',
      narration: '第三页讲解词',
      summary: '第三页摘要',
      bullets: ['覆盖 12 城市', '98% 准确率', '日均 2400 单'],
      sourceAnchor: '#metrics',
      durationMs: 2600,
      layoutHint: PresentationLayoutHint.Showcase,
    },
  ],
});

describe('buildPresentationRuntimeHtml', () => {
  test('renders the current scene into a standalone presentation document', () => {
    const html = buildPresentationRuntimeHtml({
      deck: createDeck(),
      currentSceneIndex: 1,
      playbackStatus: PresentationPlaybackStatus.Active,
    });

    expect(html).toContain('演示稿标题');
    expect(html).toContain('第二页');
    expect(html).toContain('步骤一');
    expect(html).toContain('active');
    expect(html).toContain('/tmp/demo.html');
  });

  test('renders showcase scenes as animated cards', () => {
    const html = buildPresentationRuntimeHtml({
      deck: createDeck(),
      currentSceneIndex: 2,
      playbackStatus: PresentationPlaybackStatus.Active,
    });

    expect(html).toContain('scene-showcase');
    expect(html).toContain('scene-card-grid');
    expect(html).toContain('覆盖 12 城市');
    expect(html).toContain('98% 准确率');
  });
});
