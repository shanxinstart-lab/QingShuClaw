import { afterEach, expect, test } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { DeliveryMode, GatewayStatus, MigrationKey, ScheduleKind } from './constants';
import { migrateScheduledTaskRunsToOpenclaw, migrateScheduledTasksToOpenclaw } from './migrate';
import type { ScheduledTaskInput } from './types';

type SqlJsExecResult = Array<{ columns: string[]; values: unknown[][] }>;

const tempDirs: string[] = [];

function makeTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qingshu-scheduled-migrate-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeSqlJsDb({
  tables = new Set<string>(),
  taskRows = [] as Record<string, unknown>[],
  runRows = [] as Record<string, unknown>[],
  taskNameRows = [] as Record<string, unknown>[],
} = {}) {
  return {
    exec(sql: string): SqlJsExecResult {
      if (sql.includes('sqlite_master') && sql.includes("'scheduled_tasks'")) {
        return tables.has('scheduled_tasks')
          ? [{ columns: ['name'], values: [['scheduled_tasks']] }]
          : [];
      }
      if (sql.includes('sqlite_master') && sql.includes("'scheduled_task_runs'")) {
        return tables.has('scheduled_task_runs')
          ? [{ columns: ['name'], values: [['scheduled_task_runs']] }]
          : [];
      }
      if (sql.includes('SELECT id, name FROM scheduled_tasks')) {
        return rowsToExecResult(['id', 'name'], taskNameRows);
      }
      if (sql.includes('FROM scheduled_tasks') && !sql.includes('scheduled_task_runs')) {
        return rowsToExecResult(
          ['id', 'name', 'description', 'enabled', 'schedule_json', 'prompt', 'notify_platforms_json'],
          taskRows,
        );
      }
      if (sql.includes('FROM scheduled_task_runs')) {
        return rowsToExecResult(
          ['id', 'task_id', 'session_id', 'status', 'started_at', 'finished_at', 'duration_ms', 'error'],
          runRows,
        );
      }
      return [];
    },
  };
}

function rowsToExecResult(columns: string[], rows: Record<string, unknown>[]): SqlJsExecResult {
  if (rows.length === 0) {
    return [];
  }
  return [{
    columns,
    values: rows.map((row) => columns.map((column) => row[column])),
  }];
}

function makeKv(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getKv: (key: string) => store[key],
    setKv: (key: string, value: string) => {
      store[key] = value;
    },
    store,
  };
}

function makeCronService() {
  const jobs: ScheduledTaskInput[] = [];
  let shouldThrow = false;
  return {
    jobs,
    forceError: () => {
      shouldThrow = true;
    },
    addJob: async (input: ScheduledTaskInput) => {
      if (shouldThrow) {
        throw new Error('gateway unavailable');
      }
      jobs.push(input);
    },
  };
}

test('migrateScheduledTasksToOpenclaw skips when already migrated', async () => {
  const kv = makeKv({ [MigrationKey.TasksToOpenclaw]: 'true' });
  const cron = makeCronService();
  const db = makeSqlJsDb({
    tables: new Set(['scheduled_tasks']),
    taskRows: [{
      id: 'task-1',
      name: 'Already migrated task',
      description: '',
      enabled: 1,
      schedule_json: JSON.stringify({ type: 'cron', expression: '0 9 * * *' }),
      prompt: 'Should not migrate',
      notify_platforms_json: '[]',
    }],
  });

  await migrateScheduledTasksToOpenclaw({
    db: db as never,
    getKv: kv.getKv,
    setKv: kv.setKv,
    cronJobService: cron as never,
  });

  expect(cron.jobs).toHaveLength(0);
  expect(kv.store[MigrationKey.TasksToOpenclaw]).toBe('true');
});

test('migrateScheduledTasksToOpenclaw marks fresh installs as migrated', async () => {
  const kv = makeKv();
  const cron = makeCronService();
  const db = makeSqlJsDb();

  await migrateScheduledTasksToOpenclaw({
    db: db as never,
    getKv: kv.getKv,
    setKv: kv.setKv,
    cronJobService: cron as never,
  });

  expect(kv.store[MigrationKey.TasksToOpenclaw]).toBe('true');
  expect(cron.jobs).toHaveLength(0);
});

test('migrateScheduledTasksToOpenclaw marks empty legacy tables as migrated', async () => {
  const kv = makeKv();
  const cron = makeCronService();
  const db = makeSqlJsDb({
    tables: new Set(['scheduled_tasks']),
    taskRows: [],
  });

  await migrateScheduledTasksToOpenclaw({
    db: db as never,
    getKv: kv.getKv,
    setKv: kv.setKv,
    cronJobService: cron as never,
  });

  expect(kv.store[MigrationKey.TasksToOpenclaw]).toBe('true');
  expect(cron.jobs).toHaveLength(0);
});

test('migrateScheduledTasksToOpenclaw converts valid cron tasks', async () => {
  const kv = makeKv();
  const cron = makeCronService();
  const db = makeSqlJsDb({
    tables: new Set(['scheduled_tasks']),
    taskRows: [{
      id: 'task-1',
      name: 'Daily standup',
      description: 'Morning reminder',
      enabled: 1,
      schedule_json: JSON.stringify({ type: 'cron', expression: '0 9 * * 1-5' }),
      prompt: 'Remind me of the standup meeting',
      notify_platforms_json: '["dingtalk"]',
    }],
  });

  await migrateScheduledTasksToOpenclaw({
    db: db as never,
    getKv: kv.getKv,
    setKv: kv.setKv,
    cronJobService: cron as never,
  });

  expect(cron.jobs).toHaveLength(1);
  expect(cron.jobs[0]).toMatchObject({
    name: 'Daily standup',
    schedule: { kind: ScheduleKind.Cron, expr: '0 9 * * 1-5' },
    delivery: { mode: DeliveryMode.Announce, channel: 'dingtalk' },
  });
  expect(kv.store[MigrationKey.TasksToOpenclaw]).toBe('true');
});

