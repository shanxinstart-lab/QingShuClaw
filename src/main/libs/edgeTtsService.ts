import { type ChildProcess,spawn } from 'child_process';
import crypto from 'crypto';
import { app } from 'electron';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

import {
  type TtsAvailability,
  TtsEngine,
  TtsPlaybackSource,
  type TtsPrepareOptions,
  TtsPrepareStatus,
  type TtsSpeakOptions,
  type TtsStateEvent,
  TtsStateType,
  type TtsVoice,
  TtsVoiceQuality,
} from '../../shared/tts/constants';

const EDGE_TTS_RUNTIME_DIR_NAME = 'edge-tts-runtime';
const EDGE_TTS_VENV_DIR_NAME = 'venv';
const EDGE_TTS_DOWNLOADS_DIR_NAME = 'downloads';
const EDGE_TTS_TEMP_DIR_NAME = 'temp';
const EDGE_TTS_AUDIO_CACHE_DIR_NAME = 'audio-cache';
const EDGE_TTS_VOICE_PREFIX = 'edge:';
const EDGE_TTS_PACKAGE_NAME = 'edge-tts';
const EDGE_TTS_PACKAGE_VERSION = process.env.LOBSTERAI_EDGE_TTS_VERSION || '7.2.8';
const EDGE_TTS_PYTHON_VERSION = process.env.LOBSTERAI_EDGE_TTS_PYTHON_VERSION || '3.10.19';
const EDGE_TTS_PYTHON_BUILD_TAG = process.env.LOBSTERAI_EDGE_TTS_PYTHON_BUILD_TAG || '20251217';
const EDGE_TTS_PYTHON_ARCHIVE_PATH = process.env.LOBSTERAI_EDGE_TTS_PYTHON_ARCHIVE?.trim() || '';
const EDGE_TTS_PYTHON_BASE_URL = process.env.LOBSTERAI_EDGE_TTS_PYTHON_BASE_URL?.trim()
  || `https://github.com/astral-sh/python-build-standalone/releases/download/${EDGE_TTS_PYTHON_BUILD_TAG}`;
const EDGE_TTS_DEFAULT_ZH_VOICE = 'zh-CN-XiaoxiaoNeural';
const EDGE_TTS_DEFAULT_EN_VOICE = 'en-US-AriaNeural';
const EDGE_TTS_PACKAGED_RUNTIME_MISSING_ERROR = '当前安装包未内置 edge-tts 运行时，也未发现已安装的本地运行时。请先切换回系统语音，或使用内置 edge-tts 运行时的安装包。';

export const EdgeTtsRuntimeMode = {
  Bundled: 'bundled',
  Managed: 'managed',
  Unavailable: 'unavailable',
} as const;
export type EdgeTtsRuntimeMode = typeof EdgeTtsRuntimeMode[keyof typeof EdgeTtsRuntimeMode];

type EdgeVoicePayload = {
  ShortName?: string;
  FriendlyName?: string;
  Locale?: string;
};

type EdgeWorkerRequest = {
  id: string;
  command: 'listVoices' | 'synthesize' | 'shutdown';
  payload?: Record<string, unknown>;
};

type EdgeWorkerResponse = {
  id?: string;
  ok?: boolean;
  result?: Record<string, unknown>;
  error?: string;
};

type WorkerPendingRequest = {
  resolve: (value: EdgeWorkerResponse) => void;
  reject: (error: Error) => void;
};

type EdgeTtsServiceEvents = {
  stateChanged: (event: TtsStateEvent) => void;
  availabilityChanged: (availability: TtsAvailability) => void;
};

