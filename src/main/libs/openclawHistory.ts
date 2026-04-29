import {
  parseScheduledReminderPrompt,
  parseSimpleScheduledReminderText,
} from '../../scheduledTask/reminderText';

type GatewayHistoryRole = 'user' | 'assistant' | 'system';

const CURRENT_USER_REQUEST_MARKER = '[Current user request]';
const METADATA_PREFIX_RE = /^Sender \(untrusted metadata\):\s*```json\s*\{[^}]*}\s*```\s*/s;
const WRAPPED_REQUEST_HEADING_RE = /^(#{1,6}\s+|[-*]\s+|\d+\.\s+|```)/m;
const WRAPPED_REQUEST_MARKER_PATTERNS = [
  /(?:结合上面内容|结合以上内容|结合上文内容|结合上述内容)(?:帮我分析|进行分析|回答问题)?[：:]\s*(.+)$/s,
  /(?:请)?(?:基于|根据)(?:上面|以上|上文|上述)内容(?:帮我分析|进行分析|回答问题)?[：:]\s*(.+)$/s,
  /(?:用户(?:当前)?(?:请求|问题|查询)|最终问题|实际问题)[：:]\s*(.+)$/s,
] as const;

export interface GatewayHistoryEntry {
  role: GatewayHistoryRole;
  text: string;
}

const HEARTBEAT_ACK_RE = /^[`*_~"'“”‘’()[\]{}<>.,!?;:，。！？；：\s-]{0,8}HEARTBEAT_OK[`*_~"'“”‘’()[\]{}<>.,!?;:，。！？；：\s-]{0,8}$/i;
const TRANSIENT_GATEWAY_STATUS_MAX_CHARS = 600;
const TRANSIENT_GATEWAY_STATUS_PATTERNS = [
  /^(?:OpenClaw\s*)?(?:网关|AI\s*引擎).{0,16}(?:正在)?(?:重启|启动|连接)(?:中)?[，,。.]/i,
  /等待(?:网关|AI\s*引擎)?.{0,24}(?:重启|启动|连接)完成后.{0,120}(?:继续|恢复|我将继续)/i,
  /^(?:the\s+)?(?:openclaw\s+)?(?:gateway|ai\s+engine).{0,32}(?:is\s+)?(?:restarting|starting|reconnecting|draining)[,.]/i,
  /(?:wait|waiting).{0,24}(?:gateway|ai\s+engine).{0,48}(?:restart|start|reconnect).{0,120}(?:continue|resume)/i,
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
};

const collectTextChunks = (value: unknown): string[] => {
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? [text] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectTextChunks(item));
  }

  if (!isRecord(value)) {
    return [];
  }

  const chunks: string[] = [];
  if (typeof value.text === 'string') {
    const text = value.text.trim();
    if (text) {
      chunks.push(text);
    }
  }

  if (value.content !== undefined) {
    chunks.push(...collectTextChunks(value.content));
  }
  if (value.parts !== undefined) {
    chunks.push(...collectTextChunks(value.parts));
  }

  return chunks;
};

export const extractGatewayMessageText = (message: unknown): string => {
  if (typeof message === 'string') {
    return message;
  }
  if (!isRecord(message)) {
    return '';
  }

  const content = message.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    const chunks = collectTextChunks(content);
    if (chunks.length > 0) {
      return chunks.join('\n');
    }
  }
  if (isRecord(content)) {
    const chunks = collectTextChunks(content);
    if (chunks.length > 0) {
      return chunks.join('\n');
    }
  }
  if (typeof message.text === 'string') {
    return message.text;
  }
  return '';
};

export const normalizeGatewayHistoryText = (
  role: GatewayHistoryRole,
  text: string,
): string => {
  const normalized = text.trim().replace(METADATA_PREFIX_RE, '').trim();
  if (role !== 'user') {
    return normalized;
  }

  const requestMarkerIndex = normalized.lastIndexOf(CURRENT_USER_REQUEST_MARKER);
  if (requestMarkerIndex === -1) {
    return normalized;
  }

  const currentUserRequest = normalized
    .slice(requestMarkerIndex + CURRENT_USER_REQUEST_MARKER.length)
    .trim();

  const extractedWrappedRequest = extractWrappedUserRequest(currentUserRequest);
  if (extractedWrappedRequest) {
    return extractedWrappedRequest;
  }

  return currentUserRequest;
};

export const isHeartbeatAckText = (text: string): boolean => HEARTBEAT_ACK_RE.test(text.trim());

export const isTransientGatewayStatusText = (text: string): boolean => {
  const normalized = text.trim();
  if (!normalized || normalized.length > TRANSIENT_GATEWAY_STATUS_MAX_CHARS) {
    return false;
  }
  if (normalized.includes('```')) {
    return false;
  }
  return TRANSIENT_GATEWAY_STATUS_PATTERNS.some((pattern) => pattern.test(normalized));
};

const extractWrappedUserRequest = (text: string): string | null => {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  const headingCount = (normalized.match(/^#{1,6}\s+/gm) ?? []).length;
  const bulletCount = (normalized.match(/^[-*]\s+/gm) ?? []).length;
  const orderedStepCount = (normalized.match(/^\d+\.\s+/gm) ?? []).length;
  const looksLikeWrappedTemplate = WRAPPED_REQUEST_HEADING_RE.test(normalized) && (
    normalized.length >= 400
    || headingCount >= 2
    || (headingCount >= 1 && bulletCount >= 2)
    || orderedStepCount >= 3
  );
  if (!looksLikeWrappedTemplate) {
    return null;
  }

  for (const pattern of WRAPPED_REQUEST_MARKER_PATTERNS) {
    const match = normalized.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  const lastNonEmptyLine = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  if (!lastNonEmptyLine) {
    return null;
  }

  const lastLineCandidate = lastNonEmptyLine.replace(/^[-*]\s+/, '').trim();
  if (!lastLineCandidate || WRAPPED_REQUEST_HEADING_RE.test(lastLineCandidate)) {
    return null;
  }

  return lastLineCandidate;
};

export const buildScheduledReminderSystemMessage = (text: string): string | null => {
  const parsed = parseScheduledReminderPrompt(text);
  if (!parsed) {
    return parseSimpleScheduledReminderText(text)?.reminderText ?? null;
  }

  return parsed.reminderText;
};

export const extractGatewayHistoryEntry = (message: unknown): GatewayHistoryEntry | null => {
  if (!isRecord(message)) {
    return null;
  }

  const role = typeof message.role === 'string' ? message.role.trim().toLowerCase() : '';
  if (role !== 'user' && role !== 'assistant' && role !== 'system') {
    return null;
  }

  const text = normalizeGatewayHistoryText(role, extractGatewayMessageText(message));
  if (!text) {
    return null;
  }
  if ((role === 'assistant' || role === 'system') && isHeartbeatAckText(text)) {
    return null;
  }
  if (role === 'assistant' && isTransientGatewayStatusText(text)) {
    return null;
  }

  const reminderSystemMessage = role === 'user'
    ? buildScheduledReminderSystemMessage(text)
    : null;
  if (reminderSystemMessage) {
    return {
      role: 'system',
      text: reminderSystemMessage,
    };
  }

  return {
    role,
    text,
  };
};

export const extractGatewayHistoryEntries = (messages: unknown[]): GatewayHistoryEntry[] => {
  return messages
    .map((message) => extractGatewayHistoryEntry(message))
    .filter((entry): entry is GatewayHistoryEntry => entry !== null);
};
