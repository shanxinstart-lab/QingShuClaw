import type { CoworkMessageMetadata } from '../../types/cowork';
import { formatTokenCount } from '../../utils/tokenFormat';

export const getAssistantMessageModelLabel = (metadata?: CoworkMessageMetadata | null): string | null => {
  const model = typeof metadata?.model === 'string' ? metadata.model.trim() : '';
  if (!model) return null;
  return model.includes('/') ? (model.split('/').pop() || model) : model;
};

export const buildAssistantMetadataItems = (
  metadata?: CoworkMessageMetadata | null,
): string[] => {
  const modelLabel = getAssistantMessageModelLabel(metadata);
  const inputTokens = metadata?.usage?.inputTokens;
  const outputTokens = metadata?.usage?.outputTokens;
  const cacheReadTokens = metadata?.usage?.cacheReadTokens;
  const contextPercent = metadata?.contextPercent;

  return [
    modelLabel ? `Model ${modelLabel}` : null,
    inputTokens != null || outputTokens != null
      ? `Tokens ${inputTokens != null ? formatTokenCount(inputTokens) : '-'} in / ${outputTokens != null ? formatTokenCount(outputTokens) : '-'} out`
      : null,
    cacheReadTokens != null && cacheReadTokens > 0 ? `Cache read ${formatTokenCount(cacheReadTokens)}` : null,
    contextPercent != null ? `Ctx ${contextPercent}%` : null,
  ].filter((item): item is string => Boolean(item));
};
