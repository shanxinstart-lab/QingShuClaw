import type { CoworkMessage } from '../../types/cowork';
import type { GuideScene } from '../../../shared/desktopAssistant/constants';
import {
  DesktopAssistantAutoSkill,
  getDesktopAssistantAutoAttachedSkillIds,
} from './desktopAssistantSkillRouting';
import {
  buildGuideScenesFromLinkedPresentationManifest,
  extractLinkedPresentationManifestFromHtml,
} from './guidePresentationBridge';

export interface GuideContentParseResult {
  eligible: boolean;
  previewTarget: string | null;
  scenes: GuideScene[];
}

export interface GuideContentResolveOptions {
  cwd?: string;
}

const MARKDOWN_HEADING_PATTERN = /^(#{2,3})\s+(.+?)\s*$/gmu;
const ORDERED_LIST_PATTERN = /^\s*\d+\.\s+(.+?)\s*$/gmu;
const HEADING_INLINE_ANCHOR_PATTERN = /^(.*?)\s*\[(?:anchor|锚点)\s*[:：=]\s*(#[A-Za-z0-9_-]+)\]\s*$/u;
const SCENE_BODY_ANCHOR_PATTERN = /^(?:anchor|锚点)\s*[:：=]\s*(#[A-Za-z0-9_-]+)\s*$/imu;
const HTML_CODE_BLOCK_PATTERN = /```(?:(?:artifact:)?html)\b[^\n]*\n([\s\S]*?)```/iu;
const MARKDOWN_LINK_PATTERN = /\[[^\]]*\]\(([^)]+)\)/gu;
const MAX_HTML_SCENES = 6;
const RELATIVE_HTML_PATH_AFTER_SEPARATOR_PATTERN = /[：:=]((?:\.\.?(?:\/|\\)|(?:[^\\/\s)\]]+(?:\/|\\))+|[^\\/\s)\]]+\.(?:html?|xhtml))[^\s)\]]*)$/iu;
const RELATIVE_HTML_PATH_STANDALONE_PATTERN = /^((?:\.\.?(?:\/|\\)|(?:[^\\/\s)\]]+(?:\/|\\))+|[^\\/\s)\]]+\.(?:html?|xhtml))[^\s)\]]*)$/iu;

