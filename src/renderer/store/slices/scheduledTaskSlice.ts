import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import type {
  ScheduledTask,
  ScheduledTaskRun,
  ScheduledTaskRunWithName,
  ScheduledTaskViewMode,
  TaskState,
} from '../../../scheduledTask/types';

interface ScheduledTaskState {
  tasks: ScheduledTask[];
  selectedTaskId: string | null;
  viewMode: ScheduledTaskViewMode;
  runs: Record<string, ScheduledTaskRun[]>;
  runsHasMore: Record<string, boolean>;
  allRuns: ScheduledTaskRunWithName[];
  allRunsHasMore: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: ScheduledTaskState = {
  tasks: [],
  selectedTaskId: null,
  viewMode: 'list',
  runs: {},
  runsHasMore: {},
  allRuns: [],
  allRunsHasMore: false,
  loading: false,
  error: null,
};

const scheduledTaskSlice = createSlice({
  name: 'scheduledTask',
  initialState,
  reducers: {
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setTasks(state, action: PayloadAction<ScheduledTask[]>) {
      state.tasks = action.payload;
      state.loading = false;
    },
    addTask(state, action: PayloadAction<ScheduledTask>) {
      state.tasks.unshift(action.payload);
    },
    updateTask(state, action: PayloadAction<ScheduledTask>) {
      const index = state.tasks.findIndex((t) => t.id === action.payload.id);
      if (index !== -1) {
        state.tasks[index] = action.payload;
      }
    },
    removeTask(state, action: PayloadAction<string>) {
      state.tasks = state.tasks.filter((t) => t.id !== action.payload);
      if (state.selectedTaskId === action.payload) {
        state.selectedTaskId = null;
        state.viewMode = 'list';
      }
      delete state.runs[action.payload];
      delete state.runsHasMore[action.payload];
      state.allRuns = state.allRuns.filter((r) => r.taskId !== action.payload);
    },
    updateTaskState(
      state,
      action: PayloadAction<{ taskId: string; taskState: TaskState }>
    ) {
      const task = state.tasks.find((t) => t.id === action.payload.taskId);
      if (task) {
        task.state = action.payload.taskState;
      }
      const pendingManualRunId = `pending-manual-${action.payload.taskId}`;
      const updatePendingRun = <TRun extends ScheduledTaskRun>(run: TRun): TRun => ({
        ...run,
        ...(action.payload.taskState.lastStatus ? { status: action.payload.taskState.lastStatus } : {}),
        ...(action.payload.taskState.runningAtMs
          ? { finishedAt: null }
          : (
              action.payload.taskState.lastRunAtMs
                ? { finishedAt: new Date(action.payload.taskState.lastRunAtMs).toISOString() }
                : {}
            )),
        durationMs: action.payload.taskState.lastDurationMs,
        error: action.payload.taskState.lastError,
      });
      if (state.runs[action.payload.taskId]) {
        state.runs[action.payload.taskId] = state.runs[action.payload.taskId].map((run) => (
          run.id === pendingManualRunId ? updatePendingRun(run) : run
        ));
      }
      state.allRuns = state.allRuns.map((run) => (
        run.id === pendingManualRunId ? updatePendingRun(run) : run
      ));
    },
    selectTask(state, action: PayloadAction<string | null>) {
      state.selectedTaskId = action.payload;
      state.viewMode = action.payload ? 'detail' : 'list';
    },
    setViewMode(state, action: PayloadAction<ScheduledTaskViewMode>) {
      state.viewMode = action.payload;
    },
    setRuns(
      state,
      action: PayloadAction<{ taskId: string; runs: ScheduledTaskRun[]; hasMore: boolean }>
    ) {
      state.runs[action.payload.taskId] = action.payload.runs;
      state.runsHasMore[action.payload.taskId] = action.payload.hasMore;
    },
    appendRuns(
      state,
      action: PayloadAction<{ taskId: string; runs: ScheduledTaskRun[]; hasMore: boolean }>
    ) {
      const { taskId, runs, hasMore } = action.payload;
      if (!state.runs[taskId]) {
        state.runs[taskId] = runs;
      } else {
        const existingIds = new Set(state.runs[taskId].map((r) => r.id));
        const newRuns = runs.filter((r) => !existingIds.has(r.id));
        state.runs[taskId] = [...state.runs[taskId], ...newRuns];
      }
      state.runsHasMore[taskId] = hasMore;
    },
    addOrUpdateRun(state, action: PayloadAction<ScheduledTaskRunWithName>) {
      const { taskId } = action.payload;
      if (!state.runs[taskId]) {
        state.runs[taskId] = [];
      }
      const pendingManualRunId = `pending-manual-${taskId}`;
      if (action.payload.id !== pendingManualRunId) {
        state.runs[taskId] = state.runs[taskId].filter(
          (run) => run.id !== pendingManualRunId
        );
        state.allRuns = state.allRuns.filter(
          (run) => run.id !== pendingManualRunId
        );
      }
      const existingIndex = state.runs[taskId].findIndex(
        (r) => r.id === action.payload.id
      );
      if (existingIndex !== -1) {
        state.runs[taskId][existingIndex] = action.payload;
      } else {
        state.runs[taskId].unshift(action.payload);
      }

      const existingAllRunIndex = state.allRuns.findIndex(
        (r) => r.id === action.payload.id
      );
      if (existingAllRunIndex !== -1) {
        state.allRuns[existingAllRunIndex] = action.payload;
      } else {
        state.allRuns.unshift(action.payload);
      }
    },
    setAllRuns(state, action: PayloadAction<{ runs: ScheduledTaskRunWithName[]; hasMore?: boolean } | ScheduledTaskRunWithName[]>) {
      const payload = action.payload;
      if (Array.isArray(payload)) {
        state.allRuns = payload;
        state.allRunsHasMore = false;
        return;
      }
      state.allRuns = payload.runs;
      state.allRunsHasMore = payload.hasMore ?? false;
    },
    appendAllRuns(state, action: PayloadAction<{ runs: ScheduledTaskRunWithName[]; hasMore?: boolean } | ScheduledTaskRunWithName[]>) {
      const payload = action.payload;
      const runs = Array.isArray(payload) ? payload : payload.runs;
      const existingIds = new Set(state.allRuns.map((run) => run.id));
      const newRuns = runs.filter((run) => !existingIds.has(run.id));
      state.allRuns = [...state.allRuns, ...newRuns];
      state.allRunsHasMore = Array.isArray(payload) ? false : (payload.hasMore ?? false);
    },
  },
});

export const {
  setLoading,
  setError,
  setTasks,
  addTask,
  updateTask,
  removeTask,
  updateTaskState,
  selectTask,
  setViewMode,
  setRuns,
  appendRuns,
  addOrUpdateRun,
  setAllRuns,
  appendAllRuns,
} = scheduledTaskSlice.actions;

export default scheduledTaskSlice.reducer;
