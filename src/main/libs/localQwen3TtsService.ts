import fs from 'fs';
import path from 'path';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'child_process';
import { app } from 'electron';
import type { TtsSpeakOptions, TtsSpeakResult } from '../../shared/tts/constants';
import {
  VoiceLocalQwen3TtsTask,
  VoiceProvider,
  type VoiceLocalQwen3TtsProviderConfig,
} from '../../shared/voice/constants';
import {
  resolveInstalledLocalModelPath,
  resolveLocalQwen3TtsRuntimeRoot,
} from './localVoiceModelManager';

const LOCAL_QWEN3_TTS_TIMEOUT_MS = 10 * 60 * 1000;
const LOCAL_QWEN3_TTS_AUDIO_MIME_TYPE = 'audio/wav';
const LOCAL_QWEN3_TTS_RUNNER_FILE = 'qwen3_tts_runner.py';
const LOCAL_QWEN3_TTS_RUNTIME_CHECK_TIMEOUT_MS = 10_000;
const HUGGINGFACE_CLI_COMMAND = 'huggingface-cli';

type LocalQwen3TtsPythonRuntimeCheck = {
  pythonVersion: string;
  qwenTtsAvailable: boolean;
  torchAvailable: boolean;
  soundfileAvailable: boolean;
  huggingfaceHubAvailable: boolean;
  error?: string;
};

type LocalQwen3TtsRuntimeInspection = {
  runnerScriptPath: string;
  modelPath: string | null;
  tokenizerPath: string | null;
  modelExists: boolean;
  tokenizerExists: boolean;
  pythonCommand: string;
  pythonResolvedPath: string | null;
  pythonAvailable: boolean;
  pythonVersion: string;
  qwenTtsAvailable: boolean;
  torchAvailable: boolean;
  soundfileAvailable: boolean;
  huggingfaceCliAvailable: boolean;
  huggingfaceHubAvailable: boolean;
  runnerWritable: boolean;
  runtimeIssues: string[];
};

const PYTHON_RUNTIME_CHECK_SOURCE = `
import importlib.util
import json
import platform

def has_module(name):
    return importlib.util.find_spec(name) is not None

print(json.dumps({
    "pythonVersion": platform.python_version(),
    "qwenTtsAvailable": has_module("qwen_tts"),
    "torchAvailable": has_module("torch"),
    "soundfileAvailable": has_module("soundfile"),
    "huggingfaceHubAvailable": has_module("huggingface_hub"),
}))
`.trim();

