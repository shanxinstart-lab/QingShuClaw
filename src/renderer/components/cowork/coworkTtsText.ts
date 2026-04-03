const EMOJI_PATTERN = /[\p{Extended_Pictographic}\uFE0F]/gu;
const STANDALONE_SLASH_PATTERN = /(^|\s)[/\\]+(?=\s|$)/gu;
const REPEATED_SEPARATOR_PATTERN = /[|]{2,}|[~]{2,}|[·•▪▫]+/gu;

const collapseWhitespace = (value: string): string => {
  return value
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
};

export const extractSpeakableAssistantText = (content: string): string => {
  if (!content.trim()) {
    return '';
  }

  return collapseWhitespace(
    content
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]+`/g, ' ')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/^>\s?/gm, '')
      .replace(/^#{1,6}\s*/gm, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
  );
};

export const sanitizeTtsDraftText = (content: string): string => {
  if (!content.trim()) {
    return '';
  }

  return collapseWhitespace(
    content
      .replace(EMOJI_PATTERN, ' ')
      .replace(STANDALONE_SLASH_PATTERN, '$1')
      .replace(REPEATED_SEPARATOR_PATTERN, ' ')
  );
};

export const applyTtsSkipKeywords = (content: string, keywords: string[]): string => {
  let nextContent = content;
  for (const keyword of keywords) {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) {
      continue;
    }
    nextContent = nextContent.split(normalizedKeyword).join(' ');
  }
  return collapseWhitespace(nextContent);
};

export const buildSpeakableAssistantText = (
  content: string,
  options?: { skipKeywords?: string[] },
): string => {
  const extracted = extractSpeakableAssistantText(content);
  const sanitized = sanitizeTtsDraftText(extracted);
  return applyTtsSkipKeywords(sanitized, options?.skipKeywords ?? []);
};
