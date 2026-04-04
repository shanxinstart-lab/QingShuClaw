import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { app } from 'electron';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'child_process';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import * as tar from 'tar';
import {
  TtsEngine,
  TtsPlaybackMode,
  TtsPrepareStatus,
  TtsStateType,
  TtsVoiceQuality,
  TtsWorkerStatus,
  type TtsAvailability,
  type TtsSpeakOptions,
  type TtsSpeakResult,
  type TtsStateEvent,
  type TtsVoice,
} from '../../shared/tts/constants';
import type { VoiceEdgeTtsProviderConfig } from '../../shared/voice/constants';

type EdgeTtsVoicePayload = Record<string, unknown>;

type EdgeTtsWorkerResponse =
  | { id?: string; success: true; ready?: boolean; voices?: EdgeTtsVoicePayload[]; output?: string }
  | { id?: string; success: false; error: string };

type EdgeTtsWorkerPendingRequest = {
  resolve: (value: EdgeTtsWorkerResponse) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

type EdgeTtsSynthesizedAudio = {
  audioPath: string;
  voiceId: string;
};

const EDGE_TTS_VERSION = process.env.LOBSTERAI_EDGE_TTS_VERSION?.trim() || '7.2.8';
const EDGE_TTS_RUNTIME_RELEASE = process.env.LOBSTERAI_EDGE_TTS_PYTHON_RELEASE?.trim() || '20260325';
const EDGE_TTS_PYTHON_VERSION = process.env.LOBSTERAI_EDGE_TTS_PYTHON_VERSION?.trim() || '3.10.20';
const EDGE_TTS_RUNTIME_DIR = 'edge-tts-runtime';
const EDGE_TTS_PYTHON_DIR = 'python';
const EDGE_TTS_SITE_PACKAGES_DIR = 'site-packages';
const EDGE_TTS_INSTALL_CACHE_DIR = 'cache';
const EDGE_TTS_AUDIO_CACHE_DIR = 'audio-cache';
const EDGE_TTS_RUNNER_NAME = 'edge_tts_runner.py';
const EDGE_TTS_COMMAND_TIMEOUT_MS = 60_000;
const EDGE_TTS_WORKER_BOOT_TIMEOUT_MS = 20_000;
const EDGE_TTS_PLAYBACK_SETTLE_TIMEOUT_MS = 1_500;
const EDGE_TTS_DEFAULT_PLAYBACK_TIMEOUT_MS = 8_000;
const EDGE_TTS_INSTALL_TIMEOUT_MS = 5 * 60_000;
const EDGE_TTS_REQUIRED_IMPORTS = ['edge_tts', 'aiohttp'] as const;
const EDGE_TTS_AUDIO_CACHE_MAX_BYTES = 256 * 1024 * 1024;
const EDGE_TTS_AUDIO_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EDGE_TTS_WORKER_RESTART_DELAY_MS = 300;

const PYTHON_RUNTIME_URL_BY_ARCH: Record<string, string> = {
  arm64: `https://github.com/astral-sh/python-build-standalone/releases/download/${EDGE_TTS_RUNTIME_RELEASE}/cpython-${EDGE_TTS_PYTHON_VERSION}%2B${EDGE_TTS_RUNTIME_RELEASE}-aarch64-apple-darwin-install_only.tar.gz`,
  x64: `https://github.com/astral-sh/python-build-standalone/releases/download/${EDGE_TTS_RUNTIME_RELEASE}/cpython-${EDGE_TTS_PYTHON_VERSION}%2B${EDGE_TTS_RUNTIME_RELEASE}-x86_64-apple-darwin-install_only.tar.gz`,
};

const normalizeSpawnOutput = (value: string | Buffer | null | undefined): string => {
  if (!value) {
    return '';
  }
  return value.toString().trim();
};

const ensureDir = async (targetPath: string): Promise<void> => {
  await fs.promises.mkdir(targetPath, { recursive: true });
};

const resolveCommand = (command: string): string | null => {
  const trimmed = command.trim();
  if (!trimmed) {
    return null;
  }
  if (path.isAbsolute(trimmed) && fs.existsSync(trimmed)) {
    return trimmed;
  }
  const checker = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(checker, [trimmed], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null;
};

const collectFiles = (rootDir: string, matcher: (candidate: string) => boolean): string[] => {
  const results: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const candidate = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(candidate);
        continue;
      }
      if (matcher(candidate)) {
        results.push(candidate);
      }
    }
  }
  return results;
};

const parsePythonVersion = (rawVersion: string): number[] => {
  const match = rawVersion.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return [0, 0, 0];
  }
  return match.slice(1).map((value) => Number(value));
};

const isSupportedPythonVersion = (rawVersion: string): boolean => {
  const [major, minor] = parsePythonVersion(rawVersion);
  return major > 3 || (major === 3 && minor >= 9);
};

