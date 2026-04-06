'use strict';

const path = require('path');
const { existsSync, mkdirSync, rmSync, cpSync, readdirSync, statSync, writeFileSync } = require('fs');

const SOURCE_DIR = path.join(__dirname, '..', 'resources', 'sherpa-asr');
const GENERATED_DIR = path.join(__dirname, '..', 'build', 'generated', 'sherpa-asr');
const CONFIG_FILE_NAME = 'sherpa-asr-config.json';

function findModelRoot() {
  if (!existsSync(SOURCE_DIR)) {
    throw new Error(`Sherpa ASR source directory is missing: ${SOURCE_DIR}`);
  }

  const directModel = path.join(SOURCE_DIR, 'model.int8.onnx');
  if (existsSync(directModel)) {
    return SOURCE_DIR;
  }

  const children = readdirSync(SOURCE_DIR)
    .map((entry) => path.join(SOURCE_DIR, entry))
    .filter((entry) => statSync(entry).isDirectory());
  const matched = children.find((entry) => existsSync(path.join(entry, 'model.int8.onnx')));
  if (!matched) {
    throw new Error('Unable to locate Sherpa ASR model.int8.onnx under resources/sherpa-asr.');
  }
  return matched;
}

function prepareSherpaAsrResources() {
  const modelRoot = findModelRoot();
  rmSync(GENERATED_DIR, { recursive: true, force: true });
  mkdirSync(GENERATED_DIR, { recursive: true });

  const files = ['model.int8.onnx', 'tokens.txt', 'bbpe.model'];
  for (const fileName of files) {
    const sourcePath = path.join(modelRoot, fileName);
    if (!existsSync(sourcePath)) {
      throw new Error(`Sherpa ASR resource is missing: ${sourcePath}`);
    }
    cpSync(sourcePath, path.join(GENERATED_DIR, fileName));
  }

  const config = {
    schemaVersion: 1,
    modelId: path.basename(modelRoot),
    sampleRate: 16000,
    featureDim: 80,
    modelFileName: 'model.int8.onnx',
    tokensFileName: 'tokens.txt',
    bpeVocabFileName: 'bbpe.model',
    provider: 'cpu',
    numThreads: 2,
  };
  writeFileSync(path.join(GENERATED_DIR, CONFIG_FILE_NAME), `${JSON.stringify(config, null, 2)}\n`);
  console.log('[prepare-sherpa-asr-resources] Prepared Sherpa ASR resources:', GENERATED_DIR);
}

module.exports = {
  prepareSherpaAsrResources,
};

if (require.main === module) {
  prepareSherpaAsrResources();
}

