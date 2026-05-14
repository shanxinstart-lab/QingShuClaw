import { describe, expect, test } from 'vitest';

import { PET_NOTIFICATION_LIFETIME_MS, PetStatus } from '../../shared/pet/constants';
import {
  mergePetSessionNotifications,
  resolvePetActiveSessionsFromCoworkState,
  resolvePetMessageFromCoworkState,
  resolvePetSessionSnapshotsFromCoworkState,
  resolvePetStatusFromCoworkState,
} from './petService';

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
