import type { Skill } from '../../types/skill';
import { DesktopAssistantMessageMetadataKey } from '../../../shared/desktopAssistant/constants';

export const DesktopAssistantAutoSkill = {
  PresentationHtml: 'presentation-html',
} as const;
export type DesktopAssistantAutoSkill =
  typeof DesktopAssistantAutoSkill[keyof typeof DesktopAssistantAutoSkill];

const PRESENTATION_INTENT_PATTERN = /(演示稿|演示页|演示模式|讲解页|讲解模式|讲解用|逐幕|分幕|用于演示|用于讲解|演示|讲解|ppt|幻灯|slides?|slide deck|walkthrough|guided walkthrough|guide page|demo(?:\s+page)?)/iu;
const GENERATE_INTENT_PATTERN = /(生成|制作|创建|输出|做一个|写一个|给我一个|帮我做|帮我生成|generate|create|build|make)/iu;
const STRONG_HTML_TARGET_PATTERN = /(html|网页|web page|landing page|demo page|previewable|可预览)/iu;
const PAGE_TARGET_PATTERN = /(页|页面|单页|落地页)/iu;
const PRESENTATION_HTML_RUNTIME_CONTRACT = [
  '## Presentation HTML Runtime Contract',
  'When this skill is attached, prefer writing a real local HTML file with the available file tools instead of replying with inline HTML only.',
  'The default expected behavior is:',
  '1. Create a single-file HTML page in the current workspace.',
  '2. Prefer a stable path under ./artifacts/presentation/ or another clear local subdirectory.',
  '3. Reply with an absolute local file path using the exact label: 文件位置：/absolute/path/to/file.html',
  '4. Do not return only a ```html``` code block unless writing a local file truly failed.',
  '',
  '## Linked Presentation Contract',
  'When the user asks for a demo page, presentation page, walkthrough page, or scene-by-scene guide page, make the HTML bridge-compatible by default.',
  'Required structure for bridge-compatible output:',
  '1. Add data-qingshu-presentation="v1" to the root html/body/main container.',
  '2. Mark every major scene section with data-guide-scene-id="stable-scene-id".',
  '3. Prefer also adding a stable DOM id for every scene section so file://...#anchor fallback still works.',
  '4. Prefer data-guide-scene-title on each scene section when the visible heading is not stable enough.',
  '5. Include a small inline script that listens to window.postMessage commands: handshake, goToScene, highlightScene, setPlaybackStatus.',
  '6. On handshake, post back a ready event to the parent window.',
  '7. On goToScene/highlightScene, scroll the target scene into view and apply an active scene class.',
  '8. Do not add audio playback to the HTML itself; QingShuClaw handles narration TTS.',
].join('\n');

export const shouldAutoAttachPresentationHtmlSkill = (input: {
  prompt: string;
  desktopAssistantEnabled: boolean;
}): boolean => {
  if (!input.desktopAssistantEnabled) {
    return false;
  }

  const prompt = input.prompt.trim();
  if (!prompt) {
    return false;
  }

  const hasGenerateIntent = GENERATE_INTENT_PATTERN.test(prompt);
  const hasStrongHtmlTarget = STRONG_HTML_TARGET_PATTERN.test(prompt);
  const hasPageTarget = PAGE_TARGET_PATTERN.test(prompt);
  const hasPresentationIntent = PRESENTATION_INTENT_PATTERN.test(prompt);

  return hasGenerateIntent
    && hasPresentationIntent
    && (hasStrongHtmlTarget || hasPageTarget);
};

export const resolveAutoAttachedDesktopAssistantSkill = (input: {
  prompt: string;
  desktopAssistantEnabled: boolean;
  skills: Skill[];
  activeSkillIds: string[];
}): Skill | null => {
  if (!shouldAutoAttachPresentationHtmlSkill({
    prompt: input.prompt,
    desktopAssistantEnabled: input.desktopAssistantEnabled,
  })) {
    return null;
  }

  return input.skills.find((skill) => (
    skill.id === DesktopAssistantAutoSkill.PresentationHtml
    && skill.enabled
    && !input.activeSkillIds.includes(skill.id)
  )) ?? null;
};

export const buildDesktopAssistantAutoSkillMetadata = (
  skill: Skill | null | undefined,
): Record<string, unknown> | undefined => {
  if (!skill) {
    return undefined;
  }

  return {
    [DesktopAssistantMessageMetadataKey.AutoAttachedSkillIds]: [skill.id],
  };
};

export const buildAutoAttachedPresentationHtmlRuntimeContract = (
  skill: Skill | null | undefined,
): string | undefined => {
  if (!skill || skill.id !== DesktopAssistantAutoSkill.PresentationHtml) {
    return undefined;
  }

  return PRESENTATION_HTML_RUNTIME_CONTRACT;
};

export const getDesktopAssistantAutoAttachedSkillIds = (
  metadata: Record<string, unknown> | null | undefined,
): string[] => {
  const rawValue = metadata?.[DesktopAssistantMessageMetadataKey.AutoAttachedSkillIds];
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
};
