const EMOJI_PATTERN = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

const collapseWhitespace = (value: string): string => {
  return value
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim();
};

export const extractReadableAssistantText = (content: string): string => {
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
      .replace(/[\/\\]+/g, ' ')
      .replace(/[*_~`>#|[\]{}]+/g, ' ')
      .replace(/-{3,}/g, ' ')
      .replace(/={2,}/g, ' ')
      .replace(/\.{3,}/g, ' ')
      .replace(/。{2,}/g, '。')
      .replace(/，{2,}/g, '，')
      .replace(/！{2,}/g, '！')
      .replace(/？{2,}/g, '？')
  );
};

export const applyTtsSkipKeywords = (content: string, keywords: string[]): string => {
  if (!content.trim()) {
    return '';
  }

  let nextContent = content;
  keywords.forEach((keyword) => {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) {
      return;
    }
    nextContent = nextContent.split(normalizedKeyword).join(' ');
  });

  return collapseWhitespace(nextContent);
};

export const buildSpeakableAssistantText = (
  content: string,
  options?: { skipKeywords?: string[] }
): string => {
  const readable = extractReadableAssistantText(content);
  const sanitized = sanitizeTtsDraftText(readable);
  return applyTtsSkipKeywords(sanitized, options?.skipKeywords ?? []);
};