const toEdgeTtsRate = (rate?: number): string => {
  const normalized = Number.isFinite(rate) ? Math.max(0.1, Math.min(1, rate ?? 0.5)) : 0.5;
  const percent = Math.round((normalized - 0.5) * 100);
  return `${percent >= 0 ? '+' : ''}${percent}%`;
};

const toEdgeTtsVolume = (volume?: number): string => {
  const normalized = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume ?? 1)) : 1;
  const percent = Math.round((normalized - 1) * 100);
  return `${percent >= 0 ? '+' : ''}${percent}%`;
};

const buildRunnerSource = (): string => `
import asyncio
import json
import os
import sys

from edge_tts import Communicate, list_voices


def normalize_voice(voice):
    short_name = voice.get("ShortName") or voice.get("Name") or ""
    friendly_name = voice.get("FriendlyName") or short_name
    locale = voice.get("Locale") or ""
    return {
        "identifier": short_name,
        "name": friendly_name,
        "language": locale,
    }


async def handle_command(payload):
    command = payload.get("command")
    if command == "ping":
        return {"success": True, "ready": True}

    if command == "voices":
        voices = await list_voices()
        return {
            "success": True,
            "voices": [normalize_voice(voice) for voice in voices],
        }

    if command == "speak":
        output = payload.get("output") or ""
        if not output:
            return {"success": False, "error": "missing_output"}

        output_dir = os.path.dirname(output)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)

        communicate = Communicate(
            payload.get("text") or "",
            payload.get("voice") or "",
            rate=payload.get("rate") or "+0%",
            volume=payload.get("volume") or "+0%",
        )
        await communicate.save(output)
        return {"success": True, "output": output}

    return {"success": False, "error": f"unknown_command:{command}"}


async def main():
    loop = asyncio.get_running_loop()
    while True:
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if line == "":
            break
        stripped = line.strip()
        if not stripped:
            continue

        request_id = None
        try:
            payload = json.loads(stripped)
            request_id = payload.get("id")
        except Exception as error:
            print(
                json.dumps(
                    {"id": request_id, "success": False, "error": f"invalid_json:{error}"},
                    ensure_ascii=False,
                ),
                flush=True,
            )
            continue

        try:
            response = await handle_command(payload)
        except Exception as error:
            response = {"success": False, "error": str(error)}

        response["id"] = request_id
        print(json.dumps(response, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
`.trimStart();

const isFailureResponse = (
  payload: EdgeTtsWorkerResponse,
): payload is { id?: string; success: false; error: string } => {
  return payload.success === false;
};

export class EdgeTtsService extends EventEmitter {
  private prepareStatus: typeof TtsPrepareStatus[keyof typeof TtsPrepareStatus] = TtsPrepareStatus.Idle;

  private workerStatus: typeof TtsWorkerStatus[keyof typeof TtsWorkerStatus] = TtsWorkerStatus.Idle;

  private recentError?: string;

  private preparePromise: Promise<void> | null = null;

  private workerStartPromise: Promise<void> | null = null;

  private workerProcess: ChildProcessWithoutNullStreams | null = null;

  private workerStdoutBuffer = '';

  private workerStderrBuffer = '';

  private workerShouldStayAlive = false;

  private workerRestartAttempts = 0;

  private workerStopping = false;

  private workerRequestSequence = 0;

  private activeSpeakRequestId: string | null = null;

  private activePlayerChild: ChildProcessWithoutNullStreams | null = null;

  private activePlaybackFilePath: string | null = null;

  private speaking = false;

  private runtimeRoot = path.join(app.getPath('userData'), EDGE_TTS_RUNTIME_DIR);

  private readonly pendingWorkerRequests = new Map<string, EdgeTtsWorkerPendingRequest>();

  private resolvePythonRuntimeRoot(): string {
    return path.join(this.runtimeRoot, EDGE_TTS_PYTHON_DIR);
  }

  private resolveSitePackagesRoot(): string {
    return path.join(this.runtimeRoot, EDGE_TTS_SITE_PACKAGES_DIR);
  }

  private resolveInstallCacheRoot(): string {
    return path.join(this.runtimeRoot, EDGE_TTS_INSTALL_CACHE_DIR);
  }

  private resolveAudioCacheRoot(): string {
    return path.join(this.runtimeRoot, EDGE_TTS_AUDIO_CACHE_DIR);
  }

  private resolveRunnerPath(): string {
    return path.join(this.runtimeRoot, EDGE_TTS_RUNNER_NAME);
  }

  private emitAvailabilityChanged(): void {
    this.emit('stateChanged', {
      type: TtsStateType.AvailabilityChanged,
      availability: this.getAvailabilitySnapshot(),
    } satisfies TtsStateEvent);
  }

