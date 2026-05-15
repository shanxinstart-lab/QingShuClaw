import { afterEach, describe, expect, test, vi } from 'vitest';

import { DEFAULT_PET_CONFIG } from '../../shared/pet/config';
import {
  PET_NOTIFICATION_LIFETIME_MS,
  PetMode,
  PetSource,
  PetStatus,
} from '../../shared/pet/constants';
import type { PetCatalogEntry, PetRuntimeState } from '../../shared/pet/types';
import {
  mergePetSessionNotifications,
  petService,
  resolvePetActiveSessionsFromCoworkState,
  resolvePetMessageFromCoworkState,
  resolvePetSessionSnapshotsFromCoworkState,
  resolvePetStatusFromCoworkState,
} from './petService';

const pet: PetCatalogEntry = {
  id: 'codex',
  displayName: 'Codex',
  description: 'Codex pet',
  source: PetSource.Bundled,
  bundled: true,
  installed: true,
  selectable: true,
};

afterEach(() => {
  Object.assign(petService, {
    state: null,
    cleanup: null,
    lastSentStatus: null,
    sessionMessages: new Map(),
    trackedSessions: new Map(),
    acknowledgedSessionAt: new Map(),
  });
  vi.restoreAllMocks();
});

describe('resolvePetStatusFromCoworkState', () => {
  const state = (input: {
    isStreaming?: boolean;
    status?: 'idle' | 'running' | 'completed' | 'error';
    pendingPermissions?: unknown[];
    sessions?: Array<{ id: string; title: string; status: 'idle' | 'running' | 'completed' | 'error'; updatedAt: number }>;
  }) => ({
    isStreaming: input.isStreaming ?? false,
    currentSession: input.status ? { status: input.status } : null,
    pendingPermissions: input.pendingPermissions ?? [],
    sessions: input.sessions ?? [],
  });

  test('maps pending permission to waiting', () => {
    expect(resolvePetStatusFromCoworkState(state({
      isStreaming: true,
      status: 'running',
      pendingPermissions: [{}],
    }))).toBe(PetStatus.Waiting);
  });

  test.each([
    [state({ isStreaming: true }), PetStatus.Running],
    [state({ status: 'running' }), PetStatus.Running],
    [state({ status: 'completed' }), PetStatus.Review],
    [state({ status: 'error' }), PetStatus.Failed],
    [state({ status: 'idle' }), PetStatus.Idle],
    [state({}), PetStatus.Idle],
  ])('maps cowork state %# to pet status', (coworkState, expected) => {
    expect(resolvePetStatusFromCoworkState(coworkState)).toBe(expected);
  });

  test('uses Codex-style fallback messages for runtime states', () => {
    expect(resolvePetMessageFromCoworkState(state({ isStreaming: true }), PetStatus.Running)).toBe('Thinking');
    expect(resolvePetMessageFromCoworkState(state({ status: 'completed' }), PetStatus.Review)).toBe('Ready');
    expect(resolvePetMessageFromCoworkState(state({ status: 'error' }), PetStatus.Failed)).toBe('Blocked');
    expect(resolvePetMessageFromCoworkState(state({ pendingPermissions: [{}] }), PetStatus.Waiting)).toBe('Needs input');
  });

  test('projects latest session messages into pet bubble text', () => {
    const coworkState = {
      isStreaming: false,
      pendingPermissions: [],
      currentSession: {
        status: 'completed' as const,
        messages: [
          { id: 'user-1', type: 'user' as const, content: '请修复测试', timestamp: 1 },
          { id: 'assistant-1', type: 'assistant' as const, content: '测试已经修复，并补充了覆盖。', timestamp: 2 },
        ],
      },
    };

    expect(resolvePetMessageFromCoworkState(coworkState, PetStatus.Review)).toBe('测试已经修复，并补充了覆盖。');
  });
});

describe('resolvePetActiveSessionsFromCoworkState', () => {
  test('projects running sessions sorted by status and recency', () => {
    const sessions = resolvePetActiveSessionsFromCoworkState({
      isStreaming: false,
      pendingPermissions: [],
      currentSession: null,
      sessions: [
        { id: 'old', title: '旧会话', status: 'running', updatedAt: 10 },
        { id: 'done', title: '已完成', status: 'completed', updatedAt: 30 },
        { id: 'new', title: '新会话', status: 'running', updatedAt: 20 },
      ],
    });

    expect(sessions.map((session) => session.id)).toEqual(['new', 'old']);
    expect(sessions[0].progressLabel).toBe('Loading');
  });

  test('uses current running session messages for active session preview', () => {
    const sessions = resolvePetActiveSessionsFromCoworkState({
      isStreaming: true,
      pendingPermissions: [],
      sessions: [],
      currentSession: {
        id: 'current',
        title: '当前会话',
        status: 'running',
        updatedAt: 40,
        messages: [
          { id: 'user-1', type: 'user', content: '请把宠物会话列表也对齐 Codex', timestamp: 1 },
        ],
      },
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: 'current',
      title: '当前会话',
      status: PetStatus.Running,
      message: '请把宠物会话列表也对齐 Codex',
    });
  });

  test('marks sessions with pending permission as waiting', () => {
    const sessions = resolvePetActiveSessionsFromCoworkState({
      isStreaming: false,
      pendingPermissions: [{ sessionId: 'needs-input' }],
      currentSession: null,
      sessions: [
        { id: 'needs-input', title: '权限确认', status: 'running', updatedAt: 50 },
      ],
    });

    expect(sessions[0]).toMatchObject({
      id: 'needs-input',
      status: PetStatus.Waiting,
      progressLabel: 'Needs input',
    });
  });
});

