import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { app } from 'electron';
import type { SpeechTranscribeAudioOptions, SpeechTranscribeAudioResult } from '../../shared/speech/constants';
import { VoiceProvider, type VoiceLocalWhisperCppProviderConfig } from '../../shared/voice/constants';
import { resolveDownloadedWhisperCppModelsDirectory, resolveLocalVoiceModelsRoot } from './localVoiceModelManager';

export const LOCAL_WHISPER_CPP_RESOURCE_DIR = 'local-whisper-cpp';
const LOCAL_WHISPER_CPP_TIMEOUT_MS = 5 * 60 * 1000;

const resolveProjectRoot = (): string => {
  const appPath = app.getAppPath();
  return appPath.endsWith('dist-electron')
    ? path.join(appPath, '..')
    : appPath;
};

const resolveBundledBaseDir = (): string => {
  return app.isPackaged
    ? path.join(process.resourcesPath, LOCAL_WHISPER_CPP_RESOURCE_DIR)
    : path.join(resolveProjectRoot(), 'build', 'generated', LOCAL_WHISPER_CPP_RESOURCE_DIR);
};

export const resolveLocalWhisperCppResourceRoot = (): string => {
  return path.join(resolveLocalVoiceModelsRoot(), LOCAL_WHISPER_CPP_RESOURCE_DIR);
};

export const resolveLocalWhisperCppBinaryName = (): string => {
  return process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
};

export const resolveLocalWhisperCppBinaryDirectory = (): string => {
  return path.join(resolveBundledBaseDir(), 'bin');
};

export const resolveLocalWhisperCppModelsDirectory = (): string => {
  return resolveDownloadedWhisperCppModelsDirectory();
};

export const ensureLocalWhisperCppDirectories = async (): Promise<{
  resourceRoot: string;
  binaryDirectory: string;
  modelsDirectory: string;
}> => {
  const resourceRoot = resolveLocalWhisperCppResourceRoot();
  const binaryDirectory = resolveLocalWhisperCppBinaryDirectory();
  const modelsDirectory = resolveLocalWhisperCppModelsDirectory();

  await fs.promises.mkdir(resourceRoot, { recursive: true });
  await fs.promises.mkdir(modelsDirectory, { recursive: true });

  return {
    resourceRoot,
    binaryDirectory,
    modelsDirectory,
  };
};

const cleanupTempDir = async (tempDir: string): Promise<void> => {
  try {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup failures.
  }
};

const resolveTextOutput = async (outputBasePath: string): Promise<string> => {
  const outputPath = `${outputBasePath}.txt`;
  const content = await fs.promises.readFile(outputPath, 'utf8');
  return content.trim();
};

export const resolveLocalWhisperCppExecutablePath = (config: VoiceLocalWhisperCppProviderConfig): string | null => {
  const configured = config.binaryPath.trim();
  if (configured) {
    return configured;
  }

  const bundled = path.join(resolveLocalWhisperCppBinaryDirectory(), resolveLocalWhisperCppBinaryName());
  return fs.existsSync(bundled) ? bundled : null;
};

export const resolveLocalWhisperCppModelPath = (config: VoiceLocalWhisperCppProviderConfig): string | null => {
  const configured = config.modelPath.trim();
  if (configured) {
    return configured;
  }

  const modelName = config.modelName.trim();
  if (!modelName) {
    return null;
  }

  const downloaded = path.join(resolveLocalWhisperCppModelsDirectory(), `ggml-${modelName}.bin`);
  if (fs.existsSync(downloaded)) {
    return downloaded;
  }

  const bundled = path.join(resolveBundledBaseDir(), 'models', `ggml-${modelName}.bin`);
  return fs.existsSync(bundled) ? bundled : null;
};

export const inspectLocalWhisperCppRuntime = (config: VoiceLocalWhisperCppProviderConfig): {
  executablePath: string | null;
  modelPath: string | null;
  executableExists: boolean;
  modelExists: boolean;
} => {
  const executablePath = resolveLocalWhisperCppExecutablePath(config);
  const modelPath = resolveLocalWhisperCppModelPath(config);
  return {
    executablePath,
    modelPath,
    executableExists: Boolean(executablePath && fs.existsSync(executablePath)),
    modelExists: Boolean(modelPath && fs.existsSync(modelPath)),
  };
};

export class LocalWhisperCppSpeechService {
  async transcribeAudio(
    config: VoiceLocalWhisperCppProviderConfig,
    options: SpeechTranscribeAudioOptions,
  ): Promise<SpeechTranscribeAudioResult> {
    const audioBase64 = options.audioBase64?.trim();
    if (!audioBase64) {
      return {
        success: false,
        error: 'empty_audio',
        provider: VoiceProvider.LocalWhisperCpp,
      };
    }

    const runtime = inspectLocalWhisperCppRuntime(config);
    if (!runtime.executableExists || !runtime.executablePath || !runtime.modelExists || !runtime.modelPath) {
      return {
        success: false,
        error: 'provider_config_required',
        provider: VoiceProvider.LocalWhisperCpp,
      };
    }

    const tempDir = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'lobsterai-whisper-'));
    const audioPath = path.join(tempDir, 'input.wav');
    const outputBasePath = path.join(tempDir, 'transcript');

    try {
      await fs.promises.writeFile(audioPath, Buffer.from(audioBase64, 'base64'));

      const args = [
        '-m', runtime.modelPath,
        '-f', audioPath,
        '-l', config.language.trim() || 'auto',
        '-t', String(Math.max(1, config.threads || 1)),
        '-otxt',
        '-of', outputBasePath,
        '-np',
        '-nt',
      ];

      if (!config.useGpu) {
        args.push('-ng');
      }

      const result = await new Promise<SpeechTranscribeAudioResult>((resolve) => {
        let settled = false;
        let stderr = '';
        let stdout = '';
        const child = spawn(runtime.executablePath!, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        const timeout = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          child.kill('SIGKILL');
          resolve({
            success: false,
            error: 'local_whisper_timeout',
            provider: VoiceProvider.LocalWhisperCpp,
          });
        }, LOCAL_WHISPER_CPP_TIMEOUT_MS);

        child.stdout.on('data', (chunk: Buffer | string) => {
          stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk: Buffer | string) => {
          stderr += chunk.toString();
        });

        child.on('error', (error) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeout);
          resolve({
            success: false,
            error: error.message || 'Failed to start local whisper.cpp process.',
            provider: VoiceProvider.LocalWhisperCpp,
          });
        });

        child.on('close', async (code) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeout);

          if (code !== 0) {
            const errorOutput = stderr.trim() || stdout.trim() || `whisper.cpp exited with code ${code}`;
            resolve({
              success: false,
              error: errorOutput,
              provider: VoiceProvider.LocalWhisperCpp,
            });
            return;
          }

          try {
            const text = await resolveTextOutput(outputBasePath);
            if (!text) {
              resolve({
                success: false,
                error: 'empty_transcript',
                provider: VoiceProvider.LocalWhisperCpp,
              });
              return;
            }

            resolve({
              success: true,
              text,
              provider: VoiceProvider.LocalWhisperCpp,
            });
          } catch (error) {
            resolve({
              success: false,
              error: error instanceof Error ? error.message : 'Failed to read local whisper.cpp output.',
              provider: VoiceProvider.LocalWhisperCpp,
            });
          }
        });
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Local whisper.cpp transcription failed.',
        provider: VoiceProvider.LocalWhisperCpp,
      };
    } finally {
      await cleanupTempDir(tempDir);
    }
  }
}
