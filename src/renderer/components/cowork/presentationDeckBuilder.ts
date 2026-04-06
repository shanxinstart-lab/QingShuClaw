import type { CoworkMessage } from '../../types/cowork';
import type { GuideSession } from '../../../shared/desktopAssistant/constants';
import {
  PresentationLayoutHint,
  type PresentationDeck,
  type PresentationScene,
} from '../../../shared/desktopAssistant/presentation';
import { buildGuideNarrationText, getGuideAutoAdvanceDelayMs } from './guideNarration';

const FALLBACK_TITLE = '演示稿';
const MAX_HTML_SCENES = 6;
const MAX_SCENE_BULLETS = 4;

const toDeckTitle = (message: CoworkMessage | null | undefined): string => {
  const firstLine = message?.content
    ?.split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return FALLBACK_TITLE;
  }
  return firstLine.length > 40 ? `${firstLine.slice(0, 37)}...` : firstLine;
};

const splitSummaryIntoBullets = (summary: string): string[] => {
  const normalized = summary
    .split(/\n+/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');
  if (!normalized) {
    return [];
  }

  const parts = normalized
    .split(/[。！？；;]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 1) {
    return parts.slice(0, MAX_SCENE_BULLETS);
  }

  return [normalized];
};

const hasCompactBullets = (bullets: string[]): boolean => {
  return bullets.length >= 2 && bullets.every((bullet) => bullet.length <= 18);
};

const resolveLayoutHint = (input: {
  index: number;
  sceneCount: number;
  bullets: string[];
  preferShowcase?: boolean;
  preferSteps?: boolean;
}): typeof PresentationLayoutHint[keyof typeof PresentationLayoutHint] => {
  if (input.index === 0) {
    return PresentationLayoutHint.Cover;
  }
  if (input.index === input.sceneCount - 1) {
    return PresentationLayoutHint.Summary;
  }
  if (input.preferShowcase) {
    return PresentationLayoutHint.Showcase;
  }
  if (input.preferSteps) {
    return PresentationLayoutHint.Steps;
  }
  if (hasCompactBullets(input.bullets)) {
    return PresentationLayoutHint.Showcase;
  }
  if (input.bullets.length >= 3) {
    return PresentationLayoutHint.Steps;
  }
  return PresentationLayoutHint.Focus;
};

export const buildPresentationDeck = (input: {
  guideSession: GuideSession;
  sourceMessage?: CoworkMessage | null;
}): PresentationDeck => {
  const { guideSession, sourceMessage } = input;
  const scenes: PresentationScene[] = guideSession.scenes.map((scene, index) => {
    const narration = buildGuideNarrationText(scene);
    const bullets = splitSummaryIntoBullets(scene.summary);
    return {
      id: scene.id,
      title: scene.title || `第 ${index + 1} 幕`,
      narration,
      summary: scene.summary,
      bullets,
      sourceAnchor: scene.anchor,
      durationMs: getGuideAutoAdvanceDelayMs(scene),
      layoutHint: resolveLayoutHint({
        index,
        sceneCount: guideSession.scenes.length,
        bullets,
      }),
    };
  });

  const title = toDeckTitle(sourceMessage);
  return {
    id: `deck-${guideSession.id}`,
    title,
    subtitle: `${scenes.length} 幕自动讲解`,
    sourceMessageId: guideSession.messageId,
    sourcePreviewTarget: guideSession.previewTarget,
    scenes,
  };
};

const stripHtmlTags = (value: string): string => {
  return value
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/gu, ' ')
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/\s+/gu, ' ')
    .trim();
};

const extractHtmlTitle = (htmlContent: string): string | null => {
  const titleMatch = htmlContent.match(/<title[^>]*>([\s\S]*?)<\/title>/iu);
  const title = titleMatch?.[1] ? stripHtmlTags(titleMatch[1]) : '';
  return title || null;
};

type HtmlSectionCandidate = {
  title: string;
  summary: string;
  bullets: string[];
  anchor?: string;
  preferLayoutHint?: typeof PresentationLayoutHint[keyof typeof PresentationLayoutHint];
};

const truncateText = (value: string, maxLength: number): string => {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
};

const extractTagTexts = (body: string, tagName: string): string[] => {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'giu');
  return Array.from(body.matchAll(pattern))
    .map((match) => stripHtmlTags(match[1] || ''))
    .map((text) => text.trim())
    .filter(Boolean);
};