  private setPrepareStatus(
    nextStatus: typeof TtsPrepareStatus[keyof typeof TtsPrepareStatus],
    recentError?: string,
  ): void {
    this.prepareStatus = nextStatus;
    this.recentError = recentError;
    this.emitAvailabilityChanged();
  }

  private setWorkerStatus(
    nextStatus: typeof TtsWorkerStatus[keyof typeof TtsWorkerStatus],
    recentError?: string,
  ): void {
    this.workerStatus = nextStatus;
    this.recentError = recentError;
    this.emitAvailabilityChanged();
  }

  private getPythonRuntimeArchiveUrl(): string {
    const envOverride = process.env.LOBSTERAI_EDGE_TTS_PYTHON_URL?.trim();
    if (envOverride) {
      return envOverride;
    }
    return PYTHON_RUNTIME_URL_BY_ARCH[process.arch] ?? PYTHON_RUNTIME_URL_BY_ARCH.arm64;
  }

  private getPythonRuntimeArchivePath(): string {
    return path.join(this.resolveInstallCacheRoot(), path.basename(this.getPythonRuntimeArchiveUrl()));
  }

  private resolvePythonExecutableFromRuntime(runtimeRoot: string): string | null {
    const candidates = collectFiles(runtimeRoot, (candidate) => {
      const baseName = path.basename(candidate);
      return baseName === 'python3' || baseName === 'python';
    });
    return candidates.find((candidate) => fs.statSync(candidate).mode & 0o111) ?? candidates[0] ?? null;
  }

  private resolveSystemPythonExecutable(): string | null {
    const candidates = ['python3', 'python'];
    for (const candidate of candidates) {
      const resolved = resolveCommand(candidate);
      if (!resolved) {
        continue;
      }
      const version = this.inspectPythonVersion(resolved);
      if (version && isSupportedPythonVersion(version)) {
        return resolved;
      }
    }
    return null;
  }

  private inspectPythonVersion(pythonExecutable: string): string | null {
    const result = spawnSync(pythonExecutable, ['-c', 'import platform; print(platform.python_version())'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10_000,
    });
    if (result.status !== 0) {
      return null;
    }
    const version = normalizeSpawnOutput(result.stdout);
    return version || null;
  }

  private resolvePythonExecutable(): string | null {
    const runtimePython = this.resolvePythonExecutableFromRuntime(this.resolvePythonRuntimeRoot());
    if (runtimePython) {
      return runtimePython;
    }
    return this.resolveSystemPythonExecutable();
  }

  private getPythonEnv(pythonExecutable: string): NodeJS.ProcessEnv {
    const runtimeRoot = this.resolvePythonRuntimeRoot();
    const sitePackagesRoot = this.resolveSitePackagesRoot();
    const cacheRoot = this.resolveInstallCacheRoot();
    const pythonDir = path.dirname(pythonExecutable);
    const currentPath = process.env.PATH || '';
    return {
      ...process.env,
      PATH: [pythonDir, currentPath].filter(Boolean).join(':'),
      PYTHONPATH: sitePackagesRoot,
      PIP_CACHE_DIR: cacheRoot,
      PYTHONNOUSERSITE: '1',
      LOBSTERAI_EDGE_TTS_RUNTIME_ROOT: runtimeRoot,
    };
  }

  private async ensureRunnerScript(): Promise<string> {
    await ensureDir(this.runtimeRoot);
    const runnerPath = this.resolveRunnerPath();
    await fs.promises.writeFile(runnerPath, buildRunnerSource(), 'utf8');
    return runnerPath;
  }

