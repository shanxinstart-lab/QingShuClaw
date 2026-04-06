import path from 'path';
import {
  SpeechErrorCode,
  SpeechPermissionStatus,
  type SpeechAvailability,
} from '../../shared/speech/constants';
import {
  VoiceProvider,
  type VoiceConfig,
  type VoiceLocalQwen3TtsStatus,
  type VoiceLocalSherpaOnnxStatus,
  type VoiceLocalWhisperCppStatus,
} from '../../shared/voice/constants';
import {
  inspectLocalWhisperCppRuntime,
  resolveLocalWhisperCppBinaryDirectory,
  resolveLocalWhisperCppExecutablePath,
  resolveLocalWhisperCppModelPath,
  resolveLocalWhisperCppModelsDirectory,
  resolveLocalWhisperCppResourceRoot,
} from './localWhisperCppSpeechService';
import {
  inspectLocalQwen3TtsRuntime,
  resolveLocalQwen3TtsModelPath,
  resolveLocalQwen3TtsRunnerPath,
  resolveLocalQwen3TtsTokenizerPath,
} from './localQwen3TtsService';
import {
  resolveInstalledLocalModelPath,
  resolveLocalQwen3TtsModelsRoot,
  resolveLocalVoiceModelsRoot,
} from './localVoiceModelManager';
import { inspectLocalSherpaOnnxStatus } from './sherpaOnnxResourceService';
import type { MacSpeechService } from './macSpeechService';
import type { TtsRouterService } from './ttsRouterService';
import {
  getVoiceConfigFromAppConfig,
  type AppConfigSettings,
} from './voiceFeatureConfig';

export interface VoiceFeatureRuntimeHelpers {
  getCurrentVoiceConfig: () => VoiceConfig;
  getSpeechAvailabilityForVoice: () => Promise<SpeechAvailability>;
  buildLocalWhisperCppStatus: (voiceConfig: VoiceConfig) => VoiceLocalWhisperCppStatus;
  buildLocalSherpaOnnxStatus: (voiceConfig: VoiceConfig) => VoiceLocalSherpaOnnxStatus;
  buildLocalQwen3TtsStatus: (voiceConfig: VoiceConfig) => VoiceLocalQwen3TtsStatus;
  buildTtsAvailabilityForSettings: (
    selectedProvider: VoiceProvider,
    baseAvailability: Awaited<ReturnType<TtsRouterService['getAvailability']>>,
  ) => Promise<Awaited<ReturnType<TtsRouterService['getAvailability']>>>;
}

export interface CreateVoiceFeatureRuntimeHelpersDeps {
  getAppConfig: () => AppConfigSettings | undefined;
  isMacSpeechInputEnabled: () => boolean;
  macSpeechService: MacSpeechService;
}

