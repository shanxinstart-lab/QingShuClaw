import { app } from 'electron';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { Porcupine } from '@picovoice/porcupine-node';
import { PvRecorder } from '@picovoice/pvrecorder-node';

const PORCUPINE_KEYWORD_RESOURCE_DIR = 'porcupine-keywords';
const PORCUPINE_CONFIG_FILE_NAME = 'porcupine-config.json';
const PORCUPINE_DEFAULT_SENSITIVITY = 0.55;
const PORCUPINE_BUFFERED_FRAMES_COUNT = 8;
const STOP_WAIT_TIMEOUT_MS = 300;

const PorcupineWakeErrorCode = {
  AccessKeyMissing: 'porcupine_access_key_missing',
  KeywordModelMissing: 'porcupine_keyword_model_missing',
  RuntimeUnavailable: 'porcupine_runtime_unavailable',
  RecorderStartFailed: 'porcupine_recorder_start_failed',
  RecorderReadFailed: 'porcupine_recorder_read_failed',
  EngineProcessFailed: 'porcupine_engine_process_failed',
} as const;

type PorcupineWakeErrorCode = typeof PorcupineWakeErrorCode[keyof typeof PorcupineWakeErrorCode];

type PorcupineKeywordBinding = {
  wakeWord: string;
  fileName: string;
  sensitivity: number;
  envKey?: string;
};

type ResolvedPorcupineKeywordBinding = {
  wakeWord: string;
  keywordPath: string;
  sensitivity: number;
};

type PorcupineResourceConfig = {
  schemaVersion?: number;
  accessKey?: string;
  keywords?: Array<{
    wakeWord?: string;
    fileName?: string;
    sensitivity?: number;
  }>;
};

type PorcupineWakeServiceEvents = {
  wake: (event: { wakeWord: string; provider: typeof LEGACY_PORCUPINE_PROVIDER }) => void;
  error: (event: { code: PorcupineWakeErrorCode; message: string }) => void;
};

const STATIC_PORCUPINE_KEYWORDS: PorcupineKeywordBinding[] = [
  {
    wakeWord: '打开青书爪',
    fileName: 'open-qingshuclaw-mac.ppn',
    sensitivity: PORCUPINE_DEFAULT_SENSITIVITY,
    envKey: 'PORCUPINE_KEYWORD_OPEN_QINGSHUCLAW_PATH',
  },
  {
    wakeWord: '初一',
    fileName: 'chu-yi-mac.ppn',
    sensitivity: PORCUPINE_DEFAULT_SENSITIVITY,
    envKey: 'PORCUPINE_KEYWORD_CHUYI_PATH',
  },
];

const resolveKeywordResourceRoots = (): string[] => {
  if (app.isPackaged) {
    return [path.join(process.resourcesPath, PORCUPINE_KEYWORD_RESOURCE_DIR)];
  }

  return [
    path.join(process.cwd(), 'build', 'generated', PORCUPINE_KEYWORD_RESOURCE_DIR),
    path.join(process.cwd(), 'resources', PORCUPINE_KEYWORD_RESOURCE_DIR),
  ];
};

const formatErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  return fallbackMessage;
};

const readBundledResourceConfig = (): { root: string; config: PorcupineResourceConfig } | null => {
  for (const resourceRoot of resolveKeywordResourceRoots()) {
    const configPath = path.join(resourceRoot, PORCUPINE_CONFIG_FILE_NAME);
    if (!fs.existsSync(configPath)) {
      continue;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!parsed || typeof parsed !== 'object') {
        continue;
      }
      return {
        root: resourceRoot,
        config: parsed,
      };
    } catch (error) {
      console.warn('[PorcupineWake] Failed to parse bundled config file.', error);
    }
  }

  return null;
};

const resolveConfigAccessKey = (): string => {
  const bundledConfig = readBundledResourceConfig();
  if (typeof bundledConfig?.config.accessKey === 'string' && bundledConfig.config.accessKey.trim()) {
    return bundledConfig.config.accessKey.trim();
  }
  return process.env.PORCUPINE_ACCESS_KEY?.trim() || '';
};

