import { app, type BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'child_process';
import {
  SpeechErrorCode,
  SpeechPermissionStatus,
  SpeechStateType,
  type SpeechAvailability,
  type SpeechStartOptions,
  type SpeechStateEvent,
} from '../../shared/speech/constants';

type HelperAvailabilityResponse = {
  type: 'availability';
  supported?: boolean;
  speechAuthorization?: string;
  microphoneAuthorization?: string;
  locale?: string;
};

type HelperSpeechEvent = {
  type: string;
  text?: string;
  code?: string;
  message?: string;
};

const MAC_SPEECH_HELPER_DIR = 'macos-speech';
const MAC_SPEECH_HELPER_NAME = 'MacSpeechHelper';
const DEFAULT_MACOS_SPEECH_VERSION = '12.0';

const isSpeechPermissionStatus = (value: unknown): value is SpeechPermissionStatus => {
  return Object.values(SpeechPermissionStatus).includes(value as SpeechPermissionStatus);
};

const resolvePermission = (
  speechAuthorization: SpeechPermissionStatus,
  microphoneAuthorization: SpeechPermissionStatus,
): SpeechPermissionStatus => {
  if (
    speechAuthorization === SpeechPermissionStatus.Denied
    || microphoneAuthorization === SpeechPermissionStatus.Denied
  ) {
    return SpeechPermissionStatus.Denied;
  }
  if (
    speechAuthorization === SpeechPermissionStatus.Restricted
    || microphoneAuthorization === SpeechPermissionStatus.Restricted
  ) {
    return SpeechPermissionStatus.Restricted;
  }
  if (
    speechAuthorization === SpeechPermissionStatus.NotDetermined
    || microphoneAuthorization === SpeechPermissionStatus.NotDetermined
  ) {
    return SpeechPermissionStatus.NotDetermined;
  }
  if (
    speechAuthorization === SpeechPermissionStatus.Unsupported
    || microphoneAuthorization === SpeechPermissionStatus.Unsupported
  ) {
    return SpeechPermissionStatus.Unsupported;
  }
  return SpeechPermissionStatus.Granted;
};

const resolveProjectRoot = (): string => {
  const appPath = app.getAppPath();
  return appPath.endsWith('dist-electron')
    ? path.join(appPath, '..')
    : appPath;
};

const resolveDevHelperBinaryPath = (): string => {
  return path.join(resolveProjectRoot(), 'build', 'generated', MAC_SPEECH_HELPER_DIR, MAC_SPEECH_HELPER_NAME);
};

const resolvePackagedHelperBinaryPath = (): string => {
  return path.join(process.resourcesPath, MAC_SPEECH_HELPER_DIR, MAC_SPEECH_HELPER_NAME);
};

const sanitizeSpeechEvent = (event: HelperSpeechEvent): SpeechStateEvent => {
  switch (event.type) {
    case SpeechStateType.Listening:
      return { type: SpeechStateType.Listening };
    case SpeechStateType.Partial:
      return { type: SpeechStateType.Partial, text: event.text ?? '' };
    case SpeechStateType.Final:
      return { type: SpeechStateType.Final, text: event.text ?? '' };
    case SpeechStateType.Stopped:
      return { type: SpeechStateType.Stopped };
    case SpeechStateType.Error:
      return {
        type: SpeechStateType.Error,
        code: event.code || SpeechErrorCode.RuntimeError,
        message: event.message,
      };
    default:
      return {
        type: SpeechStateType.Error,
        code: SpeechErrorCode.InvalidResponse,
        message: `Unexpected speech helper event type: ${event.type}`,
      };
  }
};

const isJsonLikeLine = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.startsWith('{') && trimmed.endsWith('}');
};

export class MacSpeechService extends EventEmitter {
  private activeChild: ChildProcessWithoutNullStreams | null = null;

  private stdoutBuffer = '';

  private stderrBuffer = '';

  private stopping = false;

  private activeChildEmittedError = false;

  private waitForChildClose(child: ChildProcessWithoutNullStreams, timeoutMs = 1_500): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      let timer: NodeJS.Timeout | null = null;

