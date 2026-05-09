/**
 * Unit tests for imPairingStore.ts.
 *
 * The store reads and writes OpenClaw-compatible pairing files:
 * - credentials/<channel>-pairing.json
 * - credentials/<channel>-allowFrom.json
 * - credentials/<channel>-<accountId>-allowFrom.json
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  approvePairingCode,
  listPairingRequests,
  readAllowFromStore,
  rejectPairingRequest,
} = require('../dist-electron/main/im/imPairingStore.js');

const HOUR_MS = 3600 * 1000;

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'qingshu-pairing-test-'));
}

function cleanupDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function credentialsDir(stateDir) {
  return path.join(stateDir, 'credentials');
}

function writePairingFile(stateDir, channel, requests) {
  fs.mkdirSync(credentialsDir(stateDir), { recursive: true });
  fs.writeFileSync(
    path.join(credentialsDir(stateDir), `${channel}-pairing.json`),
    JSON.stringify({ version: 1, requests }, null, 2),
    'utf-8',
  );
}

function writeAllowFromFile(stateDir, channel, allowFrom, accountId) {
  fs.mkdirSync(credentialsDir(stateDir), { recursive: true });
  const suffix = accountId && accountId !== 'default' ? `-${accountId}` : '';
  fs.writeFileSync(
    path.join(credentialsDir(stateDir), `${channel}${suffix}-allowFrom.json`),
    JSON.stringify({ version: 1, allowFrom }, null, 2),
    'utf-8',
  );
}

function readAllowFromFile(stateDir, channel, accountId) {
  const suffix = accountId && accountId !== 'default' ? `-${accountId}` : '';
  const filePath = path.join(credentialsDir(stateDir), `${channel}${suffix}-allowFrom.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')).allowFrom;
  } catch {
    return [];
  }
}

function readPairingFile(stateDir, channel) {
  const filePath = path.join(credentialsDir(stateDir), `${channel}-pairing.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')).requests;
  } catch {
    return [];
  }
}

function isoTimestamp(deltaMs = 0) {
  return new Date(Date.now() + deltaMs).toISOString();
}

test('listPairingRequests returns empty array when pairing data is absent', () => {
  const stateDir = makeTmpDir();
  try {
    assert.deepEqual(listPairingRequests('dingtalk', stateDir), []);
    fs.mkdirSync(credentialsDir(stateDir), { recursive: true });
    assert.deepEqual(listPairingRequests('dingtalk', stateDir), []);
  } finally {
    cleanupDir(stateDir);
  }
});

test('listPairingRequests filters expired and invalid requests', () => {
  const stateDir = makeTmpDir();
  try {
    const fresh = {
      id: 'user:alice',
      code: 'FRESH1',
      createdAt: isoTimestamp(-10 * 60 * 1000),
      lastSeenAt: isoTimestamp(-10 * 60 * 1000),
    };
    const expired = {
      id: 'user:bob',
      code: 'OLD001',
      createdAt: isoTimestamp(-(HOUR_MS + 1)),
      lastSeenAt: isoTimestamp(-(HOUR_MS + 1)),
    };
    const invalid = {
      id: 'user:carol',
      code: 'BAD001',
      createdAt: 'not-a-date',
      lastSeenAt: isoTimestamp(),
    };
    writePairingFile(stateDir, 'dingtalk', [fresh, expired, invalid]);

    const result = listPairingRequests('dingtalk', stateDir);

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'user:alice');
  } finally {
    cleanupDir(stateDir);
  }
});

test('readAllowFromStore reads approved senders from the default store', () => {
  const stateDir = makeTmpDir();
  try {
    assert.deepEqual(readAllowFromStore('telegram', stateDir), []);
    writeAllowFromFile(stateDir, 'telegram', ['user:alice', 'user:bob']);
    assert.deepEqual(readAllowFromStore('telegram', stateDir), ['user:alice', 'user:bob']);
  } finally {
    cleanupDir(stateDir);
  }
});

test('approvePairingCode moves request into default allowFrom without duplicates', () => {
  const stateDir = makeTmpDir();
  try {
    writeAllowFromFile(stateDir, 'feishu', ['user:alice']);
    writePairingFile(stateDir, 'feishu', [
      {
        id: 'user:alice',
        code: 'APP001',
        createdAt: isoTimestamp(-60 * 1000),
        lastSeenAt: isoTimestamp(-60 * 1000),
      },
      {
        id: 'user:bob',
        code: 'KEEP01',
        createdAt: isoTimestamp(-60 * 1000),
        lastSeenAt: isoTimestamp(-60 * 1000),
      },
    ]);

    const approved = approvePairingCode('feishu', 'app001', stateDir);

    assert.equal(approved.id, 'user:alice');
    assert.deepEqual(readPairingFile(stateDir, 'feishu').map((r) => r.code), ['KEEP01']);
    assert.deepEqual(readAllowFromFile(stateDir, 'feishu'), ['user:alice']);
  } finally {
    cleanupDir(stateDir);
  }
});

test('approvePairingCode writes account-scoped allowFrom when meta.accountId is set', () => {
  const stateDir = makeTmpDir();
  try {
    writePairingFile(stateDir, 'dingtalk', [{
      id: 'user:lena',
      code: 'ACCT01',
      createdAt: isoTimestamp(-60 * 1000),
      lastSeenAt: isoTimestamp(-60 * 1000),
      meta: { accountId: 'acct-42' },
    }]);

    const approved = approvePairingCode('dingtalk', 'ACCT01', stateDir);

    assert.equal(approved.id, 'user:lena');
    assert.deepEqual(readAllowFromFile(stateDir, 'dingtalk'), []);
    assert.deepEqual(readAllowFromFile(stateDir, 'dingtalk', 'acct-42'), ['user:lena']);
  } finally {
    cleanupDir(stateDir);
  }
});

test('approvePairingCode returns null for unknown codes', () => {
  const stateDir = makeTmpDir();
  try {
    writePairingFile(stateDir, 'feishu', [{
      id: 'user:ivan',
      code: 'REAL01',
      createdAt: isoTimestamp(-60 * 1000),
      lastSeenAt: isoTimestamp(-60 * 1000),
    }]);

    assert.equal(approvePairingCode('feishu', 'NOPE01', stateDir), null);
    assert.deepEqual(readPairingFile(stateDir, 'feishu').map((r) => r.code), ['REAL01']);
  } finally {
    cleanupDir(stateDir);
  }
});

test('rejectPairingRequest removes request without adding allowFrom', () => {
  const stateDir = makeTmpDir();
  try {
    writePairingFile(stateDir, 'telegram', [
      {
        id: 'user:oscar',
        code: 'KEEP01',
        createdAt: isoTimestamp(-60 * 1000),
        lastSeenAt: isoTimestamp(-60 * 1000),
      },
      {
        id: 'user:pat',
        code: 'RJCT01',
        createdAt: isoTimestamp(-60 * 1000),
        lastSeenAt: isoTimestamp(-60 * 1000),
      },
    ]);

    const rejected = rejectPairingRequest('telegram', 'RJCT01', stateDir);

    assert.equal(rejected.id, 'user:pat');
    assert.deepEqual(readPairingFile(stateDir, 'telegram').map((r) => r.code), ['KEEP01']);
    assert.deepEqual(readAllowFromFile(stateDir, 'telegram'), []);
  } finally {
    cleanupDir(stateDir);
  }
});

test('rejectPairingRequest returns null for unknown codes', () => {
  const stateDir = makeTmpDir();
  try {
    writePairingFile(stateDir, 'telegram', [{
      id: 'user:quinn',
      code: 'REAL02',
      createdAt: isoTimestamp(-60 * 1000),
      lastSeenAt: isoTimestamp(-60 * 1000),
    }]);

    assert.equal(rejectPairingRequest('telegram', 'NOPE02', stateDir), null);
    assert.deepEqual(readPairingFile(stateDir, 'telegram').map((r) => r.code), ['REAL02']);
  } finally {
    cleanupDir(stateDir);
  }
});
