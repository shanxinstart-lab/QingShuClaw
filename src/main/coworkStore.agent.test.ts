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

const createCoworkTables = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE cowork_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      claude_session_id TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      pinned INTEGER NOT NULL DEFAULT 0,
      pin_order INTEGER,
      cwd TEXT NOT NULL,
      system_prompt TEXT NOT NULL DEFAULT '',
      model_override TEXT NOT NULL DEFAULT '',
      execution_mode TEXT,
      active_skill_ids TEXT,
      agent_id TEXT NOT NULL DEFAULT 'main',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE cowork_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      sequence INTEGER
    );
  `);

  db.exec(`
    CREATE TABLE user_memories (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.75,
      is_explicit INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'created',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_used_at INTEGER
    );
  `);

  db.exec(`
    CREATE TABLE user_memory_sources (
      id TEXT PRIMARY KEY,
      memory_id TEXT NOT NULL,
      session_id TEXT,
      message_id TEXT,
      role TEXT NOT NULL DEFAULT 'system',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
  `);
};

const prepareAgentDb = (
  db: Database.Database,
  includeToolBundleIds: boolean,
  includeWorkingDirectory = true,
): void => {
  createAgentsTable(db, includeToolBundleIds, includeWorkingDirectory);
  createCoworkTables(db);
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
    prepareAgentDb(db, true);
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
    prepareAgentDb(db, false);
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
    prepareAgentDb(db, true);
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
    prepareAgentDb(db, true);
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

describe('CoworkStore agent/session cleanup', () => {
  test('deleteSession removes messages without relying on foreign key cascade', () => {
    const db = createDb();
    prepareAgentDb(db, true);
    const store = new CoworkStore(db, () => {});
    const session = store.createSession('Delete me', '/tmp', '', 'local', [], 'main');
    store.addMessage(session.id, {
      id: 'msg-delete-hard',
      type: 'user',
      content: 'remove me',
      timestamp: 1,
    });

    store.deleteSession(session.id);

    expect(store.getSession(session.id)).toBeNull();
    const messageCount = db
      .prepare('SELECT COUNT(*) AS count FROM cowork_messages WHERE session_id = ?')
      .get(session.id) as { count: number };
    expect(messageCount.count).toBe(0);
  });

  test('deleteAgent removes its task history before an agent with the same name is recreated', () => {
    const db = createDb();
    prepareAgentDb(db, true);
    const store = new CoworkStore(db, () => {});
    const agent = store.createAgent({ name: 'Docs Agent' });
    const session = store.createSession('Old Docs Task', '/tmp/docs-project', '', 'local', [], agent.id);
    store.addMessage(session.id, {
      id: 'msg-agent-delete',
      type: 'assistant',
      content: 'old result',
      timestamp: 1,
    });

    expect(store.listSessionIdsByAgent(agent.id)).toEqual([session.id]);
    expect(store.deleteAgent(agent.id)).toBe(true);

    expect(store.getAgent(agent.id)).toBeNull();
    expect(store.listSessions(agent.id)).toEqual([]);
    const messageCount = db
      .prepare('SELECT COUNT(*) AS count FROM cowork_messages WHERE session_id = ?')
      .get(session.id) as { count: number };
    expect(messageCount.count).toBe(0);

    const recreated = store.createAgent({ name: 'Docs Agent' });
    expect(recreated.id).toBe(agent.id);
    expect(store.listSessions(recreated.id)).toEqual([]);
  });

  test('createAgent clears orphaned task history left by legacy agent deletion', () => {
    const db = createDb();
    prepareAgentDb(db, true);
    const store = new CoworkStore(db, () => {});
    const agent = store.createAgent({ name: 'Legacy Deleted Agent' });
    const session = store.createSession('Legacy Orphan Task', '/tmp/docs-project', '', 'local', [], agent.id);
    store.addMessage(session.id, {
      id: 'msg-legacy-orphan',
      type: 'assistant',
      content: 'legacy result',
      timestamp: 1,
    });
    db.prepare('DELETE FROM agents WHERE id = ?').run(agent.id);

    const recreated = store.createAgent({ name: 'Legacy Deleted Agent' });

    expect(recreated.id).toBe(agent.id);
    expect(store.listSessions(recreated.id)).toEqual([]);
    const messageCount = db
      .prepare('SELECT COUNT(*) AS count FROM cowork_messages WHERE session_id = ?')
      .get(session.id) as { count: number };
    expect(messageCount.count).toBe(0);
  });
});
