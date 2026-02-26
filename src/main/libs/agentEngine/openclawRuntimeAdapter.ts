import { randomUUID } from 'crypto';
import { app } from 'electron';
import { EventEmitter } from 'events';
import { pathToFileURL } from 'url';
import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import type { CoworkMessage, CoworkStore } from '../../coworkStore';
import {
  OpenClawEngineManager,
  type OpenClawGatewayConnectionInfo,
} from '../openclawEngineManager';
import type {
  CoworkContinueOptions,
  CoworkRuntime,
  CoworkRuntimeEvents,
  CoworkStartOptions,
  PermissionRequest,
} from './types';

const OPENCLAW_SESSION_PREFIX = 'lobsterai:';
const BRIDGE_MAX_MESSAGES = 20;
const BRIDGE_MAX_MESSAGE_CHARS = 1200;
const GATEWAY_READY_TIMEOUT_MS = 15_000;

type GatewayEventFrame = {
  event: string;
  payload?: unknown;
};

type GatewayClientLike = {
  start: () => void;
  stop: () => void;
  request: <T = Record<string, unknown>>(
    method: string,
    params?: unknown,
    opts?: { expectFinal?: boolean },
  ) => Promise<T>;
};

type GatewayClientCtor = new (options: Record<string, unknown>) => GatewayClientLike;

type ChatEventState = 'delta' | 'final' | 'aborted' | 'error';

type ChatEventPayload = {
  runId?: string;
  sessionKey?: string;
  state?: ChatEventState;
  message?: unknown;
  errorMessage?: string;
};

type ExecApprovalRequestedPayload = {
  id?: string;
  request?: {
    command?: string;
    cwd?: string | null;
    host?: string | null;
    security?: string | null;
    ask?: string | null;
    resolvedPath?: string | null;
    sessionKey?: string | null;
    agentId?: string | null;
  };
};

type ExecApprovalResolvedPayload = {
  id?: string;
};

type ActiveTurn = {
  sessionId: string;
  sessionKey: string;
  runId: string;
  assistantMessageId: string | null;
  currentText: string;
  stopRequested: boolean;
};

type PendingApprovalEntry = {
  requestId: string;
  sessionId: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
};

