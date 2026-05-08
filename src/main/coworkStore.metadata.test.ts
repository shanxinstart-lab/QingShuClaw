import { beforeAll, describe, expect, test, vi } from 'vitest';
import initSqlJs from 'sql.js';

vi.mock('electron', () => ({
  app: {
    getAppPath: () => process.cwd(),
  },
}));

import { CoworkStore } from './coworkStore';

let SQL: Awaited<ReturnType<typeof initSqlJs>>;

beforeAll(async () => {
  SQL = await initSqlJs();
});

const createCoworkTables = (db: initSqlJs.Database): void => {
  db.run(`
    CREATE TABLE cowork_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      claude_session_id TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      pinned INTEGER NOT NULL DEFAULT 0,
      cwd TEXT NOT NULL,
      system_prompt TEXT NOT NULL DEFAULT '',
      execution_mode TEXT NOT NULL DEFAULT 'local',
      active_skill_ids TEXT,
      agent_id TEXT NOT NULL DEFAULT 'main',
      model_override TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE cowork_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      sequence INTEGER,
      FOREIGN KEY (session_id) REFERENCES cowork_sessions(id) ON DELETE CASCADE
    );
  `);
};

const insertSession = (db: initSqlJs.Database, id: string): void => {
  const now = Date.now();
  db.run(
    `INSERT INTO cowork_sessions
      (id, title, claude_session_id, status, pinned, cwd, system_prompt, execution_mode, active_skill_ids, agent_id, model_override, created_at, updated_at)
     VALUES (?, 'test', NULL, 'idle', 0, '/tmp', '', 'local', '[]', 'main', '', ?, ?)`,
    [id, now, now],
  );
};

const insertMessage = (
  db: initSqlJs.Database,
  id: string,
  sessionId: string,
  type: string,
  content: string,
  metadata: string | null,
  sequence: number,
): void => {
  db.run(
    `INSERT INTO cowork_messages (id, session_id, type, content, metadata, created_at, sequence)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, sessionId, type, content, metadata, Date.now(), sequence],
  );
};

describe('CoworkStore message metadata resilience', () => {
  test('keeps loading a session when one message metadata row is corrupt', () => {
    const db = new SQL.Database();
    createCoworkTables(db);
    insertSession(db, 'session-1');
    insertMessage(db, 'message-ok', 'session-1', 'user', 'hello', '{"skillIds":["demo"]}', 1);
    insertMessage(db, 'message-bad', 'session-1', 'tool_use', 'broken', '{bad-json', 2);
    insertMessage(db, 'message-empty', 'session-1', 'assistant', 'reply', null, 3);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = new CoworkStore(db, () => {});
    const session = store.getSession('session-1');

    expect(session).not.toBeNull();
    expect(session?.messages).toHaveLength(3);
    expect(session?.messages.find((message) => message.id === 'message-ok')?.metadata).toEqual({ skillIds: ['demo'] });
    expect(session?.messages.find((message) => message.id === 'message-bad')?.metadata).toBeUndefined();
    expect(session?.messages.find((message) => message.id === 'message-empty')?.metadata).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });
});
