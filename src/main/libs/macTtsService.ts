import { app, type BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'child_process';
import {
  TtsStateType,
  type TtsAvailability,
  type TtsSpeakOptions,
  type TtsStateEvent,
  type TtsVoice,
} from '../../shared/tts/constants';

type HelperVoiceResponse = {
  type: 'voices';
  voices?: TtsVoice[];
};

type HelperTtsEvent = {
  type: string;
  voiceId?: string;
  code?: string;
  message?: string;
};

const MAC_SPEECH_HELPER_DIR = 'macos-speech';
const MAC_TTS_HELPER_NAME = 'MacTtsHelper';

const resolveProjectRoot = (): string => {
  const appPath = app.getAppPath();
  return appPath.endsWith('dist-electron')
    ? path.join(appPath, '..')
    : appPath;
};

const resolveDevHelperBinaryPath = (): string => {
  return path.join(resolveProjectRoot(), 'build', 'generated', MAC_SPEECH_HELPER_DIR, MAC_TTS_HELPER_NAME);
};

const resolvePackagedHelperBinaryPath = (): string => {
  return path.join(process.resourcesPath, MAC_SPEECH_HELPER_DIR, MAC_TTS_HELPER_NAME);
};

const isJsonLikeLine = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith('{') && trimmed.endsWith('}');
};

const sanitizeTtsEvent = (event: HelperTtsEvent): TtsStateEvent => {
  switch (event.type) {
    case TtsStateType.Speaking:
      return { type: TtsStateType.Speaking, voiceId: event.voiceId };
    case TtsStateType.Stopped:
      return { type: TtsStateType.Stopped, voiceId: event.voiceId };
    case TtsStateType.Error:
      return { type: TtsStateType.Error, code: event.code, message: event.message };
    default:
      return {
        type: TtsStateType.Error,
        code: 'invalid_response',
        message: `Unexpected TTS helper event type: ${event.type}`,
      };
  }
};

export class MacTtsService extends EventEmitter {
  private activeChild: ChildProcessWithoutNullStreams | null = null;

  private stdoutBuffer = '';

  private speaking = false;

  private stopping = false;

  private ensureHelperBinary(): string {
    const helperPath = app.isPackaged ? resolvePackagedHelperBinaryPath() : resolveDevHelperBinaryPath();
    if (app.isPackaged) {
      return helperPath;
    }
    if (!fs.existsSync(helperPath)) {
      throw new Error(
        `macOS TTS helper is missing: ${helperPath}. `
        + 'Please run `npm run build:macos-tts-helper` and restart the Electron dev process.',
      );
    }
    return helperPath;
  }

  private handleChildStdout(data: string): void {
    this.stdoutBuffer += data;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !isJsonLikeLine(trimmed)) {
        continue;
      }
      try {
        const rawEvent = JSON.parse(trimmed) as HelperTtsEvent;
        const event = sanitizeTtsEvent(rawEvent);
        if (event.type === TtsStateType.Speaking) {
          this.speaking = true;
        }
        if (event.type === TtsStateType.Stopped || event.type === TtsStateType.Error) {
          this.speaking = false;
        }
        this.emit('stateChanged', event);
      } catch (error) {
        this.emit('stateChanged', {
          type: TtsStateType.Error,
          code: 'invalid_response',
          message: error instanceof Error ? error.message : 'Invalid TTS helper response.',
        } satisfies TtsStateEvent);
      }
    }
  }

  async getAvailability(): Promise<TtsAvailability> {
    if (process.platform !== 'darwin') {
      return {
        enabled: true,
        supported: false,
        platform: process.platform,
        speaking: false,
      };
    }

    try {
      this.ensureHelperBinary();
      return {
        enabled: true,
        supported: true,
        platform: process.platform,
        speaking: this.speaking,
      };
    } catch (error) {
      return {
        enabled: true,
        supported: false,
        platform: process.platform,
        speaking: false,
        error: error instanceof Error ? error.message : 'Failed to initialize macOS TTS helper.',
      };
    }
  }

  async getVoices(): Promise<TtsVoice[]> {
    if (process.platform !== 'darwin') {
      return [];
    }
    const helperPath = this.ensureHelperBinary();
    const result = spawnSync(helperPath, ['voices'], {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.error?.message || 'macOS TTS helper failed.');
    }

    const line = result.stdout
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => isJsonLikeLine(item))
      .pop();
    if (!line) {
      return [];
    }
    const response = JSON.parse(line) as HelperVoiceResponse;
    return Array.isArray(response.voices) ? response.voices : [];
  }

  async speak(options: TtsSpeakOptions): Promise<{ success: boolean; error?: string }> {
    if (process.platform !== 'darwin') {
      return { success: false, error: 'unsupported_platform' };
    }
    const text = options.text?.trim();
    if (!text) {
      return { success: false, error: 'empty_text' };
    }

    await this.stop();

    try {
      const helperPath = this.ensureHelperBinary();
      const child = spawn(
        helperPath,
        [
          'speak',
          options.voiceId ?? '',
          String(options.rate ?? 0.5),
          String(options.volume ?? 1),
        ],
        {
          stdio: 'pipe',
        },
      );

      this.activeChild = child;
      this.stdoutBuffer = '';
      this.stopping = false;
      child.stdout.setEncoding('utf-8');
      child.stderr.setEncoding('utf-8');
      child.stdout.on('data', (data: string) => this.handleChildStdout(data));
      child.stderr.on('data', (data: string) => {
        const message = data.trim();
        if (message) {
          this.emit('stateChanged', {
            type: TtsStateType.Error,
            code: 'runtime_error',
            message,
          } satisfies TtsStateEvent);
        }
      });
      child.once('close', () => {
        this.activeChild = null;
        this.stdoutBuffer = '';
        if (!this.stopping && this.speaking) {
          this.speaking = false;
          this.emit('stateChanged', { type: TtsStateType.Stopped } satisfies TtsStateEvent);
        }
        this.stopping = false;
      });
      child.stdin.write(text);
      child.stdin.end();
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to start TTS helper.' };
    }
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    if (!this.activeChild) {
      this.speaking = false;
      return { success: true };
    }
    this.stopping = true;
    this.speaking = false;
    this.activeChild.kill('SIGTERM');
    this.activeChild = null;
    this.emit('stateChanged', { type: TtsStateType.Stopped } satisfies TtsStateEvent);
    return { success: true };
  }

  dispose(): void {
    void this.stop();
  }
}

export const broadcastTtsState = (
  windows: BrowserWindow[],
  channel: string,
  event: TtsStateEvent,
): void => {
  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, event);
    }
  }
};
