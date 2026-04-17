import type {
  CoworkExecutionMode,
  CoworkMessage,
  CoworkMessageMetadata,
  CoworkSession,
  CoworkSessionStatus,
} from '../coworkStore';
import {
  extractGatewayMessageText,
  normalizeGatewayHistoryText,
} from './openclawHistory';
import { extractOpenClawAssistantStreamText } from './openclawAssistantText';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const toStringValue = (value: unknown): string => (
  typeof value === 'string' ? value : ''
);

const parseTimestamp = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toToolInputRecord = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return {};
  }
  return { value };
};

const extractToolUseId = (value: Record<string, unknown>): string | null => (
  toStringValue(value.tool_use_id).trim()
  || toStringValue(value.toolCallId).trim()
  || toStringValue(value.tool_call_id).trim()
  || toStringValue(value.id).trim()
  || null
);

const extractToolText = (payload: unknown): string => {
  if (typeof payload === 'string') {
    return payload;
  }

  if (Array.isArray(payload)) {
    const lines = payload
      .map((item) => extractToolText(item).trim())
      .filter(Boolean);
    if (lines.length > 0) {
      return lines.join('\n');
    }
  }

  if (!isRecord(payload)) {
    if (payload === undefined || payload === null) return '';
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return String(payload);
    }
  }

  if (typeof payload.text === 'string' && payload.text.trim()) {
    return payload.text;
  }
  if (typeof payload.output === 'string' && payload.output.trim()) {
    return payload.output;
  }
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }
  if (typeof payload.stdout === 'string' || typeof payload.stderr === 'string') {
    const chunks = [
      typeof payload.stdout === 'string' ? payload.stdout : '',
      typeof payload.stderr === 'string' ? payload.stderr : '',
    ].filter(Boolean);
    if (chunks.length > 0) {
      return chunks.join('\n');
    }
  }

  const nestedText = extractOpenClawAssistantStreamText(payload);
  if (nestedText) {
    return nestedText;
  }

  const content = payload.content;
  if (typeof content === 'string' && content.trim()) {
    return content;
  }
  if (Array.isArray(content)) {
    const chunks: string[] = [];
    for (const item of content) {
      if (typeof item === 'string' && item.trim()) {
        chunks.push(item);
        continue;
      }
      if (!isRecord(item)) continue;
      if (typeof item.text === 'string' && item.text.trim()) {
        chunks.push(item.text);
        continue;
      }
      if (typeof item.content === 'string' && item.content.trim()) {
        chunks.push(item.content);
      }
    }
    if (chunks.length > 0) {
      return chunks.join('\n');
    }
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
};

const extractTranscriptText = (message: unknown): string => (
  extractOpenClawAssistantStreamText(message) || extractGatewayMessageText(message)
);

const extractNormalizedTranscriptText = (
  role: 'user' | 'assistant' | 'system',
  message: unknown,
): string => normalizeGatewayHistoryText(role, extractTranscriptText(message));

const parseToolCallArguments = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : { value };
    } catch {
      return { value };
    }
  }
  return {};
};

const buildAssistantMetadata = (extra: Partial<CoworkMessageMetadata> = {}): CoworkMessageMetadata => ({
  isStreaming: false,
  isFinal: true,
  ...extra,
});

