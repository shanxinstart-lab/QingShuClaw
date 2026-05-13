import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getAppPath: () => process.cwd(),
  },
}));

import { CoworkStore } from './coworkStore';

const createAgentsTable = (
  db: Database.Database,
  includeToolBundleIds: boolean,
  includeWorkingDirectory = true,
): void => {
  db.exec(`
    CREATE TABLE agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL DEFAULT '',
      identity TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      ${includeWorkingDirectory ? "working_directory TEXT NOT NULL DEFAULT ''," : ''}
      icon TEXT NOT NULL DEFAULT '',
      skill_ids TEXT NOT NULL DEFAULT '[]',
      ${includeToolBundleIds ? "tool_bundle_ids TEXT NOT NULL DEFAULT '[]'," : ''}
      enabled INTEGER NOT NULL DEFAULT 1,
      is_default INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'custom',
      preset_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
};

const tempDirs: string[] = [];
const dbs: Database.Database[] = [];

const createDb = (): Database.Database => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qingshu-cowork-agent-'));
  tempDirs.push(dir);
  const db = new Database(path.join(dir, 'test.sqlite'));
  dbs.push(db);
  return db;
};

afterEach(() => {
  for (const db of dbs.splice(0)) {
    db.close();
  }
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('CoworkStore agent toolBundleIds', () => {
  test('persists toolBundleIds on create and update', () => {
    const db = createDb();
    createAgentsTable(db, true);
    const store = new CoworkStore(db, () => {});

    const created = store.createAgent({
      name: 'QingShu Agent',
      skillIds: ['lbs-analysis'],
      toolBundleIds: ['lbs-analysis', 'inventory-readonly'],
    });

    expect(created.toolBundleIds).toEqual(['lbs-analysis', 'inventory-readonly']);

    const updated = store.updateAgent(created.id, {
      toolBundleIds: ['order-basic'],
    });

    expect(updated?.toolBundleIds).toEqual(['order-basic']);
  });

  test('falls back to empty toolBundleIds for legacy rows', () => {
    const db = createDb();
    createAgentsTable(db, false);
    const now = Date.now();
    db.prepare(`
      INSERT INTO agents (id, name, description, system_prompt, identity, model, icon, skill_ids, enabled, is_default, source, preset_id, created_at, updated_at)
      VALUES (?, ?, '', '', '', '', '', ?, 1, 0, 'custom', '', ?, ?)
    `).run(
      'legacy-agent',
      'Legacy Agent',
      JSON.stringify(['web-search']),
      now,
      now,
    );

    const store = new CoworkStore(db, () => {});
    const agent = store.getAgent('legacy-agent');

    expect(agent).not.toBeNull();
    expect(agent?.skillIds).toEqual(['web-search']);
    expect(agent?.toolBundleIds).toEqual([]);
  });
});

describe('CoworkStore agent workingDirectory', () => {
  test('persists workingDirectory on create and update', () => {
    const db = createDb();
    createAgentsTable(db, true);
    const store = new CoworkStore(db, () => {});

    const created = store.createAgent({
      name: 'Workspace Agent',
      workingDirectory: '/tmp/qingshu-a',
    });

    expect(created.workingDirectory).toBe('/tmp/qingshu-a');

    const updated = store.updateAgent(created.id, {
      workingDirectory: '/tmp/qingshu-b',
    });

    expect(updated?.workingDirectory).toBe('/tmp/qingshu-b');
  });

  test('falls back to empty workingDirectory for legacy rows', () => {
    const db = createDb();
    createAgentsTable(db, true);
    const now = Date.now();
    db.prepare(`
      INSERT INTO agents (id, name, description, system_prompt, identity, model, icon, skill_ids, tool_bundle_ids, enabled, is_default, source, preset_id, created_at, updated_at)
      VALUES (?, ?, '', '', '', '', '', '[]', '[]', 1, 0, 'custom', '', ?, ?)
    `).run(
      'legacy-agent',
      'Legacy Agent',
      now,
      now,
    );

    const store = new CoworkStore(db, () => {});
    const agent = store.getAgent('legacy-agent');

    expect(agent).not.toBeNull();
    expect(agent?.workingDirectory).toBe('');
  });
});
