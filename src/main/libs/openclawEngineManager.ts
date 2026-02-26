import { app } from 'electron';
import { ChildProcessWithoutNullStreams, spawn, spawnSync } from 'child_process';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import fs from 'fs';
import net from 'net';
import path from 'path';

const DEFAULT_OPENCLAW_VERSION = '2026.2.23';
const DEFAULT_OPENCLAW_PACKAGE = 'openclaw';
const DEFAULT_GATEWAY_PORT = 18789;
const GATEWAY_PORT_SCAN_LIMIT = 80;
const INSTALL_LOCK_STALE_MS = 30 * 60 * 1000;
const INSTALL_LOCK_WAIT_TIMEOUT_MS = 2 * 60 * 1000;
const INSTALL_LOCK_POLL_MS = 1000;
const INSTALL_TIMEOUT_MS = 10 * 60 * 1000;
const GATEWAY_BOOT_TIMEOUT_MS = 30 * 1000;
const GATEWAY_RESTART_DELAY_MS = 3000;

export type OpenClawEnginePhase =
  | 'not_installed'
  | 'installing'
  | 'ready'
  | 'starting'
  | 'running'
  | 'error';

export interface OpenClawEngineStatus {
  phase: OpenClawEnginePhase;
  version: string | null;
  progressPercent?: number;
  message?: string;
  canRetry: boolean;
}

export interface OpenClawGatewayConnectionInfo {
  version: string | null;
  port: number | null;
  token: string | null;
  url: string | null;
  clientEntryPath: string | null;
}

interface OpenClawBootstrapManifest {
  version: string;
  packageName?: string;
  downloadUrl?: string;
  sha256?: string;
}

interface OpenClawEngineManagerEvents {
  status: (status: OpenClawEngineStatus) => void;
}

interface InstallRuntime {
  kind: 'embedded-node' | 'npm-command';
  nodePath?: string;
  npmCliPath?: string;
  npmCommand?: string;
}

interface GatewayNodeRuntime {
  nodePath: string;
  needsElectronRunAsNode: boolean;
}

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const parseJsonFile = <T>(filePath: string): T | null => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const ensureDir = (dirPath: string): void => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const isProcessAlive = (child: ChildProcessWithoutNullStreams | null): child is ChildProcessWithoutNullStreams => {
  return Boolean(child && child.pid && !child.killed && child.exitCode === null);
};

const hasCommand = (command: string): boolean => {
  const result = spawnSync(command, ['--version'], {
    stdio: 'ignore',
    shell: false,
  });
  return result.status === 0;
};

const normalizeManifestVersion = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const findPath = (candidates: string[]): string | null => {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const isPortReachable = (host: string, port: number, timeoutMs = 1200): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const done = (result: boolean) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
};

const isPortAvailable = async (port: number): Promise<boolean> => {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
};

export class OpenClawEngineManager extends EventEmitter {
  private readonly baseDir: string;
  private readonly engineRoot: string;
  private readonly cacheDir: string;
  private readonly logsDir: string;
  private readonly stateDir: string;
  private readonly installLockPath: string;
  private readonly activeVersionPath: string;
  private readonly gatewayTokenPath: string;
  private readonly gatewayPortPath: string;
  private readonly gatewayLogPath: string;
  private readonly configPath: string;
  private readonly desiredVersion: string;
  private readonly packageName: string;

  private status: OpenClawEngineStatus;
  private installPromise: Promise<OpenClawEngineStatus> | null = null;
  private gatewayProcess: ChildProcessWithoutNullStreams | null = null;
  private readonly expectedGatewayExits = new WeakSet<ChildProcessWithoutNullStreams>();
  private gatewayRestartTimer: NodeJS.Timeout | null = null;
  private shutdownRequested = false;
  private gatewayPort: number | null = null;

