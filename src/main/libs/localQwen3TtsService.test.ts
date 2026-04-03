import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DEFAULT_VOICE_CONFIG } from '../../shared/voice/constants';

const electronState = vi.hoisted(() => ({
  isPackaged: false,
  appPath: '',
  tempPath: '',
}));

const childProcessState = vi.hoisted(() => ({
  spawnSync: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return electronState.isPackaged;
    },
    getAppPath: () => electronState.appPath,
    getPath: () => electronState.tempPath,
  },
}));

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    spawnSync: childProcessState.spawnSync,
  };
});

import { inspectLocalQwen3TtsRuntime } from './localQwen3TtsService';

describe('localQwen3TtsService', () => {
  let tempRoot = '';
  let pythonPath = '';

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qingshu-local-qwen-tts-'));
    pythonPath = path.join(tempRoot, 'bin', 'python3');
    fs.mkdirSync(path.dirname(pythonPath), { recursive: true });
    fs.writeFileSync(pythonPath, '#!/bin/sh\n');
    fs.chmodSync(pythonPath, 0o755);

    electronState.isPackaged = false;
    electronState.appPath = path.join(tempRoot, 'dist-electron');
    electronState.tempPath = tempRoot;

    childProcessState.spawnSync.mockReset();
    childProcessState.spawnSync.mockImplementation((command: string, args?: string[]) => {
      if (command === pythonPath && args?.[0] === '-c') {
        return {
          status: 0,
          stdout: JSON.stringify({
            pythonVersion: '3.11.9',
            qwenTtsAvailable: true,
            torchAvailable: true,
            soundfileAvailable: true,
            huggingfaceHubAvailable: true,
          }),
          stderr: '',
        };
      }
      if (command === 'which' && args?.[0] === 'huggingface-cli') {
        return {
          status: 0,
          stdout: '/usr/local/bin/huggingface-cli\n',
          stderr: '',
        };
      }
      return {
        status: 1,
        stdout: '',
        stderr: '',
      };
    });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('reports python modules and writable runtime when local environment is ready', () => {
    const modelPath = path.join(tempRoot, 'models', 'Qwen3-TTS-1.7B-VoiceDesign');
    const tokenizerPath = path.join(tempRoot, 'models', 'Qwen3-TTS-Tokenizer-12Hz');
    fs.mkdirSync(modelPath, { recursive: true });
    fs.mkdirSync(tokenizerPath, { recursive: true });

    const runtime = inspectLocalQwen3TtsRuntime({
      ...DEFAULT_VOICE_CONFIG.providers.localQwen3Tts,
      enabled: true,
      pythonCommand: pythonPath,
      modelPath,
      tokenizerPath,
    });

    expect(runtime.pythonAvailable).toBe(true);
    expect(runtime.pythonResolvedPath).toBe(pythonPath);
    expect(runtime.pythonVersion).toBe('3.11.9');
    expect(runtime.qwenTtsAvailable).toBe(true);
    expect(runtime.torchAvailable).toBe(true);
    expect(runtime.soundfileAvailable).toBe(true);
    expect(runtime.huggingfaceCliAvailable).toBe(true);
    expect(runtime.huggingfaceHubAvailable).toBe(true);
    expect(runtime.runnerWritable).toBe(true);
    expect(runtime.runtimeIssues).toHaveLength(0);
  });

  test('reports missing python modules as runtime issues', () => {
    const modelPath = path.join(tempRoot, 'models', 'Qwen3-TTS-1.7B-VoiceDesign');
    const tokenizerPath = path.join(tempRoot, 'models', 'Qwen3-TTS-Tokenizer-12Hz');
    fs.mkdirSync(modelPath, { recursive: true });
    fs.mkdirSync(tokenizerPath, { recursive: true });

    childProcessState.spawnSync.mockImplementation((command: string, args?: string[]) => {
      if (command === pythonPath && args?.[0] === '-c') {
        return {
          status: 0,
          stdout: JSON.stringify({
            pythonVersion: '3.11.9',
            qwenTtsAvailable: false,
            torchAvailable: false,
            soundfileAvailable: false,
            huggingfaceHubAvailable: false,
          }),
          stderr: '',
        };
      }
      return {
        status: 1,
        stdout: '',
        stderr: '',
      };
    });

    const runtime = inspectLocalQwen3TtsRuntime({
      ...DEFAULT_VOICE_CONFIG.providers.localQwen3Tts,
      enabled: true,
      pythonCommand: pythonPath,
      modelPath,
      tokenizerPath,
    });

    expect(runtime.pythonAvailable).toBe(true);
    expect(runtime.qwenTtsAvailable).toBe(false);
    expect(runtime.torchAvailable).toBe(false);
    expect(runtime.soundfileAvailable).toBe(false);
    expect(runtime.huggingfaceCliAvailable).toBe(false);
    expect(runtime.huggingfaceHubAvailable).toBe(false);
    expect(runtime.runtimeIssues).toContain('Python module `qwen_tts` is missing.');
    expect(runtime.runtimeIssues).toContain('Python module `torch` is missing.');
    expect(runtime.runtimeIssues).toContain('Python module `soundfile` is missing.');
    expect(runtime.runtimeIssues).toContain('No local model downloader is available (`huggingface-cli` or Python module `huggingface_hub`).');
  });
});
