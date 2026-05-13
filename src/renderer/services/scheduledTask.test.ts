import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { DeliveryMode, PayloadKind, ScheduleKind, SessionTarget, TaskStatus, WakeMode } from '../../scheduledTask/constants';
import type { ScheduledTask, ScheduledTaskRunEvent } from '../../scheduledTask/types';
import { store } from '../store';
import {
  setTasks,
  updateTaskState,
} from '../store/slices/scheduledTaskSlice';
import { ScheduledTaskService } from './scheduledTask';

type TestWindow = {
  electron?: {
    scheduledTasks?: {
      get?: (id: string) => Promise<{ success: boolean; task?: ScheduledTask; error?: string }>;
      listAllRuns?: (...args: unknown[]) => Promise<{ success: boolean; runs?: unknown[]; error?: string }>;
      list?: () => Promise<{ success: boolean; tasks?: ScheduledTask[]; error?: string }>;
      listRuns?: (...args: unknown[]) => Promise<{ success: boolean; runs?: unknown[]; error?: string }>;
      onRefresh?: (callback: () => void) => () => void;
      onRunUpdate?: (callback: (event: ScheduledTaskRunEvent) => void) => () => void;
      onStatusUpdate?: (callback: unknown) => () => void;
      runManually?: (id: string) => Promise<{ success: boolean; error?: string }>;
    };
  };
  dispatchEvent: ReturnType<typeof vi.fn>;
  setTimeout: typeof setTimeout;
};

if (!globalThis.window) {
  globalThis.window = {
    dispatchEvent: vi.fn(() => true),
    setTimeout,
  } as unknown as Window & typeof globalThis;
}

function makeScheduledTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: 'task-1',
    name: 'Manual task',
    description: '',
    enabled: true,
    schedule: { kind: ScheduleKind.Every, everyMs: 3600000 },
    sessionTarget: SessionTarget.Main,
    wakeMode: WakeMode.Now,
    payload: { kind: PayloadKind.SystemEvent, text: 'test' },
    delivery: { mode: DeliveryMode.None },
    agentId: 'main',
    sessionKey: null,
    state: {
      nextRunAtMs: null,
      lastRunAtMs: null,
      lastStatus: null,
      lastError: null,
      lastDurationMs: null,
      runningAtMs: null,
      consecutiveErrors: 0,
    },
    createdAt: '2026-05-11T00:00:00.000Z',
    updatedAt: '2026-05-11T00:00:00.000Z',
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useRealTimers();
  (globalThis.window as unknown as TestWindow).dispatchEvent = vi.fn(() => true);
});

afterEach(() => {
  delete (globalThis.window as unknown as TestWindow).electron;
  store.dispatch(setTasks([]));
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ScheduledTaskService.runManually', () => {
  test('deduplicates concurrent manual run requests for the same task', async () => {
    const service = new ScheduledTaskService();
    const pending = deferred<{ success: boolean }>();
    const runManually = vi.fn(() => pending.promise);
    (globalThis.window as unknown as TestWindow).electron = { scheduledTasks: { runManually } };
    store.dispatch(setTasks([makeScheduledTask()]));

    const first = service.runManually('task-1');
    const second = service.runManually('task-1');

    expect(runManually).toHaveBeenCalledTimes(1);
    expect(store.getState().scheduledTask.tasks[0].state.runningAtMs).toEqual(expect.any(Number));
    expect(store.getState().scheduledTask.tasks[0].state.lastStatus).toBe(TaskStatus.Running);
    expect(store.getState().scheduledTask.runs['task-1']).toEqual([
      expect.objectContaining({
        id: 'pending-manual-task-1',
        taskId: 'task-1',
        taskName: 'Manual task',
        status: TaskStatus.Running,
        finishedAt: null,
      }),
    ]);

    pending.resolve({ success: true });
    await Promise.all([first, second]);

    store.dispatch(updateTaskState({
      taskId: 'task-1',
      taskState: {
        nextRunAtMs: null,
        lastRunAtMs: Date.now(),
        lastStatus: TaskStatus.Success,
        lastError: null,
        lastDurationMs: 1000,
        runningAtMs: null,
        consecutiveErrors: 0,
      },
    }));

    await service.runManually('task-1');
    expect(runManually).toHaveBeenCalledTimes(2);
  });

  test('skips manual run when the task is already marked running', async () => {
    const service = new ScheduledTaskService();
    const runManually = vi.fn(async () => ({ success: true }));
    (globalThis.window as unknown as TestWindow).electron = { scheduledTasks: { runManually } };
    store.dispatch(setTasks([
      makeScheduledTask({
        state: {
          nextRunAtMs: null,
          lastRunAtMs: null,
          lastStatus: TaskStatus.Running,
          lastError: null,
          lastDurationMs: null,
          runningAtMs: Date.now(),
          consecutiveErrors: 0,
        },
      }),
    ]));

    await service.runManually('task-1');

    expect(runManually).not.toHaveBeenCalled();
  });

  test('rolls back optimistic running state when manual run fails', async () => {
    const service = new ScheduledTaskService();
    (globalThis.window as unknown as TestWindow).electron = {
      scheduledTasks: {
        runManually: vi.fn(async () => ({ success: false, error: 'gateway unavailable' })),
      },
    };
    const task = makeScheduledTask();
    store.dispatch(setTasks([task]));

    await expect(service.runManually('task-1')).rejects.toThrow('gateway unavailable');

    expect(store.getState().scheduledTask.tasks[0].state).toEqual(task.state);
    expect(store.getState().scheduledTask.runs['task-1']).toEqual([
      expect.objectContaining({
        id: 'pending-manual-task-1',
        status: TaskStatus.Error,
        error: 'gateway unavailable',
        finishedAt: expect.any(String),
        durationMs: expect.any(Number),
      }),
    ]);
    expect((globalThis.window as unknown as TestWindow).dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'app:showToast',
        detail: expect.stringContaining('gateway unavailable'),
      }),
    );
  });
});