const normalizeTarget = (target: string): string => {
  return target.trim().replace(/^[([{"'`]+/u, '').replace(/[)\],.;!?}"'`]+$/u, '');
};

const hasScheme = (value: string): boolean => /^[A-Za-z][A-Za-z\d+.-]*:/u.test(value);

const isAbsolutePath = (value: string): boolean => /^\/(?!\/)/u.test(value);

const isRelativePath = (value: string): boolean => (
  /^(?:\.\.?(?:\/|\\)|(?:[^\\/\s<>:"|?*]+(?:\/|\\))+[^\\/\s<>:"|?*]+|[^\\/\s<>:"|?*]+\.(?:html?|xhtml))(?:[?#][^\s]*)?$/iu.test(value)
);

const stripFileProtocol = (value: string): string => value.replace(/^file:\/\//iu, '');

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const stripHashAndQuery = (value: string): string => value.replace(/[?#].*$/u, '');

const toAbsolutePathFromCwd = (filePath: string, cwd: string): string => {
  if (isAbsolutePath(filePath)) {
    return filePath;
  }
  return `${cwd.replace(/\/$/, '')}/${filePath.replace(/^\.\//u, '')}`;
};

const normalizeLocalPath = (
  value: string,
): { path: string; isRelative: boolean; isAbsolute: boolean } | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const fileScheme = /^file:\/\//iu.test(trimmed);
  const schemePresent = hasScheme(trimmed);
  if (schemePresent && !fileScheme && !isAbsolutePath(trimmed)) {
    return null;
  }

  let raw = trimmed;
  if (fileScheme) {
    raw = stripFileProtocol(raw);
  }
  raw = stripHashAndQuery(raw);
  if (!raw) {
    return null;
  }

  const isAbsolute = isAbsolutePath(raw);
  const isRelative = isRelativePath(raw);
  if (!isAbsolute && !isRelative) {
    return null;
  }

  return { path: raw, isRelative, isAbsolute };
};

const resolvePreviewTarget = (
  target: string,
  options?: GuideContentResolveOptions,
): string | null => {
  const normalizedTarget = normalizeTarget(target);
  if (!normalizedTarget) {
    return null;
  }

  if (
    /^https?:\/\//iu.test(normalizedTarget)
    || /^localfile:\/\//iu.test(normalizedTarget)
    || /^#artifact-[A-Za-z0-9_-]+$/u.test(normalizedTarget)
  ) {
    return normalizedTarget;
  }

  if (/^file:\/\//iu.test(normalizedTarget)) {
    const filePath = stripHashAndQuery(stripFileProtocol(normalizedTarget));
    return isAbsolutePath(filePath) ? filePath : null;
  }

  const localPath = normalizeLocalPath(normalizedTarget);
  if (!localPath) {
    return null;
  }
  if (localPath.isAbsolute) {
    return localPath.path;
  }
  if (localPath.isRelative && options?.cwd) {
    return toAbsolutePathFromCwd(localPath.path, options.cwd);
  }
  return null;
};

const extractTargetFromToken = (token: string): string | null => {
  const normalizedToken = normalizeTarget(token);
  const httpMatch = normalizedToken.match(/https?:\/\/[^\s)]+/u);
  if (httpMatch) {
    return normalizeTarget(httpMatch[0]);
  }

  const localFileMatch = normalizedToken.match(/localfile:\/\/[^\s)]+/u);
  if (localFileMatch) {
    return normalizeTarget(localFileMatch[0]);
  }

  const fileUrlMatch = normalizedToken.match(/file:\/\/[^\s)]+/iu);
  if (fileUrlMatch) {
    return normalizeTarget(fileUrlMatch[0]);
  }

  if (/[<>]/u.test(normalizedToken)) {
    return null;
  }

  const absolutePathMatch = normalizedToken.match(/(?:^|[：:=\s([])(\/(?!\/)[^\s)\]]+)/u);
  if (absolutePathMatch) {
    return normalizeTarget(absolutePathMatch[1]);
  }

  const artifactMatch = normalizedToken.match(/#artifact-[A-Za-z0-9_-]+/u);
  if (artifactMatch) {
    return normalizeTarget(artifactMatch[0]);
  }

  const relativePathAfterSeparatorMatch = normalizedToken.match(RELATIVE_HTML_PATH_AFTER_SEPARATOR_PATTERN);
  if (relativePathAfterSeparatorMatch) {
    return normalizeTarget(relativePathAfterSeparatorMatch[1]);
  }

  const relativePathStandaloneMatch = normalizedToken.match(RELATIVE_HTML_PATH_STANDALONE_PATTERN);
  if (relativePathStandaloneMatch) {
    return normalizeTarget(relativePathStandaloneMatch[1]);
  }

  return null;
};

const collectUniqueTargetsFromText = (
  text: string,
  options?: GuideContentResolveOptions,
): string[] => {
  if (!text.trim()) {
    return [];
  }

  const markdownLinkTargets = Array.from(text.matchAll(MARKDOWN_LINK_PATTERN))
    .map((match) => match[1] || '')
    .map((target) => resolvePreviewTarget(target, options))
    .filter((token): token is string => Boolean(token));

  const textWithoutMarkdownLinks = text.replace(MARKDOWN_LINK_PATTERN, ' ');
  const tokenTargets = textWithoutMarkdownLinks
    .split(/\s+/u)
    .map(extractTargetFromToken)
    .map((target) => (target ? resolvePreviewTarget(target, options) : null))
    .filter((token): token is string => Boolean(token));

  return Array.from(new Set([
    ...markdownLinkTargets,
    ...tokenTargets,
  ]));
};

const collectUniqueTargetsFromUnknown = (
  value: unknown,
  options?: GuideContentResolveOptions,
): string[] => {
  if (typeof value === 'string') {
    return collectUniqueTargetsFromText(value, options);
  }

  if (Array.isArray(value)) {
    return Array.from(new Set(
      value.flatMap((item) => collectUniqueTargetsFromUnknown(item, options)),
    ));
  }

  if (isPlainObject(value)) {
    return Array.from(new Set(
      Object.values(value).flatMap((item) => collectUniqueTargetsFromUnknown(item, options)),
    ));
  }

  return [];
};

const collectUniqueTargetsFromMessage = (
  message: Pick<CoworkMessage, 'content' | 'metadata'>,
  options?: GuideContentResolveOptions,
): string[] => {
  const metadataPreviewTarget = typeof message.metadata?.previewTarget === 'string'
    ? resolvePreviewTarget(message.metadata.previewTarget, options)
    : null;
  const metadataArtifactAnchor = typeof message.metadata?.artifactAnchor === 'string'
    ? resolvePreviewTarget(message.metadata.artifactAnchor, options)
    : null;
  const metadataToolResultTargets = typeof message.metadata?.toolResult === 'string'
    ? collectUniqueTargetsFromText(message.metadata.toolResult, options)
    : [];
  const metadataErrorTargets = typeof message.metadata?.error === 'string'
    ? collectUniqueTargetsFromText(message.metadata.error, options)
    : [];
  const metadataToolInputTargets = collectUniqueTargetsFromUnknown(message.metadata?.toolInput, options);

  return Array.from(new Set([
    ...collectUniqueTargetsFromText(message.content, options),
    ...(metadataPreviewTarget ? [metadataPreviewTarget] : []),
    ...(metadataArtifactAnchor ? [metadataArtifactAnchor] : []),
    ...metadataToolResultTargets,
    ...metadataToolInputTargets,
    ...metadataErrorTargets,
  ].filter(Boolean)));
};

const collectUniqueTargets = (
  message: CoworkMessage,
  options?: GuideContentResolveOptions,
): string[] => {
  return collectUniqueTargetsFromMessage(message, options);
};

const normalizeSceneSummary = (value: string): string => {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
};

const buildHeadingScenes = (content: string): GuideScene[] => {
  const matches = Array.from(content.matchAll(MARKDOWN_HEADING_PATTERN));
  return matches.map((match, index) => {
    const rawTitle = match[2].trim();
    const bodyStart = match.index + match[0].length;
    const bodyEnd = index + 1 < matches.length
      ? matches[index + 1].index
      : content.length;
    const rawBody = content.slice(bodyStart, bodyEnd).trim();
    const inlineAnchorMatch = rawTitle.match(HEADING_INLINE_ANCHOR_PATTERN);
    const bodyAnchorMatch = rawBody.match(SCENE_BODY_ANCHOR_PATTERN);
    const title = inlineAnchorMatch?.[1]?.trim() || rawTitle;
    const anchor = inlineAnchorMatch?.[2]?.trim()
      || bodyAnchorMatch?.[1]?.trim()
      || undefined;
    const summaryBody = bodyAnchorMatch
      ? rawBody.replace(bodyAnchorMatch[0], '').trim()
      : rawBody;
    const summary = normalizeSceneSummary(summaryBody) || title;

    return {
      id: `heading-${index + 1}`,
      title,
      summary,
      anchor,
    };
  });
};

const buildOrderedListScenes = (content: string): GuideScene[] => {
  const matches = Array.from(content.matchAll(ORDERED_LIST_PATTERN));
  return matches.map((match, index) => ({
    id: `step-${index + 1}`,
    title: `步骤 ${index + 1}`,
    summary: match[1].trim(),
  }));
};

const buildFallbackScene = (content: string): GuideScene[] => {
  const summary = content.trim().split(/\n+/u).find((line) => line.trim())?.trim() ?? '概览';
  return [{
    id: 'overview',
    title: '概览',
    summary,
  }];
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

const extractInlineHtmlContent = (content: string): string | null => {
  const codeBlockMatch = content.match(HTML_CODE_BLOCK_PATTERN);
  const candidate = codeBlockMatch?.[1]?.trim() || content.trim();
  if (!candidate) {
    return null;
  }

  if (/(<!doctype\s+html|<html\b|<body\b|<main\b|<section\b|<article\b|<div\b)/iu.test(candidate)) {
    return candidate;
  }

  return null;
};

export const extractInlineGuideHtmlContent = (
  message: Pick<CoworkMessage, 'type' | 'content' | 'metadata'> | null | undefined,
): string | null => {
  if (!message || message.type !== 'assistant' || message.metadata?.isStreaming) {
    return null;
  }

  return extractInlineHtmlContent(message.content);
};

const buildHtmlScenesFromContent = (htmlContent: string): GuideScene[] => {
  const linkedManifest = extractLinkedPresentationManifestFromHtml(htmlContent);
  if (linkedManifest) {
    return buildGuideScenesFromLinkedPresentationManifest(linkedManifest);
  }

  const sectionPattern = /<(section|article|div)\b([^>]*)>([\s\S]*?)<\/\1>/giu;
  const scenes: GuideScene[] = [];
  for (const match of htmlContent.matchAll(sectionPattern)) {
    const attrs = match[2] || '';
    const body = match[3] || '';
    const idMatch = attrs.match(/\bid=(["']?)([A-Za-z][\w-]*)\1/iu);
    const anchor = idMatch?.[2] ? `#${idMatch[2]}` : undefined;
    const headings = [
      ...extractTagTexts(body, 'h1'),
      ...extractTagTexts(body, 'h2'),
      ...extractTagTexts(body, 'h3'),
    ];
    const paragraphs = extractTagTexts(body, 'p');
    const listItems = extractTagTexts(body, 'li');
    const summary = truncateText(
      paragraphs.find(Boolean)
      || listItems.find(Boolean)
      || stripHtmlTags(body),
      140,
    );
    const title = headings[0] || anchor?.replace(/^#/u, '') || '概览';
    if (!title || !summary) {
      continue;
    }
    scenes.push({
      id: `html-scene-${scenes.length + 1}`,
      title,
      summary,
      anchor,
    });
    if (scenes.length >= MAX_HTML_SCENES) {
      break;
    }
  }

  if (scenes.length > 0) {
    return scenes;
  }

  const title = extractTagTexts(htmlContent, 'title')[0]
    || extractTagTexts(htmlContent, 'h1')[0]
    || '概览';
  const summary = truncateText(stripHtmlTags(htmlContent), 140) || title;
  return [{
    id: 'html-overview',
    title,
    summary,
  }];
};

const buildScenesFromContent = (
  content: string,
  options?: { allowFallback?: boolean },
): GuideScene[] => {
  const headingScenes = buildHeadingScenes(content);
  if (headingScenes.length > 0) {
    return headingScenes;
  }

  const orderedListScenes = buildOrderedListScenes(content);
  if (orderedListScenes.length > 0) {
    return orderedListScenes;
  }

  if (options?.allowFallback === false) {
    return [];
  }

  return buildFallbackScene(content);
};

const GUIDE_REFERENCE_PATTERN = /(?:演示|讲解|介绍|带你看).*(?:上面的?|这个|该).*(?:html|HTML|页面|网页|预览|结果)|(?:上面的?|这个|该).*(?:html|HTML|页面|网页|预览|结果).*(?:演示|讲解|介绍)/u;

const referencesPreviousPreviewTarget = (content: string): boolean => {
  return GUIDE_REFERENCE_PATTERN.test(content.trim());
};

const isPresentationSkillUserMessage = (message: CoworkMessage | undefined): boolean => {
  if (!message || message.type !== 'user') {
    return false;
  }

  const skillIds = Array.isArray(message.metadata?.skillIds)
    ? message.metadata.skillIds.filter((value): value is string => typeof value === 'string')
    : [];
  const autoAttachedSkillIds = getDesktopAssistantAutoAttachedSkillIds(message.metadata);
  return [...skillIds, ...autoAttachedSkillIds].includes(DesktopAssistantAutoSkill.PresentationHtml);
};

const resolveTurnScopedPreviewTarget = (
  message: CoworkMessage,
  messages: CoworkMessage[],
  options?: GuideContentResolveOptions,
): string | null => {
  const messageIndex = messages.findIndex((item) => item.id === message.id);
  if (messageIndex <= 0) {
    return null;
  }

  let userMessageIndex = -1;
  for (let index = messageIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.type === 'user') {
      userMessageIndex = index;
      break;
    }
  }
  if (userMessageIndex < 0 || !isPresentationSkillUserMessage(messages[userMessageIndex])) {
    return null;
  }

  const targetSet = new Set<string>();
  for (let index = userMessageIndex + 1; index < messageIndex; index += 1) {
    const candidate = messages[index];
    if (!candidate || candidate.type === 'user') {
      continue;
    }
    for (const target of collectUniqueTargetsFromMessage(candidate, options)) {
      targetSet.add(target);
    }
  }

  return targetSet.size === 1 ? Array.from(targetSet)[0] : null;
};

export const parseGuideContent = (
  message: CoworkMessage | null | undefined,
  options?: GuideContentResolveOptions,
): GuideContentParseResult => {
  if (!message || message.type !== 'assistant' || message.metadata?.isStreaming) {
    return { eligible: false, previewTarget: null, scenes: [] };
  }

  const targets = collectUniqueTargets(message, options);
  const inlineHtmlContent = extractInlineGuideHtmlContent(message);
  if (targets.length === 0 && inlineHtmlContent) {
    return {
      eligible: true,
      previewTarget: `#artifact-${message.id}`,
      scenes: buildHtmlScenesFromContent(inlineHtmlContent),
    };
  }
  if (targets.length !== 1) {
    return { eligible: false, previewTarget: null, scenes: [] };
  }

  return {
    eligible: true,
    previewTarget: targets[0],
    scenes: inlineHtmlContent
      ? buildHtmlScenesFromContent(inlineHtmlContent)
      : buildScenesFromContent(message.content, { allowFallback: true }),
  };
};

export const resolveGuideContentFromConversation = (
  message: CoworkMessage | null | undefined,
  messages: CoworkMessage[],
  options?: GuideContentResolveOptions,
): GuideContentParseResult => {
  const directResult = parseGuideContent(message, options);
  if (directResult.eligible) {
    return directResult;
  }

  if (!message || message.type !== 'assistant' || message.metadata?.isStreaming) {
    return directResult;
  }

  const turnScopedPreviewTarget = resolveTurnScopedPreviewTarget(message, messages, options);
  if (turnScopedPreviewTarget) {
    const explicitScenes = buildScenesFromContent(message.content, { allowFallback: true });
    return {
      eligible: true,
      previewTarget: turnScopedPreviewTarget,
      scenes: explicitScenes,
    };
  }

  if (!referencesPreviousPreviewTarget(message.content)) {
    return directResult;
  }

  const messageIndex = messages.findIndex((item) => item.id === message.id);
  const previousMessages = messageIndex >= 0
    ? messages.slice(0, messageIndex).reverse()
    : [...messages].reverse();
  const resolvedReferencedMessage = previousMessages.find((candidate) => (
    parseGuideContent(candidate, options).eligible
  ));
  if (!resolvedReferencedMessage) {
    return directResult;
  }

  const referencedResult = parseGuideContent(resolvedReferencedMessage, options);
  if (!referencedResult.eligible || !referencedResult.previewTarget) {
    return directResult;
  }

  const explicitScenes = buildScenesFromContent(message.content, { allowFallback: false });
  return {
    eligible: true,
    previewTarget: referencedResult.previewTarget,
    scenes: explicitScenes.length > 0 ? explicitScenes : referencedResult.scenes,
  };
};

export const shouldShowGuideButton = (
  message: CoworkMessage | null | undefined,
  masterEnabled: boolean,
  messages: CoworkMessage[] = [],
  options?: GuideContentResolveOptions,
): boolean => {
  if (!masterEnabled || !message || message.type !== 'assistant' || message.metadata?.isStreaming) {
    return false;
  }
  const result = messages.length > 0
    ? resolveGuideContentFromConversation(message, messages, options)
    : parseGuideContent(message, options);
  return result.eligible;
};