export function createVoiceFeatureRuntimeHelpers(
  deps: CreateVoiceFeatureRuntimeHelpersDeps,
): VoiceFeatureRuntimeHelpers {
  const buildDisabledSpeechAvailability = () => ({
    enabled: false,
    supported: false,
    platform: process.platform,
    permission: SpeechPermissionStatus.Unsupported,
    speechAuthorization: SpeechPermissionStatus.Unsupported,
    microphoneAuthorization: SpeechPermissionStatus.Unsupported,
    listening: false,
    error: SpeechErrorCode.HelperUnavailable,
  });

  const getCurrentVoiceConfig = (): VoiceConfig => {
    return getVoiceConfigFromAppConfig(deps.getAppConfig());
  };

  const buildLocalWhisperCppStatus = (voiceConfig: VoiceConfig): VoiceLocalWhisperCppStatus => {
    const runtime = inspectLocalWhisperCppRuntime(voiceConfig.providers.localWhisperCpp);
    const resourceRoot = resolveLocalWhisperCppResourceRoot();
    const binaryDirectory = resolveLocalWhisperCppBinaryDirectory();
    const modelsDirectory = resolveLocalWhisperCppModelsDirectory();
    const expectedExecutablePath = resolveLocalWhisperCppExecutablePath({
      ...voiceConfig.providers.localWhisperCpp,
      binaryPath: '',
    }) ?? path.join(binaryDirectory, process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli');
    const expectedModelPath = resolveLocalWhisperCppModelPath({
      ...voiceConfig.providers.localWhisperCpp,
      modelPath: '',
    }) ?? path.join(modelsDirectory, `ggml-${voiceConfig.providers.localWhisperCpp.modelName.trim() || 'base'}.bin`);

    return {
      resourceRoot,
      binaryDirectory,
      modelsDirectory,
      expectedExecutablePath,
      expectedModelPath,
      ...runtime,
      enabled: voiceConfig.providers.localWhisperCpp.enabled,
      ready: voiceConfig.providers.localWhisperCpp.enabled && runtime.executableExists && runtime.modelExists,
    };
  };

  const buildLocalSherpaOnnxStatus = (voiceConfig: VoiceConfig): VoiceLocalSherpaOnnxStatus => {
    return inspectLocalSherpaOnnxStatus(voiceConfig.providers.sherpaOnnx);
  };

  const buildLocalQwen3TtsStatus = (voiceConfig: VoiceConfig): VoiceLocalQwen3TtsStatus => {
    const runtime = inspectLocalQwen3TtsRuntime(voiceConfig.providers.localQwen3Tts);
    const modelsRoot = resolveLocalQwen3TtsModelsRoot();
    const expectedModelPath = resolveLocalQwen3TtsModelPath({
      ...voiceConfig.providers.localQwen3Tts,
      modelPath: '',
    }) ?? (voiceConfig.providers.localQwen3Tts.modelId.trim()
      ? (resolveInstalledLocalModelPath(voiceConfig.providers.localQwen3Tts.modelId.trim()) || '')
      : '');
    const expectedTokenizerPath = resolveLocalQwen3TtsTokenizerPath({
      ...voiceConfig.providers.localQwen3Tts,
      tokenizerPath: '',
    }) ?? (resolveInstalledLocalModelPath('qwen3_tts_tokenizer_12hz') || '');

    return {
      resourceRoot: resolveLocalVoiceModelsRoot(),
      modelsRoot,
      runnerScriptPath: resolveLocalQwen3TtsRunnerPath(),
      expectedModelPath,
      expectedTokenizerPath,
      modelPath: runtime.modelPath,
      tokenizerPath: runtime.tokenizerPath,
      modelExists: runtime.modelExists,
      tokenizerExists: runtime.tokenizerExists,
      pythonCommand: runtime.pythonCommand,
      pythonResolvedPath: runtime.pythonResolvedPath,
      pythonAvailable: runtime.pythonAvailable,
      pythonVersion: runtime.pythonVersion,
      qwenTtsAvailable: runtime.qwenTtsAvailable,
      torchAvailable: runtime.torchAvailable,
      soundfileAvailable: runtime.soundfileAvailable,
      huggingfaceCliAvailable: runtime.huggingfaceCliAvailable,
      huggingfaceHubAvailable: runtime.huggingfaceHubAvailable,
      runnerWritable: runtime.runnerWritable,
      runtimeIssues: runtime.runtimeIssues,
      enabled: voiceConfig.providers.localQwen3Tts.enabled,
      ready: voiceConfig.providers.localQwen3Tts.enabled
        && runtime.modelExists
        && runtime.tokenizerExists
        && runtime.pythonAvailable
        && runtime.qwenTtsAvailable
        && runtime.torchAvailable
        && runtime.soundfileAvailable
        && runtime.runnerWritable,
    };
  };

  const getSpeechAvailabilityForVoice = async () => {
    if (!deps.isMacSpeechInputEnabled()) {
      return buildDisabledSpeechAvailability();
    }
    return deps.macSpeechService.getAvailability();
  };

  const buildTtsAvailabilityForSettings = async (
    selectedProvider: VoiceProvider,
    baseAvailability: Awaited<ReturnType<TtsRouterService['getAvailability']>>,
  ): Promise<Awaited<ReturnType<TtsRouterService['getAvailability']>>> => {
    return {
      ...baseAvailability,
      requestedProvider: selectedProvider,
      actualProvider: selectedProvider,
      fallbackActive: false,
    };
  };

  return {
    getCurrentVoiceConfig,
    getSpeechAvailabilityForVoice,
    buildLocalWhisperCppStatus,
    buildLocalSherpaOnnxStatus,
    buildLocalQwen3TtsStatus,
    buildTtsAvailabilityForSettings,
  };
}