      const finish = (): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        child.removeListener('close', handleClose);
        resolve();
      };

      const handleClose = (): void => {
        finish();
      };

      child.once('close', handleClose);
      timer = setTimeout(() => {
        finish();
      }, timeoutMs);
    });
  }

  private ensureHelperBinary(): string {
    const helperPath = app.isPackaged ? resolvePackagedHelperBinaryPath() : resolveDevHelperBinaryPath();
    if (app.isPackaged) {
      return helperPath;
    }

    if (!fs.existsSync(helperPath)) {
      throw new Error(
        `macOS speech helper is missing: ${helperPath}. `
        + 'Please run `npm run build:macos-speech-helper` and restart the Electron dev process.',
      );
    }
    return helperPath;
  }

  private parseJsonLine<T>(line: string): T {
    return JSON.parse(line) as T;
  }

  private runHelperCommand(args: string[]): HelperAvailabilityResponse {
    const helperPath = this.ensureHelperBinary();
    const result = spawnSync(helperPath, args, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.error?.message || 'macOS speech helper failed.');
    }

    const line = result.stdout
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => isJsonLikeLine(item))
      .pop();
    if (!line) {
      throw new Error('macOS speech helper returned no output.');
    }
    return this.parseJsonLine<HelperAvailabilityResponse>(line);
  }

  private handleChildStdout(data: string): void {
    this.stdoutBuffer += data;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? '';

    for (const line of lines) {
      this.processStdoutLine(line);
    }
  }

  private processStdoutLine(line: string): void {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }
      if (!isJsonLikeLine(trimmed)) {
        return;
      }

      try {
        const rawEvent = this.parseJsonLine<HelperSpeechEvent>(trimmed);
        const event = sanitizeSpeechEvent(rawEvent);
        if (event.type === SpeechStateType.Error) {
          this.activeChildEmittedError = true;
          console.warn(
            '[MacSpeechService] Speech helper reported an error event:',
            JSON.stringify({ code: event.code, message: event.message }),
          );
        }
        this.emit('stateChanged', event);
      } catch (error) {
        this.activeChildEmittedError = true;
        this.emit('stateChanged', {
          type: SpeechStateType.Error,
          code: SpeechErrorCode.InvalidResponse,
          message: error instanceof Error ? error.message : 'Invalid speech helper response.',
        } satisfies SpeechStateEvent);
      }
  }

  private flushStdoutBuffer(): void {
    const leftover = this.stdoutBuffer.trim();
    this.stdoutBuffer = '';
    if (!leftover) {
      return;
    }
    this.processStdoutLine(leftover);
  }

  private clearActiveChild(child: ChildProcessWithoutNullStreams): void {
    if (this.activeChild === child) {
      this.activeChild = null;
    }
    this.stdoutBuffer = '';
    this.stderrBuffer = '';
    this.stopping = false;
    this.activeChildEmittedError = false;
  }

  async getAvailability(): Promise<SpeechAvailability> {
    if (process.platform !== 'darwin') {
      return {
        enabled: true,
        supported: false,
        platform: process.platform,
        permission: SpeechPermissionStatus.Unsupported,
        speechAuthorization: SpeechPermissionStatus.Unsupported,
        microphoneAuthorization: SpeechPermissionStatus.Unsupported,
        listening: false,
      };
    }

    try {
      const response = this.runHelperCommand(['status']);
      const speechAuthorization = isSpeechPermissionStatus(response.speechAuthorization)
        ? response.speechAuthorization
        : SpeechPermissionStatus.Unsupported;
      const microphoneAuthorization = isSpeechPermissionStatus(response.microphoneAuthorization)
        ? response.microphoneAuthorization
        : SpeechPermissionStatus.Unsupported;

      return {
        enabled: true,
        supported: response.supported === true,
        platform: process.platform,
        permission: resolvePermission(speechAuthorization, microphoneAuthorization),
        speechAuthorization,
        microphoneAuthorization,
        locale: response.locale,
        listening: this.activeChild !== null,
      };
    } catch (error) {
      console.warn('[MacSpeechService] Failed to inspect speech availability:', error);
      return {
        enabled: true,
        supported: false,
        platform: process.platform,
        permission: SpeechPermissionStatus.Unsupported,
        speechAuthorization: SpeechPermissionStatus.Unsupported,
        microphoneAuthorization: SpeechPermissionStatus.Unsupported,
        listening: this.activeChild !== null,
        error: error instanceof Error ? error.message : 'Failed to inspect macOS speech availability.',
      };
    }
  }

  async start(options?: SpeechStartOptions): Promise<{ success: boolean; error?: string }> {
    if (process.platform !== 'darwin') {
      return { success: false, error: SpeechErrorCode.UnsupportedPlatform };
    }
    if (this.activeChild) {
      return { success: false, error: SpeechErrorCode.AlreadyListening };
    }

    const availability = await this.getAvailability();
    if (!availability.supported) {
      return { success: false, error: SpeechErrorCode.RecognizerUnavailable };
    }
    if (
      !app.isPackaged
      && (
        availability.speechAuthorization === SpeechPermissionStatus.NotDetermined
        || availability.microphoneAuthorization === SpeechPermissionStatus.NotDetermined
      )
    ) {
      return {
        success: false,
        error: SpeechErrorCode.DevPermissionPromptUnsupported,
      };
    }
    if (availability.speechAuthorization === SpeechPermissionStatus.Denied) {
      return { success: false, error: SpeechErrorCode.SpeechPermissionDenied };
    }
    if (availability.microphoneAuthorization === SpeechPermissionStatus.Denied) {
      return { success: false, error: SpeechErrorCode.MicrophonePermissionDenied };
    }

    let helperPath: string;
    try {
      helperPath = this.ensureHelperBinary();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : SpeechErrorCode.HelperUnavailable,
      };
    }

    try {
      const args = ['listen'];
      if (options?.locale?.trim()) {
        args.push(options.locale.trim());
      }

      const child = spawn(helperPath, args, {
        stdio: 'pipe',
      });
      this.activeChild = child;
      this.stopping = false;
      this.stdoutBuffer = '';
      this.stderrBuffer = '';
      this.activeChildEmittedError = false;

      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        this.handleChildStdout(chunk);
      });

      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => {
        this.stderrBuffer += chunk;
      });

      child.on('error', (error) => {
        this.activeChildEmittedError = true;
        console.error('[MacSpeechService] Speech helper process failed to start:', error);
        this.emit('stateChanged', {
          type: SpeechStateType.Error,
          code: SpeechErrorCode.RuntimeError,
          message: error.message,
        } satisfies SpeechStateEvent);
        this.clearActiveChild(child);
      });

      child.on('close', (code, signal) => {
        const shouldEmitStopped = !this.stopping;
        const stderr = this.stderrBuffer.trim();
        const emittedError = this.activeChildEmittedError;
        this.flushStdoutBuffer();
        this.clearActiveChild(child);
        if (shouldEmitStopped && code && code !== 0 && !emittedError) {
          const message = stderr || `Speech helper exited unexpectedly (code: ${code}${signal ? `, signal: ${signal}` : ''}).`;
          console.warn('[MacSpeechService] Speech helper exited unexpectedly:', JSON.stringify({ code, signal, stderr: stderr || undefined }));
          this.emit('stateChanged', {
            type: SpeechStateType.Error,
            code: SpeechErrorCode.RuntimeError,
            message,
          } satisfies SpeechStateEvent);
          return;
        }
        if (shouldEmitStopped) {
          this.emit('stateChanged', {
            type: SpeechStateType.Stopped,
          } satisfies SpeechStateEvent);
        }
      });

      return { success: true };
    } catch (error) {
      this.activeChild = null;
      return {
        success: false,
        error: error instanceof Error ? error.message : SpeechErrorCode.StartFailed,
      };
    }
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    if (!this.activeChild) {
      return { success: true };
    }

    const child = this.activeChild;
    this.stopping = true;
    const closePromise = this.waitForChildClose(child);
    const killed = child.kill('SIGTERM');
    if (!killed) {
      this.stopping = false;
      return { success: false, error: SpeechErrorCode.RuntimeError };
    }

    this.emit('stateChanged', {
      type: SpeechStateType.Stopped,
    } satisfies SpeechStateEvent);
    await closePromise;
    return { success: true };
  }

  dispose(): void {
    if (this.activeChild) {
      this.stopping = true;
      this.activeChild.kill('SIGTERM');
      this.activeChild = null;
    }
  }

  onStateChanged(listener: (event: SpeechStateEvent) => void): () => void {
    this.on('stateChanged', listener);
    return () => {
      this.off('stateChanged', listener);
    };
  }
}

export const broadcastSpeechState = (
  windows: BrowserWindow[],
  channel: string,
  event: SpeechStateEvent,
): void => {
  const payload = {
    ...event,
    text: event.text && event.text.length > 4000
      ? `${event.text.slice(0, 4000)}\n...[truncated in speech IPC forwarding]`
      : event.text,
    message: event.message && event.message.length > 4000
      ? `${event.message.slice(0, 4000)}\n...[truncated in speech IPC forwarding]`
      : event.message,
  };

  for (const win of windows) {
    win.webContents.send(channel, payload);
  }
};
