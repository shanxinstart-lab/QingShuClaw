'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const generatedRoot = path.join(repoRoot, 'build', 'generated', 'local-whisper-cpp');
const binDir = path.join(generatedRoot, 'bin');
const modelsDir = path.join(generatedRoot, 'models');
const binaryName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
const targetBinaryPath = path.join(binDir, binaryName);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyIfProvided(sourcePath, targetPath) {
  if (!sourcePath) {
    return false;
  }
  const resolvedSourcePath = path.resolve(sourcePath);
  if (!fs.existsSync(resolvedSourcePath)) {
    throw new Error(`Source file does not exist: ${resolvedSourcePath}`);
  }
  fs.copyFileSync(resolvedSourcePath, targetPath);
  if (process.platform !== 'win32') {
    fs.chmodSync(targetPath, 0o755);
  }
  return true;
}

function listModelFiles() {
  if (!fs.existsSync(modelsDir)) {
    return [];
  }
  return fs.readdirSync(modelsDir).filter((entry) => entry.endsWith('.bin'));
}

function printStatus() {
  const binaryExists = fs.existsSync(targetBinaryPath);
  const modelFiles = listModelFiles();

  console.log('[prepare-dev-local-whisper-cpp] Local whisper.cpp dev status');
  console.log(`[prepare-dev-local-whisper-cpp] generatedRoot: ${generatedRoot}`);
  console.log(`[prepare-dev-local-whisper-cpp] binaryPath: ${targetBinaryPath}`);
  console.log(`[prepare-dev-local-whisper-cpp] binaryExists: ${binaryExists ? 'yes' : 'no'}`);
  console.log(`[prepare-dev-local-whisper-cpp] modelCount: ${modelFiles.length}`);
  if (modelFiles.length > 0) {
    for (const modelFile of modelFiles) {
      console.log(`[prepare-dev-local-whisper-cpp] model: ${path.join(modelsDir, modelFile)}`);
    }
  }
}

function main() {
  ensureDir(binDir);
  ensureDir(modelsDir);

  const providedBinaryPath = process.env.WHISPER_CPP_BIN;
  const providedModelPath = process.env.WHISPER_CPP_MODEL;

  if (copyIfProvided(providedBinaryPath, targetBinaryPath)) {
    console.log(`[prepare-dev-local-whisper-cpp] Copied binary to ${targetBinaryPath}`);
  }

  if (providedModelPath) {
    const resolvedModelPath = path.resolve(providedModelPath);
    if (!fs.existsSync(resolvedModelPath)) {
      throw new Error(`Model file does not exist: ${resolvedModelPath}`);
    }
    const targetModelPath = path.join(modelsDir, path.basename(resolvedModelPath));
    fs.copyFileSync(resolvedModelPath, targetModelPath);
    console.log(`[prepare-dev-local-whisper-cpp] Copied model to ${targetModelPath}`);
  }

  printStatus();
}

try {
  main();
} catch (error) {
  console.error('[prepare-dev-local-whisper-cpp] Failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
