import { afterEach, describe, expect, test, vi } from 'vitest';

import { store } from '../store';
import { beginLoadSession, clearCurrentSession, setCurrentSession, setSessions } from '../store/slices/coworkSlice';
import type { CoworkMessage, CoworkPermissionRequest, CoworkSession, CoworkSessionSummary } from '../types/cowork';
import { coworkService, mergeLoadedSessionWithCurrentSession } from './cowork';

type TestWindow = {
  electron?: {
    cowork?: {
      getSession: (sessionId: string) => Promise<{ success: boolean; session?: CoworkSession; error?: string }>;
      listSessions?: (agentId?: string) => Promise<{ success: boolean; sessions?: CoworkSessionSummary[]; error?: string }>;
      onSessionsChanged?: (callback: () => void) => () => void;
      onStreamComplete?: (callback: (data: { sessionId: string; claudeSessionId: string | null }) => void) => () => void;
      onStreamError?: (callback: (data: { sessionId: string; error: string }) => void) => () => void;
      onStreamMessage?: (callback: (data: { sessionId: string; message: CoworkMessage }) => void) => () => void;
      onStreamMessageUpdate?: (callback: (data: {
        sessionId: string;
        messageId: string;
        content: string;
        metadata?: CoworkMessage['metadata'];
      }) => void) => () => void;
      onStreamPermission?: (callback: (data: { sessionId: string; request: CoworkPermissionRequest }) => void) => () => void;
      onStreamPermissionDismiss?: (callback: (data: { requestId: string }) => void) => () => void;
      remoteManaged: (sessionId: string) => Promise<{ remoteManaged?: boolean }>;
    };
  };
};

type ListSessionsResult = { success: boolean; sessions: CoworkSessionSummary[] };

const makeSession = (id: string): CoworkSession => ({
  id,
  title: `Session ${id}`,
  claudeSessionId: null,
  status: 'completed',
  pinned: false,
  cwd: '/tmp',
  systemPrompt: '',
  executionMode: 'local',
  activeSkillIds: [],
  agentId: 'main',
  messages: [],
  createdAt: 1,
  updatedAt: 1,
});

const makeSummary = (session: CoworkSession): CoworkSessionSummary => ({
  id: session.id,
  title: session.title,
  status: session.status,
  pinned: session.pinned,
  agentId: session.agentId,
  source: 'chat',
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
});

const makeMessage = (id: string, type: CoworkMessage['type']): CoworkMessage => ({
  id,
  type,
  content: `${type} message`,
  timestamp: Date.now(),
});

const setupStreamListenerMock = (options: { session?: CoworkSession } = {}) => {
  const listeners: Partial<{
    message: (data: { sessionId: string; message: CoworkMessage }) => void;
    complete: (data: { sessionId: string; claudeSessionId: string | null }) => void;
    error: (data: { sessionId: string; error: string }) => void;
  }> = {};

  (globalThis.window as unknown as TestWindow).electron = {
    cowork: {
      getSession: vi.fn(async () => {
        if (!options.session) {
          return { success: false, error: 'session not found' };
        }
        return { success: true, session: options.session };
      }),
      listSessions: vi.fn(async () => ({ success: true, sessions: [] })),
      onSessionsChanged: vi.fn(() => vi.fn()),
      onStreamComplete: vi.fn((callback) => {
        listeners.complete = callback;
        return vi.fn();
      }),
      onStreamError: vi.fn((callback) => {
        listeners.error = callback;
        return vi.fn();
      }),
      onStreamMessage: vi.fn((callback) => {
        listeners.message = callback;
        return vi.fn();
      }),
      onStreamMessageUpdate: vi.fn(() => vi.fn()),
      onStreamPermission: vi.fn(() => vi.fn()),
      onStreamPermissionDismiss: vi.fn(() => vi.fn()),
      remoteManaged: vi.fn(async () => ({ remoteManaged: false })),
    },
  };

  coworkService.setupStreamListenersForTest();
  return listeners;
};

if (!globalThis.window) {
  globalThis.window = {} as Window & typeof globalThis;
}

afterEach(() => {
  coworkService.cleanupListenersForTest();
  delete (globalThis.window as unknown as TestWindow).electron;
  store.dispatch(clearCurrentSession());
  store.dispatch(setSessions([]));
  vi.restoreAllMocks();
});

describe('CoworkService.loadSessions', () => {
  test('coalesces concurrent refreshes for the same agent key', async () => {
    let resolveListSessions: (result: ListSessionsResult) => void = () => {
      throw new Error('listSessions resolver was not captured');
    };
    const sessions: CoworkSessionSummary[] = [{
      id: 'session-a',
      title: 'Session A',
      status: 'completed',
      pinned: false,
      agentId: 'main',
      source: 'chat',
      createdAt: 1,
      updatedAt: 1,
    }];
    const listSessions = vi.fn()
      .mockImplementationOnce(() => new Promise<ListSessionsResult>((resolve) => {
        resolveListSessions = resolve;
      }))
      .mockResolvedValue({ success: true, sessions });

    (globalThis.window as unknown as TestWindow).electron = {
      cowork: {
        getSession: vi.fn(),
        listSessions,
        remoteManaged: vi.fn(async () => ({ remoteManaged: false })),
      },
    };

    const firstRefresh = coworkService.loadSessions();
    const secondRefresh = coworkService.loadSessions();

    expect(listSessions).toHaveBeenCalledTimes(1);

    resolveListSessions?.({ success: true, sessions });
    await Promise.all([firstRefresh, secondRefresh]);

    expect(store.getState().cowork.sessions).toEqual(sessions);

    await coworkService.loadSessions();

    expect(listSessions).toHaveBeenCalledTimes(2);
  });
});

