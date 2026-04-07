import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { SherpaOnnxWakeModelId } from '../../shared/voice/constants';

const electronState = vi.hoisted(() => ({
  isPackaged: false,
  appPath: '',
}));

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return electronState.isPackaged;
    },
    getAppPath: () => electronState.appPath,
  },
}));

import { inspectSherpaOnnxWakeRuntime } from './sherpaOnnxWakeResourceService';

describe('inspectSherpaOnnxWakeRuntime', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('优先按 manifest 解析所选模型目录', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qsc-sherpa-kws-'));
    tempDirs.push(projectRoot);
    electronState.appPath = path.join(projectRoot, 'dist-electron');

    const resourceRoot = path.join(projectRoot, 'build', 'generated', 'sherpa-kws');
    const zhEnRoot = path.join(resourceRoot, SherpaOnnxWakeModelId.ZipformerZhEn3M20251220);
    const wenetRoot = path.join(resourceRoot, SherpaOnnxWakeModelId.ZipformerWenetSpeech33M20240101);
    fs.mkdirSync(zhEnRoot, { recursive: true });
    fs.mkdirSync(wenetRoot, { recursive: true });

    fs.writeFileSync(path.join(resourceRoot, 'sherpa-kws-manifest.json'), JSON.stringify({
      schemaVersion: 1,
      defaultModelId: SherpaOnnxWakeModelId.ZipformerZhEn3M20251220,
      models: [
        {
          id: SherpaOnnxWakeModelId.ZipformerZhEn3M20251220,
          label: 'Zipformer zh-en 3M',
          directory: SherpaOnnxWakeModelId.ZipformerZhEn3M20251220,
        },
        {
          id: SherpaOnnxWakeModelId.ZipformerWenetSpeech33M20240101,
          label: 'Zipformer WenetSpeech 3.3M',
          directory: SherpaOnnxWakeModelId.ZipformerWenetSpeech33M20240101,
        },
      ],
    }));

    for (const modelRoot of [zhEnRoot, wenetRoot]) {
      fs.writeFileSync(path.join(modelRoot, 'encoder.onnx'), '');
      fs.writeFileSync(path.join(modelRoot, 'decoder.onnx'), '');
      fs.writeFileSync(path.join(modelRoot, 'joiner.onnx'), '');
      fs.writeFileSync(path.join(modelRoot, 'tokens.txt'), modelRoot.includes('zh-en') ? 'en 1\n' : 'zh 1\n');
      fs.writeFileSync(path.join(modelRoot, 'sherpa-kws-config.json'), JSON.stringify({
        schemaVersion: 1,
        model: {
          encoderFileName: 'encoder.onnx',
          decoderFileName: 'decoder.onnx',
          joinerFileName: 'joiner.onnx',
          tokensFileName: 'tokens.txt',
          provider: 'cpu',
          numThreads: 1,
          debug: false,
        },
        defaultWakeWords: ['打开青书爪'],
      }));
    }

    const zhEnRuntime = inspectSherpaOnnxWakeRuntime(SherpaOnnxWakeModelId.ZipformerZhEn3M20251220);
    const wenetRuntime = inspectSherpaOnnxWakeRuntime(SherpaOnnxWakeModelId.ZipformerWenetSpeech33M20240101);

    expect(zhEnRuntime.ready).toBe(true);
    expect(zhEnRuntime.modelId).toBe(SherpaOnnxWakeModelId.ZipformerZhEn3M20251220);
    expect(zhEnRuntime.modelRoot).toBe(zhEnRoot);
    expect(zhEnRuntime.resolvedTokensPath).toBe(path.join(zhEnRoot, 'tokens.txt'));

    expect(wenetRuntime.ready).toBe(true);
    expect(wenetRuntime.modelId).toBe(SherpaOnnxWakeModelId.ZipformerWenetSpeech33M20240101);
    expect(wenetRuntime.modelRoot).toBe(wenetRoot);
    expect(wenetRuntime.resolvedTokensPath).toBe(path.join(wenetRoot, 'tokens.txt'));
  });

  test('兼容 legacy 平铺目录并将其视为 wenetspeech', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qsc-sherpa-kws-'));
    tempDirs.push(projectRoot);
    electronState.appPath = path.join(projectRoot, 'dist-electron');

    const resourceRoot = path.join(projectRoot, 'resources', 'sherpa-kws');
    fs.mkdirSync(resourceRoot, { recursive: true });
    fs.writeFileSync(path.join(resourceRoot, 'encoder.onnx'), '');
    fs.writeFileSync(path.join(resourceRoot, 'decoder.onnx'), '');
    fs.writeFileSync(path.join(resourceRoot, 'joiner.onnx'), '');
    fs.writeFileSync(path.join(resourceRoot, 'tokens.txt'), 'zh 1\n');
    fs.writeFileSync(path.join(resourceRoot, 'sherpa-kws-config.json'), JSON.stringify({
      schemaVersion: 1,
      model: {
        encoderFileName: 'encoder.onnx',
        decoderFileName: 'decoder.onnx',
        joinerFileName: 'joiner.onnx',
        tokensFileName: 'tokens.txt',
      },
      defaultWakeWords: ['打开青书爪'],
    }));

    const wenetRuntime = inspectSherpaOnnxWakeRuntime(SherpaOnnxWakeModelId.ZipformerWenetSpeech33M20240101);
    const zhEnRuntime = inspectSherpaOnnxWakeRuntime(SherpaOnnxWakeModelId.ZipformerZhEn3M20251220);

    expect(wenetRuntime.ready).toBe(true);
    expect(wenetRuntime.legacy).toBe(true);
    expect(wenetRuntime.modelId).toBe(SherpaOnnxWakeModelId.ZipformerWenetSpeech33M20240101);

    expect(zhEnRuntime.ready).toBe(false);
    expect(zhEnRuntime.error).toBe('sherpa_kws_selected_model_missing');
  });
});