const truncate = (value: string, maxChars: number): string => {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}...`;
};

const extractMessageText = (message: unknown): string => {
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
    const chunks: string[] = [];
    for (const item of content) {
      if (!isRecord(item)) continue;
      if (item.type === 'text' && typeof item.text === 'string') {
        chunks.push(item.text);
      }
    }
    if (chunks.length > 0) {
      return chunks.join('\n');
    }
  }
  if (typeof message.text === 'string') {
    return message.text;
  }
  return '';
};

const waitWithTimeout = async (promise: Promise<void>, timeoutMs: number): Promise<void> => {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<void>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`OpenClaw gateway client connect timeout after ${timeoutMs}ms.`));
    }, timeoutMs);
  });
  try {
    await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export class OpenClawRuntimeAdapter extends EventEmitter implements CoworkRuntime {
  private readonly store: CoworkStore;
  private readonly engineManager: OpenClawEngineManager;
  private readonly activeTurns = new Map<string, ActiveTurn>();
  private readonly sessionIdBySessionKey = new Map<string, string>();
  private readonly sessionIdByRunId = new Map<string, string>();
  private readonly pendingApprovals = new Map<string, PendingApprovalEntry>();
  private readonly pendingTurns = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
  private readonly confirmationModeBySession = new Map<string, 'modal' | 'text'>();
  private readonly bridgedSessions = new Set<string>();

  private gatewayClient: GatewayClientLike | null = null;
  private gatewayClientVersion: string | null = null;
  private gatewayClientEntryPath: string | null = null;
  private gatewayReadyPromise: Promise<void> | null = null;

  constructor(store: CoworkStore, engineManager: OpenClawEngineManager) {
    super();
    this.store = store;
    this.engineManager = engineManager;
  }

  override on<U extends keyof CoworkRuntimeEvents>(
    event: U,
    listener: CoworkRuntimeEvents[U],
  ): this {
    return super.on(event, listener);
  }

  override off<U extends keyof CoworkRuntimeEvents>(
    event: U,
    listener: CoworkRuntimeEvents[U],
  ): this {
    return super.off(event, listener);
  }

  async startSession(sessionId: string, prompt: string, options: CoworkStartOptions = {}): Promise<void> {
    await this.runTurn(sessionId, prompt, {
      skipInitialUserMessage: options.skipInitialUserMessage,
      skillIds: options.skillIds,
      confirmationMode: options.confirmationMode,
    });
  }

  async continueSession(sessionId: string, prompt: string, options: CoworkContinueOptions = {}): Promise<void> {
    await this.runTurn(sessionId, prompt, {
      skipInitialUserMessage: false,
      skillIds: options.skillIds,
    });
  }

  stopSession(sessionId: string): void {
    const turn = this.activeTurns.get(sessionId);
    if (turn) {
      turn.stopRequested = true;
      const client = this.gatewayClient;
      if (client) {
        void client.request('chat.abort', {
          sessionKey: turn.sessionKey,
          runId: turn.runId,
        }).catch((error) => {
          console.warn('[OpenClawRuntime] Failed to abort chat run:', error);
        });
      }
    }

    this.cleanupSessionTurn(sessionId);
    this.clearPendingApprovalsBySession(sessionId);
    this.store.updateSession(sessionId, { status: 'idle' });
    this.resolveTurn(sessionId);
  }

  stopAllSessions(): void {
    const activeSessionIds = Array.from(this.activeTurns.keys());
    activeSessionIds.forEach((sessionId) => {
      this.stopSession(sessionId);
    });
  }

  respondToPermission(requestId: string, result: PermissionResult): void {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending) {
      return;
    }

    const decision = result.behavior === 'allow' ? 'allow-once' : 'deny';
    const client = this.gatewayClient;
    if (!client) {
      this.pendingApprovals.delete(requestId);
      return;
    }

    void client.request('exec.approval.resolve', {
      id: requestId,
      decision,
    }).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.emit('error', pending.sessionId, `Failed to resolve OpenClaw approval: ${message}`);
    }).finally(() => {
      this.pendingApprovals.delete(requestId);
    });
  }

  isSessionActive(sessionId: string): boolean {
    return this.activeTurns.has(sessionId);
  }

  getSessionConfirmationMode(sessionId: string): 'modal' | 'text' | null {
    return this.confirmationModeBySession.get(sessionId) ?? null;
  }

  private async runTurn(
    sessionId: string,
    prompt: string,
    options: {
      skipInitialUserMessage?: boolean;
      skillIds?: string[];
      confirmationMode?: 'modal' | 'text';
    },
  ): Promise<void> {
    if (!prompt.trim()) {
      throw new Error('Prompt is required.');
    }
    if (this.activeTurns.has(sessionId)) {
      throw new Error(`Session ${sessionId} is still running.`);
    }

    const session = this.store.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const confirmationMode = options.confirmationMode
      ?? this.confirmationModeBySession.get(sessionId)
      ?? 'modal';
    this.confirmationModeBySession.set(sessionId, confirmationMode);

    if (!options.skipInitialUserMessage) {
      const userMessage = this.store.addMessage(sessionId, {
        type: 'user',
        content: prompt,
        metadata: options.skillIds?.length ? { skillIds: options.skillIds } : undefined,
      });
      this.emit('message', sessionId, userMessage);
    }

    const sessionKey = this.toSessionKey(sessionId);
    this.sessionIdBySessionKey.set(sessionKey, sessionId);

    this.store.updateSession(sessionId, { status: 'running' });
    await this.ensureGatewayClientReady();

    const runId = randomUUID();
    const outboundMessage = await this.buildOutboundPrompt(sessionId, prompt);
    const completionPromise = new Promise<void>((resolve, reject) => {
      this.pendingTurns.set(sessionId, { resolve, reject });
    });
    this.activeTurns.set(sessionId, {
      sessionId,
      sessionKey,
      runId,
      assistantMessageId: null,
      currentText: '',
      stopRequested: false,
    });
    this.sessionIdByRunId.set(runId, sessionId);

    const client = this.requireGatewayClient();
    try {
      await client.request('chat.send', {
        sessionKey,
        message: outboundMessage,
        deliver: false,
        idempotencyKey: runId,
      });
    } catch (error) {
      this.cleanupSessionTurn(sessionId);
      this.store.updateSession(sessionId, { status: 'error' });
      const message = error instanceof Error ? error.message : String(error);
      this.emit('error', sessionId, message);
      this.rejectTurn(sessionId, new Error(message));
      throw error;
    }

    await completionPromise;
  }

  private async buildOutboundPrompt(sessionId: string, prompt: string): Promise<string> {
    if (this.bridgedSessions.has(sessionId)) {
      return prompt;
    }

    const client = this.requireGatewayClient();
    const sessionKey = this.toSessionKey(sessionId);
    let hasHistory = false;
    try {
      const history = await client.request<{ messages?: unknown[] }>('chat.history', {
        sessionKey,
        limit: 1,
      });
      hasHistory = Array.isArray(history?.messages) && history.messages.length > 0;
    } catch (error) {
      console.warn('[OpenClawRuntime] chat.history check failed, continuing without history guard:', error);
    }

    this.bridgedSessions.add(sessionId);
    if (hasHistory) {
      return prompt;
    }

    const session = this.store.getSession(sessionId);
    if (!session) {
      return prompt;
    }

    const bridgePrefix = this.buildBridgePrefix(session.messages, prompt);
    if (!bridgePrefix) {
      return prompt;
    }

    return `${bridgePrefix}\n\n[Current user request]\n${prompt}`;
  }

  private buildBridgePrefix(messages: CoworkMessage[], currentPrompt: string): string {
    const normalizedCurrentPrompt = currentPrompt.trim();
    if (!normalizedCurrentPrompt) return '';

    const source = messages
      .filter((message) => {
        if (message.type !== 'user' && message.type !== 'assistant') {
          return false;
        }
        if (!message.content.trim()) {
          return false;
        }
        if (message.metadata?.isThinking) {
          return false;
        }
        return true;
      })
      .map((message) => ({
        type: message.type,
        content: message.content.trim(),
      }));

    if (source.length === 0) {
      return '';
    }

    if (source[source.length - 1]?.type === 'user'
      && source[source.length - 1]?.content === normalizedCurrentPrompt) {
      source.pop();
    }

    const recent = source.slice(-BRIDGE_MAX_MESSAGES);
    if (recent.length === 0) {
      return '';
    }

    const lines = recent.map((entry) => {
      const role = entry.type === 'user' ? 'User' : 'Assistant';
      return `${role}: ${truncate(entry.content, BRIDGE_MAX_MESSAGE_CHARS)}`;
    });

    return [
      '[Context bridge from previous LobsterAI conversation]',
      'Use this prior context for continuity. Focus your final answer on the current request.',
      ...lines,
    ].join('\n');
  }

  private async ensureGatewayClientReady(): Promise<void> {
    const engineStatus = await this.engineManager.startGateway();
    if (engineStatus.phase !== 'running') {
      const message = engineStatus.message || 'OpenClaw engine is not running.';
      throw new Error(message);
    }

    const connection = this.engineManager.getGatewayConnectionInfo();
    const missing: string[] = [];
    if (!connection.url) missing.push('url');
    if (!connection.token) missing.push('token');
    if (!connection.version) missing.push('version');
    if (!connection.clientEntryPath) missing.push('clientEntryPath');
    if (missing.length > 0) {
      throw new Error(`OpenClaw gateway connection info is incomplete (missing: ${missing.join(', ')})`);
    }

    const needsNewClient = !this.gatewayClient
      || this.gatewayClientVersion !== connection.version
      || this.gatewayClientEntryPath !== connection.clientEntryPath;
    if (!needsNewClient && this.gatewayReadyPromise) {
      await waitWithTimeout(this.gatewayReadyPromise, GATEWAY_READY_TIMEOUT_MS);
      return;
    }

    this.stopGatewayClient();
    await this.createGatewayClient(connection);
    if (this.gatewayReadyPromise) {
      await waitWithTimeout(this.gatewayReadyPromise, GATEWAY_READY_TIMEOUT_MS);
    }
  }

  private async createGatewayClient(connection: OpenClawGatewayConnectionInfo): Promise<void> {
    const GatewayClient = await this.loadGatewayClientCtor(connection.clientEntryPath);

    let resolveReady: (() => void) | null = null;
    let rejectReady: ((error: Error) => void) | null = null;
    let settled = false;

    this.gatewayReadyPromise = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });

    const settleResolve = () => {
      if (settled) return;
      settled = true;
      resolveReady?.();
    };
    const settleReject = (error: Error) => {
      if (settled) return;
      settled = true;
      rejectReady?.(error);
    };

    const client = new GatewayClient({
      url: connection.url,
      token: connection.token,
      clientDisplayName: 'LobsterAI',
      clientVersion: app.getVersion(),
      mode: 'backend',
      role: 'operator',
      scopes: ['operator.admin'],
      onHelloOk: () => {
        settleResolve();
      },
      onConnectError: (error: Error) => {
        settleReject(error);
      },
      onClose: (_code: number, reason: string) => {
        if (!settled) {
          settleReject(new Error(reason || 'OpenClaw gateway disconnected before handshake'));
          return;
        }

        const disconnectedError = new Error(reason || 'OpenClaw gateway client disconnected');
        const activeSessionIds = Array.from(this.activeTurns.keys());
        activeSessionIds.forEach((sessionId) => {
          this.store.updateSession(sessionId, { status: 'error' });
          this.emit('error', sessionId, disconnectedError.message);
          this.cleanupSessionTurn(sessionId);
          this.rejectTurn(sessionId, disconnectedError);
        });
        this.stopGatewayClient();
        this.gatewayReadyPromise = Promise.reject(disconnectedError);
        this.gatewayReadyPromise.catch(() => {
          // suppress unhandled rejection noise; caller will re-establish on next run
        });
      },
      onEvent: (event: GatewayEventFrame) => {
        this.handleGatewayEvent(event);
      },
    });

    this.gatewayClient = client;
    this.gatewayClientVersion = connection.version;
    this.gatewayClientEntryPath = connection.clientEntryPath;
    client.start();
  }

  private stopGatewayClient(): void {
    try {
      this.gatewayClient?.stop();
    } catch (error) {
      console.warn('[OpenClawRuntime] Failed to stop gateway client:', error);
    }
    this.gatewayClient = null;
    this.gatewayClientVersion = null;
    this.gatewayClientEntryPath = null;
    this.gatewayReadyPromise = null;
  }

  private async loadGatewayClientCtor(clientEntryPath: string): Promise<GatewayClientCtor> {
    const modulePath = pathToFileURL(clientEntryPath).href;
    const loaded = await import(modulePath) as Record<string, unknown>;
    const direct = loaded.GatewayClient;
    if (typeof direct === 'function') {
      return direct as GatewayClientCtor;
    }

    const exportedValues = Object.values(loaded);
    for (const candidate of exportedValues) {
      if (typeof candidate !== 'function') {
        continue;
      }
      const maybeCtor = candidate as {
        name?: string;
        prototype?: {
          start?: unknown;
          stop?: unknown;
          request?: unknown;
        };
      };
      if (maybeCtor.name === 'GatewayClient') {
        return candidate as GatewayClientCtor;
      }
      const proto = maybeCtor.prototype;
      if (proto
        && typeof proto.start === 'function'
        && typeof proto.stop === 'function'
        && typeof proto.request === 'function') {
        return candidate as GatewayClientCtor;
      }
    }

    const exportKeysPreview = Object.keys(loaded).slice(0, 20).join(', ');
    throw new Error(
      `Invalid OpenClaw gateway client module: ${clientEntryPath} (exports: ${exportKeysPreview || 'none'})`,
    );
  }

  private handleGatewayEvent(event: GatewayEventFrame): void {
    if (event.event === 'chat') {
      this.handleChatEvent(event.payload);
      return;
    }

    if (event.event === 'exec.approval.requested') {
      this.handleApprovalRequested(event.payload);
      return;
    }

    if (event.event === 'exec.approval.resolved') {
      this.handleApprovalResolved(event.payload);
    }
  }

  private handleChatEvent(payload: unknown): void {
    if (!isRecord(payload)) return;
    const chatPayload = payload as ChatEventPayload;
    const state = chatPayload.state;
    if (!state) return;

    const sessionId = this.resolveSessionIdFromChatPayload(chatPayload);
    if (!sessionId) return;

    const turn = this.activeTurns.get(sessionId);
    if (!turn) return;

    if (state === 'delta') {
      this.handleChatDelta(sessionId, turn, chatPayload);
      return;
    }

    if (state === 'final') {
      this.handleChatFinal(sessionId, turn, chatPayload);
      return;
    }

    if (state === 'aborted') {
      this.handleChatAborted(sessionId, turn);
      return;
    }

    if (state === 'error') {
      this.handleChatError(sessionId, turn, chatPayload);
    }
  }

  private handleChatDelta(sessionId: string, turn: ActiveTurn, payload: ChatEventPayload): void {
    const streamedText = extractMessageText(payload.message);
    if (!streamedText) return;
    if (turn.currentText && streamedText.length < turn.currentText.length) {
      return;
    }

    if (!turn.assistantMessageId) {
      const assistantMessage = this.store.addMessage(sessionId, {
        type: 'assistant',
        content: streamedText,
        metadata: {
          isStreaming: true,
          isFinal: false,
        },
      });
      turn.assistantMessageId = assistantMessage.id;
      turn.currentText = streamedText;
      this.emit('message', sessionId, assistantMessage);
      return;
    }

    if (turn.assistantMessageId && streamedText !== turn.currentText) {
      this.store.updateMessage(sessionId, turn.assistantMessageId, {
        content: streamedText,
        metadata: {
          isStreaming: true,
          isFinal: false,
        },
      });
      turn.currentText = streamedText;
      this.emit('messageUpdate', sessionId, turn.assistantMessageId, streamedText);
    }
  }

  private handleChatFinal(sessionId: string, turn: ActiveTurn, payload: ChatEventPayload): void {
    const finalText = extractMessageText(payload.message).trim() || turn.currentText.trim();
    if (turn.assistantMessageId) {
      this.store.updateMessage(sessionId, turn.assistantMessageId, {
        content: finalText,
        metadata: {
          isStreaming: false,
          isFinal: true,
        },
      });
      if (finalText !== turn.currentText) {
        this.emit('messageUpdate', sessionId, turn.assistantMessageId, finalText);
      }
    } else if (finalText) {
      const assistantMessage = this.store.addMessage(sessionId, {
        type: 'assistant',
        content: finalText,
        metadata: {
          isStreaming: false,
          isFinal: true,
        },
      });
      this.emit('message', sessionId, assistantMessage);
    }

    this.store.updateSession(sessionId, { status: 'completed' });
    this.emit('complete', sessionId, payload.runId ?? turn.runId);
    this.cleanupSessionTurn(sessionId);
    this.resolveTurn(sessionId);
  }

  private handleChatAborted(sessionId: string, turn: ActiveTurn): void {
    this.store.updateSession(sessionId, { status: 'idle' });
    if (!turn.stopRequested) {
      this.emit('complete', sessionId, turn.runId);
    }
    this.cleanupSessionTurn(sessionId);
    this.resolveTurn(sessionId);
  }

  private handleChatError(sessionId: string, _turn: ActiveTurn, payload: ChatEventPayload): void {
    const errorMessage = payload.errorMessage?.trim() || 'OpenClaw run failed';
    this.store.updateSession(sessionId, { status: 'error' });
    this.emit('error', sessionId, errorMessage);
    this.cleanupSessionTurn(sessionId);
    this.rejectTurn(sessionId, new Error(errorMessage));
  }

  private handleApprovalRequested(payload: unknown): void {
    if (!isRecord(payload)) return;
    const typedPayload = payload as ExecApprovalRequestedPayload;
    const requestId = typeof typedPayload.id === 'string' ? typedPayload.id.trim() : '';
    if (!requestId) return;
    if (!typedPayload.request || !isRecord(typedPayload.request)) return;

    const request = typedPayload.request;
    const sessionKey = typeof request.sessionKey === 'string' ? request.sessionKey.trim() : '';
    const sessionId = sessionKey ? this.sessionIdBySessionKey.get(sessionKey) : undefined;
    if (!sessionId) {
      return;
    }

    this.pendingApprovals.set(requestId, { requestId, sessionId });

    const permissionRequest: PermissionRequest = {
      requestId,
      toolName: 'Bash',
      toolInput: {
        command: typeof request.command === 'string' ? request.command : '',
        cwd: request.cwd ?? null,
        host: request.host ?? null,
        security: request.security ?? null,
        ask: request.ask ?? null,
        resolvedPath: request.resolvedPath ?? null,
        sessionKey: request.sessionKey ?? null,
        agentId: request.agentId ?? null,
      },
      toolUseId: requestId,
    };

    this.emit('permissionRequest', sessionId, permissionRequest);
  }

  private handleApprovalResolved(payload: unknown): void {
    if (!isRecord(payload)) return;
    const typedPayload = payload as ExecApprovalResolvedPayload;
    const requestId = typeof typedPayload.id === 'string' ? typedPayload.id.trim() : '';
    if (!requestId) return;
    this.pendingApprovals.delete(requestId);
  }

  private resolveSessionIdFromChatPayload(payload: ChatEventPayload): string | null {
    const runId = typeof payload.runId === 'string' ? payload.runId : '';
    if (runId && this.sessionIdByRunId.has(runId)) {
      return this.sessionIdByRunId.get(runId) ?? null;
    }

    const sessionKey = typeof payload.sessionKey === 'string' ? payload.sessionKey : '';
    if (sessionKey && this.sessionIdBySessionKey.has(sessionKey)) {
      return this.sessionIdBySessionKey.get(sessionKey) ?? null;
    }
    return null;
  }

  private clearPendingApprovalsBySession(sessionId: string): void {
    for (const [requestId, pending] of this.pendingApprovals.entries()) {
      if (pending.sessionId === sessionId) {
        this.pendingApprovals.delete(requestId);
      }
    }
  }

  private cleanupSessionTurn(sessionId: string): void {
    const turn = this.activeTurns.get(sessionId);
    if (turn?.runId) {
      this.sessionIdByRunId.delete(turn.runId);
    }
    this.activeTurns.delete(sessionId);
  }

  private resolveTurn(sessionId: string): void {
    const pending = this.pendingTurns.get(sessionId);
    if (!pending) return;
    this.pendingTurns.delete(sessionId);
    pending.resolve();
  }

  private rejectTurn(sessionId: string, error: Error): void {
    const pending = this.pendingTurns.get(sessionId);
    if (!pending) return;
    this.pendingTurns.delete(sessionId);
    pending.reject(error);
  }

  private toSessionKey(sessionId: string): string {
    return `${OPENCLAW_SESSION_PREFIX}${sessionId}`;
  }

  private requireGatewayClient(): GatewayClientLike {
    if (!this.gatewayClient) {
      throw new Error('OpenClaw gateway client is unavailable.');
    }
    return this.gatewayClient;
  }
}
