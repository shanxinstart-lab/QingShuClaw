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

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return electronState.isPackaged;
    },
    getAppPath: () => electronState.appPath,
    getPath: () => electronState.tempPath,
  },
}));

import {
  ensureLocalWhisperCppDirectories,
  inspectLocalWhisperCppRuntime,
  resolveLocalWhisperCppBinaryDirectory,
  resolveLocalWhisperCppBinaryName,
  resolveLocalWhisperCppExecutablePath,
  resolveLocalWhisperCppModelPath,
  resolveLocalWhisperCppModelsDirectory,
  resolveLocalWhisperCppResourceRoot,
} from './localWhisperCppSpeechService';

describe('localWhisperCppSpeechService', () => {
  let tempRoot = '';

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qingshu-local-whisper-'));
    electronState.isPackaged = false;
    electronState.appPath = path.join(tempRoot, 'dist-electron');
    electronState.tempPath = tempRoot;
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('creates default resource directories and resolves bundled assets', async () => {
    await ensureLocalWhisperCppDirectories();

    const binaryDirectory = resolveLocalWhisperCppBinaryDirectory();
    const modelsDirectory = resolveLocalWhisperCppModelsDirectory();
    const executablePath = path.join(binaryDirectory, resolveLocalWhisperCppBinaryName());
    const modelPath = path.join(modelsDirectory, 'ggml-base.bin');

    expect(resolveLocalWhisperCppResourceRoot()).toBe(path.join(tempRoot, 'voice-models', 'local-whisper-cpp'));
    expect(fs.existsSync(modelsDirectory)).toBe(true);

    fs.mkdirSync(binaryDirectory, { recursive: true });
    fs.writeFileSync(executablePath, '#!/bin/sh\n');
    fs.chmodSync(executablePath, 0o755);
    fs.writeFileSync(modelPath, 'test-model');

    const runtime = inspectLocalWhisperCppRuntime(DEFAULT_VOICE_CONFIG.providers.localWhisperCpp);
    expect(runtime.executableExists).toBe(true);
    expect(runtime.modelExists).toBe(true);
    expect(runtime.executablePath).toBe(executablePath);
    expect(runtime.modelPath).toBe(modelPath);
  });

  test('prefers explicitly configured binary and model paths', () => {
    const customBinaryPath = path.join(tempRoot, 'custom', 'whisper-cli');
    const customModelPath = path.join(tempRoot, 'custom', 'ggml-small.bin');
    fs.mkdirSync(path.dirname(customBinaryPath), { recursive: true });
    fs.writeFileSync(customBinaryPath, '#!/bin/sh\n');
    fs.writeFileSync(customModelPath, 'model');

    const config = {
      ...DEFAULT_VOICE_CONFIG.providers.localWhisperCpp,
      binaryPath: customBinaryPath,
      modelPath: customModelPath,
      modelName: 'small',
    };

    expect(resolveLocalWhisperCppExecutablePath(config)).toBe(customBinaryPath);
    expect(resolveLocalWhisperCppModelPath(config)).toBe(customModelPath);
  });
});