describe('resolvePetSessionSnapshotsFromCoworkState', () => {
  test('includes completed sessions as ready snapshots', () => {
    const sessions = resolvePetSessionSnapshotsFromCoworkState({
      isStreaming: false,
      pendingPermissions: [],
      currentSession: null,
      sessions: [
        { id: 'done', title: '已完成', status: 'completed', updatedAt: 30 },
      ],
    });

    expect(sessions).toEqual([
      expect.objectContaining({
        id: 'done',
        status: PetStatus.Review,
        progressLabel: 'Ready',
      }),
    ]);
  });
});

describe('mergePetSessionNotifications', () => {
  const now = 1_000_000;
  const session = (
    id: string,
    status: PetStatus,
    updatedAt: number,
  ) => ({
    id,
    title: id,
    status,
    message: null,
    progressLabel: status === PetStatus.Running ? 'Loading' : 'Ready',
    updatedAt,
  });

  test('keeps completed session notifications until acknowledged', () => {
    const merged = mergePetSessionNotifications(
      [session('task-1', PetStatus.Running, 10)],
      [session('task-1', PetStatus.Review, 20)],
      {},
      now,
    );

    expect(merged).toEqual([
      expect.objectContaining({ id: 'task-1', status: PetStatus.Review }),
    ]);
  });

  test('shows newly completed and failed sessions even when they were not previously tracked', () => {
    const merged = mergePetSessionNotifications(
      [],
      [
        session('done', PetStatus.Review, now - 2),
        session('failed', PetStatus.Failed, now - 1),
      ],
      {},
      now,
      { terminalSnapshotCutoffMs: now - 10 },
    );

    expect(merged).toEqual([
      expect.objectContaining({ id: 'done', status: PetStatus.Review }),
      expect.objectContaining({ id: 'failed', status: PetStatus.Failed }),
    ]);
  });

  test('skips historical completed and failed snapshots from before notification startup', () => {
    const merged = mergePetSessionNotifications(
      [],
      [
        session('old-done', PetStatus.Review, now - 200),
        session('old-failed', PetStatus.Failed, now - 100),
      ],
      {},
      now,
      { terminalSnapshotCutoffMs: now - 50 },
    );

    expect(merged).toEqual([]);
  });

  test('keeps terminal snapshots that were already visible before startup cutoff filtering', () => {
    const merged = mergePetSessionNotifications(
      [session('task-1', PetStatus.Running, now - 200)],
      [session('task-1', PetStatus.Review, now - 100)],
      {},
      now,
      { terminalSnapshotCutoffMs: now - 50 },
    );

    expect(merged).toEqual([
      expect.objectContaining({ id: 'task-1', status: PetStatus.Review }),
    ]);
  });

  test('sorts visible notifications by Codex status priority then recency', () => {
    const merged = mergePetSessionNotifications(
      [],
      [
        session('review-newer', PetStatus.Review, now - 1),
        session('running-old', PetStatus.Running, now - 30),
        session('waiting-old', PetStatus.Waiting, now - 40),
        session('failed-newest', PetStatus.Failed, now),
        session('running-newer', PetStatus.Running, now - 10),
      ],
      {},
      now,
    );

    expect(merged.map((item) => item.id)).toEqual([
      'waiting-old',
      'running-newer',
      'running-old',
      'review-newer',
      'failed-newest',
    ]);
  });

  test('removes acknowledged completed notifications', () => {
    const merged = mergePetSessionNotifications(
      [session('task-1', PetStatus.Review, 20)],
      [session('task-1', PetStatus.Review, 20)],
      { 'task-1': 30 },
      now,
    );

    expect(merged).toEqual([]);
  });

  test('shows a newly updated session after an earlier acknowledgement', () => {
    const merged = mergePetSessionNotifications(
      [],
      [session('task-1', PetStatus.Running, now - 1)],
      { 'task-1': now - 2 },
      now,
    );

    expect(merged).toEqual([
      expect.objectContaining({ id: 'task-1', status: PetStatus.Running }),
    ]);
  });

  test('expires running notifications after the Codex lifetime', () => {
    const merged = mergePetSessionNotifications(
      [session('task-1', PetStatus.Running, now - PET_NOTIFICATION_LIFETIME_MS[PetStatus.Running] - 1)],
      [],
      {},
      now,
    );

    expect(merged).toEqual([]);
  });

  test('keeps waiting notifications before the Codex lifetime', () => {
    const merged = mergePetSessionNotifications(
      [session('task-1', PetStatus.Waiting, now - PET_NOTIFICATION_LIFETIME_MS[PetStatus.Waiting] + 1)],
      [session('task-1', PetStatus.Waiting, now - PET_NOTIFICATION_LIFETIME_MS[PetStatus.Waiting] + 1)],
      {},
      now,
    );

    expect(merged).toEqual([
      expect.objectContaining({ id: 'task-1', status: PetStatus.Waiting }),
    ]);
  });

  test('expires completed notifications after the Codex lifetime', () => {
    const merged = mergePetSessionNotifications(
      [session('task-1', PetStatus.Review, now - PET_NOTIFICATION_LIFETIME_MS[PetStatus.Review] - 1)],
      [],
      {},
      now,
    );

    expect(merged).toEqual([]);
  });

  test('expires failed notifications after the Codex lifetime', () => {
    const merged = mergePetSessionNotifications(
      [session('task-1', PetStatus.Failed, now - PET_NOTIFICATION_LIFETIME_MS[PetStatus.Failed] - 1)],
      [],
      {},
      now,
    );

    expect(merged).toEqual([]);
  });
});

