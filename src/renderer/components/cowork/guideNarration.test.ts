import { describe, expect, test } from 'vitest';
import { DesktopAssistantReplySpeakMode, GuideStatus } from '../../../shared/desktopAssistant/constants';
import {
  buildGuideNarrationText,
  getGuideAutoAdvanceDelayMs,
  shouldSuppressAssistantReplyAutoPlay,
} from './guideNarration';

describe('buildGuideNarrationText', () => {
  test('builds narration from title and summary conservatively', () => {
    expect(buildGuideNarrationText({
      id: 'scene-1',
      title: '第一幕',
      summary: '展示核心结果',
    })).toBe('第一幕。展示核心结果');
    expect(buildGuideNarrationText({
      id: 'scene-2',
      title: '概览',
      summary: '概览',
    })).toBe('概览');
    expect(buildGuideNarrationText({
      id: 'scene-3',
      title: '',
      summary: '只播报摘要',
    })).toBe('只播报摘要');
  });

  test('supports a more detailed guide narration mode', () => {
    expect(buildGuideNarrationText({
      id: 'scene-4',
      title: '价格卡片',
      summary: '说明套餐价格和差异',
    }, DesktopAssistantReplySpeakMode.Detailed)).toBe('现在来到价格卡片。这一幕重点是：说明套餐价格和差异');
  });

  test('sanitizes markdown-like symbols before narration playback', () => {
    expect(buildGuideNarrationText({
      id: 'scene-5',
      title: '**价格卡片**',
      summary: '1. **基础版** - 免费试用',
    })).toBe('价格卡片。基础版 免费试用');
  });

  test('returns a bounded auto-advance delay from narration length', () => {
    expect(getGuideAutoAdvanceDelayMs(null)).toBe(600);
    expect(getGuideAutoAdvanceDelayMs({
      id: 'scene-4',
      title: '概览',
      summary: '简短说明',
    })).toBeGreaterThanOrEqual(1200);
    expect(getGuideAutoAdvanceDelayMs({
      id: 'scene-5a',
      title: '价格卡片',
      summary: '说明套餐价格和差异',
    })).toBeGreaterThanOrEqual(2200);
    expect(getGuideAutoAdvanceDelayMs({
      id: 'scene-5',
      title: '价格卡片',
      summary: '说明套餐价格和差异',
    }, DesktopAssistantReplySpeakMode.Detailed)).toBeGreaterThan(
      getGuideAutoAdvanceDelayMs({
        id: 'scene-5',
        title: '价格卡片',
        summary: '说明套餐价格和差异',
      }, DesktopAssistantReplySpeakMode.Summary),
    );
  });
});

describe('shouldSuppressAssistantReplyAutoPlay', () => {
  test('suppresses assistant auto play when guide session is already active', () => {
    expect(shouldSuppressAssistantReplyAutoPlay({
      desktopAssistantEnabled: true,
      autoOpenPreviewGuide: true,
      autoEnterSceneGuide: true,
      latestMessageEligible: true,
      guideSessionStatus: GuideStatus.Active,
    })).toBe(true);
  });

  test('suppresses assistant auto play when the latest eligible message will auto-enter guide mode', () => {
    expect(shouldSuppressAssistantReplyAutoPlay({
      desktopAssistantEnabled: true,
      autoOpenPreviewGuide: true,
      autoEnterSceneGuide: true,
      latestMessageEligible: true,
      guideSessionStatus: null,
    })).toBe(true);
  });

  test('does not suppress assistant auto play when desktop assistant is idle or disabled', () => {
    expect(shouldSuppressAssistantReplyAutoPlay({
      desktopAssistantEnabled: false,
      autoOpenPreviewGuide: true,
      autoEnterSceneGuide: true,
      latestMessageEligible: true,
      guideSessionStatus: null,
    })).toBe(false);
    expect(shouldSuppressAssistantReplyAutoPlay({
      desktopAssistantEnabled: true,
      autoOpenPreviewGuide: false,
      autoEnterSceneGuide: true,
      latestMessageEligible: true,
      guideSessionStatus: null,
    })).toBe(false);
  });
});
