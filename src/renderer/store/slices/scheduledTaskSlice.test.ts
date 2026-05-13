import { describe, expect, test } from 'vitest';

import { TaskStatus } from '../../../scheduledTask/constants';
import type { ScheduledTaskRunWithName } from '../../../scheduledTask/types';
import reducer, {
  addOrUpdateRun,
  appendAllRuns,
  removeTask,
  updateTaskState,
  setAllRuns,
} from './scheduledTaskSlice';

const makeRun = (overrides: Partial<ScheduledTaskRunWithName> = {}): ScheduledTaskRunWithName => ({
  id: 'run-1',
  taskId: 'task-1',
  taskName: 'Daily report',
  sessionId: 'session-1',
  sessionKey: 'agent:main:run:run-1',
  status: TaskStatus.Running,
  startedAt: '2026-05-11T10:00:00.000Z',
  finishedAt: null,
  durationMs: null,
  error: null,
  ...overrides,
});

describe('scheduledTaskSlice run updates', () => {
  test('adds run updates to both task history and all runs history', () => {
    const nextState = reducer(undefined, addOrUpdateRun(makeRun()));

    expect(nextState.runs['task-1']).toEqual([makeRun()]);
    expect(nextState.allRuns).toEqual([makeRun()]);
  });

  test('updates existing all-runs entries without duplicating them', () => {
    const initialState = reducer(undefined, setAllRuns([
      makeRun({
        status: TaskStatus.Running,
        taskName: 'Old title',
      }),
    ]));

    const finishedRun = makeRun({
      status: TaskStatus.Success,
      taskName: 'Daily report',
      finishedAt: '2026-05-11T10:01:00.000Z',
      durationMs: 60_000,
    });
    const nextState = reducer(initialState, addOrUpdateRun(finishedRun));

    expect(nextState.allRuns).toEqual([finishedRun]);
    expect(nextState.runs['task-1']).toEqual([finishedRun]);
  });

  test('replaces pending manual run placeholder when a real run arrives', () => {
    const initialState = reducer(
      reducer(undefined, addOrUpdateRun(makeRun({
        id: 'pending-manual-task-1',
        status: TaskStatus.Running,
      }))),
      setAllRuns({
        runs: [makeRun({
          id: 'pending-manual-task-1',
          status: TaskStatus.Running,
        })],
        hasMore: false,
      }),
    );

    const finishedRun = makeRun({
      id: 'run-real-1',
      status: TaskStatus.Success,
      finishedAt: '2026-05-11T10:01:00.000Z',
      durationMs: 60_000,
    });
    const nextState = reducer(initialState, addOrUpdateRun(finishedRun));

    expect(nextState.runs['task-1'].map((run) => run.id)).toEqual(['run-real-1']);
    expect(nextState.allRuns.map((run) => run.id)).toEqual(['run-real-1']);
  });

  test('syncs pending manual run status from task state updates', () => {
    const initialState = reducer(
      reducer(undefined, addOrUpdateRun(makeRun({
        id: 'pending-manual-task-1',
        status: TaskStatus.Running,
        finishedAt: null,
        durationMs: null,
      }))),
      setAllRuns({
        runs: [makeRun({
          id: 'pending-manual-task-1',
          status: TaskStatus.Running,
          finishedAt: null,
          durationMs: null,
        })],
        hasMore: false,
      }),
    );

    const nextState = reducer(initialState, updateTaskState({
      taskId: 'task-1',
      taskState: {
        nextRunAtMs: null,
        lastRunAtMs: Date.parse('2026-05-11T10:21:01.000Z'),
        lastStatus: TaskStatus.Success,
        lastError: null,
        lastDurationMs: 1200,
        runningAtMs: null,
        consecutiveErrors: 0,
      },
    }));

    expect(nextState.runs['task-1'][0]).toMatchObject({
      id: 'pending-manual-task-1',
      status: TaskStatus.Success,
      finishedAt: '2026-05-11T10:21:01.000Z',
      durationMs: 1200,
      error: null,
    });
    expect(nextState.allRuns[0]).toMatchObject({
      id: 'pending-manual-task-1',
      status: TaskStatus.Success,
      finishedAt: '2026-05-11T10:21:01.000Z',
      durationMs: 1200,
      error: null,
    });
  });

  test('deduplicates appended all-runs entries from paginated loads', () => {
    const initialState = reducer(undefined, setAllRuns({
      runs: [makeRun({ id: 'run-1' })],
      hasMore: true,
    }));

    const nextState = reducer(initialState, appendAllRuns({
      runs: [
        makeRun({ id: 'run-1' }),
        makeRun({ id: 'run-2', taskId: 'task-2', taskName: 'Weekly report' }),
      ],
      hasMore: false,
    }));

    expect(nextState.allRuns.map((run) => run.id)).toEqual(['run-1', 'run-2']);
    expect(nextState.allRunsHasMore).toBe(false);
  });

  test('tracks hasMore for initial all-runs loads', () => {
    const nextState = reducer(undefined, setAllRuns({
      runs: [makeRun({ id: 'run-1' })],
      hasMore: true,
    }));

    expect(nextState.allRunsHasMore).toBe(true);
  });

  test('legacy all-runs payload clears hasMore', () => {
    const initialState = reducer(undefined, setAllRuns({
      runs: [makeRun({ id: 'run-1' })],
      hasMore: true,
    }));
    const nextState = reducer(initialState, setAllRuns([makeRun({ id: 'run-2' })]));

    expect(nextState.allRuns.map((run) => run.id)).toEqual(['run-2']);
    expect(nextState.allRunsHasMore).toBe(false);
  });

  test('removing a task also removes matching all-runs entries', () => {
    const initialState = reducer(undefined, setAllRuns({
      runs: [
        makeRun({ id: 'run-1', taskId: 'task-1' }),
        makeRun({ id: 'run-2', taskId: 'task-2' }),
      ],
      hasMore: true,
    }));
    const nextState = reducer(initialState, removeTask('task-1'));

    expect(nextState.allRuns.map((run) => run.id)).toEqual(['run-2']);
    expect(nextState.allRunsHasMore).toBe(true);
  });
});
