import { VoiceFeatureController } from './voiceFeatureController';
import type { VoiceFeatureControllerDeps } from './voiceFeatureController';
import type { VoiceFeatureRuntimeHelpers } from './voiceFeatureRuntimeHelpers';
import type { VoiceFeatureWindowBridge } from './voiceFeatureWindowBridge';

export interface CreateVoiceFeatureControllerDeps
  extends Omit<
    VoiceFeatureControllerDeps,
    | 'getSpeechAvailabilityForVoice'
    | 'buildTtsAvailabilityForSettings'
    | 'buildLocalWhisperCppStatus'
    | 'buildLocalSherpaOnnxStatus'
    | 'buildLocalQwen3TtsStatus'
    | 'showMainWindow'
    | 'focusCoworkInputInMainWindow'
    | 'dispatchWakeDictationRequest'
  > {
  runtimeHelpers: VoiceFeatureRuntimeHelpers;
  windowBridge: VoiceFeatureWindowBridge;
}

export function createVoiceFeatureController(
  deps: CreateVoiceFeatureControllerDeps,
): VoiceFeatureController {
  const { runtimeHelpers, windowBridge, ...controllerDeps } = deps;
  return new VoiceFeatureController({
    ...controllerDeps,
    getSpeechAvailabilityForVoice: runtimeHelpers.getSpeechAvailabilityForVoice,
    buildTtsAvailabilityForSettings: runtimeHelpers.buildTtsAvailabilityForSettings,
    buildLocalWhisperCppStatus: runtimeHelpers.buildLocalWhisperCppStatus,
    buildLocalSherpaOnnxStatus: runtimeHelpers.buildLocalSherpaOnnxStatus,
    buildLocalQwen3TtsStatus: runtimeHelpers.buildLocalQwen3TtsStatus,
    showMainWindow: windowBridge.showMainWindow,
    focusCoworkInputInMainWindow: windowBridge.focusCoworkInputInMainWindow,
    dispatchWakeDictationRequest: windowBridge.dispatchWakeDictationRequest,
  });
}