const uniqueTexts = (values: string[]): string[] => {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
};

const buildFallbackTitle = (summary: string, anchor?: string): string => {
  const firstSentence = summary.split(/[。！？.!?]/u).map((part) => part.trim()).find(Boolean);
  if (firstSentence) {
    return truncateText(firstSentence, 24);
  }
  return anchor ? anchor.replace(/^#/u, '') : '概览';
};

const extractHtmlSectionCandidates = (htmlContent: string): HtmlSectionCandidate[] => {
  const sectionPattern = /<(section|article|div)\b([^>]*)>([\s\S]*?)<\/\1>/giu;
  const candidates: HtmlSectionCandidate[] = [];
  for (const match of htmlContent.matchAll(sectionPattern)) {
    const attrs = match[2] || '';
    const body = match[3] || '';
    const idMatch = attrs.match(/\bid=(["']?)([A-Za-z][\w-]*)\1/iu);
    const anchor = idMatch?.[2] ? `#${idMatch[2]}` : undefined;
    const headingTexts = [
      ...extractTagTexts(body, 'h1'),
      ...extractTagTexts(body, 'h2'),
      ...extractTagTexts(body, 'h3'),
    ];
    const paragraphTexts = extractTagTexts(body, 'p');
    const listBullets = extractTagTexts(body, 'li').map((item) => truncateText(item, 40));
    const actionBullets = uniqueTexts([
      ...extractTagTexts(body, 'button'),
      ...extractTagTexts(body, 'a'),
    ]).map((item) => truncateText(item, 24));
    const cardBullets = headingTexts.slice(1).map((item) => truncateText(item, 28));
    const summarySource = paragraphTexts.find(Boolean) || stripHtmlTags(body);
    const summary = truncateText(summarySource, 140);
    const bullets = uniqueTexts([...listBullets, ...cardBullets, ...actionBullets]).slice(0, MAX_SCENE_BULLETS);
    const title = headingTexts[0] || buildFallbackTitle(summary, anchor);
    if (!title || !summary) {
      continue;
    }

    const hasOrderedList = /<ol\b/iu.test(body);
    const hasMetricBullets = bullets.some((bullet) => /(?:\d|%|¥|\$|万|亿)/u.test(bullet));
    const preferLayoutHint = hasOrderedList
      ? PresentationLayoutHint.Steps
      : (hasMetricBullets || hasCompactBullets(bullets))
        ? PresentationLayoutHint.Showcase
        : undefined;

    candidates.push({
      title,
      summary,
      bullets,
      anchor,
      preferLayoutHint,
    });
    if (candidates.length >= MAX_HTML_SCENES) {
      break;
    }
  }
  return candidates;
};

export const buildPresentationDeckFromHtmlContent = (input: {
  guideSession: GuideSession;
  htmlContent: string;
  sourceMessage?: CoworkMessage | null;
}): PresentationDeck => {
  const baseDeck = buildPresentationDeck({
    guideSession: input.guideSession,
    sourceMessage: input.sourceMessage,
  });
  const htmlCandidates = extractHtmlSectionCandidates(input.htmlContent);
  if (htmlCandidates.length === 0) {
    const htmlTitle = extractHtmlTitle(input.htmlContent);
    return htmlTitle ? {
      ...baseDeck,
      title: htmlTitle,
    } : baseDeck;
  }

  const scenes: PresentationScene[] = htmlCandidates.map((candidate, index) => {
    const bullets = candidate.bullets.length > 0
      ? candidate.bullets
      : splitSummaryIntoBullets(candidate.summary);
    const narration = [candidate.title, candidate.summary, ...bullets.slice(0, 2)].filter(Boolean).join('。');
    return {
      id: `html-scene-${index + 1}`,
      title: candidate.title,
      narration,
      summary: candidate.summary,
      bullets,
      sourceAnchor: candidate.anchor,
      durationMs: Math.min(8_000, Math.max(1_400, narration.length * 170)),
      layoutHint: resolveLayoutHint({
        index,
        sceneCount: htmlCandidates.length,
        bullets,
        preferShowcase: candidate.preferLayoutHint === PresentationLayoutHint.Showcase,
        preferSteps: candidate.preferLayoutHint === PresentationLayoutHint.Steps,
      }),
    };
  });

  return {
    ...baseDeck,
    title: extractHtmlTitle(input.htmlContent) || baseDeck.title,
    subtitle: `${scenes.length} 幕自动讲解`,
    scenes,
  };
};