test('migrateScheduledTasksToOpenclaw converts interval tasks', async () => {
  const kv = makeKv();
  const cron = makeCronService();
  const db = makeSqlJsDb({
    tables: new Set(['scheduled_tasks']),
    taskRows: [{
      id: 'task-interval',
      name: 'Hourly check',
      description: '',
      enabled: 1,
      schedule_json: JSON.stringify({ type: 'interval', intervalMs: 3_600_000 }),
      prompt: 'Check emails',
      notify_platforms_json: '[]',
    }],
  });

  await migrateScheduledTasksToOpenclaw({
    db: db as never,
    getKv: kv.getKv,
    setKv: kv.setKv,
    cronJobService: cron as never,
  });

  expect(cron.jobs).toHaveLength(1);
  expect(cron.jobs[0]).toMatchObject({
    name: 'Hourly check',
    schedule: { kind: ScheduleKind.Every, everyMs: 3_600_000 },
    delivery: { mode: DeliveryMode.None },
  });
  expect(kv.store[MigrationKey.TasksToOpenclaw]).toBe('true');
});

test('migrateScheduledTasksToOpenclaw skips expired one-time tasks', async () => {
  const kv = makeKv();
  const cron = makeCronService();
  const db = makeSqlJsDb({
    tables: new Set(['scheduled_tasks']),
    taskRows: [{
      id: 'task-past',
      name: 'Expired reminder',
      description: '',
      enabled: 1,
      schedule_json: JSON.stringify({ type: 'at', datetime: '2000-01-01T00:00:00' }),
      prompt: 'Long gone reminder',
      notify_platforms_json: '[]',
    }],
  });

  await migrateScheduledTasksToOpenclaw({
    db: db as never,
    getKv: kv.getKv,
    setKv: kv.setKv,
    cronJobService: cron as never,
  });

  expect(cron.jobs).toHaveLength(0);
  expect(kv.store[MigrationKey.TasksToOpenclaw]).toBe('true');
});

test('migrateScheduledTasksToOpenclaw skips invalid schedule_json and continues', async () => {
  const kv = makeKv();
  const cron = makeCronService();
  const db = makeSqlJsDb({
    tables: new Set(['scheduled_tasks']),
    taskRows: [
      {
        id: 'task-bad',
        name: 'Bad schedule',
        description: '',
        enabled: 1,
        schedule_json: 'not json',
        prompt: 'Skip me',
        notify_platforms_json: '[]',
      },
      {
        id: 'task-good',
        name: 'Good schedule',
        description: '',
        enabled: 1,
        schedule_json: JSON.stringify({ type: 'cron', expression: '0 8 * * *' }),
        prompt: 'Morning brief',
        notify_platforms_json: '[]',
      },
    ],
  });

  await migrateScheduledTasksToOpenclaw({
    db: db as never,
    getKv: kv.getKv,
    setKv: kv.setKv,
    cronJobService: cron as never,
  });

  expect(cron.jobs).toHaveLength(1);
  expect(cron.jobs[0].name).toBe('Good schedule');
  expect(kv.store[MigrationKey.TasksToOpenclaw]).toBe('true');
});

test('migrateScheduledTasksToOpenclaw does not mark done when gateway fails', async () => {
  const kv = makeKv();
  const cron = makeCronService();
  cron.forceError();
  const db = makeSqlJsDb({
    tables: new Set(['scheduled_tasks']),
    taskRows: [{
      id: 'task-1',
      name: 'Daily standup',
      description: '',
      enabled: 1,
      schedule_json: JSON.stringify({ type: 'cron', expression: '0 9 * * *' }),
      prompt: 'Remind me',
      notify_platforms_json: '[]',
    }],
  });

  await migrateScheduledTasksToOpenclaw({
    db: db as never,
    getKv: kv.getKv,
    setKv: kv.setKv,
    cronJobService: cron as never,
  });

  expect(kv.store[MigrationKey.TasksToOpenclaw]).toBeUndefined();
});

test('migrateScheduledTaskRunsToOpenclaw writes JSONL run history and deduplicates reruns', async () => {
  const kv = makeKv();
  const stateDir = makeTmpDir();
  const db = makeSqlJsDb({
    tables: new Set(['scheduled_task_runs']),
    taskNameRows: [{ id: 'task-1', name: 'Daily standup' }],
    runRows: [{
      id: 'run-1',
      task_id: 'task-1',
      session_id: 'session-1',
      status: 'success',
      started_at: '2026-03-27T09:00:00.000Z',
      finished_at: '2026-03-27T09:00:05.000Z',
      duration_ms: 5000,
      error: null,
    }],
  });

  const deps = {
    db: db as never,
    getKv: kv.getKv,
    setKv: kv.setKv,
    openclawStateDir: stateDir,
  };

  await migrateScheduledTaskRunsToOpenclaw(deps);
  delete kv.store[MigrationKey.RunsToOpenclaw];
  await migrateScheduledTaskRunsToOpenclaw(deps);

  const jsonlPath = path.join(stateDir, 'cron', 'runs', 'task-1.jsonl');
  const lines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n');
  expect(lines).toHaveLength(1);
  expect(JSON.parse(lines[0])).toMatchObject({
    jobId: 'task-1',
    status: GatewayStatus.Ok,
    runAtMs: Date.parse('2026-03-27T09:00:00.000Z'),
    durationMs: 5000,
    sessionId: 'session-1',
    summary: 'Daily standup',
  });
  expect(kv.store[MigrationKey.RunsToOpenclaw]).toBe('true');
});
