import { beforeEach, describe, expect, test, vi } from 'vitest';

const controllerState = vi.hoisted(() => ({
  constructorSpy: vi.fn(),
}));

vi.mock('./voiceFeatureController', () => {
  class MockVoiceFeatureController {
    constructor(deps: unknown) {
      controllerState.constructorSpy(deps);
    }
  }

  return {
    VoiceFeatureController: MockVoiceFeatureController,
  };
});

import { createVoiceFeatureController } from './voiceFeatureFactory';
import { VoiceFeatureController } from './voiceFeatureController';

describe('voiceFeatureFactory', () => {
  beforeEach(() => {
    controllerState.constructorSpy.mockReset();
  });

  test('wires runtime helpers and window bridge into controller deps', () => {
    const getSpeechAvailabilityForVoice = vi.fn();
    const buildTtsAvailabilityForSettings = vi.fn();
    const buildLocalWhisperCppStatus = vi.fn();
    const buildLocalSherpaOnnxStatus = vi.fn();
    const buildLocalQwen3TtsStatus = vi.fn();
    const showMainWindow = vi.fn();
    const focusCoworkInputInMainWindow = vi.fn();
    const dispatchWakeDictationRequest = vi.fn();
    const setAppConfig = vi.fn();

    const controller = createVoiceFeatureController({
      macSpeechService: {} as any,
      sherpaOnnxSpeechService: {} as any,
      wakeInputService: {} as any,
      sherpaOnnxWakeService: {} as any,
      ttsRouterService: {} as any,
      speechRouterService: {} as any,
      voiceCapabilityRegistry: {} as any,
      localVoiceModelManager: {} as any,
      localWhisperCppSpeechService: {} as any,
      localQwen3TtsService: {} as any,
      openAiSpeechService: {} as any,
      openAiVoiceService: {} as any,
      aliyunSpeechService: {} as any,
      aliyunVoiceService: {} as any,
      volcengineSpeechService: {} as any,
      volcengineVoiceService: {} as any,
      azureVoiceService: {} as any,
      getAppConfig: () => undefined,
      setAppConfig,
      isMacSpeechInputEnabled: () => true,
      runtimeHelpers: {
        getCurrentVoiceConfig: vi.fn(),
        getSpeechAvailabilityForVoice,
        buildTtsAvailabilityForSettings,
        buildLocalWhisperCppStatus,
        buildLocalSherpaOnnxStatus,
        buildLocalQwen3TtsStatus,
      },
      windowBridge: {
        showMainWindow,
        focusCoworkInputInMainWindow,
        dispatchWakeDictationRequest,
      },
    });

    expect(controller).toBeInstanceOf(VoiceFeatureController);
    expect(controllerState.constructorSpy).toHaveBeenCalledTimes(1);

    const injectedDeps = controllerState.constructorSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(injectedDeps.getSpeechAvailabilityForVoice).toBe(getSpeechAvailabilityForVoice);
    expect(injectedDeps.buildTtsAvailabilityForSettings).toBe(buildTtsAvailabilityForSettings);
    expect(injectedDeps.buildLocalWhisperCppStatus).toBe(buildLocalWhisperCppStatus);
    expect(injectedDeps.buildLocalSherpaOnnxStatus).toBe(buildLocalSherpaOnnxStatus);
    expect(injectedDeps.buildLocalQwen3TtsStatus).toBe(buildLocalQwen3TtsStatus);
    expect(injectedDeps.showMainWindow).toBe(showMainWindow);
    expect(injectedDeps.focusCoworkInputInMainWindow).toBe(focusCoworkInputInMainWindow);
    expect(injectedDeps.dispatchWakeDictationRequest).toBe(dispatchWakeDictationRequest);
    expect(injectedDeps.setAppConfig).toBe(setAppConfig);
    expect(injectedDeps.runtimeHelpers).toBeUndefined();
    expect(injectedDeps.windowBridge).toBeUndefined();
  });
});
