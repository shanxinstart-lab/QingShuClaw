'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const LOG_DIR = path.join(process.cwd(), 'build', 'logs');
const DEFAULT_LOG_NAME = 'vite-build.log';

function ensureLogDir() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    debug: args.has('--debug'),
    profile: args.has('--profile'),
    mode: (() => {
      const index = argv.indexOf('--mode');
      return index >= 0 ? argv[index + 1] : null;
    })(),
  };
}

function writeBanner(stream, lines) {
  for (const line of lines) {
    stream.write(line + '\n');
  }
}

async function main() {
  ensureLogDir();
  const options = parseArgs(process.argv);
  const logPath = path.join(LOG_DIR, DEFAULT_LOG_NAME);
  const logStream = fs.createWriteStream(logPath, { flags: 'w' });
  const vitePackageJsonPath = require.resolve('vite/package.json');
  const vitePackageJson = JSON.parse(fs.readFileSync(vitePackageJsonPath, 'utf8'));
  const viteBin = path.resolve(path.dirname(vitePackageJsonPath), vitePackageJson.bin.vite);
  const viteArgs = [viteBin, 'build'];

  if (options.debug) {
    viteArgs.push('--debug');
  }
  if (options.profile) {
    viteArgs.push('--profile');
  }
  if (options.mode) {
    viteArgs.push('--mode', options.mode);
  }

  const env = {
    ...process.env,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, '--trace-uncaught', '--trace-warnings'].filter(Boolean).join(' '),
  };
  if (options.debug) {
    env.DEBUG = process.env.DEBUG || 'vite:*';
  }

  const metadata = [
    '[vite-build-debug] Starting Vite build wrapper.',
    '[vite-build-debug] cwd: ' + process.cwd(),
    '[vite-build-debug] node: ' + process.version,
    '[vite-build-debug] log: ' + logPath,
    '[vite-build-debug] args: ' + JSON.stringify(viteArgs.slice(1)),
  ];
  writeBanner(process.stdout, metadata);
  writeBanner(logStream, metadata);

  const child = spawn(process.execPath, viteArgs, {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const forward = (source, target, prefix) => {
    source.on('data', (chunk) => {
      const text = chunk.toString();
      target.write(text);
      logStream.write(prefix + text);
    });
  };

  forward(child.stdout, process.stdout, '');
  forward(child.stderr, process.stderr, '');

  child.on('error', (error) => {
    const message = '[vite-build-debug] Failed to spawn Vite build: ' + (error && error.stack ? error.stack : String(error)) + '\n';
    process.stderr.write(message);
    logStream.write(message);
  });

  const runtimeErrors = [];
  const captureRuntimeError = (label) => (error) => {
    const message = '[vite-build-debug] ' + label + ': ' + (error && error.stack ? error.stack : String(error));
    runtimeErrors.push(message);
    process.stderr.write(message + '\n');
    logStream.write(message + '\n');
  };

  process.on('uncaughtException', captureRuntimeError('uncaughtException'));
  process.on('unhandledRejection', captureRuntimeError('unhandledRejection'));
  process.on('warning', (warning) => {
    const message = '[vite-build-debug] warning: ' + (warning && warning.stack ? warning.stack : String(warning));
    process.stderr.write(message + '\n');
    logStream.write(message + '\n');
  });

  child.on('exit', (code, signal) => {
    const summary = '[vite-build-debug] child exit: code=' + String(code) + ' signal=' + String(signal);
    process.stdout.write(summary + '\n');
    logStream.write(summary + '\n');
  });

  child.on('close', (code, signal) => {
    const summary = '[vite-build-debug] child close: code=' + String(code) + ' signal=' + String(signal);
    process.stdout.write(summary + '\n');
    logStream.write(summary + '\n');
    const finalLine = '[vite-build-debug] full log saved to ' + logPath;
    process.stdout.write(finalLine + '\n');
    logStream.write(finalLine + '\n');
    logStream.end(() => {
      if (signal || code !== 0 || runtimeErrors.length > 0) {
        process.exitCode = 1;
        return;
      }
      process.exitCode = 0;
    });
  });
}

void main().catch((error) => {
  const message = '[vite-build-debug] Wrapper failed: ' + (error && error.stack ? error.stack : String(error));
  process.stderr.write(message + '\n');
  process.exitCode = 1;
});
