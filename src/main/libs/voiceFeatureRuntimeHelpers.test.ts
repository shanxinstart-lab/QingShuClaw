import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  DEFAULT_VOICE_CONFIG,
  VoiceProvider,
} from '../../shared/voice/constants';
import {
  SpeechErrorCode,
  SpeechPermissionStatus,
} from '../../shared/speech/constants';

const whisperState = vi.hoisted(() => ({
  inspectRuntime: vi.fn(),
  resolveBinaryDirectory: vi.fn(),
  resolveExecutablePath: vi.fn(),
  resolveModelPath: vi.fn(),
  resolveModelsDirectory: vi.fn(),
  resolveResourceRoot: vi.fn(),
}));

const qwenState = vi.hoisted(() => ({
  inspectRuntime: vi.fn(),
  resolveModelPath: vi.fn(),
  resolveRunnerPath: vi.fn(),
  resolveTokenizerPath: vi.fn(),
}));

const localModelState = vi.hoisted(() => ({
  resolveInstalledLocalModelPath: vi.fn(),
  resolveLocalQwen3TtsModelsRoot: vi.fn(),
  resolveLocalVoiceModelsRoot: vi.fn(),
}));

const sherpaState = vi.hoisted(() => ({
  inspectStatus: vi.fn(),
}));

vi.mock('./localWhisperCppSpeechService', () => ({
  inspectLocalWhisperCppRuntime: whisperState.inspectRuntime,
  resolveLocalWhisperCppBinaryDirectory: whisperState.resolveBinaryDirectory,
  resolveLocalWhisperCppExecutablePath: whisperState.resolveExecutablePath,
  resolveLocalWhisperCppModelPath: whisperState.resolveModelPath,
  resolveLocalWhisperCppModelsDirectory: whisperState.resolveModelsDirectory,
  resolveLocalWhisperCppResourceRoot: whisperState.resolveResourceRoot,
}));

vi.mock('./localQwen3TtsService', () => ({
  inspectLocalQwen3TtsRuntime: qwenState.inspectRuntime,
  resolveLocalQwen3TtsModelPath: qwenState.resolveModelPath,
  resolveLocalQwen3TtsRunnerPath: qwenState.resolveRunnerPath,
  resolveLocalQwen3TtsTokenizerPath: qwenState.resolveTokenizerPath,
}));

vi.mock('./localVoiceModelManager', () => ({
  resolveInstalledLocalModelPath: localModelState.resolveInstalledLocalModelPath,
  resolveLocalQwen3TtsModelsRoot: localModelState.resolveLocalQwen3TtsModelsRoot,
  resolveLocalVoiceModelsRoot: localModelState.resolveLocalVoiceModelsRoot,
}));

vi.mock('./sherpaOnnxResourceService', () => ({
  inspectLocalSherpaOnnxStatus: sherpaState.inspectStatus,
}));

import { createVoiceFeatureRuntimeHelpers } from './voiceFeatureRuntimeHelpers';

