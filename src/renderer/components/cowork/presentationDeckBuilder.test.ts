import { describe, expect, test } from 'vitest';
import { GuideSource, GuideStatus } from '../../../shared/desktopAssistant/constants';
import { PresentationLayoutHint } from '../../../shared/desktopAssistant/presentation';
import { buildPresentationDeck, buildPresentationDeckFromHtmlContent } from './presentationDeckBuilder';

describe('buildPresentationDeck', () => {
  test('builds a conservative presentation deck from guide session scenes', () => {
    const deck = buildPresentationDeck({
      sourceMessage: {
        id: 'message-1',
        type: 'assistant',
        content: '演示这个 HTML 页面\n## 第一幕\n内容',
        timestamp: Date.now(),
      },
      guideSession: {
        id: 'guide-1',
        sessionId: 'session-1',
        messageId: 'message-1',
        source: GuideSource.Manual,
        status: GuideStatus.Active,
        previewTarget: '/tmp/demo.html',
        currentSceneIndex: 0,
        scenes: [
          {
            id: 'scene-1',
            title: '第一页',
            summary: '介绍标题区。说明主要按钮。',
            anchor: '#hero',
          },
          {
            id: 'scene-2',
            title: '第二页',
            summary: '总结价格和卖点',
            anchor: '#pricing',
          },
        ],
      },
    });

    expect(deck.title).toContain('演示这个 HTML 页面');
    expect(deck.sourcePreviewTarget).toBe('/tmp/demo.html');
    expect(deck.scenes).toHaveLength(2);
    expect(deck.scenes[0]).toMatchObject({
      title: '第一页',
      sourceAnchor: '#hero',
      layoutHint: PresentationLayoutHint.Cover,
    });
    expect(deck.scenes[0].bullets).toEqual(['介绍标题区', '说明主要按钮']);
    expect(deck.scenes[1]).toMatchObject({
      title: '第二页',
      sourceAnchor: '#pricing',
      layoutHint: PresentationLayoutHint.Summary,
    });
  });

  test('can enrich the deck from html structure conservatively', () => {
    const deck = buildPresentationDeckFromHtmlContent({
      sourceMessage: {
        id: 'message-1',
        type: 'assistant',
        content: '演示这个 HTML 页面',
        timestamp: Date.now(),
      },
      guideSession: {
        id: 'guide-1',
        sessionId: 'session-1',
        messageId: 'message-1',
        source: GuideSource.Manual,
        status: GuideStatus.Active,
        previewTarget: '/tmp/demo.html',
        currentSceneIndex: 0,
        scenes: [{
          id: 'scene-1',
          title: '概览',
          summary: '默认概览',
        }],
      },
      htmlContent: `
        <html>
          <head><title>QingShu Demo</title></head>
          <body>
            <section id="hero"><h1>欢迎页</h1><p>介绍主标题和主要按钮。</p></section>
            <section id="pricing"><h2>价格卡片</h2><p>说明套餐与差异。</p></section>
          </body>
        </html>
      `,
    });

    expect(deck.title).toBe('QingShu Demo');
    expect(deck.scenes).toHaveLength(2);
    expect(deck.scenes[0]).toMatchObject({
      title: '欢迎页',
      sourceAnchor: '#hero',
    });
    expect(deck.scenes[1]).toMatchObject({
      title: '价格卡片',
      sourceAnchor: '#pricing',
    });
  });

  test('prefers showcase layout when a middle html section contains compact card blocks', () => {
    const deck = buildPresentationDeckFromHtmlContent({
      sourceMessage: {
        id: 'message-2',
        type: 'assistant',
        content: '演示这个指标看板',
        timestamp: Date.now(),
      },
      guideSession: {
        id: 'guide-2',
        sessionId: 'session-2',
        messageId: 'message-2',
        source: GuideSource.Manual,
        status: GuideStatus.Active,
        previewTarget: '/tmp/metrics.html',
        currentSceneIndex: 0,
        scenes: [{
          id: 'scene-1',
          title: '概览',
          summary: '默认概览',
        }],
      },
      htmlContent: `
        <html>
          <body>
            <section id="hero"><h1>运营总览</h1><p>查看整体趋势与关键指标。</p></section>
            <section id="metrics">
              <h2>核心指标</h2>
              <div><h3>覆盖 12 城市</h3></div>
              <div><h3>98% 准确率</h3></div>
              <div><h3>日均 2400 单</h3></div>
              <p>本幕聚焦核心经营数据。</p>
            </section>
            <section id="summary"><h2>收尾结论</h2><p>总结当前页的主要观察。</p></section>
          </body>
        </html>
      `,
    });

    expect(deck.scenes).toHaveLength(3);
    expect(deck.scenes[1]).toMatchObject({
      title: '核心指标',
      sourceAnchor: '#metrics',
      layoutHint: PresentationLayoutHint.Showcase,
    });
    expect(deck.scenes[1].bullets).toEqual(['覆盖 12 城市', '98% 准确率', '日均 2400 单']);
  });
});
