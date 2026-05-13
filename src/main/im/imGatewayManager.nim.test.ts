import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { IMGatewayManager } from './imGatewayManager';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/qingshuclaw-test'),
  },
}));

const tempDirs: string[] = [];
const dbs: Database.Database[] = [];

const createDb = (): Database.Database => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qingshu-im-manager-'));
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

const createManager = (options?: {
  syncOpenClawConfig?: () => Promise<void>;
  ensureOpenClawGatewayConnected?: () => Promise<void>;
}): IMGatewayManager => {
  const db = createDb();
  return new IMGatewayManager(db, () => undefined, options);
};

describe('IMGatewayManager NIM OpenClaw runtime behavior', () => {
  test('startGateway syncs OpenClaw config and connects the gateway for NIM', async () => {
    const syncOpenClawConfig = vi.fn().mockResolvedValue(undefined);
    const ensureOpenClawGatewayConnected = vi.fn().mockResolvedValue(undefined);
    const manager = createManager({
      syncOpenClawConfig,
      ensureOpenClawGatewayConnected,
    });

    await manager.startGateway('nim');

    expect(syncOpenClawConfig).toHaveBeenCalledTimes(1);
    expect(ensureOpenClawGatewayConnected).toHaveBeenCalledTimes(1);
  });

  test('stopGateway syncs disabled OpenClaw config for NIM without reconnecting', async () => {
    const syncOpenClawConfig = vi.fn().mockResolvedValue(undefined);
    const ensureOpenClawGatewayConnected = vi.fn().mockResolvedValue(undefined);
    const manager = createManager({
      syncOpenClawConfig,
      ensureOpenClawGatewayConnected,
    });

    await manager.stopGateway('nim');

    expect(syncOpenClawConfig).toHaveBeenCalledTimes(1);
    expect(ensureOpenClawGatewayConnected).not.toHaveBeenCalled();
  });

  test('getStatus projects enabled NIM credentials as connected state', () => {
    const manager = createManager();

    manager.setConfig({
      nim: {
        enabled: true,
        appKey: 'nim-app-key',
        account: 'nim-account',
        token: 'nim-token',
      },
    });

    expect(manager.getStatus().nim).toMatchObject({
      connected: true,
      botAccount: 'nim-account',
      lastError: null,
    });
    expect(manager.isConnected('nim')).toBe(true);
  });

  test('getStatus projects the primary NIM instance as connected state', () => {
    const manager = createManager();

    manager.getIMStore().setNimInstanceConfig('disabled', {
      instanceName: 'Disabled NIM',
      enabled: false,
      appKey: 'disabled-app-key',
      account: 'disabled-account',
      token: 'disabled-token',
    });
    manager.getIMStore().setNimInstanceConfig('primary', {
      instanceName: 'Primary NIM',
      enabled: true,
      appKey: 'primary-app-key',
      account: 'primary-account',
      token: 'primary-token',
    });

    expect(manager.getStatus().nim).toMatchObject({
      connected: true,
      botAccount: 'primary-account',
      lastError: null,
    });
    expect(manager.isConnected('nim')).toBe(true);
  });

  test('testGateway fails fast when NIM credentials are incomplete', async () => {
    const manager = createManager();

    const result = await manager.testGateway('nim', {
      nim: {
        enabled: true,
        appKey: 'nim-app-key',
        account: '',
        token: '',
      },
    });

    expect(result.platform).toBe('nim');
    expect(result.verdict).toBe('fail');
    expect(result.checks[0]).toMatchObject({
      code: 'missing_credentials',
      level: 'fail',
    });
  });

  test('testGateway accepts complete NIM credentials as OpenClaw-ready', async () => {
    const manager = createManager();

    const result = await manager.testGateway('nim', {
      nim: {
        enabled: true,
        appKey: 'nim-app-key',
        account: 'nim-account',
        token: 'nim-token',
      },
    });

    expect(result.platform).toBe('nim');
    expect(result.verdict).toBe('pass');
    expect(result.checks.map((check) => check.code)).toEqual([
      'auth_check',
      'gateway_running',
      'nim_p2p_only_hint',
    ]);
  });
});
