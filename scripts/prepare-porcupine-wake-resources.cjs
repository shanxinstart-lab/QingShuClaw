'use strict';

const path = require('path');
const { existsSync, mkdirSync, rmSync, cpSync, writeFileSync } = require('fs');

const GENERATED_DIR = path.join(__dirname, '..', 'build', 'generated', 'porcupine-keywords');
const SOURCE_DIR = path.join(__dirname, '..', 'resources', 'porcupine-keywords');
const CONFIG_FILE_NAME = 'porcupine-config.json';

const DEFAULT_BINDINGS = [
  {
    wakeWord: '打开青书爪',
    sourceFileName: 'open-qingshuclaw-mac.ppn',
    outputFileName: 'open-qingshuclaw-mac.ppn',
    sensitivity: 0.55,
    envKey: 'PORCUPINE_KEYWORD_OPEN_QINGSHUCLAW_PATH',
  },
  {
    wakeWord: '初一',
    sourceFileName: 'chu-yi-mac.ppn',
    outputFileName: 'chu-yi-mac.ppn',
    sensitivity: 0.55,
    envKey: 'PORCUPINE_KEYWORD_CHUYI_PATH',
  },
];

function resolveSourcePath(binding) {
  const envOverride = process.env[binding.envKey]?.trim();
  if (envOverride) {
    return path.resolve(envOverride);
  }
  return path.join(SOURCE_DIR, binding.sourceFileName);
}

function ensureGeneratedDir() {
  rmSync(GENERATED_DIR, { recursive: true, force: true });
  mkdirSync(GENERATED_DIR, { recursive: true });
}

function buildConfigPayload() {
  const accessKey = process.env.PORCUPINE_ACCESS_KEY?.trim() || '';
  const copiedKeywords = [];

  for (const binding of DEFAULT_BINDINGS) {
    const sourcePath = resolveSourcePath(binding);
    if (!existsSync(sourcePath)) {
      continue;
    }

    const targetPath = path.join(GENERATED_DIR, binding.outputFileName);
    cpSync(sourcePath, targetPath, { force: true });
    copiedKeywords.push({
      wakeWord: binding.wakeWord,
      fileName: binding.outputFileName,
      sensitivity: binding.sensitivity,
    });
  }

  const payload = {
    schemaVersion: 1,
    accessKey,
    keywords: copiedKeywords,
  };

  writeFileSync(
    path.join(GENERATED_DIR, CONFIG_FILE_NAME),
    JSON.stringify(payload, null, 2) + '\n',
  );

  return {
    outputDir: GENERATED_DIR,
    accessKeyConfigured: Boolean(accessKey),
    keywordCount: copiedKeywords.length,
    keywords: copiedKeywords.map((item) => item.wakeWord),
  };
}

function preparePorcupineWakeResources() {
  ensureGeneratedDir();
  const result = buildConfigPayload();
  console.log(
    '[prepare-porcupine-wake-resources] Prepared Porcupine resources:',
    JSON.stringify(result),
  );
  return result;
}

module.exports = {
  preparePorcupineWakeResources,
  GENERATED_DIR,
  CONFIG_FILE_NAME,
};

if (require.main === module) {
  try {
    preparePorcupineWakeResources();
  } catch (error) {
    console.error(
      '[prepare-porcupine-wake-resources] Failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
