import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const tempDirs: string[] = [];

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => makeTempDir('openclaw-manager-user-data-')),
    getAppPath: vi.fn(() => mockAppPath),
  },
  utilityProcess: {
    fork: vi.fn(),
  },
}));

vi.mock('./openclawLocalExtensions', () => ({
  cleanupStaleThirdPartyPluginsFromBundledDir: vi.fn(),
  listLocalOpenClawExtensionIds: vi.fn(() => ['local-plugin-dir']),
  syncLocalOpenClawExtensionsIntoRuntime: vi.fn(() => ({ sourceDir: null, copied: [] })),
}));

let mockAppPath = '';

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writePackageJson(dir: string, payload: unknown): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(payload), 'utf8');
}

describe('OpenClawEngineManager plugin cleanup ids', () => {
  beforeEach(() => {
    mockAppPath = makeTempDir('openclaw-manager-app-');
  });

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('includes configured, local, and renamed third-party plugin ids', async () => {
    writePackageJson(mockAppPath, {
      openclaw: {
        plugins: [
          { id: 'openclaw-lark' },
          { id: '  qwen-portal-auth  ' },
          { id: '' },
        ],
      },
    });

    const { OpenClawEngineManager } = await import('./openclawEngineManager');
    const manager = new OpenClawEngineManager();
    const ids = (manager as unknown as {
      getConfiguredThirdPartyPluginIds(): string[];
    }).getConfiguredThirdPartyPluginIds();

    expect(ids).toEqual(expect.arrayContaining([
      'local-plugin-dir',
      'feishu-openclaw-plugin',
      'openclaw-lark',
      'qwen-portal-auth',
    ]));
  });
});