const normalizeSpawnOutput = (value: string | Buffer | null | undefined): string => {
  if (!value) {
    return '';
  }
  return value.toString().trim();
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

const cleanupTempDir = async (tempDir: string): Promise<void> => {
  try {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup failures.
  }
};

const buildRunnerSource = (): string => `
import argparse
import json
import os
import sys

import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel


def build_model_kwargs(device: str):
    kwargs = {}
    if device and device != "auto":
        kwargs["device_map"] = device
    elif torch.cuda.is_available():
        kwargs["device_map"] = "cuda:0"
    if torch.cuda.is_available():
        kwargs["dtype"] = torch.bfloat16
        kwargs["attn_implementation"] = "flash_attention_2"
    return kwargs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--tokenizer-path", default="")
    parser.add_argument("--task", required=True)
    parser.add_argument("--text", required=True)
    parser.add_argument("--language", default="Chinese")
    parser.add_argument("--speaker", default="")
    parser.add_argument("--instruct", default="")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    model_kwargs = build_model_kwargs(args.device)
    if args.tokenizer_path:
        model_kwargs["tokenizer_path"] = args.tokenizer_path

    try:
        model = Qwen3TTSModel.from_pretrained(
            args.model_path,
            **model_kwargs,
        )
    except TypeError:
        model_kwargs.pop("tokenizer_path", None)
        model = Qwen3TTSModel.from_pretrained(
            args.model_path,
            **model_kwargs,
        )

    if args.task == "voice_design":
        wavs, sr = model.generate_voice_design(
            text=args.text,
            language=args.language,
            instruct=args.instruct,
        )
    else:
        wavs, sr = model.generate_custom_voice(
            text=args.text,
            language=args.language,
            speaker=args.speaker,
            instruct=args.instruct if args.instruct else None,
        )

    sf.write(args.output, wavs[0], sr)
    sys.stdout.write(json.dumps({"success": True, "sampleRate": sr, "output": args.output}))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
`.trimStart();

export const resolveLocalQwen3TtsRunnerPath = (): string => {
  return path.join(resolveLocalQwen3TtsRuntimeRoot(), LOCAL_QWEN3_TTS_RUNNER_FILE);
};

const inspectPythonRuntime = (pythonPath: string): LocalQwen3TtsPythonRuntimeCheck => {
  const result = spawnSync(pythonPath, ['-c', PYTHON_RUNTIME_CHECK_SOURCE], {
    encoding: 'utf8',
    timeout: LOCAL_QWEN3_TTS_RUNTIME_CHECK_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.status !== 0) {
    const stderr = normalizeSpawnOutput(result.stderr);
    const stdout = normalizeSpawnOutput(result.stdout);
    return {
      pythonVersion: '',
      qwenTtsAvailable: false,
      torchAvailable: false,
      soundfileAvailable: false,
      huggingfaceHubAvailable: false,
      error: stderr || stdout || `python_runtime_check_failed_${result.status ?? 'unknown'}`,
    };
  }

  try {
    const parsed = JSON.parse(result.stdout) as Partial<LocalQwen3TtsPythonRuntimeCheck>;
    return {
      pythonVersion: typeof parsed.pythonVersion === 'string' ? parsed.pythonVersion : '',
      qwenTtsAvailable: parsed.qwenTtsAvailable === true,
      torchAvailable: parsed.torchAvailable === true,
      soundfileAvailable: parsed.soundfileAvailable === true,
      huggingfaceHubAvailable: parsed.huggingfaceHubAvailable === true,
    };
  } catch (error) {
    return {
      pythonVersion: '',
      qwenTtsAvailable: false,
      torchAvailable: false,
      soundfileAvailable: false,
      huggingfaceHubAvailable: false,
      error: error instanceof Error ? error.message : 'failed_to_parse_python_runtime_check',
    };
  }
};

const canWriteRunnerScript = (): boolean => {
  try {
    fs.mkdirSync(resolveLocalQwen3TtsRuntimeRoot(), { recursive: true });
    fs.accessSync(resolveLocalQwen3TtsRuntimeRoot(), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

const ensureRunnerScript = async (): Promise<string> => {
  const runtimeRoot = resolveLocalQwen3TtsRuntimeRoot();
  await fs.promises.mkdir(runtimeRoot, { recursive: true });
  const runnerPath = resolveLocalQwen3TtsRunnerPath();
  await fs.promises.writeFile(runnerPath, buildRunnerSource(), 'utf8');
  return runnerPath;
};

export const resolveLocalQwen3TtsModelPath = (config: VoiceLocalQwen3TtsProviderConfig): string | null => {
  const configured = config.modelPath.trim();
  if (configured) {
    return configured;
  }
  return resolveInstalledLocalModelPath(config.modelId.trim());
};

export const resolveLocalQwen3TtsTokenizerPath = (config: VoiceLocalQwen3TtsProviderConfig): string | null => {
  const configured = config.tokenizerPath.trim();
  if (configured) {
    return configured;
  }
  return resolveInstalledLocalModelPath('qwen3_tts_tokenizer_12hz');
};

export const inspectLocalQwen3TtsRuntime = (config: VoiceLocalQwen3TtsProviderConfig): LocalQwen3TtsRuntimeInspection => {
  const modelPath = resolveLocalQwen3TtsModelPath(config);
  const tokenizerPath = resolveLocalQwen3TtsTokenizerPath(config);
  const pythonCommand = config.pythonCommand.trim() || 'python3';
  const pythonResolvedPath = resolveCommand(pythonCommand);
  const pythonAvailable = Boolean(pythonResolvedPath);
  const pythonRuntime = pythonResolvedPath
    ? inspectPythonRuntime(pythonResolvedPath)
    : {
      pythonVersion: '',
      qwenTtsAvailable: false,
      torchAvailable: false,
      soundfileAvailable: false,
      huggingfaceHubAvailable: false,
    };
  const huggingfaceCliAvailable = Boolean(resolveCommand(HUGGINGFACE_CLI_COMMAND));
  const runnerWritable = canWriteRunnerScript();
  const runtimeIssues: string[] = [];

  if (!pythonAvailable) {
    runtimeIssues.push(`Python command is unavailable: ${pythonCommand}`);
  }
  if (pythonRuntime.error) {
    runtimeIssues.push(`Python runtime check failed: ${pythonRuntime.error}`);
  }
  if (pythonAvailable && !pythonRuntime.qwenTtsAvailable) {
    runtimeIssues.push('Python module `qwen_tts` is missing.');
  }
  if (pythonAvailable && !pythonRuntime.torchAvailable) {
    runtimeIssues.push('Python module `torch` is missing.');
  }
  if (pythonAvailable && !pythonRuntime.soundfileAvailable) {
    runtimeIssues.push('Python module `soundfile` is missing.');
  }
  if (!runnerWritable) {
    runtimeIssues.push('Local Qwen3-TTS runtime directory is not writable.');
  }
  if (!huggingfaceCliAvailable && !pythonRuntime.huggingfaceHubAvailable) {
    runtimeIssues.push('No local model downloader is available (`huggingface-cli` or Python module `huggingface_hub`).');
  }

  return {
    runnerScriptPath: resolveLocalQwen3TtsRunnerPath(),
    modelPath,
    tokenizerPath,
    modelExists: Boolean(modelPath && fs.existsSync(modelPath)),
    tokenizerExists: Boolean(tokenizerPath && fs.existsSync(tokenizerPath)),
    pythonCommand,
    pythonResolvedPath,
    pythonAvailable,
    pythonVersion: pythonRuntime.pythonVersion,
    qwenTtsAvailable: pythonRuntime.qwenTtsAvailable,
    torchAvailable: pythonRuntime.torchAvailable,
    soundfileAvailable: pythonRuntime.soundfileAvailable,
    huggingfaceCliAvailable,
    huggingfaceHubAvailable: pythonRuntime.huggingfaceHubAvailable,
    runnerWritable,
    runtimeIssues,
  };
};

export class LocalQwen3TtsService {
  private activeChild: ChildProcessWithoutNullStreams | null = null;

  async synthesizeSpeech(
    config: VoiceLocalQwen3TtsProviderConfig,
    options: TtsSpeakOptions,
  ): Promise<TtsSpeakResult> {
    const text = options.text?.trim();
    if (!text) {
      return { success: false, error: 'empty_text', provider: VoiceProvider.LocalQwen3Tts };
    }

    const runtime = inspectLocalQwen3TtsRuntime(config);
    if (!runtime.pythonAvailable) {
      return {
        success: false,
        error: runtime.runtimeIssues[0] || 'missing_local_runtime',
        provider: VoiceProvider.LocalQwen3Tts,
      };
    }
    if (!runtime.modelExists || !runtime.modelPath) {
      return { success: false, error: 'missing_local_model', provider: VoiceProvider.LocalQwen3Tts };
    }
    if (!runtime.tokenizerExists) {
      return { success: false, error: 'missing_local_model', provider: VoiceProvider.LocalQwen3Tts };
    }
    if (!runtime.qwenTtsAvailable || !runtime.torchAvailable || !runtime.soundfileAvailable || !runtime.runnerWritable) {
      return {
        success: false,
        error: runtime.runtimeIssues[0] || 'missing_local_runtime',
        provider: VoiceProvider.LocalQwen3Tts,
      };
    }

    const pythonPath = runtime.pythonResolvedPath;
    if (!pythonPath) {
      return {
        success: false,
        error: runtime.runtimeIssues[0] || 'missing_local_runtime',
        provider: VoiceProvider.LocalQwen3Tts,
      };
    }

    const tempDir = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'lobsterai-qwen-tts-'));
    const outputPath = path.join(tempDir, 'tts.wav');

    try {
      const runnerPath = await ensureRunnerScript();
      const args = [
        runnerPath,
        '--model-path', runtime.modelPath,
        '--tokenizer-path', runtime.tokenizerPath,
        '--task', config.task || VoiceLocalQwen3TtsTask.VoiceDesign,
        '--text', text,
        '--language', config.language.trim() || 'Chinese',
        '--speaker', config.speaker.trim() || 'Vivian',
        '--instruct', config.instruct.trim() || '自然、清晰、克制的中文女声',
        '--device', config.device.trim() || 'auto',
        '--output', outputPath,
      ];

      const result = await new Promise<TtsSpeakResult>((resolve) => {
        let settled = false;
        let stderr = '';
        let stdout = '';
        const child = spawn(pythonPath, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
          },
        });
        this.activeChild = child;

        const timeout = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          child.kill('SIGKILL');
          resolve({
            success: false,
            error: 'local_qwen3_tts_timeout',
            provider: VoiceProvider.LocalQwen3Tts,
          });
        }, LOCAL_QWEN3_TTS_TIMEOUT_MS);

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
          this.activeChild = null;
          resolve({
            success: false,
            error: error.message || 'Failed to start local Qwen3-TTS process.',
            provider: VoiceProvider.LocalQwen3Tts,
          });
        });
        child.on('close', async (code) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeout);
          this.activeChild = null;

          if (code !== 0) {
            resolve({
              success: false,
              error: stderr.trim() || stdout.trim() || `local Qwen3-TTS exited with code ${code}`,
              provider: VoiceProvider.LocalQwen3Tts,
            });
            return;
          }

          try {
            const audioBuffer = await fs.promises.readFile(outputPath);
            resolve({
              success: true,
              audioDataUrl: `data:${LOCAL_QWEN3_TTS_AUDIO_MIME_TYPE};base64,${audioBuffer.toString('base64')}`,
              provider: VoiceProvider.LocalQwen3Tts,
            });
          } catch (error) {
            resolve({
              success: false,
              error: error instanceof Error ? error.message : 'Failed to read local Qwen3-TTS output.',
              provider: VoiceProvider.LocalQwen3Tts,
            });
          }
        });
      });

      return result;
    } finally {
      await cleanupTempDir(tempDir);
    }
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    if (!this.activeChild || this.activeChild.killed) {
      return { success: true };
    }
    try {
      this.activeChild.kill('SIGTERM');
      this.activeChild = null;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop local Qwen3-TTS.',
      };
    }
  }
}