const EDGE_TTS_WORKER_SCRIPT = [
  'import asyncio',
  'import json',
  'import pathlib',
  'import sys',
  'import traceback',
  'import edge_tts',
  '',
  'async def handle_request(request):',
  '    command = request.get("command")',
  '    payload = request.get("payload") or {}',
  '    if command == "listVoices":',
  '        voices = await edge_tts.list_voices()',
  '        return {"voices": voices}',
  '    if command == "synthesize":',
  '        output_path = pathlib.Path(payload["outputPath"])',
  '        output_path.parent.mkdir(parents=True, exist_ok=True)',
  '        communicate = edge_tts.Communicate(',
  '            payload["text"],',
  '            payload["voice"],',
  '            rate=payload["rate"],',
  '            volume=payload["volume"],',
  '        )',
  '        await communicate.save(str(output_path))',
  '        return {"outputPath": str(output_path)}',
  '    if command == "shutdown":',
  '        return {"shutdown": True}',
  '    raise RuntimeError(f"Unsupported edge-tts worker command: {command}")',
  '',
  'async def main():',
  '    loop = asyncio.get_event_loop()',
  '    while True:',
  '        line = await loop.run_in_executor(None, sys.stdin.readline)',
  '        if not line:',
  '            break',
  '        stripped = line.strip()',
  '        if not stripped:',
  '            continue',
  '        request = json.loads(stripped)',
  '        request_id = request.get("id")',
  '        try:',
  '            result = await handle_request(request)',
  '            sys.stdout.write(json.dumps({"id": request_id, "ok": True, "result": result}, ensure_ascii=False) + "\\n")',
  '            sys.stdout.flush()',
  '            if result.get("shutdown"):',
  '                break',
  '        except Exception as error:',
  '            sys.stdout.write(json.dumps({"id": request_id, "ok": False, "error": str(error), "traceback": traceback.format_exc(limit=1)}, ensure_ascii=False) + "\\n")',
  '            sys.stdout.flush()',
  '',
  'asyncio.run(main())',
].join('\n');

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const normalizeSignedPercent = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value}%`;
};

export const toEdgeVoiceIdentifier = (shortName: string): string => `${EDGE_TTS_VOICE_PREFIX}${shortName}`;

export const stripEdgeVoiceIdentifier = (voiceId?: string): string | undefined => {
  if (!voiceId?.startsWith(EDGE_TTS_VOICE_PREFIX)) {
    return undefined;
  }
  const stripped = voiceId.slice(EDGE_TTS_VOICE_PREFIX.length).trim();
  return stripped || undefined;
};

export const normalizeEdgeTtsRate = (rate?: number): string => {
  const normalized = clamp(typeof rate === 'number' ? rate : 0.5, 0.1, 1);
  const percent = Math.round(((normalized - 0.5) / 0.5) * 50);
  return normalizeSignedPercent(percent);
};

export const normalizeEdgeTtsVolume = (volume?: number): string => {
  const normalized = clamp(typeof volume === 'number' ? volume : 1, 0, 1);
  const percent = Math.round((normalized - 1) * 100);
  return normalizeSignedPercent(percent);
};

export const resolveEdgeTtsRuntimeMode = (options: {
  isPackaged: boolean;
  bundledReady: boolean;
  managedReady: boolean;
}): EdgeTtsRuntimeMode => {
  if (options.bundledReady) {
    return EdgeTtsRuntimeMode.Bundled;
  }
  if (options.managedReady) {
    return EdgeTtsRuntimeMode.Managed;
  }
  if (options.isPackaged) {
    return EdgeTtsRuntimeMode.Unavailable;
  }
  return EdgeTtsRuntimeMode.Managed;
};

const resolvePythonStandaloneTarget = (): string => {
  if (process.arch === 'arm64') {
    return 'aarch64-apple-darwin';
  }
  if (process.arch === 'x64') {
    return 'x86_64-apple-darwin';
  }
  throw new Error(`Unsupported macOS architecture for edge-tts runtime: ${process.arch}`);
};

const getPythonArchiveFileName = (): string => {
  return `cpython-${EDGE_TTS_PYTHON_VERSION}+${EDGE_TTS_PYTHON_BUILD_TAG}-${resolvePythonStandaloneTarget()}-install_only.tar.gz`;
};

const getPythonDownloadUrl = (): string => {
  return `${EDGE_TTS_PYTHON_BASE_URL}/${getPythonArchiveFileName()}`;
};

const mapEdgeVoice = (voice: EdgeVoicePayload): TtsVoice | null => {
  const shortName = typeof voice.ShortName === 'string' ? voice.ShortName.trim() : '';
  if (!shortName) {
    return null;
  }
  const friendlyName = typeof voice.FriendlyName === 'string' ? voice.FriendlyName.trim() : '';
  const language = typeof voice.Locale === 'string' ? voice.Locale.trim() : '';
  return {
    identifier: toEdgeVoiceIdentifier(shortName),
    name: friendlyName || shortName,
    language,
    quality: TtsVoiceQuality.Premium,
    isPersonalVoice: false,
    engine: TtsEngine.EdgeTts,
  };
};

const resolveDefaultEdgeVoiceShortName = (): string => {
  const locale = app.getLocale().toLowerCase();
  if (locale.startsWith('zh')) {
    return EDGE_TTS_DEFAULT_ZH_VOICE;
  }
  return EDGE_TTS_DEFAULT_EN_VOICE;
};

async function writeResponseBodyToFile(url: string, filePath: string): Promise<void> {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
}

function spawnAndCollect(
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    input?: string;
    env?: NodeJS.ProcessEnv;
  },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      env: options?.env,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', (error) => {
      reject(error);
    });
    child.once('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `${command} exited with code ${code}`));
    });

    if (options?.input) {
      child.stdin.write(options.input);
    }
    child.stdin.end();
  });
}

export class EdgeTtsService extends EventEmitter {
  private prepareStatus: TtsPrepareStatus = TtsPrepareStatus.Idle;

  private lastError: string | undefined;

  private speaking = false;

  private activePlayer: ChildProcess | null = null;

  private activeAudioFilePath: string | null = null;

  private activeAudioFileShouldDelete = false;

  private currentVoiceId: string | undefined;

  private currentSource: TtsPlaybackSource | undefined;

  private stopping = false;

  private preparePromise: Promise<void> | null = null;

  private prepareSerialPromise: Promise<void> = Promise.resolve();

  private workerProcess: ChildProcess | null = null;

  private workerStartPromise: Promise<void> | null = null;

  private workerStdoutBuffer = '';

  private workerPendingRequests = new Map<string, WorkerPendingRequest>();

  private refreshVoicesPromise: Promise<TtsVoice[]> | null = null;

  override on<U extends keyof EdgeTtsServiceEvents>(event: U, listener: EdgeTtsServiceEvents[U]): this {
    return super.on(event, listener);
  }

  private getBaseRoot(): string {
    return path.join(app.getPath('userData'), 'runtimes', EDGE_TTS_RUNTIME_DIR_NAME);
  }

  private getBundledRuntimeRoot(): string {
    return path.join(process.resourcesPath, EDGE_TTS_RUNTIME_DIR_NAME);
  }

  private getDownloadsRoot(): string {
    return path.join(this.getBaseRoot(), EDGE_TTS_DOWNLOADS_DIR_NAME);
  }

  private getManagedPythonRoot(): string {
    return path.join(this.getBaseRoot(), 'python');
  }

  private getManagedVenvRoot(): string {
    return path.join(this.getBaseRoot(), EDGE_TTS_VENV_DIR_NAME);
  }

  private getTempRoot(): string {
    return path.join(this.getBaseRoot(), EDGE_TTS_TEMP_DIR_NAME);
  }

  private getAudioCacheRoot(): string {
    return path.join(this.getBaseRoot(), EDGE_TTS_AUDIO_CACHE_DIR_NAME);
  }

  private getVoiceCachePath(): string {
    return path.join(this.getBaseRoot(), 'voices-cache.json');
  }

  private getManagedPythonBinary(): string {
    return path.join(this.getManagedPythonRoot(), 'bin', 'python3');
  }

  private getBundledVenvPythonBinary(): string {
    return path.join(this.getBundledRuntimeRoot(), EDGE_TTS_VENV_DIR_NAME, 'bin', 'python3');
  }

  private getManagedVenvPythonBinary(): string {
    return path.join(this.getManagedVenvRoot(), 'bin', 'python3');
  }

  private getRuntimeMode(): EdgeTtsRuntimeMode {
    return resolveEdgeTtsRuntimeMode({
      isPackaged: app.isPackaged,
      bundledReady: fs.existsSync(this.getBundledVenvPythonBinary()),
      managedReady: fs.existsSync(this.getManagedVenvPythonBinary()),
    });
  }

  private getVenvPythonBinary(): string {
    return this.getRuntimeMode() === EdgeTtsRuntimeMode.Bundled
      ? this.getBundledVenvPythonBinary()
      : this.getManagedVenvPythonBinary();
  }

  private getArchivePath(): string {
    return path.join(this.getDownloadsRoot(), getPythonArchiveFileName());
  }

  private hasUsableRuntimeBinary(): boolean {
    return fs.existsSync(this.getVenvPythonBinary());
  }

  private canRetryPrepare(): boolean {
    return this.getRuntimeMode() !== EdgeTtsRuntimeMode.Unavailable;
  }

  private getUnavailableRuntimeError(): string {
    return EDGE_TTS_PACKAGED_RUNTIME_MISSING_ERROR;
  }

  private setPrepareStatus(status: TtsPrepareStatus, error?: string): void {
    this.prepareStatus = status;
    this.lastError = error;
    this.emit('availabilityChanged', this.getAvailabilitySync());
  }

  private emitState(event: TtsStateEvent): void {
    this.emit('stateChanged', event);
  }

  private getAvailabilitySync(): TtsAvailability {
    return {
      enabled: true,
      supported: process.platform === 'darwin',
      platform: process.platform,
      speaking: this.speaking,
      currentEngine: TtsEngine.EdgeTts,
      availableEngines: process.platform === 'darwin'
        ? [TtsEngine.MacOsNative, TtsEngine.EdgeTts]
        : [TtsEngine.EdgeTts],
      prepareStatus: this.prepareStatus,
      error: this.lastError,
      canRetryPrepare: this.canRetryPrepare(),
    };
  }

  private rejectWorkerPendingRequests(message: string): void {
    for (const pending of this.workerPendingRequests.values()) {
      pending.reject(new Error(message));
    }
    this.workerPendingRequests.clear();
  }

  private clearWorkerProcessReference(): void {
    this.workerProcess = null;
    this.workerStdoutBuffer = '';
  }

  private handleWorkerStdout(chunk: string): void {
    this.workerStdoutBuffer += chunk;
    const lines = this.workerStdoutBuffer.split(/\r?\n/);
    this.workerStdoutBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
        continue;
      }
      try {
        const response = JSON.parse(trimmed) as EdgeWorkerResponse;
        const requestId = typeof response.id === 'string' ? response.id : '';
        if (!requestId) {
          continue;
        }
        const pending = this.workerPendingRequests.get(requestId);
        if (!pending) {
          continue;
        }
        this.workerPendingRequests.delete(requestId);
        pending.resolve(response);
      } catch (error) {
        console.warn('[EdgeTtsService] Failed to parse worker response:', error);
      }
    }
  }

  private readCachedVoices(): TtsVoice[] {
    const cachePath = this.getVoiceCachePath();
    if (!fs.existsSync(cachePath)) {
      return [];
    }

    try {
      const payload = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as { voices?: EdgeVoicePayload[] };
      if (!Array.isArray(payload.voices)) {
        return [];
      }
      return payload.voices
        .map((voice) => mapEdgeVoice(voice))
        .filter((voice): voice is TtsVoice => Boolean(voice));
    } catch (error) {
      console.warn('[EdgeTtsService] Failed to read cached voice list:', error);
      return [];
    }
  }

  private writeCachedVoices(voices: EdgeVoicePayload[]): TtsVoice[] {
    const cachePath = this.getVoiceCachePath();
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, `${JSON.stringify({ voices }, null, 2)}\n`, 'utf8');
    return voices
      .map((voice) => mapEdgeVoice(voice))
      .filter((voice): voice is TtsVoice => Boolean(voice));
  }

  private async refreshVoicesCache(): Promise<TtsVoice[]> {
    if (this.refreshVoicesPromise) {
      return this.refreshVoicesPromise;
    }

    this.refreshVoicesPromise = (async () => {
      await this.ensureWorkerStarted();
      const response = await this.sendWorkerRequest('listVoices');
      if (!response.ok) {
        throw new Error(`拉取 edge-tts 音色失败: ${response.error || 'unknown error'}`);
      }

      const rawVoices = Array.isArray(response.result?.voices)
        ? (response.result?.voices as EdgeVoicePayload[])
        : [];
      return this.writeCachedVoices(rawVoices);
    })();

    try {
      return await this.refreshVoicesPromise;
    } finally {
      this.refreshVoicesPromise = null;
    }
  }

  private async ensureArchiveReady(): Promise<string> {
    const archivePath = this.getArchivePath();
    if (EDGE_TTS_PYTHON_ARCHIVE_PATH && fs.existsSync(EDGE_TTS_PYTHON_ARCHIVE_PATH)) {
      fs.mkdirSync(path.dirname(archivePath), { recursive: true });
      fs.copyFileSync(EDGE_TTS_PYTHON_ARCHIVE_PATH, archivePath);
      return archivePath;
    }
    if (fs.existsSync(archivePath) && fs.statSync(archivePath).size > 0) {
      return archivePath;
    }
    const downloadUrl = getPythonDownloadUrl();
    console.log(`[EdgeTtsService] Downloading managed Python runtime from ${downloadUrl}.`);
    await writeResponseBodyToFile(downloadUrl, archivePath);
    return archivePath;
  }

  private removeDirectoryIfExists(targetPath: string): void {
    if (!fs.existsSync(targetPath)) {
      return;
    }
    fs.rmSync(targetPath, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 120,
    });
  }

  private async ensureManagedPythonReady(force = false): Promise<void> {
    const pythonBinary = this.getManagedPythonBinary();
    if (!force && fs.existsSync(pythonBinary)) {
      return;
    }

    const pythonRoot = this.getManagedPythonRoot();
    this.removeDirectoryIfExists(pythonRoot);
    fs.mkdirSync(pythonRoot, { recursive: true });

    const archivePath = await this.ensureArchiveReady();
    await spawnAndCollect('tar', [
      '-xzf',
      archivePath,
      '-C',
      pythonRoot,
      '--strip-components',
      '1',
    ]);

    if (!fs.existsSync(pythonBinary)) {
      throw new Error(`Managed Python runtime is missing expected binary: ${pythonBinary}`);
    }
  }

  private async ensureVirtualEnvReady(force = false): Promise<void> {
    const venvPython = this.getVenvPythonBinary();
    if (!force && fs.existsSync(venvPython)) {
      return;
    }

    const venvRoot = this.getManagedVenvRoot();
    this.removeDirectoryIfExists(venvRoot);
    fs.mkdirSync(venvRoot, { recursive: true });

    const managedPython = this.getManagedPythonBinary();
    try {
      await spawnAndCollect(managedPython, ['-m', 'venv', venvRoot]);
    } catch (error) {
      console.warn('[EdgeTtsService] Failed to create venv on first attempt, retrying after ensurepip.', error);
      await spawnAndCollect(managedPython, ['-m', 'ensurepip', '--upgrade']);
      await spawnAndCollect(managedPython, ['-m', 'venv', venvRoot]);
    }

    await spawnAndCollect(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip']);
  }

  private async getInstalledEdgeTtsVersion(): Promise<string | null> {
    const venvPython = this.getVenvPythonBinary();
    if (!fs.existsSync(venvPython)) {
      return null;
    }

    try {
      const result = await spawnAndCollect(venvPython, [
        '-c',
        'import edge_tts; print(getattr(edge_tts, "__version__", ""))',
      ]);
      const version = result.stdout.trim();
      return version || null;
    } catch {
      return null;
    }
  }

  private async ensureEdgeTtsInstalled(force = false): Promise<void> {
    const installedVersion = await this.getInstalledEdgeTtsVersion();
    if (!force && installedVersion === EDGE_TTS_PACKAGE_VERSION) {
      return;
    }

    const packageSpec = `${EDGE_TTS_PACKAGE_NAME}==${EDGE_TTS_PACKAGE_VERSION}`;
    console.log(`[EdgeTtsService] Installing ${packageSpec} into managed runtime.`);
    await spawnAndCollect(this.getVenvPythonBinary(), [
      '-m',
      'pip',
      'install',
      '--upgrade',
      packageSpec,
    ]);
  }

  private async sendWorkerRequest(
    command: EdgeWorkerRequest['command'],
    payload?: Record<string, unknown>,
  ): Promise<EdgeWorkerResponse> {
    await this.ensureWorkerStarted();
    if (!this.workerProcess) {
      throw new Error('edge-tts worker is not running.');
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const request: EdgeWorkerRequest = {
      id: requestId,
      command,
      ...(payload ? { payload } : {}),
    };

    return await new Promise((resolve, reject) => {
      this.workerPendingRequests.set(requestId, { resolve, reject });
      try {
        this.workerProcess?.stdin.write(`${JSON.stringify(request)}\n`);
      } catch (error) {
        this.workerPendingRequests.delete(requestId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private resolveWakeActivationCachePath(input: {
    text: string;
    voice: string;
    rate: string;
    volume: string;
  }): string {
    const cacheKey = crypto
      .createHash('sha1')
      .update(JSON.stringify({
        engine: TtsEngine.EdgeTts,
        packageVersion: EDGE_TTS_PACKAGE_VERSION,
        source: TtsPlaybackSource.WakeActivation,
        text: input.text,
        voice: input.voice,
        rate: input.rate,
        volume: input.volume,
      }))
      .digest('hex');
    return path.join(this.getAudioCacheRoot(), 'wake-activation', `${cacheKey}.mp3`);
  }

  private isWakeActivationCacheEligible(options: TtsSpeakOptions): boolean {
    return options.source === TtsPlaybackSource.WakeActivation;
  }

  private async synthesizeToPath(input: {
    text: string;
    voice: string;
    rate: string;
    volume: string;
    outputPath: string;
    source?: TtsPlaybackSource;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.sendWorkerRequest('synthesize', {
        text: input.text,
        voice: input.voice,
        rate: input.rate,
        volume: input.volume,
        outputPath: input.outputPath,
      });
      if (!response.ok) {
        throw new Error(response.error || 'Unknown edge-tts worker synthesis failure.');
      }
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      this.emitState({
        type: TtsStateType.Error,
        code: 'edge_tts_synthesize_failed',
        message,
        source: input.source,
      });
      return { success: false, error: message };
    }
  }

  private writeWakeActivationCache(tempPath: string, cachePath: string): void {
    if (fs.existsSync(cachePath)) {
      return;
    }
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    const cacheTempPath = `${cachePath}.tmp-${process.pid}-${Date.now()}`;
    fs.copyFileSync(tempPath, cacheTempPath);
    fs.renameSync(cacheTempPath, cachePath);
  }

  private async playAudioFile(
    filePath: string,
    options: TtsSpeakOptions,
    deleteAfterPlayback: boolean,
  ): Promise<{ success: boolean; error?: string }> {
    return await new Promise((resolve) => {
      this.stopping = false;
      this.speaking = true;
      this.currentVoiceId = options.voiceId;
      this.currentSource = options.source;
      this.activeAudioFilePath = filePath;
      this.activeAudioFileShouldDelete = deleteAfterPlayback;
      const player = spawn('afplay', [filePath], {
        stdio: 'ignore',
      });
      this.activePlayer = player;

      player.once('error', (error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.activePlayer = null;
        this.speaking = false;
        this.cleanupActiveAudioFile();
        this.emitState({
          type: TtsStateType.Error,
          code: 'edge_tts_playback_failed',
          message,
          source: this.currentSource,
        });
        this.currentSource = undefined;
        resolve({ success: false, error: message });
      });

      player.once('spawn', () => {
        this.emitState({
          type: TtsStateType.Speaking,
          voiceId: options.voiceId,
          source: options.source,
        });
      });

      player.once('close', (code) => {
        this.activePlayer = null;
        const wasStopping = this.stopping;
        this.stopping = false;
        this.speaking = false;
        this.cleanupActiveAudioFile();
        if (wasStopping) {
          this.currentSource = undefined;
          resolve({ success: true });
          return;
        }
        if (code === 0) {
          this.emitState({
            type: TtsStateType.Stopped,
            voiceId: this.currentVoiceId,
            source: this.currentSource,
          });
          this.currentSource = undefined;
          resolve({ success: true });
          return;
        }

        const message = `afplay exited with code ${code ?? 'unknown'}`;
        this.emitState({
          type: TtsStateType.Error,
          code: 'edge_tts_playback_failed',
          message,
          source: this.currentSource,
        });
        this.currentSource = undefined;
        resolve({ success: false, error: message });
      });
    });
  }

  isReady(): boolean {
    return this.prepareStatus === TtsPrepareStatus.Ready && this.hasUsableRuntimeBinary();
  }

  async getAvailability(): Promise<TtsAvailability> {
    return this.getAvailabilitySync();
  }

  async ensureWorkerStarted(): Promise<void> {
    if (this.workerProcess && !this.workerProcess.killed) {
      return;
    }
    if (this.workerStartPromise) {
      await this.workerStartPromise;
      return;
    }
    if (!this.hasUsableRuntimeBinary()) {
      throw new Error('edge-tts runtime is not ready.');
    }

    this.workerStartPromise = new Promise((resolve, reject) => {
      const worker = spawn(this.getVenvPythonBinary(), ['-u', '-c', EDGE_TTS_WORKER_SCRIPT], {
        stdio: 'pipe',
      });
      this.workerProcess = worker;
      this.workerStdoutBuffer = '';

      let settled = false;
      const settleResolve = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      };
      const settleReject = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        this.clearWorkerProcessReference();
        reject(error);
      };

      worker.stdout.setEncoding('utf8');
      worker.stderr.setEncoding('utf8');
      worker.stdout.on('data', (chunk: string) => {
        this.handleWorkerStdout(chunk);
      });
      worker.stderr.on('data', (chunk: string) => {
        const message = chunk.trim();
        if (!message) {
          return;
        }
        console.warn('[EdgeTtsService] Worker stderr:', message);
      });
      worker.once('spawn', () => {
        console.log('[EdgeTtsService] edge-tts worker started.');
        settleResolve();
      });
      worker.once('error', (error) => {
        settleReject(error instanceof Error ? error : new Error(String(error)));
      });
      worker.once('close', (code) => {
        this.clearWorkerProcessReference();
        this.rejectWorkerPendingRequests(`edge-tts worker exited with code ${code ?? 'unknown'}`);
        if (!settled) {
          settleReject(new Error(`edge-tts worker exited with code ${code ?? 'unknown'}`));
          return;
        }
        console.warn(`[EdgeTtsService] edge-tts worker exited with code ${code ?? 'unknown'}.`);
      });
    });

    try {
      await this.workerStartPromise;
    } finally {
      this.workerStartPromise = null;
    }
  }

  async shutdownWorker(): Promise<void> {
    this.refreshVoicesPromise = null;
    if (!this.workerProcess) {
      return;
    }

    const currentWorker = this.workerProcess;
    try {
      await this.sendWorkerRequest('shutdown');
    } catch (error) {
      console.warn('[EdgeTtsService] Failed to request worker shutdown gracefully:', error);
    }

    if (!currentWorker.killed) {
      currentWorker.kill('SIGTERM');
    }
    this.clearWorkerProcessReference();
  }

  async prepare(options?: TtsPrepareOptions): Promise<{ success: boolean; error?: string }> {
    if (process.platform !== 'darwin') {
      this.setPrepareStatus(TtsPrepareStatus.Error, 'edge-tts is only supported on macOS in this build.');
      return { success: false, error: this.lastError };
    }

    const force = options?.force === true;
    const runtimeMode = this.getRuntimeMode();
    if (runtimeMode === EdgeTtsRuntimeMode.Unavailable) {
      await this.shutdownWorker();
      this.setPrepareStatus(TtsPrepareStatus.Error, this.getUnavailableRuntimeError());
      return { success: false, error: this.lastError };
    }

    const runPrepare = async (): Promise<void> => {
      if (this.preparePromise) {
        await this.preparePromise;
        return;
      }

      if (!force && this.isReady()) {
        await this.ensureWorkerStarted();
        return;
      }

      this.preparePromise = (async () => {
        this.setPrepareStatus(TtsPrepareStatus.Installing);
        if (app.isPackaged) {
          if (force) {
            await this.shutdownWorker();
          }
          await this.ensureWorkerStarted();
          this.setPrepareStatus(TtsPrepareStatus.Ready);
          return;
        }
        if (force) {
          await this.shutdownWorker();
          this.removeDirectoryIfExists(this.getManagedVenvRoot());
          this.removeDirectoryIfExists(this.getManagedPythonRoot());
        }
        try {
          await this.ensureManagedPythonReady(force);
        } catch (error) {
          throw new Error(`下载 Python 运行时失败: ${error instanceof Error ? error.message : String(error)}`);
        }
        try {
          await this.ensureVirtualEnvReady(force);
        } catch (error) {
          throw new Error(`创建 edge-tts 虚拟环境失败: ${error instanceof Error ? error.message : String(error)}`);
        }
        try {
          await this.ensureEdgeTtsInstalled(force);
        } catch (error) {
          throw new Error(`安装 edge-tts 运行依赖失败: ${error instanceof Error ? error.message : String(error)}`);
        }
        this.setPrepareStatus(TtsPrepareStatus.Ready);
        await this.ensureWorkerStarted();
      })();

      try {
        await this.preparePromise;
      } finally {
        this.preparePromise = null;
      }
    };

    const queuedPrepare = this.prepareSerialPromise.then(runPrepare);
    this.prepareSerialPromise = queuedPrepare.catch((): void => undefined);

    try {
      await queuedPrepare;
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[EdgeTtsService] Failed to prepare edge-tts runtime:', error);
      await this.shutdownWorker();
      this.setPrepareStatus(TtsPrepareStatus.Error, message);
      return { success: false, error: message };
    }
  }

  async listVoicesCached(): Promise<TtsVoice[]> {
    const cachedVoices = this.readCachedVoices();
    if (cachedVoices.length > 0) {
      return cachedVoices;
    }
    return await this.refreshVoicesCache();
  }

  async getVoices(): Promise<TtsVoice[]> {
    const prepareResult = await this.prepare({ force: false });
    if (!prepareResult.success) {
      throw new Error(prepareResult.error || 'Failed to prepare edge-tts runtime.');
    }

    const cachedVoices = await this.listVoicesCached();
    if (cachedVoices.length > 0) {
      void this.refreshVoicesCache().catch((error) => {
        console.warn('[EdgeTtsService] Failed to refresh voice cache in background:', error);
      });
      return cachedVoices;
    }
    return await this.refreshVoicesCache();
  }

  async speak(
    options: TtsSpeakOptions,
    executionOptions?: { allowPrepare?: boolean },
  ): Promise<{ success: boolean; error?: string }> {
    if (process.platform !== 'darwin') {
      return { success: false, error: 'unsupported_platform' };
    }

    const text = options.text?.trim();
    if (!text) {
      return { success: false, error: 'empty_text' };
    }

    await this.stop();

    const allowPrepare = executionOptions?.allowPrepare !== false;
    if (allowPrepare) {
      const prepareResult = await this.prepare({ force: false });
      if (!prepareResult.success) {
        return prepareResult;
      }
    } else if (!this.isReady()) {
      return { success: false, error: 'edge_tts_runtime_not_ready' };
    }

    try {
      await this.ensureWorkerStarted();
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }

    const voiceId = stripEdgeVoiceIdentifier(options.voiceId) ?? resolveDefaultEdgeVoiceShortName();
    const normalizedRate = normalizeEdgeTtsRate(options.rate);
    const normalizedVolume = normalizeEdgeTtsVolume(options.volume);
    if (this.isWakeActivationCacheEligible(options)) {
      const cachePath = this.resolveWakeActivationCachePath({
        text,
        voice: voiceId,
        rate: normalizedRate,
        volume: normalizedVolume,
      });
      if (fs.existsSync(cachePath)) {
        return await this.playAudioFile(cachePath, options, false);
      }
    }

    const tempRoot = this.getTempRoot();
    fs.mkdirSync(tempRoot, { recursive: true });
    const outputPath = path.join(
      tempRoot,
      `edge-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`,
    );

    const synthesizeResult = await this.synthesizeToPath({
        text,
        voice: voiceId,
        rate: normalizedRate,
        volume: normalizedVolume,
        outputPath,
        source: options.source,
      });
    if (!synthesizeResult.success) {
      return synthesizeResult;
    }

    if (this.isWakeActivationCacheEligible(options)) {
      const cachePath = this.resolveWakeActivationCachePath({
        text,
        voice: voiceId,
        rate: normalizedRate,
        volume: normalizedVolume,
      });
      try {
        this.writeWakeActivationCache(outputPath, cachePath);
      } catch (error) {
        console.warn('[EdgeTtsService] Failed to persist wake activation audio cache:', error);
      }
    }

    return await this.playAudioFile(outputPath, options, true);
  }

  async prewarmWakeActivationCache(
    options: TtsSpeakOptions,
    executionOptions?: { allowPrepare?: boolean },
  ): Promise<{ success: boolean; cacheHit: boolean; error?: string }> {
    if (process.platform !== 'darwin') {
      return { success: false, cacheHit: false, error: 'unsupported_platform' };
    }

    const text = options.text?.trim();
    if (!text || options.source !== TtsPlaybackSource.WakeActivation) {
      return { success: false, cacheHit: false, error: 'invalid_wake_activation_input' };
    }

    const allowPrepare = executionOptions?.allowPrepare !== false;
    if (allowPrepare) {
      const prepareResult = await this.prepare({ force: false });
      if (!prepareResult.success) {
        return { success: false, cacheHit: false, error: prepareResult.error };
      }
    } else if (!this.isReady()) {
      return { success: false, cacheHit: false, error: 'edge_tts_runtime_not_ready' };
    }

    try {
      await this.ensureWorkerStarted();
    } catch (error) {
      return {
        success: false,
        cacheHit: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    const voiceId = stripEdgeVoiceIdentifier(options.voiceId) ?? resolveDefaultEdgeVoiceShortName();
    const normalizedRate = normalizeEdgeTtsRate(options.rate);
    const normalizedVolume = normalizeEdgeTtsVolume(options.volume);
    const cachePath = this.resolveWakeActivationCachePath({
      text,
      voice: voiceId,
      rate: normalizedRate,
      volume: normalizedVolume,
    });
    if (fs.existsSync(cachePath)) {
      return { success: true, cacheHit: true };
    }

    const tempRoot = this.getTempRoot();
    fs.mkdirSync(tempRoot, { recursive: true });
    const outputPath = path.join(
      tempRoot,
      `edge-tts-prewarm-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`,
    );

    const synthesizeResult = await this.synthesizeToPath({
      text,
      voice: voiceId,
      rate: normalizedRate,
      volume: normalizedVolume,
      outputPath,
      source: options.source,
    });
    if (!synthesizeResult.success) {
      try {
        fs.rmSync(outputPath, { force: true });
      } catch {
        // Ignore cleanup errors for failed warmup synthesis.
      }
      return { success: false, cacheHit: false, error: synthesizeResult.error };
    }

    try {
      this.writeWakeActivationCache(outputPath, cachePath);
    } catch (error) {
      try {
        fs.rmSync(outputPath, { force: true });
      } catch {
        // Ignore cleanup errors for failed warmup cache writes.
      }
      return {
        success: false,
        cacheHit: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      fs.rmSync(outputPath, { force: true });
    } catch {
      // Ignore cleanup errors after successful warmup.
    }
    return { success: true, cacheHit: false };
  }

  private cleanupActiveAudioFile(): void {
    const currentFile = this.activeAudioFilePath;
    const shouldDelete = this.activeAudioFileShouldDelete;
    this.activeAudioFilePath = null;
    this.activeAudioFileShouldDelete = false;
    if (!currentFile || !shouldDelete) {
      return;
    }
    try {
      fs.rmSync(currentFile, { force: true });
    } catch (error) {
      console.warn('[EdgeTtsService] Failed to delete temporary audio file:', error);
    }
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    if (!this.activePlayer) {
      this.speaking = false;
      this.cleanupActiveAudioFile();
      return { success: true };
    }

    this.stopping = true;
    this.speaking = false;
    const player = this.activePlayer;
    this.activePlayer = null;
    player.kill('SIGTERM');
    this.cleanupActiveAudioFile();
    this.emitState({
      type: TtsStateType.Stopped,
      voiceId: this.currentVoiceId,
      source: this.currentSource,
    });
    this.currentSource = undefined;
    return { success: true };
  }

  dispose(): void {
    void this.stop();
    void this.shutdownWorker();
  }
}
