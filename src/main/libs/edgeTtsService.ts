import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { spawn, type ChildProcess } from 'child_process';
import {
  TtsEngine,
  TtsPrepareStatus,
  TtsStateType,
  TtsVoiceQuality,
  type TtsAvailability,
  type TtsPrepareOptions,
  type TtsSpeakOptions,
  type TtsStateEvent,
  type TtsVoice,
} from '../../shared/tts/constants';

const EDGE_TTS_RUNTIME_DIR_NAME = 'edge-tts-runtime';
const EDGE_TTS_VENV_DIR_NAME = 'venv';
const EDGE_TTS_DOWNLOADS_DIR_NAME = 'downloads';
const EDGE_TTS_TEMP_DIR_NAME = 'temp';
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

type EdgeVoicePayload = {
  ShortName?: string;
  FriendlyName?: string;
  Locale?: string;
};

type EdgeTtsServiceEvents = {
  stateChanged: (event: TtsStateEvent) => void;
  availabilityChanged: (availability: TtsAvailability) => void;
};

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

const isJsonLikeText = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
};

const pythonListVoicesScript = [
  'import asyncio',
  'import json',
  'import sys',
  'import edge_tts',
  '',
  'async def main():',
  '    voices = await edge_tts.list_voices()',
  '    json.dump(voices, sys.stdout, ensure_ascii=False)',
  '',
  'asyncio.run(main())',
].join('\n');

