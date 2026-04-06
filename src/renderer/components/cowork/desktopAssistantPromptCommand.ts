export const DesktopAssistantPromptCommandAction = {
  StartLatestGuide: 'start_latest_guide',
} as const;
export type DesktopAssistantPromptCommandAction =
  typeof DesktopAssistantPromptCommandAction[keyof typeof DesktopAssistantPromptCommandAction];

export interface DesktopAssistantPromptCommandResult {
  action: DesktopAssistantPromptCommandAction | null;
  matchedText: string | null;
}

const START_LATEST_GUIDE_PATTERN = /^(?:(?:请|帮我|麻烦)?(?:用)?桌面助手)?(?:来)?(?:演示|讲解|介绍)(?:一下)?(?:上面的?|这个|该)?(?:html|页面|网页|预览|结果)(?:吧|呀|啊|哦)?$/iu;
const START_GUIDE_SHORT_PATTERN = /^(?:开始|启动|进入)(?:一下)?(?:讲解|演示)(?:吧|呀|啊|哦)?$/iu;

export const resolveDesktopAssistantPromptCommand = (
  prompt: string,
): DesktopAssistantPromptCommandResult => {
  const normalizedText = prompt.trim().replace(/\s+/gu, '').replace(/[。！？，、,.!?;:：]+$/u, '');
  if (!normalizedText) {
    return { action: null, matchedText: null };
  }

  if (START_LATEST_GUIDE_PATTERN.test(normalizedText)) {
    return {
      action: DesktopAssistantPromptCommandAction.StartLatestGuide,
      matchedText: normalizedText,
    };
  }

  if (START_GUIDE_SHORT_PATTERN.test(normalizedText)) {
    return {
      action: DesktopAssistantPromptCommandAction.StartLatestGuide,
      matchedText: normalizedText,
    };
  }

  return { action: null, matchedText: null };
};