describe('voiceFeatureRuntimeHelpers', () => {
  beforeEach(() => {
    whisperState.inspectRuntime.mockReset();
    whisperState.resolveBinaryDirectory.mockReset();
    whisperState.resolveExecutablePath.mockReset();
    whisperState.resolveModelPath.mockReset();
    whisperState.resolveModelsDirectory.mockReset();
    whisperState.resolveResourceRoot.mockReset();
    qwenState.inspectRuntime.mockReset();
    qwenState.resolveModelPath.mockReset();
    qwenState.resolveRunnerPath.mockReset();
    qwenState.resolveTokenizerPath.mockReset();
    localModelState.resolveInstalledLocalModelPath.mockReset();
    localModelState.resolveLocalQwen3TtsModelsRoot.mockReset();
    localModelState.resolveLocalVoiceModelsRoot.mockReset();
    sherpaState.inspectStatus.mockReset();
  });

  test('returns disabled speech availability when mac speech input is turned off', async () => {
    const macSpeechService = {
      getAvailability: vi.fn(),
    };

    const helpers = createVoiceFeatureRuntimeHelpers({
      getAppConfig: () => undefined,
      isMacSpeechInputEnabled: () => false,
      macSpeechService: macSpeechService as any,
    });

    await expect(helpers.getSpeechAvailabilityForVoice()).resolves.toMatchObject({
      enabled: false,
      supported: false,
      permission: SpeechPermissionStatus.Unsupported,
      speechAuthorization: SpeechPermissionStatus.Unsupported,
      microphoneAuthorization: SpeechPermissionStatus.Unsupported,
      error: SpeechErrorCode.HelperUnavailable,
    });
    expect(macSpeechService.getAvailability).not.toHaveBeenCalled();
  });

  test('reads current voice config and delegates mac speech availability when enabled', async () => {
    const availability = {
      supported: true,
      platform: 'darwin',
      permission: SpeechPermissionStatus.Granted,
      speechAuthorization: SpeechPermissionStatus.Granted,
      microphoneAuthorization: SpeechPermissionStatus.Granted,
      listening: false,
    };
    const macSpeechService = {
      getAvailability: vi.fn().mockResolvedValue(availability),
    };

    const helpers = createVoiceFeatureRuntimeHelpers({
      getAppConfig: () => ({
        voice: {
          capabilities: {
            manualStt: {
              enabled: false,
              provider: VoiceProvider.MacosNative,
            },
          },
        },
      }),
      isMacSpeechInputEnabled: () => true,
      macSpeechService: macSpeechService as any,
    });

    expect(helpers.getCurrentVoiceConfig().capabilities.manualStt.enabled).toBe(false);
    await expect(helpers.getSpeechAvailabilityForVoice()).resolves.toEqual(availability);
    expect(macSpeechService.getAvailability).toHaveBeenCalledTimes(1);
  });

  test('builds local whisper status from runtime inspection and resolver outputs', () => {
    whisperState.inspectRuntime.mockReturnValue({
      executableExists: true,
      modelExists: true,
      executablePath: '/runtime/whisper-cli',
      modelPath: '/runtime/model.bin',
      runtimeIssues: [],
    });
    whisperState.resolveResourceRoot.mockReturnValue('/resource-root');
    whisperState.resolveBinaryDirectory.mockReturnValue('/bin-root');
    whisperState.resolveModelsDirectory.mockReturnValue('/models-root');
    whisperState.resolveExecutablePath.mockReturnValue('/expected/whisper-cli');
    whisperState.resolveModelPath.mockReturnValue('/expected/model.bin');

    const helpers = createVoiceFeatureRuntimeHelpers({
      getAppConfig: () => undefined,
      isMacSpeechInputEnabled: () => true,
      macSpeechService: { getAvailability: vi.fn() } as any,
    });

    const status = helpers.buildLocalWhisperCppStatus({
      ...DEFAULT_VOICE_CONFIG,
      providers: {
        ...DEFAULT_VOICE_CONFIG.providers,
        localWhisperCpp: {
          ...DEFAULT_VOICE_CONFIG.providers.localWhisperCpp,
          enabled: true,
          modelName: 'base',
        },
      },
    });

    expect(status.resourceRoot).toBe('/resource-root');
    expect(status.binaryDirectory).toBe('/bin-root');
    expect(status.modelsDirectory).toBe('/models-root');
    expect(status.expectedExecutablePath).toBe('/expected/whisper-cli');
    expect(status.expectedModelPath).toBe('/expected/model.bin');
    expect(status.ready).toBe(true);
  });

  test('delegates sherpa inspection and enriches qwen status using resolver outputs', () => {
    sherpaState.inspectStatus.mockReturnValue({
      resourceRoot: '/sherpa-root',
      wakeResourceRoot: '/sherpa-wake-root',
      wakeModelId: DEFAULT_VOICE_CONFIG.providers.sherpaOnnx.wakeModelId,
      wakeReady: true,
      ready: true,
      enabled: true,
    });
    qwenState.inspectRuntime.mockReturnValue({
      modelPath: '/runtime/qwen-model',
      tokenizerPath: '/runtime/tokenizer',
      modelExists: true,
      tokenizerExists: true,
      pythonCommand: 'python3',
      pythonResolvedPath: '/usr/bin/python3',
      pythonAvailable: true,
      pythonVersion: '3.11.0',
      qwenTtsAvailable: true,
      torchAvailable: true,
      soundfileAvailable: true,
      huggingfaceCliAvailable: true,
      huggingfaceHubAvailable: true,
      runnerWritable: true,
      runtimeIssues: [],
    });
    localModelState.resolveLocalVoiceModelsRoot.mockReturnValue('/voice-model-root');
    localModelState.resolveLocalQwen3TtsModelsRoot.mockReturnValue('/qwen-models-root');
    qwenState.resolveRunnerPath.mockReturnValue('/runner.py');
    qwenState.resolveModelPath.mockReturnValue('/expected/qwen-model');
    qwenState.resolveTokenizerPath.mockReturnValue('/expected/tokenizer');
    localModelState.resolveInstalledLocalModelPath.mockImplementation((modelId: string) => {
      return `/installed/${modelId}`;
    });

    const helpers = createVoiceFeatureRuntimeHelpers({
      getAppConfig: () => undefined,
      isMacSpeechInputEnabled: () => true,
      macSpeechService: { getAvailability: vi.fn() } as any,
    });

    const sherpaStatus = helpers.buildLocalSherpaOnnxStatus(DEFAULT_VOICE_CONFIG);
    expect(sherpaStatus).toEqual({
      resourceRoot: '/sherpa-root',
      wakeResourceRoot: '/sherpa-wake-root',
      wakeModelId: DEFAULT_VOICE_CONFIG.providers.sherpaOnnx.wakeModelId,
      wakeReady: true,
      ready: true,
      enabled: true,
    });

    const qwenStatus = helpers.buildLocalQwen3TtsStatus({
      ...DEFAULT_VOICE_CONFIG,
      providers: {
        ...DEFAULT_VOICE_CONFIG.providers,
        localQwen3Tts: {
          ...DEFAULT_VOICE_CONFIG.providers.localQwen3Tts,
          enabled: true,
          modelId: 'qwen-model-id',
        },
      },
    });

    expect(qwenStatus.resourceRoot).toBe('/voice-model-root');
    expect(qwenStatus.modelsRoot).toBe('/qwen-models-root');
    expect(qwenStatus.runnerScriptPath).toBe('/runner.py');
    expect(qwenStatus.expectedModelPath).toBe('/expected/qwen-model');
    expect(qwenStatus.expectedTokenizerPath).toBe('/expected/tokenizer');
    expect(qwenStatus.ready).toBe(true);
  });

  test('adds selected provider metadata when building tts availability for settings', async () => {
    const helpers = createVoiceFeatureRuntimeHelpers({
      getAppConfig: () => undefined,
      isMacSpeechInputEnabled: () => true,
      macSpeechService: { getAvailability: vi.fn() } as any,
    });

    await expect(helpers.buildTtsAvailabilityForSettings(VoiceProvider.CloudOpenAi, {
      supported: true,
      platform: 'darwin',
      speaking: false,
    })).resolves.toEqual({
      supported: true,
      platform: 'darwin',
      speaking: false,
      requestedProvider: VoiceProvider.CloudOpenAi,
      actualProvider: VoiceProvider.CloudOpenAi,
      fallbackActive: false,
    });
  });
});