  constructor() {
    super();

    const userDataPath = app.getPath('userData');
    this.baseDir = path.join(userDataPath, 'openclaw');
    this.engineRoot = path.join(this.baseDir, 'engine');
    this.cacheDir = path.join(this.baseDir, 'cache');
    this.logsDir = path.join(this.baseDir, 'logs');
    this.stateDir = path.join(this.baseDir, 'state');

    this.installLockPath = path.join(this.baseDir, 'install.lock');
    this.activeVersionPath = path.join(this.baseDir, 'current.json');
    this.gatewayTokenPath = path.join(this.stateDir, 'gateway-token');
    this.gatewayPortPath = path.join(this.stateDir, 'gateway-port.json');
    this.gatewayLogPath = path.join(this.logsDir, 'gateway.log');
    this.configPath = path.join(this.stateDir, 'openclaw.json');

    ensureDir(this.baseDir);
    ensureDir(this.engineRoot);
    ensureDir(this.cacheDir);
    ensureDir(this.logsDir);
    ensureDir(this.stateDir);

    const manifest = this.loadManifest();
    this.desiredVersion = manifest.version;
    this.packageName = manifest.packageName;

    const installedVersion = this.resolveWorkingVersion();
    this.status = installedVersion
      ? {
          phase: 'ready',
          version: installedVersion,
          message: 'OpenClaw engine is ready.',
          canRetry: false,
        }
      : {
          phase: 'not_installed',
          version: null,
          message: 'OpenClaw engine is not installed yet.',
          canRetry: true,
        };
  }

  override on<U extends keyof OpenClawEngineManagerEvents>(
    event: U,
    listener: OpenClawEngineManagerEvents[U],
  ): this {
    return super.on(event, listener);
  }

  override emit<U extends keyof OpenClawEngineManagerEvents>(
    event: U,
    ...args: Parameters<OpenClawEngineManagerEvents[U]>
  ): boolean {
    return super.emit(event, ...args);
  }

  getStatus(): OpenClawEngineStatus {
    return { ...this.status };
  }

  setExternalError(message: string): OpenClawEngineStatus {
    this.setStatus({
      phase: 'error',
      version: this.desiredVersion,
      message: message.slice(0, 500),
      canRetry: true,
    });
    return this.getStatus();
  }

  getDesiredVersion(): string {
    return this.desiredVersion;
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  getStateDir(): string {
    return this.stateDir;
  }

  getConfigPath(): string {
    return this.configPath;
  }

  getGatewayConnectionInfo(): OpenClawGatewayConnectionInfo {
    const version = this.resolveWorkingVersion();
    const port = this.gatewayPort ?? this.readGatewayPort();
    const token = this.readGatewayToken();
    const clientEntryPath = version ? this.resolveGatewayClientEntry(version) : null;

    return {
      version,
      port,
      token,
      url: port ? `ws://127.0.0.1:${port}` : null,
      clientEntryPath,
    };
  }

  async ensureReady(options: { forceReinstall?: boolean } = {}): Promise<OpenClawEngineStatus> {
    if (this.installPromise) {
      return this.installPromise;
    }

    this.installPromise = this.ensureReadyInternal(options)
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.setStatus({
          phase: 'error',
          version: this.desiredVersion,
          message: `OpenClaw engine install failed: ${message}`,
          canRetry: true,
        });
        return this.getStatus();
      })
      .finally(() => {
        this.installPromise = null;
      });

