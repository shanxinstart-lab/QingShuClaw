import type { GuideSession } from '../../../shared/desktopAssistant/constants';

export const GuideVoiceCommandAction = {
  NextScene: 'next_scene',
  PreviousScene: 'previous_scene',
  PauseGuide: 'pause_guide',
  ResumeGuide: 'resume_guide',
  StopGuide: 'stop_guide',
  ReplayScene: 'replay_scene',
  FirstScene: 'first_scene',
  SummaryScene: 'summary_scene',
} as const;
export type GuideVoiceCommandAction = typeof GuideVoiceCommandAction[keyof typeof GuideVoiceCommandAction];

export interface GuideVoiceCommandResult {
  action: GuideVoiceCommandAction | null;
  matchedPhrase: string | null;
}

const GUIDE_COMMAND_BY_PHRASE: Record<string, GuideVoiceCommandAction> = {
  '下一步讲解': GuideVoiceCommandAction.NextScene,
  '上一步讲解': GuideVoiceCommandAction.PreviousScene,
  '暂停讲解': GuideVoiceCommandAction.PauseGuide,
  '继续讲解': GuideVoiceCommandAction.ResumeGuide,
  '停止讲解': GuideVoiceCommandAction.StopGuide,
  '重讲这一幕': GuideVoiceCommandAction.ReplayScene,
  '回到第一页': GuideVoiceCommandAction.FirstScene,
  '回到第一幕': GuideVoiceCommandAction.FirstScene,
  '跳到总结': GuideVoiceCommandAction.SummaryScene,
};

export const resolveGuideVoiceCommand = (
  speechText: string,
  guideSession: GuideSession | null,
): GuideVoiceCommandResult => {
  if (!guideSession || (guideSession.status !== 'active' && guideSession.status !== 'paused')) {
    return { action: null, matchedPhrase: null };
  }

  const normalizedText = speechText.trim().replace(/[。！？，、,.!?;:\s]+$/u, '');
  for (const [phrase, action] of Object.entries(GUIDE_COMMAND_BY_PHRASE)) {
    if (normalizedText === phrase) {
      return { action, matchedPhrase: phrase };
    }
  }

  return { action: null, matchedPhrase: null };
};