const resolveKeywordBindingsFromBundledConfig = (): ResolvedPorcupineKeywordBinding[] => {
  const bundledConfig = readBundledResourceConfig();
  if (!bundledConfig || !Array.isArray(bundledConfig.config.keywords)) {
    return [];
  }

  return bundledConfig.config.keywords.flatMap((item) => {
    const wakeWord = typeof item?.wakeWord === 'string' ? item.wakeWord.trim() : '';
    const fileName = typeof item?.fileName === 'string' ? item.fileName.trim() : '';
    if (!wakeWord || !fileName) {
      return [];
    }

    const keywordPath = path.join(bundledConfig.root, fileName);
    if (!fs.existsSync(keywordPath)) {
      return [];
    }

    return [{
      wakeWord,
      keywordPath,
      sensitivity: typeof item?.sensitivity === 'number' ? item.sensitivity : PORCUPINE_DEFAULT_SENSITIVITY,
    }];
  });
};

const resolveKeywordBindingsFromLegacySources = (): ResolvedPorcupineKeywordBinding[] => {
  const resourceRoots = resolveKeywordResourceRoots();
  return STATIC_PORCUPINE_KEYWORDS.flatMap((binding) => {
    const envOverride = binding.envKey ? process.env[binding.envKey]?.trim() : '';
    const bundledPath = resourceRoots
      .map((root) => path.join(root, binding.fileName))
      .find((candidate) => fs.existsSync(candidate));
    const keywordPath = envOverride || bundledPath || '';
    if (!keywordPath || !fs.existsSync(keywordPath)) {
      return [];
    }
    return [{
      wakeWord: binding.wakeWord,
      keywordPath,
      sensitivity: binding.sensitivity,
    }];
  });
};

const resolveKeywordBindings = (): ResolvedPorcupineKeywordBinding[] => {
  const bundledBindings = resolveKeywordBindingsFromBundledConfig();
  if (bundledBindings.length > 0) {
    return bundledBindings;
  }
  return resolveKeywordBindingsFromLegacySources();
};

export class PorcupineWakeService extends EventEmitter {
  private porcupine: Porcupine | null = null;

  private recorder: PvRecorder | null = null;

  private listening = false;

  private wakePending = false;

  private listenSessionId = 0;

  private activeBindings: ResolvedPorcupineKeywordBinding[] = [];

  private captureLoopPromise: Promise<void> | null = null;

  override on<U extends keyof PorcupineWakeServiceEvents>(event: U, listener: PorcupineWakeServiceEvents[U]): this {
    return super.on(event, listener);
  }

  getAvailability(): { supported: boolean; configuredWakeWords: string[]; error?: string } {
    const accessKey = resolveConfigAccessKey();
    if (!accessKey) {
      return {
        supported: false,
        configuredWakeWords: [],
        error: PorcupineWakeErrorCode.AccessKeyMissing,
      };
    }

    const bindings = resolveKeywordBindings();
    if (bindings.length === 0) {
      return {
        supported: false,
        configuredWakeWords: [],
        error: PorcupineWakeErrorCode.KeywordModelMissing,
      };
    }

    return {
      supported: true,
      configuredWakeWords: bindings.map((binding) => binding.wakeWord),
    };
  }