    return await this.installPromise;
  }

  async startGateway(): Promise<OpenClawEngineStatus> {
    this.shutdownRequested = false;

    const ensured = await this.ensureReady();
    if (ensured.phase !== 'ready' && ensured.phase !== 'running') {
      return ensured;
    }

    if (isProcessAlive(this.gatewayProcess)) {
      if (this.status.phase !== 'running') {
        this.setStatus({
          phase: 'running',
          version: this.status.version,
          message: 'OpenClaw gateway is running.',
          canRetry: false,
        });
      }
      return this.getStatus();
    }

    const runtime = this.resolveNodeRuntime();
    const version = this.resolveWorkingVersion();
    if (!version) {
      this.setStatus({
        phase: 'error',
        version: null,
        message: 'OpenClaw engine version is unavailable.',
        canRetry: true,
      });
      return this.getStatus();
    }

    const openclawEntry = this.resolveOpenClawEntry(version);
    if (!openclawEntry) {
      this.setStatus({
        phase: 'error',
        version,
        message: `OpenClaw entry file is missing for version ${version}.`,
        canRetry: true,
      });
      return this.getStatus();
    }

    const token = this.ensureGatewayToken();
    const port = await this.resolveGatewayPort();
    this.gatewayPort = port;
    this.writeGatewayPort(port);
    this.ensureConfigFile();

    this.setStatus({
      phase: 'starting',
      version,
      progressPercent: 10,
      message: 'Starting OpenClaw gateway...',
      canRetry: false,
    });

    const args = [
      openclawEntry,
      'gateway',
      '--bind',
      'loopback',
      '--port',
      String(port),
      '--token',
      token,
    ];

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      OPENCLAW_STATE_DIR: this.stateDir,
      OPENCLAW_CONFIG_PATH: this.configPath,
      OPENCLAW_GATEWAY_TOKEN: token,
      OPENCLAW_GATEWAY_PORT: String(port),
      OPENCLAW_ENGINE_VERSION: version,
    };

    if (runtime.needsElectronRunAsNode) {
      env.ELECTRON_RUN_AS_NODE = '1';
    }

    const child = spawn(runtime.nodePath, args, {
      cwd: path.dirname(openclawEntry),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.gatewayProcess = child;
    this.attachGatewayProcessLogs(child);
    this.attachGatewayExitHandlers(child);

    const ready = await this.waitForGatewayReady(port, GATEWAY_BOOT_TIMEOUT_MS);
    if (!ready) {
      this.setStatus({
        phase: 'error',
        version,
        message: 'OpenClaw gateway failed to become healthy in time.',
        canRetry: true,
      });
      this.stopGatewayProcess(child);
      return this.getStatus();
    }

    this.setStatus({
      phase: 'running',
      version,
      progressPercent: 100,
      message: `OpenClaw gateway is running on loopback:${port}.`,
      canRetry: false,
    });

    return this.getStatus();
  }

  async stopGateway(): Promise<void> {
    this.shutdownRequested = true;

    if (this.gatewayRestartTimer) {
      clearTimeout(this.gatewayRestartTimer);
      this.gatewayRestartTimer = null;
    }

    if (this.gatewayProcess) {
      this.stopGatewayProcess(this.gatewayProcess);
      this.gatewayProcess = null;
    }

    const version = this.resolveWorkingVersion();
    this.setStatus({
      phase: version ? 'ready' : 'not_installed',
      version,
      message: version
        ? 'OpenClaw engine is ready. Gateway is stopped.'
        : 'OpenClaw engine is not installed.',
      canRetry: !version,
    });
  }

  private async ensureReadyInternal(options: { forceReinstall?: boolean }): Promise<OpenClawEngineStatus> {
    const forceReinstall = Boolean(options.forceReinstall);
    const desiredVersion = this.desiredVersion;

    this.setStatus({
      phase: 'installing',
      version: desiredVersion,
      progressPercent: 5,
      message: forceReinstall
        ? `Reinstalling OpenClaw ${desiredVersion}...`
        : `Installing OpenClaw ${desiredVersion}...`,
      canRetry: false,
    });

    const existingDesired = this.resolveInstalledVersion(desiredVersion);
    if (existingDesired && !forceReinstall) {
      this.writeActiveVersion(desiredVersion);
      this.setStatus({
        phase: 'ready',
        version: desiredVersion,
        progressPercent: 100,
        message: `OpenClaw ${desiredVersion} is already installed.`,
        canRetry: false,
      });
      return this.getStatus();
    }

    await this.withInstallLock(async () => {
      const postLockDesired = this.resolveInstalledVersion(desiredVersion);
      if (postLockDesired && !forceReinstall) {
        this.writeActiveVersion(desiredVersion);
        this.setStatus({
          phase: 'ready',
          version: desiredVersion,
          progressPercent: 100,
          message: `OpenClaw ${desiredVersion} is ready.`,
          canRetry: false,
        });
        return;
      }

      const targetDir = this.resolveVersionDir(desiredVersion);
      const tempDir = `${targetDir}.installing-${Date.now()}`;

      this.setStatus({
        phase: 'installing',
        version: desiredVersion,
        progressPercent: 20,
        message: `Preparing installation workspace for OpenClaw ${desiredVersion}...`,
        canRetry: false,
      });

      fs.rmSync(tempDir, { recursive: true, force: true });
      ensureDir(tempDir);

      await this.installPackage(tempDir, desiredVersion);

      this.setStatus({
        phase: 'installing',
        version: desiredVersion,
        progressPercent: 85,
        message: `Verifying OpenClaw ${desiredVersion}...`,
        canRetry: false,
      });

      const verifyEntry = path.join(tempDir, 'node_modules', 'openclaw', 'openclaw.mjs');
      if (!fs.existsSync(verifyEntry)) {
        throw new Error(`Installed package is missing openclaw entry: ${verifyEntry}`);
      }

      fs.rmSync(targetDir, { recursive: true, force: true });
      fs.renameSync(tempDir, targetDir);
      this.cleanupOldTempInstalls(desiredVersion);
      this.writeActiveVersion(desiredVersion);

      this.setStatus({
        phase: 'ready',
        version: desiredVersion,
        progressPercent: 100,
        message: `OpenClaw ${desiredVersion} installed successfully.`,
        canRetry: false,
      });
    });

    return this.getStatus();
  }

  private async installPackage(prefixDir: string, version: string): Promise<void> {
    const runtime = this.resolveInstallRuntime();
    const packageSpec = `${this.packageName}@${version}`;

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      npm_config_cache: path.join(this.cacheDir, 'npm'),
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      npm_config_update_notifier: 'false',
      npm_config_progress: 'false',
      npm_config_loglevel: 'warn',
    };

    const { command, args } = runtime.kind === 'embedded-node'
      ? {
          command: runtime.nodePath!,
          args: [
            runtime.npmCliPath!,
            'install',
            packageSpec,
            '--prefix',
            prefixDir,
            '--no-audit',
            '--fund=false',
            '--loglevel',
            'warn',
          ],
        }
      : {
          command: runtime.npmCommand!,
          args: [
            'install',
            packageSpec,
            '--prefix',
            prefixDir,
            '--no-audit',
            '--fund=false',
            '--loglevel',
            'warn',
          ],
        };

    if (runtime.kind === 'embedded-node' && runtime.nodePath === process.execPath) {
      env.ELECTRON_RUN_AS_NODE = '1';
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: prefixDir,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderrTail = '';
      let stdoutTail = '';
      let progressCursor = 30;
      const updateProgress = (line: string) => {
        progressCursor = Math.min(78, progressCursor + 1);
        this.setStatus({
          phase: 'installing',
          version,
          progressPercent: progressCursor,
          message: this.sanitizeProgressLine(line),
          canRetry: false,
        });
      };

      const onStdout = this.createLineReader((line) => {
        stdoutTail = `${stdoutTail}\n${line}`.slice(-3000);
        if (line.trim()) {
          updateProgress(line);
        }
      });

      const onStderr = this.createLineReader((line) => {
        stderrTail = `${stderrTail}\n${line}`.slice(-4000);
        if (line.trim()) {
          updateProgress(line);
        }
      });

      child.stdout.on('data', (chunk) => onStdout(chunk.toString()));
      child.stderr.on('data', (chunk) => onStderr(chunk.toString()));

      const timeout = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
        reject(new Error('OpenClaw install timed out.')); 
      }, INSTALL_TIMEOUT_MS);

      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      child.once('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
          return;
        }
        reject(
          new Error(
            `OpenClaw install failed with exit code ${code}. stderr: ${stderrTail.trim() || '(empty)'} stdout: ${stdoutTail.trim() || '(empty)'}`,
          ),
        );
      });
    });
  }

  private async withInstallLock<T>(fn: () => Promise<T>): Promise<T> {
    const start = Date.now();

    while (true) {
      const fd = this.tryAcquireInstallLock();
      if (fd !== null) {
        try {
          return await fn();
        } finally {
          try {
            fs.closeSync(fd);
          } catch {
            // ignore
          }
          try {
            fs.rmSync(this.installLockPath, { force: true });
          } catch {
            // ignore
          }
        }
      }

      if (Date.now() - start > INSTALL_LOCK_WAIT_TIMEOUT_MS) {
        throw new Error('Timed out waiting for OpenClaw install lock.');
      }

      await sleep(INSTALL_LOCK_POLL_MS);
    }
  }

  private tryAcquireInstallLock(): number | null {
    try {
      return fs.openSync(this.installLockPath, 'wx');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'EEXIST') {
        return null;
      }

      try {
        const stat = fs.statSync(this.installLockPath);
        if (Date.now() - stat.mtimeMs > INSTALL_LOCK_STALE_MS) {
          fs.rmSync(this.installLockPath, { force: true });
          return fs.openSync(this.installLockPath, 'wx');
        }
      } catch {
        // ignore
      }
      return null;
    }
  }

  private resolveInstallRuntime(): InstallRuntime {
    const embedded = this.resolveEmbeddedNodeRuntime();
    if (embedded) {
      return embedded;
    }

    if (app.isPackaged) {
      throw new Error(
        'Embedded Node runtime is missing. Expected resources/node-runtime/<platform> in packaged app.',
      );
    }

    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    if (hasCommand(npmCommand)) {
      return { kind: 'npm-command', npmCommand };
    }

    throw new Error(
      'No usable npm runtime found. Expected embedded node runtime under resources/node-runtime/<platform> or system npm in PATH.',
    );
  }

  private resolveNodeRuntime(): GatewayNodeRuntime {
    const embedded = this.resolveEmbeddedNodeRuntime();
    if (embedded) {
      return {
        nodePath: embedded.nodePath!,
        needsElectronRunAsNode: embedded.nodePath === process.execPath,
      };
    }

    if (!app.isPackaged && hasCommand('node')) {
      return {
        nodePath: 'node',
        needsElectronRunAsNode: false,
      };
    }

    return {
      nodePath: process.execPath,
      needsElectronRunAsNode: true,
    };
  }

  private resolveEmbeddedNodeRuntime(): InstallRuntime | null {
    const resourcesRoot = this.resolveResourcesRoot();
    const runtimeRoot = path.join(resourcesRoot, 'node-runtime', process.platform);

    const nodePath = process.platform === 'win32'
      ? findPath([
          path.join(runtimeRoot, 'node.exe'),
          path.join(runtimeRoot, 'bin', 'node.exe'),
        ])
      : findPath([
          path.join(runtimeRoot, 'bin', 'node'),
          path.join(runtimeRoot, 'node'),
        ]);

    if (!nodePath) {
      return null;
    }

    const npmCliPath = findPath([
      path.join(runtimeRoot, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      path.join(runtimeRoot, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      path.join(path.dirname(nodePath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
      path.join(path.dirname(nodePath), '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    ]);

    if (!npmCliPath) {
      return null;
    }

    return {
      kind: 'embedded-node',
      nodePath,
      npmCliPath,
    };
  }

  private resolveOpenClawEntry(version: string): string | null {
    const candidate = path.join(this.resolveVersionDir(version), 'node_modules', 'openclaw', 'openclaw.mjs');
    return fs.existsSync(candidate) ? candidate : null;
  }

  private resolveGatewayClientEntry(version: string): string | null {
    const root = path.join(this.resolveVersionDir(version), 'node_modules', 'openclaw');
    const legacy = path.join(root, 'dist', 'gateway', 'client.js');
    if (fs.existsSync(legacy)) {
      return legacy;
    }

    const distRoot = path.join(root, 'dist');
    if (!fs.existsSync(distRoot) || !fs.statSync(distRoot).isDirectory()) {
      return null;
    }

    try {
      const candidates = fs.readdirSync(distRoot)
        .filter((name) => /^client-.*\.js$/i.test(name))
        .sort();
      if (candidates.length > 0) {
        return path.join(distRoot, candidates[0]);
      }
    } catch {
      // ignore
    }

    return null;
  }

  private resolveVersionDir(version: string): string {
    return path.join(this.engineRoot, version);
  }

  private resolveInstalledVersion(version: string): string | null {
    const entry = this.resolveOpenClawEntry(version);
    return entry ? version : null;
  }

  private resolveWorkingVersion(): string | null {
    const active = this.readActiveVersion();
    if (active === this.desiredVersion && this.resolveInstalledVersion(active)) {
      return active;
    }

    const desired = this.resolveInstalledVersion(this.desiredVersion);
    if (desired) {
      return desired;
    }

    return null;
  }

  private readActiveVersion(): string | null {
    const payload = parseJsonFile<{ activeVersion?: string }>(this.activeVersionPath);
    if (!payload?.activeVersion || typeof payload.activeVersion !== 'string') {
      return null;
    }
    const trimmed = payload.activeVersion.trim();
    return trimmed || null;
  }

  private writeActiveVersion(version: string): void {
    ensureDir(path.dirname(this.activeVersionPath));
    fs.writeFileSync(
      this.activeVersionPath,
      JSON.stringify({ activeVersion: version, updatedAt: Date.now() }, null, 2),
      'utf8',
    );
  }

  private cleanupOldTempInstalls(keepVersion: string): void {
    try {
      const entries = fs.readdirSync(this.engineRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === keepVersion) continue;
        if (entry.name.includes('.installing-')) {
          fs.rmSync(path.join(this.engineRoot, entry.name), { recursive: true, force: true });
        }
      }
    } catch {
      // ignore
    }
  }

  private ensureGatewayToken(): string {
    try {
      const existing = fs.readFileSync(this.gatewayTokenPath, 'utf8').trim();
      if (existing) {
        return existing;
      }
    } catch {
      // ignore
    }

    const token = crypto.randomBytes(24).toString('hex');
    ensureDir(path.dirname(this.gatewayTokenPath));
    fs.writeFileSync(this.gatewayTokenPath, token, 'utf8');
    return token;
  }

  private readGatewayToken(): string | null {
    try {
      const token = fs.readFileSync(this.gatewayTokenPath, 'utf8').trim();
      return token || null;
    } catch {
      return null;
    }
  }

  private ensureConfigFile(): void {
    ensureDir(path.dirname(this.configPath));
    if (!fs.existsSync(this.configPath)) {
      fs.writeFileSync(this.configPath, '{}\n', 'utf8');
    }
  }

  private writeGatewayPort(port: number): void {
    fs.writeFileSync(this.gatewayPortPath, JSON.stringify({ port, updatedAt: Date.now() }, null, 2), 'utf8');
  }

  private readGatewayPort(): number | null {
    const payload = parseJsonFile<{ port?: number }>(this.gatewayPortPath);
    if (!payload || typeof payload.port !== 'number' || !Number.isInteger(payload.port)) {
      return null;
    }
    if (payload.port <= 0 || payload.port > 65535) {
      return null;
    }
    return payload.port;
  }

  private async resolveGatewayPort(): Promise<number> {
    const candidates: number[] = [];

    if (this.gatewayPort) candidates.push(this.gatewayPort);
    const persisted = this.readGatewayPort();
    if (persisted) candidates.push(persisted);
    candidates.push(DEFAULT_GATEWAY_PORT);

    const uniqCandidates = Array.from(new Set(candidates));
    for (const candidate of uniqCandidates) {
      if (await isPortAvailable(candidate)) {
        return candidate;
      }
    }

    for (let offset = 1; offset <= GATEWAY_PORT_SCAN_LIMIT; offset += 1) {
      const candidate = DEFAULT_GATEWAY_PORT + offset;
      if (await isPortAvailable(candidate)) {
        return candidate;
      }
    }

    throw new Error('No available loopback port for OpenClaw gateway.');
  }

  private waitForGatewayReady(port: number, timeoutMs: number): Promise<boolean> {
    const startedAt = Date.now();
    return new Promise((resolve) => {
      const tick = async () => {
        if (this.shutdownRequested) {
          resolve(false);
          return;
        }

        if (!isProcessAlive(this.gatewayProcess)) {
          resolve(false);
          return;
        }

        const reachable = await isPortReachable('127.0.0.1', port, 1000);
        if (reachable) {
          resolve(true);
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          resolve(false);
          return;
        }

        setTimeout(() => {
          void tick();
        }, 600);
      };

      void tick();
    });
  }

  private stopGatewayProcess(child: ChildProcessWithoutNullStreams): void {
    this.expectedGatewayExits.add(child);

    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }

    setTimeout(() => {
      if (isProcessAlive(child)) {
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
      }
    }, 1200);
  }

  private attachGatewayProcessLogs(child: ChildProcessWithoutNullStreams): void {
    ensureDir(path.dirname(this.gatewayLogPath));
    const appendLog = (chunk: Buffer | string, stream: 'stdout' | 'stderr') => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString();
      const line = `[${new Date().toISOString()}] [${stream}] ${text}`;
      fs.appendFile(this.gatewayLogPath, line, () => {
        // best-effort log append
      });
    };

    child.stdout.on('data', (chunk) => appendLog(chunk, 'stdout'));
    child.stderr.on('data', (chunk) => appendLog(chunk, 'stderr'));
  }

  private attachGatewayExitHandlers(child: ChildProcessWithoutNullStreams): void {
    child.once('error', (error) => {
      if (this.expectedGatewayExits.has(child)) {
        this.expectedGatewayExits.delete(child);
        return;
      }
      if (this.shutdownRequested) return;
      this.setStatus({
        phase: 'error',
        version: this.status.version,
        message: `OpenClaw gateway process error: ${error.message}`,
        canRetry: true,
      });
      this.scheduleGatewayRestart();
    });

    child.once('close', (code, signal) => {
      if (this.gatewayProcess === child) {
        this.gatewayProcess = null;
      }
      if (this.expectedGatewayExits.has(child)) {
        this.expectedGatewayExits.delete(child);
        return;
      }
      if (this.shutdownRequested) return;

      this.setStatus({
        phase: 'error',
        version: this.status.version,
        message: `OpenClaw gateway exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`,
        canRetry: true,
      });
      this.scheduleGatewayRestart();
    });
  }

  private scheduleGatewayRestart(): void {
    if (this.shutdownRequested) return;
    if (this.gatewayRestartTimer) return;

    this.gatewayRestartTimer = setTimeout(() => {
      this.gatewayRestartTimer = null;
      if (this.shutdownRequested) return;
      void this.startGateway();
    }, GATEWAY_RESTART_DELAY_MS);
  }

  private loadManifest(): { version: string; packageName: string; manifest: OpenClawBootstrapManifest | null } {
    const resourcesRoot = this.resolveResourcesRoot();
    const manifestPath = path.join(resourcesRoot, 'openclaw-bootstrap', 'manifest.json');
    const parsed = parseJsonFile<OpenClawBootstrapManifest>(manifestPath);

    const manifestVersion = normalizeManifestVersion(parsed?.version);
    const packageName = normalizeManifestVersion(parsed?.packageName) || DEFAULT_OPENCLAW_PACKAGE;

    return {
      version: manifestVersion || DEFAULT_OPENCLAW_VERSION,
      packageName,
      manifest: parsed,
    };
  }

  private resolveResourcesRoot(): string {
    if (app.isPackaged) {
      return process.resourcesPath;
    }
    const appPath = app.getAppPath();
    return path.join(appPath, 'resources');
  }

  private setStatus(next: OpenClawEngineStatus): void {
    this.status = {
      ...next,
      message: next.message ? next.message.slice(0, 500) : undefined,
    };
    this.emit('status', this.getStatus());
  }

  private createLineReader(onLine: (line: string) => void): (chunk: string) => void {
    let buffer = '';
    return (chunk: string) => {
      buffer += chunk;
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop() ?? '';
      for (const line of parts) {
        onLine(line);
      }
    };
  }

  private sanitizeProgressLine(line: string): string {
    const compact = line.replace(/\s+/g, ' ').trim();
    if (!compact) return 'Installing OpenClaw...';
    if (compact.length <= 220) return compact;
    return `${compact.slice(0, 217)}...`;
  }
}