  private async downloadToFile(url: string, filePath: string): Promise<void> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'QingShuClaw/edge-tts-runtime',
      },
    });
    if (!response.ok || !response.body) {
      throw new Error(`download_failed_${response.status}`);
    }
    await ensureDir(path.dirname(filePath));
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(filePath));
  }

  private async ensurePythonRuntimeDownloaded(): Promise<void> {
    const existingPython = this.resolvePythonExecutableFromRuntime(this.resolvePythonRuntimeRoot());
    if (existingPython) {
      return;
    }

    const systemPython = this.resolveSystemPythonExecutable();
    if (systemPython) {
      return;
    }

    const archivePath = this.getPythonRuntimeArchivePath();
    const pythonRuntimeRoot = this.resolvePythonRuntimeRoot();
    if (!fs.existsSync(archivePath)) {
      console.log(`[EdgeTtsService] Downloading Python runtime from ${this.getPythonRuntimeArchiveUrl()}.`);
      await this.downloadToFile(this.getPythonRuntimeArchiveUrl(), archivePath);
    }

    await fs.promises.rm(pythonRuntimeRoot, { recursive: true, force: true });
    await ensureDir(pythonRuntimeRoot);
    await tar.x({
      file: archivePath,
      cwd: pythonRuntimeRoot,
      strip: 1,
    });

    const extractedPython = this.resolvePythonExecutableFromRuntime(pythonRuntimeRoot);
    if (!extractedPython) {
      throw new Error('python_runtime_missing_after_extract');
    }
  }

  private canImportRequiredModules(pythonExecutable: string): boolean {
    const importScript = `
import importlib
modules = ${JSON.stringify([...EDGE_TTS_REQUIRED_IMPORTS])}
for name in modules:
    importlib.import_module(name)
print("ok")
`.trim();
    const result = spawnSync(pythonExecutable, ['-c', importScript], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: EDGE_TTS_COMMAND_TIMEOUT_MS,
      env: this.getPythonEnv(pythonExecutable),
    });
    return result.status === 0;
  }

  private ensurePipAvailable(pythonExecutable: string): void {
    const pipVersionResult = spawnSync(pythonExecutable, ['-m', 'pip', '--version'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: EDGE_TTS_COMMAND_TIMEOUT_MS,
      env: this.getPythonEnv(pythonExecutable),
    });
    if (pipVersionResult.status === 0) {
      return;
    }
    const ensurePipResult = spawnSync(pythonExecutable, ['-m', 'ensurepip', '--upgrade'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: EDGE_TTS_INSTALL_TIMEOUT_MS,
      env: this.getPythonEnv(pythonExecutable),
    });
    if (ensurePipResult.status !== 0) {
      throw new Error(normalizeSpawnOutput(ensurePipResult.stderr) || normalizeSpawnOutput(ensurePipResult.stdout) || 'edge_tts_pip_bootstrap_failed');
    }
  }

  private async ensureEdgeTtsPackageInstalled(pythonExecutable: string): Promise<void> {
    if (this.canImportRequiredModules(pythonExecutable)) {
      return;
    }

    const sitePackagesRoot = this.resolveSitePackagesRoot();
    await fs.promises.rm(sitePackagesRoot, { recursive: true, force: true });
    await ensureDir(sitePackagesRoot);
    this.ensurePipAvailable(pythonExecutable);

    const installResult = spawnSync(pythonExecutable, [
      '-m',
      'pip',
      'install',
      '--upgrade',
      '--force-reinstall',
      '--no-cache-dir',
      '--disable-pip-version-check',
      '--target',
      sitePackagesRoot,
      `edge-tts==${EDGE_TTS_VERSION}`,
    ], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: EDGE_TTS_INSTALL_TIMEOUT_MS,
      env: this.getPythonEnv(pythonExecutable),
    });
    if (installResult.status !== 0) {
      throw new Error(normalizeSpawnOutput(installResult.stderr) || normalizeSpawnOutput(installResult.stdout) || 'edge_tts_install_failed');
    }
    if (!this.canImportRequiredModules(pythonExecutable)) {
      throw new Error('edge_tts_dependency_validation_failed');
    }
  }

  private async ensureRuntimeReady(): Promise<void> {
    if (process.platform !== 'darwin') {
      throw new Error('unsupported_platform');
    }
    if (this.preparePromise) {
      return this.preparePromise;
    }
    this.preparePromise = (async () => {
      this.setPrepareStatus(TtsPrepareStatus.Installing);
      try {
        await ensureDir(this.resolveInstallCacheRoot());
        await ensureDir(this.resolveAudioCacheRoot());
        await this.ensurePythonRuntimeDownloaded();
        const pythonExecutable = this.resolvePythonExecutable();
        if (!pythonExecutable) {
          throw new Error('python_runtime_unavailable');
        }
        const version = this.inspectPythonVersion(pythonExecutable);
        if (!version || !isSupportedPythonVersion(version)) {
          throw new Error(`python_version_unsupported_${version || 'unknown'}`);
        }
        await this.ensureEdgeTtsPackageInstalled(pythonExecutable);
        await this.ensureRunnerScript();
        this.setPrepareStatus(TtsPrepareStatus.Ready);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'edge_tts_runtime_failed';
        console.error('[EdgeTtsService] Failed to prepare runtime:', error);
        this.setPrepareStatus(TtsPrepareStatus.Error, message);
        throw error;
      } finally {
        this.preparePromise = null;
      }
    })();
    return this.preparePromise;
  }

  private cleanupPendingWorkerRequests(errorMessage: string): void {
    for (const [requestId, pending] of this.pendingWorkerRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error(errorMessage));
      this.pendingWorkerRequests.delete(requestId);
    }
    this.activeSpeakRequestId = null;
  }

  private handleWorkerStdout(data: string): void {
    this.workerStdoutBuffer += data;
    const lines = this.workerStdoutBuffer.split(/\r?\n/);
    this.workerStdoutBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      let payload: EdgeTtsWorkerResponse;
      try {
        payload = JSON.parse(trimmed) as EdgeTtsWorkerResponse;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'edge_tts_invalid_worker_response';
        console.warn('[EdgeTtsService] Ignored invalid worker response.', message);
        continue;
      }

      const requestId = typeof payload.id === 'string' ? payload.id : '';
      if (!requestId) {
        continue;
      }

      const pending = this.pendingWorkerRequests.get(requestId);
      if (!pending) {
        continue;
      }

      clearTimeout(pending.timer);
      this.pendingWorkerRequests.delete(requestId);
      if (this.activeSpeakRequestId === requestId) {
        this.activeSpeakRequestId = null;
      }
      pending.resolve(payload);
    }
  }

  private handleWorkerClose(
    child: ChildProcessWithoutNullStreams,
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void {
    if (this.workerProcess !== child) {
      return;
    }

    this.workerProcess = null;
    this.workerStdoutBuffer = '';
    this.workerStderrBuffer = '';
    const wasStopping = this.workerStopping;
    this.workerStopping = false;

    const exitSummary = signal
      ? `signal_${signal}`
      : `exit_${code ?? 'unknown'}`;
    this.cleanupPendingWorkerRequests(`edge_tts_worker_closed:${exitSummary}`);

    if (wasStopping || !this.workerShouldStayAlive) {
      this.setWorkerStatus(TtsWorkerStatus.Idle);
      return;
    }

    const message = `edge_tts_worker_crashed:${exitSummary}`;
    this.setWorkerStatus(TtsWorkerStatus.Error, message);
    if (this.workerRestartAttempts >= 1) {
      console.warn('[EdgeTtsService] Worker exited unexpectedly and automatic restart limit was reached.', message);
      return;
    }

    this.workerRestartAttempts += 1;
    console.warn('[EdgeTtsService] Worker exited unexpectedly. Restarting once.', message);
    setTimeout(() => {
      if (!this.workerShouldStayAlive || this.workerProcess || this.workerStartPromise) {
        return;
      }
      void this.startWorker(true).catch((error) => {
        console.error('[EdgeTtsService] Failed to restart worker after an unexpected exit:', error);
      });
    }, EDGE_TTS_WORKER_RESTART_DELAY_MS);
  }

  private async sendWorkerCommandInternal(
    worker: ChildProcessWithoutNullStreams,
    command: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<EdgeTtsWorkerResponse> {
    const requestId = String(++this.workerRequestSequence);
    if (command.command === 'speak') {
      this.activeSpeakRequestId = requestId;
    }

    return new Promise<EdgeTtsWorkerResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingWorkerRequests.delete(requestId);
        if (this.activeSpeakRequestId === requestId) {
          this.activeSpeakRequestId = null;
        }
        reject(new Error('edge_tts_worker_timeout'));
      }, timeoutMs);

      this.pendingWorkerRequests.set(requestId, {
        resolve,
        reject,
        timer,
      });

      try {
        worker.stdin.write(`${JSON.stringify({ id: requestId, ...command })}\n`);
      } catch (error) {
        clearTimeout(timer);
        this.pendingWorkerRequests.delete(requestId);
        if (this.activeSpeakRequestId === requestId) {
          this.activeSpeakRequestId = null;
        }
        reject(error instanceof Error ? error : new Error('edge_tts_worker_write_failed'));
      }
    });
  }

  private async sendWorkerCommand(
    command: Record<string, unknown>,
    timeoutMs = EDGE_TTS_COMMAND_TIMEOUT_MS,
    retryOnWorkerCrash = true,
  ): Promise<EdgeTtsWorkerResponse> {
    await this.ensureWorkerReady(this.workerShouldStayAlive);
    const worker = this.workerProcess;
    if (!worker) {
      throw new Error('edge_tts_worker_unavailable');
    }

    try {
      return await this.sendWorkerCommandInternal(worker, command, timeoutMs);
    } catch (error) {
      if (
        retryOnWorkerCrash
        && this.workerShouldStayAlive
        && error instanceof Error
        && error.message.startsWith('edge_tts_worker_closed:')
      ) {
        await this.ensureWorkerReady(true);
        return this.sendWorkerCommand(command, timeoutMs, false);
      }
      throw error;
    }
  }

  private async startWorker(keepAlive: boolean): Promise<void> {
    if (keepAlive) {
      this.workerShouldStayAlive = true;
    }
    if (this.workerProcess && this.workerStatus === TtsWorkerStatus.Ready) {
      return;
    }
    if (this.workerStartPromise) {
      return this.workerStartPromise;
    }

    this.workerStartPromise = (async () => {
      await this.ensureRuntimeReady();
      const pythonExecutable = this.resolvePythonExecutable();
      if (!pythonExecutable) {
        throw new Error('python_runtime_unavailable');
      }
      const runnerPath = await this.ensureRunnerScript();
      this.setWorkerStatus(TtsWorkerStatus.Starting);

      const child = spawn(pythonExecutable, [runnerPath], {
        env: this.getPythonEnv(pythonExecutable),
        stdio: 'pipe',
      });
      this.workerProcess = child;
      this.workerStdoutBuffer = '';
      this.workerStderrBuffer = '';
      this.workerStopping = false;

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => this.handleWorkerStdout(chunk));
      child.stderr.on('data', (chunk: string) => {
        this.workerStderrBuffer += chunk;
      });
      child.once('close', (code, signal) => {
        this.handleWorkerClose(child, code, signal);
      });

      try {
        const response = await this.sendWorkerCommandInternal(child, { command: 'ping' }, EDGE_TTS_WORKER_BOOT_TIMEOUT_MS);
        if (isFailureResponse(response) || response.ready !== true) {
          throw new Error(isFailureResponse(response) ? response.error : 'edge_tts_worker_boot_failed');
        }
        this.workerRestartAttempts = 0;
        this.setWorkerStatus(TtsWorkerStatus.Ready);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'edge_tts_worker_boot_failed';
        await this.shutdownWorkerProcess();
        this.setWorkerStatus(TtsWorkerStatus.Error, message);
        throw error;
      }
    })();

    try {
      await this.workerStartPromise;
    } finally {
      this.workerStartPromise = null;
    }
  }

  private async ensureWorkerReady(keepAlive: boolean): Promise<void> {
    if (keepAlive) {
      this.workerShouldStayAlive = true;
    }
    if (this.workerProcess && this.workerStatus === TtsWorkerStatus.Ready) {
      return;
    }
    await this.startWorker(keepAlive);
  }

  private async shutdownWorkerProcess(): Promise<void> {
    const worker = this.workerProcess;
    if (!worker) {
      this.setWorkerStatus(TtsWorkerStatus.Idle);
      return;
    }

    this.workerStopping = true;
    this.workerProcess = null;
    this.workerStdoutBuffer = '';
    this.workerStderrBuffer = '';
    this.cleanupPendingWorkerRequests('edge_tts_worker_stopped');
    worker.kill('SIGTERM');
    this.setWorkerStatus(TtsWorkerStatus.Idle);
  }

  private async shutdownWorker(): Promise<void> {
    this.workerShouldStayAlive = false;
    this.workerRestartAttempts = 0;
    await this.shutdownWorkerProcess();
  }

  private mapVoice(voice: EdgeTtsVoicePayload): TtsVoice | null {
    const identifier = typeof voice.identifier === 'string' ? voice.identifier.trim() : '';
    const name = typeof voice.name === 'string' ? voice.name.trim() : identifier;
    const language = typeof voice.language === 'string' ? voice.language.trim() : '';
    if (!identifier) {
      return null;
    }
    return {
      identifier,
      name: name || identifier,
      language: language || 'und',
      quality: TtsVoiceQuality.Default,
      isPersonalVoice: false,
      engine: TtsEngine.EdgeTts,
    };
  }

  private getAvailabilitySnapshot(): TtsAvailability {
    const pythonExecutable = this.resolvePythonExecutable();
    return {
      enabled: true,
      supported: process.platform === 'darwin' && this.prepareStatus === TtsPrepareStatus.Ready,
      platform: process.platform,
      speaking: this.speaking,
      currentEngine: TtsEngine.EdgeTts,
      availableEngines: [TtsEngine.MacosNative, ...(this.prepareStatus === TtsPrepareStatus.Ready ? [TtsEngine.EdgeTts] : [])],
      prepareStatus: this.prepareStatus,
      workerStatus: this.workerStatus,
      recentError: this.recentError,
      error: this.recentError,
      ...(pythonExecutable ? {} : { recentError: this.recentError }),
    };
  }

  private resolveSpeakConfig(config: VoiceEdgeTtsProviderConfig, options: TtsSpeakOptions): {
    text: string;
    voiceId: string;
    rate: number;
    volume: number;
    rateToken: string;
    volumeToken: string;
  } {
    const text = options.text.trim();
    const voiceId = options.voiceId?.trim() || config.ttsVoiceId.trim() || 'zh-CN-XiaoxiaoNeural';
    const rate = options.rate ?? config.ttsRate;
    const volume = options.volume ?? config.ttsVolume;
    return {
      text,
      voiceId,
      rate,
      volume,
      rateToken: toEdgeTtsRate(rate),
      volumeToken: toEdgeTtsVolume(volume),
    };
  }

  private buildAudioCacheKey(options: {
    text: string;
    voiceId: string;
    rateToken: string;
    volumeToken: string;
  }): string {
    return crypto
      .createHash('sha256')
      .update([
        EDGE_TTS_VERSION,
        options.voiceId,
        options.rateToken,
        options.volumeToken,
        options.text,
      ].join('\n'))
      .digest('hex');
  }

  private resolveAudioCachePath(cacheKey: string): string {
    return path.join(this.resolveAudioCacheRoot(), `${cacheKey}.mp3`);
  }

  private async touchAudioCacheFile(filePath: string): Promise<void> {
    const now = new Date();
    await fs.promises.utimes(filePath, now, now).catch((): void => undefined);
  }

  private async getValidAudioCachePath(filePath: string): Promise<string | null> {
    try {
      const stats = await fs.promises.stat(filePath);
      const expired = Date.now() - stats.mtimeMs > EDGE_TTS_AUDIO_CACHE_TTL_MS;
      if (expired || stats.size <= 0) {
        await fs.promises.rm(filePath, { force: true }).catch((): void => undefined);
        return null;
      }
      await this.touchAudioCacheFile(filePath);
      return filePath;
    } catch {
      return null;
    }
  }

  private async pruneAudioCache(): Promise<void> {
    const cacheRoot = this.resolveAudioCacheRoot();
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(cacheRoot, { withFileTypes: true });
    } catch {
      return;
    }

    const files = await Promise.all(entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const filePath = path.join(cacheRoot, entry.name);
        try {
          const stats = await fs.promises.stat(filePath);
          return {
            filePath,
            size: stats.size,
            mtimeMs: stats.mtimeMs,
          };
        } catch {
          return null;
        }
      }));

    const validFiles = files.filter((entry): entry is { filePath: string; size: number; mtimeMs: number } => Boolean(entry));
    const now = Date.now();
    let totalSize = 0;
    const freshFiles: { filePath: string; size: number; mtimeMs: number }[] = [];

    for (const file of validFiles) {
      if (now - file.mtimeMs > EDGE_TTS_AUDIO_CACHE_TTL_MS || file.size <= 0) {
        await fs.promises.rm(file.filePath, { force: true }).catch((): void => undefined);
        continue;
      }
      totalSize += file.size;
      freshFiles.push(file);
    }

    if (totalSize <= EDGE_TTS_AUDIO_CACHE_MAX_BYTES) {
      return;
    }

    freshFiles.sort((left, right) => left.mtimeMs - right.mtimeMs);
    for (const file of freshFiles) {
      if (totalSize <= EDGE_TTS_AUDIO_CACHE_MAX_BYTES) {
        break;
      }
      await fs.promises.rm(file.filePath, { force: true }).catch((): void => undefined);
      totalSize -= file.size;
    }
  }

  private async synthesizeToCache(
    config: VoiceEdgeTtsProviderConfig,
    options: TtsSpeakOptions,
  ): Promise<EdgeTtsSynthesizedAudio> {
    const resolved = this.resolveSpeakConfig(config, options);
    const cacheKey = this.buildAudioCacheKey(resolved);
    const cacheFilePath = this.resolveAudioCachePath(cacheKey);
    const cachedPath = await this.getValidAudioCachePath(cacheFilePath);
    if (cachedPath) {
      return {
        audioPath: cachedPath,
        voiceId: resolved.voiceId,
      };
    }

    await ensureDir(this.resolveAudioCacheRoot());
    await this.ensureWorkerReady(this.workerShouldStayAlive);
    const tempFilePath = path.join(this.resolveAudioCacheRoot(), `${cacheKey}.${Date.now()}.tmp.mp3`);

    try {
      const response = await this.sendWorkerCommand({
        command: 'speak',
        text: resolved.text,
        voice: resolved.voiceId,
        rate: resolved.rateToken,
        volume: resolved.volumeToken,
        output: tempFilePath,
      });
      if (isFailureResponse(response)) {
        throw new Error(response.error);
      }
      if (!response.output) {
        throw new Error('edge_tts_output_missing');
      }
      await fs.promises.rename(response.output, cacheFilePath);
      await this.touchAudioCacheFile(cacheFilePath);
      await this.pruneAudioCache();
      return {
        audioPath: cacheFilePath,
        voiceId: resolved.voiceId,
      };
    } catch (error) {
      await fs.promises.rm(tempFilePath, { force: true }).catch((): void => undefined);
      throw error;
    }
  }

  async prepare(options?: { keepWorkerAlive?: boolean }): Promise<TtsAvailability> {
    await this.ensureRuntimeReady();
    if (options?.keepWorkerAlive) {
      await this.ensureWorkerReady(true);
    }
    return this.getAvailabilitySnapshot();
  }

  async setWorkerPersistent(enabled: boolean): Promise<void> {
    if (enabled) {
      await this.ensureRuntimeReady();
      await this.ensureWorkerReady(true);
      return;
    }
    this.workerShouldStayAlive = false;
    this.workerRestartAttempts = 0;
    await this.stop();
    await this.shutdownWorkerProcess();
  }

  async prewarm(config: VoiceEdgeTtsProviderConfig, text: string): Promise<void> {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return;
    }
    await this.synthesizeToCache(config, {
      text: trimmedText,
    });
  }

  async getAvailability(): Promise<TtsAvailability> {
    return this.getAvailabilitySnapshot();
  }

  async getVoices(): Promise<TtsVoice[]> {
    await this.ensureRuntimeReady();
    const response = await this.sendWorkerCommand({ command: 'voices' });
    if (isFailureResponse(response)) {
      throw new Error(response.error);
    }
    if (!Array.isArray(response.voices)) {
      throw new Error('edge_tts_invalid_voices_response');
    }
    return response.voices
      .map((voice: EdgeTtsVoicePayload) => this.mapVoice(voice))
      .filter((voice: TtsVoice | null): voice is TtsVoice => Boolean(voice));
  }

  async speak(config: VoiceEdgeTtsProviderConfig, options: TtsSpeakOptions): Promise<TtsSpeakResult> {
    const text = options.text?.trim();
    if (!text) {
      return { success: false, error: 'empty_text', engine: TtsEngine.EdgeTts };
    }

    try {
      await this.stop();
      const synthesized = await this.synthesizeToCache(config, options);
      if (options.playbackMode === TtsPlaybackMode.AudioData) {
        const buffer = await fs.promises.readFile(synthesized.audioPath);
        return {
          success: true,
          audioDataUrl: `data:audio/mpeg;base64,${buffer.toString('base64')}`,
          engine: TtsEngine.EdgeTts,
        };
      }

      await this.stop();
      this.activePlaybackFilePath = synthesized.audioPath;
      const child = spawn('afplay', [synthesized.audioPath], {
        stdio: 'ignore',
      });
      this.activePlayerChild = child;
      this.speaking = true;
      this.emit('stateChanged', {
        type: TtsStateType.Speaking,
        voiceId: synthesized.voiceId,
      } satisfies TtsStateEvent);
      child.once('close', () => {
        if (this.activePlayerChild === child) {
          this.activePlayerChild = null;
        }
        this.activePlaybackFilePath = null;
        const shouldEmitStopped = this.speaking;
        this.speaking = false;
        if (shouldEmitStopped) {
          this.emit('stateChanged', {
            type: TtsStateType.Stopped,
            voiceId: synthesized.voiceId,
          } satisfies TtsStateEvent);
        }
      });
      return { success: true, engine: TtsEngine.EdgeTts };
    } catch (error) {
      this.speaking = false;
      const message = error instanceof Error ? error.message : 'edge_tts_speak_failed';
      this.recentError = message;
      this.emit('stateChanged', {
        type: TtsStateType.Error,
        code: 'runtime_error',
        message,
      } satisfies TtsStateEvent);
      return { success: false, error: message, engine: TtsEngine.EdgeTts };
    }
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    if (this.activePlayerChild) {
      this.activePlayerChild.kill('SIGTERM');
      this.activePlayerChild = null;
    }

    if (this.activeSpeakRequestId && this.workerProcess) {
      const shouldRestartWorker = this.workerShouldStayAlive;
      await this.shutdownWorkerProcess();
      if (shouldRestartWorker) {
        try {
          await this.ensureWorkerReady(true);
        } catch (error) {
          console.warn('[EdgeTtsService] Failed to restart worker after interrupting an active request.', error);
        }
      }
    }

    const shouldEmitStopped = this.speaking;
    this.speaking = false;
    this.activePlaybackFilePath = null;
    if (shouldEmitStopped) {
      await new Promise((resolve) => setTimeout(resolve, EDGE_TTS_PLAYBACK_SETTLE_TIMEOUT_MS));
      this.emit('stateChanged', {
        type: TtsStateType.Stopped,
      } satisfies TtsStateEvent);
    }
    return { success: true };
  }

  async speakAndWait(
    config: VoiceEdgeTtsProviderConfig,
    options: TtsSpeakOptions,
    timeoutMs = EDGE_TTS_DEFAULT_PLAYBACK_TIMEOUT_MS,
  ): Promise<void> {
    const result = await this.speak(config, options);
    if (!result.success) {
      throw new Error(result.error || 'edge_tts_speak_failed');
    }
    if (options.playbackMode === TtsPlaybackMode.AudioData) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, timeoutMs);
      const listener = (event: TtsStateEvent): void => {
        if (event.type === TtsStateType.Stopped) {
          cleanup();
          resolve();
          return;
        }
        if (event.type === TtsStateType.Error) {
          cleanup();
          reject(new Error(event.message || event.code || 'edge_tts_runtime_error'));
        }
      };
      const cleanup = (): void => {
        clearTimeout(timer);
        this.off('stateChanged', listener);
      };
      this.on('stateChanged', listener);
    });
  }

  onStateChanged(listener: (event: TtsStateEvent) => void): () => void {
    this.on('stateChanged', listener);
    return () => {
      this.off('stateChanged', listener);
    };
  }
}
