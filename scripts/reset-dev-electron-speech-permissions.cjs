'use strict';

const { spawnSync } = require('child_process');

const ELECTRON_BUNDLE_ID = 'com.github.Electron';
const TCC_SERVICES = ['SpeechRecognition', 'Microphone'];

function resetService(service) {
  const result = spawnSync('/usr/bin/tccutil', ['reset', service, ELECTRON_BUNDLE_ID], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || result.error?.message || '').trim();
    console.warn(`[reset-dev-electron-speech-permissions] Failed to reset ${service}: ${message || 'unknown error'}`);
    return;
  }

  console.log(`[reset-dev-electron-speech-permissions] Reset ${service} permission for ${ELECTRON_BUNDLE_ID}`);
}

function main() {
  if (process.platform !== 'darwin') {
    console.log('[reset-dev-electron-speech-permissions] Skipped because the current platform is not macOS.');
    return;
  }

  for (const service of TCC_SERVICES) {
    resetService(service);
  }
}

main();
