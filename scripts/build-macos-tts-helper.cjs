'use strict';

const path = require('path');
const { existsSync, mkdirSync, chmodSync, statSync } = require('fs');
const { spawnSync } = require('child_process');

function normalizeArch(arch) {
  if (arch === 'x64') return 'x86_64';
  if (arch === 'arm64') return 'arm64';
  throw new Error(`Unsupported macOS TTS helper arch: ${arch}`);
}

function needsRebuild(sourcePath, outputPath) {
  if (!existsSync(outputPath)) {
    return true;
  }
  return statSync(sourcePath).mtimeMs > statSync(outputPath).mtimeMs;
}

function buildMacosTtsHelper(options = {}) {
  const repoRoot = path.resolve(__dirname, '..');
  const sourcePath = path.join(repoRoot, 'resources', 'macos-speech', 'MacTtsHelper.swift');
  const outputDir = options.outputDir
    ? path.resolve(options.outputDir)
    : path.join(repoRoot, 'build', 'generated', 'macos-speech');
  const outputPath = path.join(outputDir, 'MacTtsHelper');
  const arch = options.arch || process.arch;
  const targetArch = normalizeArch(arch);

  if (!existsSync(sourcePath)) {
    throw new Error(`Swift helper source not found: ${sourcePath}`);
  }

  mkdirSync(outputDir, { recursive: true });

  if (!needsRebuild(sourcePath, outputPath)) {
    return outputPath;
  }

  const minimumVersion = options.minimumVersion || process.env.MACOS_TTS_MIN_VERSION || '12.0';
  const targetTriple = `${targetArch}-apple-macos${minimumVersion}`;
  const moduleCachePath = path.join(outputDir, 'module-cache-tts');
  mkdirSync(moduleCachePath, { recursive: true });
  const args = [
    'swiftc',
    '-target', targetTriple,
    '-module-cache-path', moduleCachePath,
    '-O',
    sourcePath,
    '-framework', 'AVFoundation',
    '-o', outputPath,
  ];

  const result = spawnSync('xcrun', args, {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  if (result.status !== 0) {
    throw new Error(`Failed to build macOS TTS helper: ${result.stderr || result.error?.message || 'unknown error'}`);
  }

  chmodSync(outputPath, 0o755);
  return outputPath;
}

module.exports = {
  buildMacosTtsHelper,
};

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    let arch = process.arch;
    let outputDir;

    for (let index = 0; index < args.length; index += 1) {
      const value = args[index];
      if (value === '--arch') {
        arch = args[index + 1];
        index += 1;
      } else if (value === '--output-dir') {
        outputDir = args[index + 1];
        index += 1;
      }
    }

    const outputPath = buildMacosTtsHelper({ arch, outputDir });
    console.log(`[build-macos-tts-helper] Built helper: ${outputPath}`);
  } catch (error) {
    console.error('[build-macos-tts-helper] Failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