const pythonSynthesizeScript = [
  'import asyncio',
  'import json',
  'import pathlib',
  'import sys',
  'import edge_tts',
  '',
  'payload = json.load(sys.stdin)',
  'output_path = pathlib.Path(payload["outputPath"])',
  'output_path.parent.mkdir(parents=True, exist_ok=True)',
  '',
  'async def main():',
  '    communicate = edge_tts.Communicate(',
  '        payload["text"],',
  '        payload["voice"],',
  '        rate=payload["rate"],',
  '        volume=payload["volume"],',
  '    )',
  '    await communicate.save(str(output_path))',
  '',
  'asyncio.run(main())',
].join('\n');

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

  private currentVoiceId: string | undefined;

  private stopping = false;

  private preparePromise: Promise<void> | null = null;

  override on<U extends keyof EdgeTtsServiceEvents>(event: U, listener: EdgeTtsServiceEvents[U]): this {
    return super.on(event, listener);
  }

  private getBaseRoot(): string {
    return path.join(app.getPath('userData'), 'runtimes', EDGE_TTS_RUNTIME_DIR_NAME);
  }

  private getDownloadsRoot(): string {
    return path.join(this.getBaseRoot(), EDGE_TTS_DOWNLOADS_DIR_NAME);
  }

  private getPythonRoot(): string {
    return path.join(this.getBaseRoot(), 'python');
  }

  private getVenvRoot(): string {
    return path.join(this.getBaseRoot(), EDGE_TTS_VENV_DIR_NAME);
  }

  private getTempRoot(): string {
    return path.join(this.getBaseRoot(), EDGE_TTS_TEMP_DIR_NAME);
  }

  private getManagedPythonBinary(): string {
    return path.join(this.getPythonRoot(), 'bin', 'python3');
  }

  private getVenvPythonBinary(): string {
    return path.join(this.getVenvRoot(), 'bin', 'python3');
  }

  private getArchivePath(): string {
    return path.join(this.getDownloadsRoot(), getPythonArchiveFileName());
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
    };
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

  private async ensureManagedPythonReady(force = false): Promise<void> {
    const pythonBinary = this.getManagedPythonBinary();
    if (!force && fs.existsSync(pythonBinary)) {
      return;
    }

    const pythonRoot = this.getPythonRoot();
    fs.rmSync(pythonRoot, { recursive: true, force: true });
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

    const venvRoot = this.getVenvRoot();
    fs.rmSync(venvRoot, { recursive: true, force: true });
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

  isReady(): boolean {
    return this.prepareStatus === TtsPrepareStatus.Ready && fs.existsSync(this.getVenvPythonBinary());
  }

  async getAvailability(): Promise<TtsAvailability> {
    return this.getAvailabilitySync();
  }

  async prepare(options?: TtsPrepareOptions): Promise<{ success: boolean; error?: string }> {
    if (process.platform !== 'darwin') {
      this.setPrepareStatus(TtsPrepareStatus.Error, 'edge-tts is only supported on macOS in this build.');
      return { success: false, error: this.lastError };
    }

    const force = options?.force === true;
    if (this.preparePromise && !force) {
      try {
        await this.preparePromise;
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }

    this.preparePromise = (async () => {
      this.setPrepareStatus(TtsPrepareStatus.Installing);
      const shouldForceRebuild = force;
      await this.ensureManagedPythonReady(shouldForceRebuild);
      await this.ensureVirtualEnvReady(shouldForceRebuild);
      await this.ensureEdgeTtsInstalled(shouldForceRebuild);
      this.setPrepareStatus(TtsPrepareStatus.Ready);
    })();

    try {
      await this.preparePromise;
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[EdgeTtsService] Failed to prepare edge-tts runtime:', error);
      this.setPrepareStatus(TtsPrepareStatus.Error, message);
      return { success: false, error: message };
    } finally {
      this.preparePromise = null;
    }
  }

  async getVoices(): Promise<TtsVoice[]> {
    const prepareResult = await this.prepare({ force: false });
    if (!prepareResult.success) {
      throw new Error(prepareResult.error || 'Failed to prepare edge-tts runtime.');
    }

    const result = await spawnAndCollect(this.getVenvPythonBinary(), ['-c', pythonListVoicesScript]);
    if (!isJsonLikeText(result.stdout)) {
      throw new Error(result.stderr.trim() || 'edge-tts returned an invalid voice list.');
    }

    const payload = JSON.parse(result.stdout) as EdgeVoicePayload[];
    if (!Array.isArray(payload)) {
      return [];
    }
    return payload
      .map((voice) => mapEdgeVoice(voice))
      .filter((voice): voice is TtsVoice => Boolean(voice));
  }

  async speak(options: TtsSpeakOptions, executionOptions?: { allowPrepare?: boolean }): Promise<{ success: boolean; error?: string }> {
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

    const voiceId = stripEdgeVoiceIdentifier(options.voiceId) ?? resolveDefaultEdgeVoiceShortName();

    const tempRoot = this.getTempRoot();
    fs.mkdirSync(tempRoot, { recursive: true });
    const outputPath = path.join(
      tempRoot,
      `edge-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`,
    );

    try {
      await spawnAndCollect(
        this.getVenvPythonBinary(),
        ['-c', pythonSynthesizeScript],
        {
          input: JSON.stringify({
            text,
            voice: voiceId,
            rate: normalizeEdgeTtsRate(options.rate),
            volume: normalizeEdgeTtsVolume(options.volume),
            outputPath,
          }),
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message;
      this.setPrepareStatus(TtsPrepareStatus.Error, message);
      this.emitState({
        type: TtsStateType.Error,
        code: 'edge_tts_synthesize_failed',
        message,
      });
      return { success: false, error: message };
    }

    return await new Promise((resolve) => {
      this.stopping = false;
      this.speaking = true;
      this.currentVoiceId = options.voiceId;
      this.activeAudioFilePath = outputPath;
      const player = spawn('afplay', [outputPath], {
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
        });
        resolve({ success: false, error: message });
      });

      player.once('spawn', () => {
        this.emitState({
          type: TtsStateType.Speaking,
          voiceId: options.voiceId,
        });
      });

      player.once('close', (code) => {
        this.activePlayer = null;
        const wasStopping = this.stopping;
        this.stopping = false;
        this.speaking = false;
        this.cleanupActiveAudioFile();
        if (wasStopping) {
          resolve({ success: true });
          return;
        }
        if (code === 0) {
          this.emitState({
            type: TtsStateType.Stopped,
            voiceId: this.currentVoiceId,
          });
          resolve({ success: true });
          return;
        }

        const message = `afplay exited with code ${code ?? 'unknown'}`;
        this.emitState({
          type: TtsStateType.Error,
          code: 'edge_tts_playback_failed',
          message,
        });
        resolve({ success: false, error: message });
      });
    });
  }

  private cleanupActiveAudioFile(): void {
    const currentFile = this.activeAudioFilePath;
    this.activeAudioFilePath = null;
    if (!currentFile) {
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
    });
    return { success: true };
  }

  dispose(): void {
    void this.stop();
  }
}
