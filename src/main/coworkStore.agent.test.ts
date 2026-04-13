import { beforeAll, describe, expect, test, vi } from 'vitest';
import initSqlJs from 'sql.js';

vi.mock('electron', () => ({
  app: {
    getAppPath: () => process.cwd(),
  },
}));

import { CoworkStore } from './coworkStore';

const createAgentsTable = (db: any, includeToolBundleIds: boolean): void => {
  db.run(`
    CREATE TABLE agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      system_prompt TEXT NOT NULL DEFAULT '',
      identity TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
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

let SQL: Awaited<ReturnType<typeof initSqlJs>>;

beforeAll(async () => {
  SQL = await initSqlJs();
});

describe('CoworkStore agent toolBundleIds', () => {
  test('persists toolBundleIds on create and update', () => {
    const db = new SQL.Database();
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
    const db = new SQL.Database();
    createAgentsTable(db, false);
    const now = Date.now();
    db.run(`
      INSERT INTO agents (id, name, description, system_prompt, identity, model, icon, skill_ids, enabled, is_default, source, preset_id, created_at, updated_at)
      VALUES (?, ?, '', '', '', '', '', ?, 1, 0, 'custom', '', ?, ?)
    `, [
      'legacy-agent',
      'Legacy Agent',
      JSON.stringify(['web-search']),
      now,
      now,
    ]);

    const store = new CoworkStore(db, () => {});
    const agent = store.getAgent('legacy-agent');

    expect(agent).not.toBeNull();
    expect(agent?.skillIds).toEqual(['web-search']);
    expect(agent?.toolBundleIds).toEqual([]);
  });
});