describe('ScheduledTaskService scheduled task events', () => {
  test('refreshes task state after receiving a run update', async () => {
    vi.useFakeTimers();
    (globalThis.window as unknown as TestWindow).setTimeout = setTimeout;
    let runUpdateCallback = (_event: ScheduledTaskRunEvent): void => {
      throw new Error('run update listener was not registered');
    };
    const refreshedTask = makeScheduledTask({
      state: {
        nextRunAtMs: null,
        lastRunAtMs: Date.now(),
        lastStatus: TaskStatus.Success,
        lastError: null,
        lastDurationMs: 1000,
        runningAtMs: null,
        consecutiveErrors: 0,
      },
    });
    const get = vi.fn(async () => ({ success: true, task: refreshedTask }));
    (globalThis.window as unknown as TestWindow).electron = {
      scheduledTasks: {
        get,
        list: vi.fn(async () => ({ success: true, tasks: [] })),
        onRefresh: vi.fn(() => () => undefined),
        onRunUpdate: vi.fn((callback) => {
          runUpdateCallback = callback;
          return () => undefined;
        }),
        onStatusUpdate: vi.fn(() => () => undefined),
      },
    };
    const service = new ScheduledTaskService();
    await service.init();
    store.dispatch(setTasks([
      makeScheduledTask({
        state: {
          nextRunAtMs: null,
          lastRunAtMs: null,
          lastStatus: TaskStatus.Running,
          lastError: null,
          lastDurationMs: null,
          runningAtMs: Date.now(),
          consecutiveErrors: 0,
        },
      }),
    ]));
    runUpdateCallback({
      run: {
        id: 'run-1',
        taskId: 'task-1',
        taskName: 'Manual task',
        sessionId: null,
        sessionKey: null,
        status: TaskStatus.Success,
        startedAt: '2026-05-11T10:00:00.000Z',
        finishedAt: '2026-05-11T10:00:01.000Z',
        durationMs: 1000,
        error: null,
      },
    });

    await vi.advanceTimersByTimeAsync(500);

    expect(get).toHaveBeenCalledWith('task-1');
    expect(store.getState().scheduledTask.tasks[0].state).toEqual(refreshedTask.state);
  });
});

describe('ScheduledTaskService run history filters', () => {
  test('passes filters when loading task runs', async () => {
    const listRuns = vi.fn(async () => ({ success: true, runs: [] }));
    (globalThis.window as unknown as TestWindow).electron = {
      scheduledTasks: { listRuns },
    };
    const service = new ScheduledTaskService();

    await service.loadRuns('task-1', 30, 60, {
      startDate: '2026-05-01',
      endDate: '2026-05-11',
      status: TaskStatus.Success,
    });

    expect(listRuns).toHaveBeenCalledWith('task-1', 30, 60, {
      startDate: '2026-05-01',
      endDate: '2026-05-11',
      status: TaskStatus.Success,
    });
  });

  test('passes filters when loading all runs', async () => {
    const listAllRuns = vi.fn(async () => ({ success: true, runs: [] }));
    (globalThis.window as unknown as TestWindow).electron = {
      scheduledTasks: { listAllRuns },
    };
    const service = new ScheduledTaskService();

    await service.loadAllRuns(30, 60, {
      startDate: '2026-05-01',
      endDate: '2026-05-11',
      status: TaskStatus.Error,
    });

    expect(listAllRuns).toHaveBeenCalledWith(30, 60, {
      startDate: '2026-05-01',
      endDate: '2026-05-11',
      status: TaskStatus.Error,
    });
  });
});