describe('OpenClawEngineManager gateway exit handling', () => {
  beforeEach(() => {
    mockAppPath = makeTempDir('openclaw-manager-app-');
    writePackageJson(mockAppPath, {});
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('keeps expected-exit guard when an error event is followed by exit', async () => {
    const { OpenClawEngineManager } = await import('./openclawEngineManager');
    const manager = new OpenClawEngineManager();
    const child = makeFakeGatewayProcess();
    const statuses: Array<{ phase: string; message?: string }> = [];
    manager.on('status', (status) => {
      statuses.push({ phase: status.phase, message: status.message });
    });

    (manager as unknown as {
      attachGatewayExitHandlers(child: EventEmitter): void;
      stopGatewayProcess(child: EventEmitter): Promise<void>;
    }).attachGatewayExitHandlers(child);

    const stopped = (manager as unknown as {
      stopGatewayProcess(child: EventEmitter): Promise<void>;
    }).stopGatewayProcess(child);

    child.emit('error', new Error('expected shutdown noise'));
    child.emit('exit', 0);
    await stopped;

    expect(statuses).toEqual([]);
  });

  test('marks unexpected exit as error and schedules one restart attempt', async () => {
    vi.useFakeTimers();
    const { OpenClawEngineManager } = await import('./openclawEngineManager');
    const manager = new OpenClawEngineManager();
    const child = makeFakeGatewayProcess();
    const startGateway = vi.spyOn(manager, 'startGateway').mockResolvedValue(manager.getStatus());
    const statuses: Array<{ phase: string; message?: string }> = [];
    manager.on('status', (status) => {
      statuses.push({ phase: status.phase, message: status.message });
    });

    (manager as unknown as {
      attachGatewayExitHandlers(child: EventEmitter): void;
    }).attachGatewayExitHandlers(child);

    child.emit('exit', 1);

    expect(statuses).toContainEqual(expect.objectContaining({
      phase: 'error',
      message: 'OpenClaw gateway exited unexpectedly (code=1).',
    }));
    expect(startGateway).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(3_000);

    expect(startGateway).toHaveBeenCalledWith('auto-restart-after-crash');
  });

  test('does not restart when shutdown was requested before exit', async () => {
    vi.useFakeTimers();
    const { OpenClawEngineManager } = await import('./openclawEngineManager');
    const manager = new OpenClawEngineManager();
    const child = makeFakeGatewayProcess();
    const startGateway = vi.spyOn(manager, 'startGateway').mockResolvedValue(manager.getStatus());
    const statuses: Array<{ phase: string; message?: string }> = [];
    manager.on('status', (status) => {
      statuses.push({ phase: status.phase, message: status.message });
    });

    (manager as unknown as {
      shutdownRequested: boolean;
      attachGatewayExitHandlers(child: EventEmitter): void;
    }).shutdownRequested = true;
    (manager as unknown as {
      attachGatewayExitHandlers(child: EventEmitter): void;
    }).attachGatewayExitHandlers(child);

    child.emit('exit', 0);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(statuses).toEqual([]);
    expect(startGateway).not.toHaveBeenCalled();
  });

  test('does not schedule duplicate restart timers for repeated crashes', async () => {
    vi.useFakeTimers();
    const { OpenClawEngineManager } = await import('./openclawEngineManager');
    const manager = new OpenClawEngineManager();
    const startGateway = vi.spyOn(manager, 'startGateway').mockResolvedValue(manager.getStatus());

    (manager as unknown as {
      scheduleGatewayRestart(): void;
    }).scheduleGatewayRestart();
    (manager as unknown as {
      scheduleGatewayRestart(): void;
    }).scheduleGatewayRestart();

    await vi.advanceTimersByTimeAsync(3_000);

    expect(startGateway).toHaveBeenCalledTimes(1);
    expect(startGateway).toHaveBeenCalledWith('auto-restart-after-crash');
  });

  test('stops scheduling restarts after reaching the attempt limit', async () => {
    vi.useFakeTimers();
    const { OpenClawEngineManager } = await import('./openclawEngineManager');
    const manager = new OpenClawEngineManager();
    const startGateway = vi.spyOn(manager, 'startGateway').mockResolvedValue(manager.getStatus());
    const statuses: Array<{ phase: string; message?: string; canRetry: boolean }> = [];
    manager.on('status', (status) => {
      statuses.push({
        phase: status.phase,
        message: status.message,
        canRetry: status.canRetry,
      });
    });

    (manager as unknown as {
      gatewayRestartAttempt: number;
      scheduleGatewayRestart(): void;
    }).gatewayRestartAttempt = 5;
    (manager as unknown as {
      scheduleGatewayRestart(): void;
    }).scheduleGatewayRestart();

    await vi.advanceTimersByTimeAsync(30_000);

    expect(startGateway).not.toHaveBeenCalled();
    expect(statuses).toContainEqual(expect.objectContaining({
      phase: 'error',
      message: 'OpenClaw gateway failed to start after 5 attempts. Check model configuration or restart manually.',
      canRetry: true,
    }));
  });
});

describe('OpenClawEngineManager gateway client entry resolution', () => {
  beforeEach(() => {
    mockAppPath = makeTempDir('openclaw-manager-app-');
    writePackageJson(mockAppPath, {});
  });

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('prefers the candidate that actually exports a GatewayClient-compatible constructor', async () => {
    const { OpenClawEngineManager } = await import('./openclawEngineManager');
    const manager = new OpenClawEngineManager();
    const distRoot = makeTempDir('openclaw-dist-');
    const invalidCandidate = path.join(distRoot, 'method-scopes-a.js');
    const validCandidate = path.join(distRoot, 'method-scopes-b.js');

    fs.writeFileSync(invalidCandidate, 'exports.notGatewayClient = function NotGatewayClient() {};', 'utf8');
    fs.writeFileSync(validCandidate, `
class MinifiedGatewayClient {
  start() {}
  stop() {}
  request() {}
}
exports.n = MinifiedGatewayClient;
`, 'utf8');

    const resolved = (manager as unknown as {
      findGatewayClientEntryFromDistRoot(distRoot: string): string | null;
    }).findGatewayClientEntryFromDistRoot(distRoot);

    expect(resolved).toBe(validCandidate);
  });

  test('falls back to the first method-scopes candidate only when no export can be verified', async () => {
    const { OpenClawEngineManager } = await import('./openclawEngineManager');
    const manager = new OpenClawEngineManager();
    const distRoot = makeTempDir('openclaw-dist-');
    const firstCandidate = path.join(distRoot, 'method-scopes-a.js');
    fs.writeFileSync(firstCandidate, 'exports.n = function NotGatewayClient() {};', 'utf8');
    fs.writeFileSync(path.join(distRoot, 'client-a.js'), 'exports.n = function AlsoNotGatewayClient() {};', 'utf8');

    const resolved = (manager as unknown as {
      findGatewayClientEntryFromDistRoot(distRoot: string): string | null;
    }).findGatewayClientEntryFromDistRoot(distRoot);

    expect(resolved).toBe(firstCandidate);
  });
});

describe('OpenClawEngineManager config guards', () => {
  beforeEach(() => {
    mockAppPath = makeTempDir('openclaw-manager-app-');
    writePackageJson(mockAppPath, {});
  });

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('removes unsupported agents.defaults.cwd before gateway start', async () => {
    const { OpenClawEngineManager } = await import('./openclawEngineManager');
    const manager = new OpenClawEngineManager();
    const configPath = manager.getConfigPath();
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        agents: {
          defaults: {
            cwd: '/tmp/legacy-cwd',
            model: 'openai/gpt-5.1-codex',
          },
        },
      }, null, 2) + '\n',
      'utf8',
    );

    (manager as unknown as {
      ensureConfigFile(): void;
    }).ensureConfigFile();

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
      gateway?: { mode?: string };
      agents?: { defaults?: Record<string, unknown> };
    };
    expect(config.gateway?.mode).toBe('local');
    expect(config.agents?.defaults).toEqual({ model: 'openai/gpt-5.1-codex' });
  });
});

function makeFakeGatewayProcess(): EventEmitter & { pid: number; exitCode: number | null; kill: ReturnType<typeof vi.fn> } {
  return Object.assign(new EventEmitter(), {
    pid: 12345,
    exitCode: null,
    kill: vi.fn(),
  });
}