  async start(): Promise<{ success: boolean; error?: string; configuredWakeWords?: string[] }> {
    if (this.listening) {
      return {
        success: true,
        configuredWakeWords: this.activeBindings.map((binding) => binding.wakeWord),
      };
    }

    const accessKey = resolveConfigAccessKey();
    if (!accessKey) {
      return { success: false, error: PorcupineWakeErrorCode.AccessKeyMissing };
    }

    const bindings = resolveKeywordBindings();
    if (bindings.length === 0) {
      return { success: false, error: PorcupineWakeErrorCode.KeywordModelMissing };
    }

    try {
      this.porcupine = new Porcupine(
        accessKey,
        bindings.map((binding) => binding.keywordPath),
        bindings.map((binding) => binding.sensitivity),
      );
    } catch (error) {
      await this.releaseResources();
      return {
        success: false,
        error: formatErrorMessage(error, PorcupineWakeErrorCode.RuntimeUnavailable),
      };
    }

    try {
      this.recorder = new PvRecorder(this.porcupine.frameLength, -1, PORCUPINE_BUFFERED_FRAMES_COUNT);
      this.recorder.start();
    } catch (error) {
      await this.releaseResources();
      return {
        success: false,
        error: formatErrorMessage(error, PorcupineWakeErrorCode.RecorderStartFailed),
      };
    }

    this.listening = true;
    this.wakePending = false;
    this.listenSessionId += 1;
    this.activeBindings = bindings;
    const currentSessionId = this.listenSessionId;
    this.captureLoopPromise = this.runCaptureLoop(currentSessionId);
    console.log(
      '[PorcupineWake] Started background wake listener.',
      JSON.stringify({ wakeWords: bindings.map((binding) => binding.wakeWord) }),
    );

    return {
      success: true,
      configuredWakeWords: bindings.map((binding) => binding.wakeWord),
    };
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    if (!this.listening && !this.porcupine && !this.recorder) {
      return { success: true };
    }

    this.listening = false;
    this.wakePending = false;
    this.listenSessionId += 1;

    try {
      this.recorder?.stop();
    } catch (error) {
      console.warn('[PorcupineWake] Failed to stop recorder cleanly.', error);
    }

    const currentLoop = this.captureLoopPromise;
    if (currentLoop) {
      await Promise.race([
        currentLoop.catch((): void => undefined),
        new Promise((resolve) => setTimeout(resolve, STOP_WAIT_TIMEOUT_MS)),
      ]);
    }

    await this.releaseResources();
    console.log('[PorcupineWake] Stopped background wake listener.');
    return { success: true };
  }

  private async runCaptureLoop(sessionId: number): Promise<void> {
    while (this.listening && sessionId === this.listenSessionId && this.recorder && this.porcupine) {
      let frame: Int16Array;
      try {
        frame = await this.recorder.read();
      } catch (error) {
        if (!this.listening || sessionId !== this.listenSessionId) {
          return;
        }
        await this.handleRuntimeFailure(
          PorcupineWakeErrorCode.RecorderReadFailed,
          formatErrorMessage(error, PorcupineWakeErrorCode.RecorderReadFailed),
        );
        return;
      }

      if (!this.listening || sessionId !== this.listenSessionId || !this.porcupine) {
        return;
      }

      let keywordIndex = -1;
      try {
        keywordIndex = this.porcupine.process(frame);
      } catch (error) {
        await this.handleRuntimeFailure(
          PorcupineWakeErrorCode.EngineProcessFailed,
          formatErrorMessage(error, PorcupineWakeErrorCode.EngineProcessFailed),
        );
        return;
      }

      if (keywordIndex < 0 || this.wakePending) {
        continue;
      }

      const binding = this.activeBindings[keywordIndex];
      if (!binding) {
        continue;
      }

      this.wakePending = true;
      console.log(
        '[PorcupineWake] Wake word detected.',
        JSON.stringify({ wakeWord: binding.wakeWord }),
      );
      this.emit('wake', {
        wakeWord: binding.wakeWord,
        provider: LEGACY_PORCUPINE_PROVIDER,
      });
    }
  }

  private async handleRuntimeFailure(code: PorcupineWakeErrorCode, message: string): Promise<void> {
    this.listening = false;
    this.wakePending = false;
    await this.releaseResources();
    console.warn(
      '[PorcupineWake] Runtime failure stopped background wake listener.',
      JSON.stringify({ code, message }),
    );
    this.emit('error', { code, message });
  }

  private async releaseResources(): Promise<void> {
    try {
      this.recorder?.release();
    } catch (error) {
      console.warn('[PorcupineWake] Failed to release recorder resources.', error);
    }
    try {
      this.porcupine?.release();
    } catch (error) {
      console.warn('[PorcupineWake] Failed to release engine resources.', error);
    }

    this.recorder = null;
    this.porcupine = null;
    this.captureLoopPromise = null;
    this.activeBindings = [];
  }
}
const LEGACY_PORCUPINE_PROVIDER = 'porcupine';
