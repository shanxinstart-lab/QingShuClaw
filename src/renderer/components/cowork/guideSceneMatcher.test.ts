import { describe, expect, test } from 'vitest';
import { GuideStatus } from '../../../shared/desktopAssistant/constants';
import { matchGuideSceneForQuery } from './guideSceneMatcher';

const createGuideSession = () => ({
  id: 'guide-1',
  sessionId: 'session-1',
  messageId: 'message-1',
  source: 'manual' as const,
  status: GuideStatus.Active,
  previewTarget: '/tmp/demo.html',
  currentSceneIndex: 1,
  scenes: [
    { id: 'scene-1', title: '首页概览', summary: '介绍产品定位和进入方式。' },
    { id: 'scene-2', title: '价格卡片', summary: '说明套餐价格和差异。' },
    { id: 'scene-3', title: '总结结论', summary: '回收主要结论和下一步建议。' },
  ],
});

describe('matchGuideSceneForQuery', () => {
  test('supports explicit scene jumps', () => {
    expect(matchGuideSceneForQuery('回到第一页', createGuideSession())?.sceneIndex).toBe(0);
    expect(matchGuideSceneForQuery('跳到总结', createGuideSession())?.sceneIndex).toBe(2);
    expect(matchGuideSceneForQuery('回到第2幕', createGuideSession())?.sceneIndex).toBe(1);
    expect(matchGuideSceneForQuery('重讲这一幕', createGuideSession())?.sceneIndex).toBe(1);
  });

  test('matches a scene conservatively by title keyword', () => {
    const result = matchGuideSceneForQuery('价格怎么设计的？', createGuideSession());
    expect(result).toMatchObject({
      sceneIndex: 1,
      reason: 'title_keyword',
      matchedText: '价格',
    });
  });

  test('rejects ambiguous or weak matches', () => {
    expect(matchGuideSceneForQuery('讲一下这个页面', createGuideSession())).toBeNull();
    expect(matchGuideSceneForQuery('', createGuideSession())).toBeNull();
    expect(matchGuideSceneForQuery('回到第一页', {
      ...createGuideSession(),
      status: GuideStatus.Stopped,
    })).toBeNull();
  });
});
