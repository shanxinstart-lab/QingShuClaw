import {
  DesktopAssistantReplySpeakMode,
  GuideStatus,
  type GuideScene,
  type GuideStatus as GuideStatusValue,
} from '../../../shared/desktopAssistant/constants';
import { buildSpeakableAssistantText } from './coworkTtsText';

const normalizeNarrationSegment = (value: string): string => {
  return buildSpeakableAssistantText(value)
    .replace(/\s[-–—]\s/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
};

export const buildGuideNarrationText = (
  scene: GuideScene | null | undefined,
  speakMode: typeof DesktopAssistantReplySpeakMode[keyof typeof DesktopAssistantReplySpeakMode] = DesktopAssistantReplySpeakMode.Summary,
): string => {
  if (!scene) {
    return '';
  }
  const title = normalizeNarrationSegment(scene.title);
  const summary = normalizeNarrationSegment(scene.summary);
  if (!title && !summary) {
    return '';
  }
  if (!title) {
    return speakMode === DesktopAssistantReplySpeakMode.Detailed
      ? `这一幕重点是：${summary}`
      : summary;
  }
  if (!summary || summary === title) {
    return speakMode === DesktopAssistantReplySpeakMode.Detailed
      ? `现在来到${title}。我先带你看这一幕的关键内容。`
      : title;
  }
  if (speakMode === DesktopAssistantReplySpeakMode.Detailed) {
    return `现在来到${title}。这一幕重点是：${summary}`;
  }
  return `${title}。${summary}`;
};

export const getGuideAutoAdvanceDelayMs = (
  scene: GuideScene | null | undefined,
  speakMode: typeof DesktopAssistantReplySpeakMode[keyof typeof DesktopAssistantReplySpeakMode] = DesktopAssistantReplySpeakMode.Summary,
): number => {
  const narration = buildGuideNarrationText(scene, speakMode);
  if (!narration) {
    return 600;
  }

  // 保守按中文讲解语速估一个停顿，给分幕切换和浏览器渲染留缓冲。
  return Math.min(12_000, Math.max(2_200, narration.length * 240 + 900));
};

export const shouldSuppressAssistantReplyAutoPlay = (input: {
  desktopAssistantEnabled: boolean;
  autoOpenPreviewGuide: boolean;
  autoEnterSceneGuide: boolean;
  latestMessageEligible: boolean;
  guideSessionStatus?: GuideStatusValue | null;
}): boolean => {
  if (
    input.guideSessionStatus === GuideStatus.Active
    || input.guideSessionStatus === GuideStatus.Paused
  ) {
    return true;
  }

  return input.desktopAssistantEnabled
    && input.autoOpenPreviewGuide
    && input.autoEnterSceneGuide
    && input.latestMessageEligible;
};