describe('CoworkService stream status handling', () => {
  test('late assistant message after completion does not move the session back to running', async () => {
    const session = {
      ...makeSession('session-a'),
      status: 'running' as const,
    };
    const listeners = setupStreamListenerMock({ session: { ...session, status: 'completed' } });

    store.dispatch(setSessions([makeSummary(session)]));
    store.dispatch(setCurrentSession(session));

    listeners.complete?.({ sessionId: session.id, claudeSessionId: null });
    listeners.message?.({ sessionId: session.id, message: makeMessage('assistant-late', 'assistant') });
    await Promise.resolve();

    expect(store.getState().cowork.currentSession?.status).toBe('completed');
    expect(store.getState().cowork.isStreaming).toBe(false);
  });

  test('new user stream message can mark an existing IM session as running', async () => {
    const session = makeSession('session-a');
    const listeners = setupStreamListenerMock();

    store.dispatch(setSessions([makeSummary(session)]));
    store.dispatch(setCurrentSession(session));

    listeners.message?.({ sessionId: session.id, message: makeMessage('user-new-turn', 'user') });

    expect(store.getState().cowork.currentSession?.status).toBe('running');
    expect(store.getState().cowork.isStreaming).toBe(true);
  });
});

describe('CoworkService.loadSession', () => {
  test('preserveSelection skips stale background refresh when active session changed', async () => {
    const sessionA = makeSession('session-a');
    const sessionB = makeSession('session-b');

    (globalThis.window as unknown as TestWindow).electron = {
      cowork: {
        getSession: vi.fn(async (sessionId: string) => ({
          success: true,
          session: sessionId === sessionA.id ? sessionA : sessionB,
        })),
        remoteManaged: vi.fn(async () => ({ remoteManaged: false })),
      },
    };

    store.dispatch(beginLoadSession(sessionA.id));
    const backgroundRefresh = coworkService.loadSession(sessionA.id, { preserveSelection: true });
    store.dispatch(beginLoadSession(sessionB.id));

    await backgroundRefresh;

    expect(store.getState().cowork.currentSessionId).toBe(sessionB.id);
    expect(store.getState().cowork.currentSession).toBeNull();
  });

  test('normal user selection still applies the loaded session', async () => {
    const sessionA = makeSession('session-a');

    (globalThis.window as unknown as TestWindow).electron = {
      cowork: {
        getSession: vi.fn(async () => ({ success: true, session: sessionA })),
        remoteManaged: vi.fn(async () => ({ remoteManaged: false })),
      },
    };

    store.dispatch(beginLoadSession(sessionA.id));

    await coworkService.loadSession(sessionA.id);

    expect(store.getState().cowork.currentSession?.id).toBe(sessionA.id);
  });
});

describe('mergeLoadedSessionWithCurrentSession', () => {
  test('keeps already displayed history when a same-session refresh is shorter', () => {
    const current = {
      ...makeSession('session-a'),
      messages: [
        { id: 'user-1', type: 'user' as const, content: 'first question', timestamp: 1 },
        { id: 'assistant-1', type: 'assistant' as const, content: 'first answer', timestamp: 2 },
        { id: 'user-2', type: 'user' as const, content: 'second question', timestamp: 3 },
      ],
      updatedAt: 3,
    };
    const loaded = {
      ...current,
      messages: [
        { id: 'user-2', type: 'user' as const, content: 'second question edited', timestamp: 4 },
      ],
      updatedAt: 4,
    };

    const merged = mergeLoadedSessionWithCurrentSession(loaded, current);

    expect(merged.messages).toHaveLength(3);
    expect(merged.messages.map((message) => message.id)).toEqual([
      'user-1',
      'assistant-1',
      'user-2',
    ]);
    expect(merged.messages[2]?.content).toBe('second question edited');
    expect(merged.updatedAt).toBe(4);
  });

  test('uses the loaded session when it is not shorter', () => {
    const current = {
      ...makeSession('session-a'),
      messages: [
        { id: 'user-1', type: 'user' as const, content: 'first question', timestamp: 1 },
      ],
    };
    const loaded = {
      ...current,
      messages: [
        { id: 'user-1', type: 'user' as const, content: 'first question', timestamp: 1 },
        { id: 'assistant-1', type: 'assistant' as const, content: 'first answer', timestamp: 2 },
      ],
    };

    expect(mergeLoadedSessionWithCurrentSession(loaded, current)).toBe(loaded);
  });
});