const parseTranscriptMessages = (fileContent: string): CoworkMessage[] => {
  const lines = fileContent.split(/\r?\n/);
  const messages: CoworkMessage[] = [];
  let messageIndex = 0;

  const pushMessage = (
    type: CoworkMessage['type'],
    content: string,
    timestamp: number,
    metadata?: CoworkMessageMetadata,
  ): void => {
    const normalizedContent = content ?? '';
    const normalizedMetadata = metadata && Object.keys(metadata).length > 0 ? metadata : undefined;
    if (!normalizedContent.trim() && !normalizedMetadata?.error && type !== 'tool_use') {
      return;
    }
    messages.push({
      id: `transcript-${messageIndex++}`,
      type,
      content: normalizedContent,
      timestamp,
      metadata: normalizedMetadata,
    });
  };

  for (const line of lines) {
    if (!line.trim()) continue;

    let parsed: Record<string, unknown>;
    try {
      const candidate = JSON.parse(line);
      if (!isRecord(candidate)) {
        continue;
      }
      parsed = candidate;
    } catch {
      continue;
    }

    if (parsed.type !== 'message' || !isRecord(parsed.message)) {
      continue;
    }

    const message = parsed.message;
    const role = toStringValue(message.role).trim().toLowerCase();
    const timestamp = parseTimestamp(message.timestamp)
      ?? parseTimestamp(parsed.timestamp)
      ?? Date.now();

    if (role === 'user') {
      const text = extractNormalizedTranscriptText('user', message);
      if (text) {
        pushMessage('user', text, timestamp, {});
      }
      continue;
    }

    if (role === 'tool' || role === 'toolresult') {
      const text = extractToolText(message.content);
      const toolUseId = extractToolUseId(message);
      pushMessage('tool_result', text, timestamp, {
        toolResult: text,
        toolUseId,
        isError: false,
      });
      continue;
    }

    if (role !== 'assistant') {
      continue;
    }

    const reasoningContent = toStringValue(message.reasoning_content) || toStringValue(message.reasoning);
    if (reasoningContent.trim()) {
      pushMessage('assistant', reasoningContent, timestamp, buildAssistantMetadata({ isThinking: true }));
    }

    const textParts: string[] = [];
    const flushAssistantText = (): void => {
      if (textParts.length === 0) return;
      const text = textParts.join('\n').trim();
      textParts.length = 0;
      if (text) {
        pushMessage('assistant', text, timestamp, buildAssistantMetadata());
      }
    };

    const content = message.content;
    if (typeof content === 'string' && content.trim()) {
      textParts.push(content);
    } else if (isRecord(content)) {
      const text = extractNormalizedTranscriptText('assistant', { content });
      if (text.trim()) {
        textParts.push(text);
      }
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (!isRecord(block)) continue;
        const blockType = toStringValue(block.type).trim().toLowerCase();

        if (blockType === 'text' || blockType === 'input_text' || blockType === 'output_text') {
          const text = extractNormalizedTranscriptText('assistant', { content: block });
          if (text.trim()) {
            textParts.push(text);
          }
          continue;
        }

        if (blockType === 'thinking') {
          flushAssistantText();
          const thinking = toStringValue(block.thinking) || toStringValue(block.text);
          if (thinking.trim()) {
            pushMessage('assistant', thinking, timestamp, buildAssistantMetadata({ isThinking: true }));
          }
          continue;
        }

        if (blockType === 'tool_use' || blockType === 'toolcall') {
          flushAssistantText();
          const toolName = toStringValue(block.name).trim()
            || toStringValue(block.toolName).trim()
            || 'Tool';
          const toolUseId = extractToolUseId(block);
          pushMessage('tool_use', `Using tool: ${toolName}`, timestamp, {
            toolName,
            toolInput: toToolInputRecord(
              isRecord(block.arguments) ? block.arguments : (block.input ?? block.arguments)
            ),
            toolUseId,
          });
          continue;
        }

        if (blockType === 'tool_result' || blockType === 'toolresult') {
          flushAssistantText();
          const resultText = extractToolText(block.content);
          const isError = Boolean(block.is_error);
          pushMessage('tool_result', resultText, timestamp, {
            toolResult: resultText,
            toolUseId: extractToolUseId(block),
            error: isError ? (resultText || 'Tool execution failed') : undefined,
            isError,
          });
          continue;
        }

        const fallbackText = extractNormalizedTranscriptText('assistant', { content: block });
        if (fallbackText.trim()) {
          textParts.push(fallbackText);
        }
      }
    }

    flushAssistantText();

    if (Array.isArray(message.tool_calls)) {
      for (const toolCall of message.tool_calls) {
        if (!isRecord(toolCall)) continue;
        const functionObj = isRecord(toolCall.function) ? toolCall.function : {};
        const toolName = toStringValue(functionObj.name).trim() || 'Tool';
        const toolUseId = toStringValue(toolCall.id).trim() || toStringValue(toolCall.call_id).trim() || null;
        pushMessage('tool_use', `Using tool: ${toolName}`, timestamp, {
          toolName,
          toolInput: parseToolCallArguments(functionObj.arguments),
          toolUseId,
        });
      }
    }
  }

  return messages;
};

export const buildTransientSessionFromOpenClawTranscript = (params: {
  sessionKey: string;
  title?: string;
  fileContent: string;
}): CoworkSession | null => {
  const messages = parseTranscriptMessages(params.fileContent);
  if (messages.length === 0) {
    return null;
  }

  const firstTimestamp = messages[0]?.timestamp ?? Date.now();
  const lastTimestamp = messages[messages.length - 1]?.timestamp ?? firstTimestamp;

  return {
    id: `transient-${params.sessionKey}`,
    title: params.title || params.sessionKey.split(':').pop() || 'Cron Session',
    claudeSessionId: null,
    status: 'completed' as CoworkSessionStatus,
    pinned: false,
    cwd: '',
    systemPrompt: '',
    executionMode: 'local' as CoworkExecutionMode,
    activeSkillIds: [],
    messages,
    agentId: 'main',
    createdAt: firstTimestamp,
    updatedAt: lastTimestamp,
  };
};