describe('petService session acknowledgement', () => {
  test('removes only the acknowledged session after syncing runtime state from main', async () => {
    const stateChangedCallbacks: Array<(state: PetRuntimeState) => void> = [];
    const runtimeState: PetRuntimeState = {
      config: {
        ...DEFAULT_PET_CONFIG,
        enabled: true,
        mode: PetMode.Floating,
      },
      status: PetStatus.Running,
      message: 'Thinking',
      session: { id: 'task-1', title: 'Task 1' },
      activePet: pet,
      pets: [pet],
      activeSessions: [
        {
          id: 'task-1',
          title: 'Task 1',
          status: PetStatus.Running,
          message: 'Working',
          progressLabel: 'Loading',
          updatedAt: 20,
        },
        {
          id: 'task-2',
          title: 'Task 2',
          status: PetStatus.Review,
          message: 'Done',
          progressLabel: 'Ready',
          updatedAt: 10,
        },
      ],
    };
    const setRuntimeProjection = vi.fn(async (projection) => ({
      success: true,
      state: {
        ...runtimeState,
        activeSessions: projection.activeSessions,
      },
    }));
    const acknowledgeSession = vi.fn(async (sessionId: string) => ({
      success: true,
      state: {
        ...runtimeState,
        activeSessions: runtimeState.activeSessions.filter((session) => session.id !== sessionId),
      },
    }));
    vi.stubGlobal('window', {
      electron: {
        pet: {
          getConfig: vi.fn(async () => ({ success: true, config: runtimeState.config })),
          getState: vi.fn(async () => ({ success: false })),
          listPets: vi.fn(async () => ({ success: true, pets: runtimeState.pets })),
          onStateChanged: vi.fn((callback) => {
            stateChangedCallbacks.push(callback);
            return vi.fn();
          }),
          acknowledgeSession,
          setRuntimeProjection,
        },
      },
    });

    await petService.init();
    stateChangedCallbacks[0]?.(runtimeState);
    await petService.acknowledgeSession('task-1');

    expect(acknowledgeSession).toHaveBeenCalledWith('task-1');
    expect(setRuntimeProjection).not.toHaveBeenCalled();
    expect(petService.getState()?.activeSessions).toEqual([
      expect.objectContaining({ id: 'task-2' }),
    ]);
  });

  test('loads full runtime state on init so floating windows survive reloads', async () => {
    const runtimeState: PetRuntimeState = {
      config: {
        ...DEFAULT_PET_CONFIG,
        enabled: true,
        mode: PetMode.Floating,
      },
      status: PetStatus.Running,
      message: 'Thinking',
      session: { id: 'task-1', title: 'Task 1' },
      activePet: pet,
      pets: [pet],
      activeSessions: [
        {
          id: 'task-1',
          title: 'Task 1',
          status: PetStatus.Running,
          message: 'Working',
          progressLabel: 'Loading',
          updatedAt: 20,
        },
      ],
    };
    vi.stubGlobal('window', {
      electron: {
        pet: {
          getConfig: vi.fn(async () => ({ success: true, config: runtimeState.config })),
          getState: vi.fn(async () => ({ success: true, state: runtimeState })),
          listPets: vi.fn(async () => ({ success: true, pets: runtimeState.pets })),
          onStateChanged: vi.fn(() => vi.fn()),
        },
      },
    });

    await petService.init();

    expect(petService.getState()?.activeSessions).toEqual([
      expect.objectContaining({ id: 'task-1' }),
    ]);
  });
});
