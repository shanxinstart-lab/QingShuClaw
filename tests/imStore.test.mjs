import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { IMStore } = require('../dist-electron/main/im/imStore.js');

class FakeDb {
  constructor() {
    this.imConfig = new Map();
    this.sessionMappings = new Map();
  }

  run(sql, params = []) {
    if (sql.includes('INSERT INTO im_config')) {
      this.imConfig.set(String(params[0]), String(params[1]));
      return;
    }

    if (sql.includes('INSERT OR REPLACE INTO im_config')) {
      this.imConfig.set(String(params[0]), String(params[1]));
      return;
    }

    if (sql.includes('DELETE FROM im_config WHERE key = ?')) {
      this.imConfig.delete(String(params[0]));
      return;
    }

    if (sql.includes('DELETE FROM im_config')) {
      this.imConfig.clear();
      return;
    }

    if (sql.includes('INSERT INTO im_session_mappings')) {
      const row = {
        im_conversation_id: String(params[0]),
        platform: String(params[1]),
        cowork_session_id: String(params[2]),
        agent_id: String(params[3]),
        openclaw_session_key: params[4] ? String(params[4]) : null,
        created_at: Number(params[5]),
        last_active_at: Number(params[6]),
      };
      this.sessionMappings.set(this.mappingKey(row.im_conversation_id, row.platform), row);
      return;
    }

    if (sql.includes('UPDATE im_session_mappings SET openclaw_session_key = ?')) {
      const row = this.sessionMappings.get(this.mappingKey(String(params[2]), String(params[3])));
      if (row) {
        row.openclaw_session_key = String(params[0]);
        row.last_active_at = Number(params[1]);
      }
      return;
    }

    if (sql.includes('UPDATE im_session_mappings SET cowork_session_id = ?')) {
      const row = this.sessionMappings.get(this.mappingKey(String(params[4]), String(params[5])));
      if (row) {
        row.cowork_session_id = String(params[0]);
        row.agent_id = String(params[1]);
        if (params[2]) {
          row.openclaw_session_key = String(params[2]);
        }
        row.last_active_at = Number(params[3]);
      }
      return;
    }

    if (sql.includes('UPDATE im_session_mappings SET last_active_at = ?')) {
      const row = this.sessionMappings.get(this.mappingKey(String(params[1]), String(params[2])));
      if (row) {
        row.last_active_at = Number(params[0]);
      }
      return;
    }

    if (sql.includes('DELETE FROM im_session_mappings WHERE im_conversation_id = ?')) {
      this.sessionMappings.delete(this.mappingKey(String(params[0]), String(params[1])));
      return;
    }
  }

  exec(sql, params = []) {
    if (sql.includes('SELECT value FROM im_config WHERE key = ?')) {
      const value = this.imConfig.get(String(params[0]));
      return value === undefined ? [] : [{ values: [[value]] }];
    }
    if (sql.includes('FROM im_session_mappings WHERE im_conversation_id = ?')) {
      const row = this.sessionMappings.get(this.mappingKey(String(params[0]), String(params[1])));
      return row ? [{ values: [this.mappingRowValues(row)] }] : [];
    }
    if (sql.includes('FROM im_session_mappings WHERE cowork_session_id = ?')) {
      const row = Array.from(this.sessionMappings.values())
        .find((item) => item.cowork_session_id === String(params[0]));
      return row ? [{ values: [this.mappingRowValues(row)] }] : [];
    }
    return [];
  }

  mappingKey(conversationId, platform) {
    return `${platform}\0${conversationId}`;
  }

  mappingRowValues(row) {
    return [
      row.im_conversation_id,
      row.platform,
      row.cowork_session_id,
      row.agent_id,
      row.openclaw_session_key,
      row.created_at,
      row.last_active_at,
    ];
  }
}

test('IMStore persists conversation reply routes by platform and conversation ID', () => {
  const db = new FakeDb();
  let saveCount = 0;
  const store = new IMStore(db, () => {
    saveCount += 1;
  });

  assert.equal(store.getConversationReplyRoute('dingtalk', '__default__:conv-1'), null);

  store.setConversationReplyRoute('dingtalk', '__default__:conv-1', {
    channel: 'dingtalk-connector',
    to: 'group:cid-42',
    accountId: '__default__',
  });

  assert.deepEqual(store.getConversationReplyRoute('dingtalk', '__default__:conv-1'), {
    channel: 'dingtalk-connector',
    to: 'group:cid-42',
    accountId: '__default__',
  });
  assert.equal(store.getConversationReplyRoute('telegram', '__default__:conv-1'), null);
  assert.ok(saveCount >= 2);
});

test('IMStore persists OpenClaw session keys in IM session mappings', () => {
  const db = new FakeDb();
  let saveCount = 0;
  const store = new IMStore(db, () => {
    saveCount += 1;
  });

  const initialKey = 'agent:main:openclaw-weixin:bot-1:direct:user-1';
  const updatedKey = 'agent:main:openclaw-weixin:bot-2:direct:user-1';

  const created = store.createSessionMapping(
    'bot-1:direct:user-1',
    'weixin',
    'cowork-1',
    'main',
    initialKey,
  );

  assert.equal(created.openClawSessionKey, initialKey);
  assert.equal(
    store.getSessionMapping('bot-1:direct:user-1', 'weixin')?.openClawSessionKey,
    initialKey,
  );
  assert.equal(
    store.getSessionMappingByCoworkSessionId('cowork-1')?.openClawSessionKey,
    initialKey,
  );

  store.updateSessionOpenClawSessionKey('bot-1:direct:user-1', 'weixin', updatedKey);
  assert.equal(
    store.getSessionMappingByCoworkSessionId('cowork-1')?.openClawSessionKey,
    updatedKey,
  );
  assert.ok(saveCount >= 3);
});
