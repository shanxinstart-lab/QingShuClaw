import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  SpeechFeatureFlagKey,
  SpeechPermissionStatus,
  type SpeechAvailability,
} from '../../shared/speech/constants';
import type { TtsAvailability } from '../../shared/tts/constants';
import {
  VoiceCapability,
  VoiceCapabilityReason,
  VoiceManifestSchemaVersion,
  VoiceProvider,
  VoiceStrategy,
  mergeVoiceConfig,
  type VoiceCapabilityManifest,
  type VoiceConfig,
} from '../../shared/voice/constants';

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

import { VoiceCapabilityRegistry } from './voiceCapabilityRegistry';

const GRANTED_SPEECH_AVAILABILITY: SpeechAvailability = {
  supported: true,
  platform: 'darwin',
  permission: SpeechPermissionStatus.Granted,
  speechAuthorization: SpeechPermissionStatus.Granted,
  microphoneAuthorization: SpeechPermissionStatus.Granted,
  listening: false,
};

const AVAILABLE_TTS: TtsAvailability = {
  supported: true,
  platform: 'darwin',
  speaking: false,
};

describe('VoiceCapabilityRegistry', () => {
  let tempRoot = '';

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qingshu-voice-registry-'));
    electronState.isPackaged = false;
    electronState.appPath = path.join(tempRoot, 'dist-electron');
    electronState.tempPath = tempRoot;
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const writeManifest = (manifest: VoiceCapabilityManifest) => {
    const manifestPath = path.join(
      tempRoot,
      'build',
      'generated',
      'voice-capabilities',
      'voice-capabilities.json',
    );
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  };

  const createRegistry = (voiceConfig: VoiceConfig) => {
    return new VoiceCapabilityRegistry({
      platform: 'darwin',
      arch: 'arm64',
      getVoiceConfig: () => voiceConfig,
      getStoreFlag: (key: string) => key === SpeechFeatureFlagKey.MacInputEnabled ? true : undefined,
      getSpeechAvailability: async () => GRANTED_SPEECH_AVAILABILITY,
      getTtsAvailability: async () => AVAILABLE_TTS,
    });
  };

  test('reports missing local binary when packaged provider is enabled without executable', async () => {
    writeManifest({
      schemaVersion: VoiceManifestSchemaVersion,
      platform: 'darwin',
      arch: 'arm64',
      providers: {
        [VoiceProvider.MacosNative]: { packaged: true, capabilities: {} },
        [VoiceProvider.LocalWhisperCpp]: {
          packaged: true,
          capabilities: {
            [VoiceCapability.ManualStt]: true,
            [VoiceCapability.FollowUpDictation]: true,
          },
        },
        [VoiceProvider.CloudOpenAi]: { packaged: true, capabilities: {} },
        [VoiceProvider.CloudAliyun]: { packaged: true, capabilities: {} },
        [VoiceProvider.CloudVolcengine]: { packaged: true, capabilities: {} },
        [VoiceProvider.CloudAzure]: { packaged: true, capabilities: {} },
        [VoiceProvider.CloudCustom]: { packaged: false, capabilities: {} },
      },
      capabilities: {},
    });

    const voiceConfig = mergeVoiceConfig({
      strategy: VoiceStrategy.Manual,
      capabilities: {
        manualStt: {
          enabled: true,
          provider: VoiceProvider.LocalWhisperCpp,
        },
      },
      providers: {
        localWhisperCpp: {
          enabled: true,
          modelName: 'base',
        },
      },
    });

    const matrix = await createRegistry(voiceConfig).getCapabilityMatrix();

    expect(matrix.providers[VoiceProvider.LocalWhisperCpp].reason).toBe(VoiceCapabilityReason.MissingLocalBinary);
    expect(matrix.capabilities[VoiceCapability.ManualStt].selectedProvider).toBe(VoiceProvider.LocalWhisperCpp);
    expect(matrix.capabilities[VoiceCapability.ManualStt].runtimeAvailable).toBe(false);
    expect(matrix.capabilities[VoiceCapability.ManualStt].reason).toBe(VoiceCapabilityReason.MissingLocalBinary);
  });

  test('reports missing local model when executable exists but model is absent', async () => {
    const binaryPath = path.join(
      tempRoot,
      'build',
      'generated',
      'local-whisper-cpp',
      'bin',
      process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli',
    );
    fs.mkdirSync(path.dirname(binaryPath), { recursive: true });
    fs.writeFileSync(binaryPath, '#!/bin/sh\n');

    const voiceConfig = mergeVoiceConfig({
      strategy: VoiceStrategy.Manual,
      capabilities: {
        manualStt: {
          enabled: true,
          provider: VoiceProvider.LocalWhisperCpp,
        },
      },
      providers: {
        localWhisperCpp: {
          enabled: true,
          modelName: 'base',
        },
      },
    });

    const matrix = await createRegistry(voiceConfig).getCapabilityMatrix();

    expect(matrix.providers[VoiceProvider.LocalWhisperCpp].packaged).toBe(true);
    expect(matrix.providers[VoiceProvider.LocalWhisperCpp].reason).toBe(VoiceCapabilityReason.MissingLocalModel);
    expect(matrix.capabilities[VoiceCapability.ManualStt].reason).toBe(VoiceCapabilityReason.MissingLocalModel);
  });
});
