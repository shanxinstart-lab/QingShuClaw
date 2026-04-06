import { describe, expect, test } from 'vitest';
import { GuideStatus } from '../../../shared/desktopAssistant/constants';
import { GuideVoiceCommandAction, resolveGuideVoiceCommand } from './guideVoiceCommand';

const activeGuideSession = {
  id: 'guide-1',
  sessionId: 'session-1',
  messageId: 'message-1',
  source: 'manual' as const,
  status: GuideStatus.Active,
  previewTarget: 'https://example.com',
  scenes: [],
  currentSceneIndex: 0,
};

describe('resolveGuideVoiceCommand', () => {
  test('matches explicit guide commands only when guide is active', () => {
    expect(resolveGuideVoiceCommand('下一步讲解', activeGuideSession)).toEqual({
      action: GuideVoiceCommandAction.NextScene,
      matchedPhrase: '下一步讲解',
    });
    expect(resolveGuideVoiceCommand('重讲这一幕', activeGuideSession)).toEqual({
      action: GuideVoiceCommandAction.ReplayScene,
      matchedPhrase: '重讲这一幕',
    });
    expect(resolveGuideVoiceCommand('停止讲解', {
      ...activeGuideSession,
      status: GuideStatus.Paused,
    })).toEqual({
      action: GuideVoiceCommandAction.StopGuide,
      matchedPhrase: '停止讲解',
    });
  });

  test('keeps send and cancel commands outside the guide parser', () => {
    expect(resolveGuideVoiceCommand('发送', activeGuideSession).action).toBeNull();
    expect(resolveGuideVoiceCommand('取消', activeGuideSession).action).toBeNull();
  });

  test('supports explicit first-scene and summary jumps', () => {
    expect(resolveGuideVoiceCommand('回到第一页', activeGuideSession).action).toBe(GuideVoiceCommandAction.FirstScene);
    expect(resolveGuideVoiceCommand('跳到总结', activeGuideSession).action).toBe(GuideVoiceCommandAction.SummaryScene);
  });

  test('does not trigger when guide session is missing', () => {
    expect(resolveGuideVoiceCommand('下一步讲解', null)).toEqual({
      action: null,
      matchedPhrase: null,
    });
  });
});
