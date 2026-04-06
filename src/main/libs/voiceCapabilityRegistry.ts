import fs from 'fs';
import path from 'path';
import { app } from 'electron';
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
  type VoiceCapabilityManifest,
  type VoiceCapabilityMatrix,
  type VoiceCapabilityStatus,
  type VoiceConfig,
  type VoiceProviderStatus,
} from '../../shared/voice/constants';
import { inspectLocalWhisperCppRuntime } from './localWhisperCppSpeechService';
import { inspectLocalQwen3TtsRuntime } from './localQwen3TtsService';
import {
  inspectSherpaOnnxAsrRuntime,
} from './sherpaOnnxResourceService';

const MAC_SPEECH_HELPER_NAME = 'MacSpeechHelper';
const MAC_TTS_HELPER_NAME = 'MacTtsHelper';
const MAC_SPEECH_HELPER_DIR = 'macos-speech';
const VOICE_MANIFEST_NAME = 'voice-capabilities.json';

type CapabilityProviderSupport = Record<typeof VoiceCapability[keyof typeof VoiceCapability], VoiceProvider[]>;

const CAPABILITY_PROVIDER_SUPPORT: CapabilityProviderSupport = {
  [VoiceCapability.ManualStt]: [VoiceProvider.MacosNative, VoiceProvider.LocalSherpaOnnx, VoiceProvider.LocalWhisperCpp, VoiceProvider.CloudOpenAi, VoiceProvider.CloudAliyun, VoiceProvider.CloudVolcengine],
  [VoiceCapability.WakeInput]: [VoiceProvider.MacosNative],
  [VoiceCapability.FollowUpDictation]: [VoiceProvider.MacosNative, VoiceProvider.LocalSherpaOnnx, VoiceProvider.LocalWhisperCpp, VoiceProvider.CloudOpenAi, VoiceProvider.CloudAliyun, VoiceProvider.CloudVolcengine],
  [VoiceCapability.Tts]: [VoiceProvider.MacosNative, VoiceProvider.LocalQwen3Tts, VoiceProvider.CloudOpenAi, VoiceProvider.CloudAliyun, VoiceProvider.CloudVolcengine, VoiceProvider.CloudAzure],
};

const resolveProjectRoot = (): string => {
  const appPath = app.getAppPath();
  return appPath.endsWith('dist-electron')
    ? path.join(appPath, '..')
    : appPath;
};

const readJsonFile = <T>(filePath: string): T | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
};

const buildFallbackManifest = (platform: string, arch: string): VoiceCapabilityManifest => {
  const devHelperDir = path.join(resolveProjectRoot(), 'build', 'generated', MAC_SPEECH_HELPER_DIR);
  const speechHelperExists = fs.existsSync(path.join(devHelperDir, MAC_SPEECH_HELPER_NAME));
  const ttsHelperExists = fs.existsSync(path.join(devHelperDir, MAC_TTS_HELPER_NAME));
  const macosNativeCapabilities = {
    [VoiceCapability.ManualStt]: platform === 'darwin' && speechHelperExists,
    [VoiceCapability.WakeInput]: platform === 'darwin' && speechHelperExists,
    [VoiceCapability.FollowUpDictation]: platform === 'darwin' && speechHelperExists,
    [VoiceCapability.Tts]: platform === 'darwin' && ttsHelperExists,
  };

  return {
    schemaVersion: VoiceManifestSchemaVersion,
    platform,
    arch,
    providers: {
      [VoiceProvider.MacosNative]: {
        packaged: Object.values(macosNativeCapabilities).some(Boolean),
        capabilities: macosNativeCapabilities,
      },
      [VoiceProvider.LocalWhisperCpp]: {
        packaged: false,
        capabilities: {
          [VoiceCapability.ManualStt]: true,
          [VoiceCapability.FollowUpDictation]: true,
        },
      },
      [VoiceProvider.LocalSherpaOnnx]: {
        packaged: false,
        capabilities: {
          [VoiceCapability.ManualStt]: true,
          [VoiceCapability.FollowUpDictation]: true,
        },
      },
      [VoiceProvider.LocalQwen3Tts]: {
        packaged: false,
        capabilities: {
          [VoiceCapability.Tts]: true,
        },
      },
      [VoiceProvider.CloudOpenAi]: {
        packaged: true,
        capabilities: {
          [VoiceCapability.ManualStt]: true,
          [VoiceCapability.FollowUpDictation]: true,
          [VoiceCapability.Tts]: true,
        },
      },
      [VoiceProvider.CloudAliyun]: {
        packaged: true,
        capabilities: {
          [VoiceCapability.ManualStt]: true,
          [VoiceCapability.FollowUpDictation]: true,
          [VoiceCapability.Tts]: true,
        },
      },
      [VoiceProvider.CloudVolcengine]: {
        packaged: true,
        capabilities: {
          [VoiceCapability.ManualStt]: true,
          [VoiceCapability.FollowUpDictation]: true,
          [VoiceCapability.Tts]: true,
        },
      },
      [VoiceProvider.CloudAzure]: {
        packaged: true,
        capabilities: {
          [VoiceCapability.Tts]: true,
        },
      },
      [VoiceProvider.CloudCustom]: {
        packaged: false,
        capabilities: {},
      },
    },
    capabilities: macosNativeCapabilities,
  };
};

const resolveCapabilityReasonFromSpeech = (availability: SpeechAvailability): typeof VoiceCapabilityReason[keyof typeof VoiceCapabilityReason] => {
  if (availability.microphoneAuthorization === SpeechPermissionStatus.Denied) {
    return VoiceCapabilityReason.MissingMicrophonePermission;
  }
  if (availability.speechAuthorization === SpeechPermissionStatus.Denied) {
    return VoiceCapabilityReason.MissingSpeechPermission;
  }
  if (availability.microphoneAuthorization === SpeechPermissionStatus.NotDetermined) {
    return VoiceCapabilityReason.MissingMicrophonePermission;
  }
  if (availability.speechAuthorization === SpeechPermissionStatus.NotDetermined) {
    return VoiceCapabilityReason.MissingSpeechPermission;
  }
  return VoiceCapabilityReason.RuntimeUnavailable;
};

const isProviderAllowedForCapability = (capability: typeof VoiceCapability[keyof typeof VoiceCapability], provider: VoiceProvider): boolean => {
  return CAPABILITY_PROVIDER_SUPPORT[capability]?.includes(provider) ?? false;
};

const uniqueProviders = (providers: VoiceProvider[]): VoiceProvider[] => {
  return [...new Set(providers)];
};

const resolveLocalWhisperCppReason = (options: {
  platform: string;
  packaged: boolean;
  enabled: boolean;
  executableExists: boolean;
  modelExists: boolean;
}): typeof VoiceCapabilityReason[keyof typeof VoiceCapabilityReason] => {
  if (options.platform !== 'darwin') {
    return VoiceCapabilityReason.UnsupportedPlatform;
  }
  if (!options.packaged) {
    return VoiceCapabilityReason.ProviderNotPackaged;
  }
  if (!options.enabled) {
    return VoiceCapabilityReason.DisabledByConfig;
  }
  if (!options.executableExists) {
    return VoiceCapabilityReason.MissingLocalBinary;
  }
  if (!options.modelExists) {
    return VoiceCapabilityReason.MissingLocalModel;
  }
  return VoiceCapabilityReason.Available;
};

const resolveLocalSherpaOnnxReason = (options: {
  platform: string;
  packaged: boolean;
  enabled: boolean;
  ready: boolean;
}): typeof VoiceCapabilityReason[keyof typeof VoiceCapabilityReason] => {
  if (options.platform !== 'darwin' && options.platform !== 'win32') {
    return VoiceCapabilityReason.UnsupportedPlatform;
  }
  if (!options.packaged) {
    return VoiceCapabilityReason.ProviderNotPackaged;
  }
  if (!options.enabled) {
    return VoiceCapabilityReason.DisabledByConfig;
  }
  if (!options.ready) {
    return VoiceCapabilityReason.MissingLocalModel;
  }
  return VoiceCapabilityReason.Available;
};

const resolveCloudProviderReason = (options: {
  packaged: boolean;
  enabled: boolean;
  configured: boolean;
}): typeof VoiceCapabilityReason[keyof typeof VoiceCapabilityReason] => {
  if (!options.packaged) {
    return VoiceCapabilityReason.ProviderNotPackaged;
  }
  if (!options.enabled) {
    return VoiceCapabilityReason.DisabledByConfig;
  }
  if (!options.configured) {
    return VoiceCapabilityReason.ProviderConfigRequired;
  }
  return VoiceCapabilityReason.Available;
};

class VoiceProviderResolver {
  constructor(
    private readonly config: VoiceConfig,
    private readonly providerStatuses: Record<VoiceProvider, VoiceProviderStatus>,
  ) {}

  private buildCandidateProviders(capability: typeof VoiceCapability[keyof typeof VoiceCapability]): VoiceProvider[] {
    const configuredProvider = this.getConfiguredProvider(capability);
    const manualSttProvider = this.config.capabilities.manualStt.provider;
    const orderedNativeFirst = uniqueProviders([
      configuredProvider,
      capability === VoiceCapability.FollowUpDictation ? manualSttProvider : configuredProvider,
      VoiceProvider.MacosNative,
      VoiceProvider.LocalSherpaOnnx,
      VoiceProvider.LocalWhisperCpp,
      VoiceProvider.LocalQwen3Tts,
      VoiceProvider.CloudOpenAi,
      VoiceProvider.CloudAliyun,
      VoiceProvider.CloudVolcengine,
      VoiceProvider.CloudAzure,
      VoiceProvider.CloudCustom,
    ]);
    const orderedCloudFirst = uniqueProviders([
      configuredProvider,
      capability === VoiceCapability.FollowUpDictation ? manualSttProvider : configuredProvider,
      VoiceProvider.CloudOpenAi,
      VoiceProvider.CloudAliyun,
      VoiceProvider.CloudVolcengine,
      VoiceProvider.CloudAzure,
      VoiceProvider.CloudCustom,
      VoiceProvider.LocalSherpaOnnx,
      VoiceProvider.LocalWhisperCpp,
      VoiceProvider.LocalQwen3Tts,
      VoiceProvider.MacosNative,
    ]);

    if (this.config.strategy === VoiceStrategy.Manual) {
      return [configuredProvider];
    }
    return this.config.strategy === VoiceStrategy.CloudFirst ? orderedCloudFirst : orderedNativeFirst;
  }

  private getConfiguredProvider(capability: typeof VoiceCapability[keyof typeof VoiceCapability]): VoiceProvider {
    switch (capability) {
      case VoiceCapability.ManualStt:
        return this.config.capabilities.manualStt.provider;
      case VoiceCapability.WakeInput:
        return this.config.capabilities.wakeInput.provider;
      case VoiceCapability.FollowUpDictation:
        return this.config.capabilities.followUpDictation.provider;
      case VoiceCapability.Tts:
        return this.config.capabilities.tts.provider;
      default:
        return VoiceProvider.None;
    }
  }

  resolve(capability: typeof VoiceCapability[keyof typeof VoiceCapability]): VoiceProvider {
    const configuredProvider = this.getConfiguredProvider(capability);
    const candidates = this.buildCandidateProviders(capability).filter((provider) => {
      return provider !== VoiceProvider.None && isProviderAllowedForCapability(capability, provider);
    });

    for (const provider of candidates) {
      const status = this.providerStatuses[provider];
      if (!status || !status.platformSupported || !status.packaged) {
        continue;
      }
      if (provider !== VoiceProvider.MacosNative && !status.configured) {
        continue;
      }
      return provider;
    }

    return configuredProvider;
  }
}

export class VoiceCapabilityRegistry {
  constructor(private readonly options: {
    platform: string;
    arch: string;
    getVoiceConfig: () => VoiceConfig;
    getStoreFlag: (key: string) => boolean | undefined;
    getSpeechAvailability: () => Promise<SpeechAvailability>;
    getTtsAvailability: () => Promise<TtsAvailability>;
  }) {}

  private loadManifest(): VoiceCapabilityManifest {
    const manifestPath = app.isPackaged
      ? path.join(process.resourcesPath, VOICE_MANIFEST_NAME)
      : path.join(resolveProjectRoot(), 'build', 'generated', 'voice-capabilities', VOICE_MANIFEST_NAME);
    return readJsonFile<VoiceCapabilityManifest>(manifestPath)
      ?? buildFallbackManifest(this.options.platform, this.options.arch);
  }

  private buildProviderStatuses(manifest: VoiceCapabilityManifest, voiceConfig: VoiceConfig): Record<VoiceProvider, VoiceProviderStatus> {
    const macosNativePackaged = manifest.providers[VoiceProvider.MacosNative]?.packaged === true;
    const sherpaOnnxAsrRuntime = inspectSherpaOnnxAsrRuntime(voiceConfig.providers.sherpaOnnx);
    const sherpaOnnxPackaged = manifest.providers[VoiceProvider.LocalSherpaOnnx]?.packaged === true
      || sherpaOnnxAsrRuntime.ready;
    const sherpaOnnxEnabled = voiceConfig.providers.sherpaOnnx.enabled;
    const sherpaOnnxConfigured = sherpaOnnxEnabled && sherpaOnnxAsrRuntime.ready;
    const localWhisperCppRuntime = inspectLocalWhisperCppRuntime(voiceConfig.providers.localWhisperCpp);
    const localWhisperCppPackaged = manifest.providers[VoiceProvider.LocalWhisperCpp]?.packaged === true
      || localWhisperCppRuntime.executableExists;
    const localWhisperCppEnabled = voiceConfig.providers.localWhisperCpp.enabled;
    const localWhisperCppConfigured = voiceConfig.providers.localWhisperCpp.enabled
      && localWhisperCppRuntime.executableExists
      && localWhisperCppRuntime.modelExists;
    const localQwen3TtsRuntime = inspectLocalQwen3TtsRuntime(voiceConfig.providers.localQwen3Tts);
    const localQwen3TtsPackaged = manifest.providers[VoiceProvider.LocalQwen3Tts]?.packaged === true
      || localQwen3TtsRuntime.modelExists;
    const localQwen3TtsEnabled = voiceConfig.providers.localQwen3Tts.enabled;
    const localQwen3TtsConfigured = voiceConfig.providers.localQwen3Tts.enabled
      && localQwen3TtsRuntime.modelExists
      && localQwen3TtsRuntime.tokenizerExists
      && localQwen3TtsRuntime.pythonAvailable
      && localQwen3TtsRuntime.qwenTtsAvailable
      && localQwen3TtsRuntime.torchAvailable
      && localQwen3TtsRuntime.soundfileAvailable
      && localQwen3TtsRuntime.runnerWritable;
    const cloudOpenAiEnabled = voiceConfig.providers.openai.enabled;
    const cloudOpenAiConfigured = voiceConfig.providers.openai.enabled
      && Boolean(voiceConfig.providers.openai.apiKey.trim() && voiceConfig.providers.openai.baseUrl.trim());
    const cloudAliyunEnabled = voiceConfig.providers.aliyun.enabled;
    const cloudAliyunConfigured = voiceConfig.providers.aliyun.enabled
      && Boolean(voiceConfig.providers.aliyun.apiKey.trim() && voiceConfig.providers.aliyun.baseUrl.trim());
    const cloudVolcengineEnabled = voiceConfig.providers.volcengine.enabled;
    const cloudVolcengineConfigured = voiceConfig.providers.volcengine.enabled
      && Boolean(voiceConfig.providers.volcengine.appKey.trim() && voiceConfig.providers.volcengine.accessToken.trim());
    const cloudAzureEnabled = voiceConfig.providers.azure.enabled;
    const cloudAzureConfigured = voiceConfig.providers.azure.enabled
      && Boolean(voiceConfig.providers.azure.apiKey.trim() && (voiceConfig.providers.azure.region.trim() || voiceConfig.providers.azure.endpoint.trim()));
    const cloudCustomEnabled = voiceConfig.providers.custom.enabled;
    const cloudCustomConfigured = voiceConfig.providers.custom.enabled
      && Boolean(voiceConfig.providers.custom.baseUrl.trim());

    return {
      [VoiceProvider.None]: {
        provider: VoiceProvider.None,
        packaged: false,
        platformSupported: true,
        configured: true,
        reason: VoiceCapabilityReason.DisabledByConfig,
        capabilities: {},
      },
      [VoiceProvider.MacosNative]: {
        provider: VoiceProvider.MacosNative,
        packaged: macosNativePackaged,
        platformSupported: this.options.platform === 'darwin',
        configured: true,
        reason: this.options.platform !== 'darwin'
          ? VoiceCapabilityReason.UnsupportedPlatform
          : !macosNativePackaged
            ? VoiceCapabilityReason.ProviderNotPackaged
            : VoiceCapabilityReason.Available,
        capabilities: manifest.providers[VoiceProvider.MacosNative]?.capabilities ?? {},
      },
      [VoiceProvider.LocalWhisperCpp]: {
        provider: VoiceProvider.LocalWhisperCpp,
        packaged: localWhisperCppPackaged,
        platformSupported: this.options.platform === 'darwin',
        configured: localWhisperCppConfigured,
        reason: resolveLocalWhisperCppReason({
          platform: this.options.platform,
          packaged: localWhisperCppPackaged,
          enabled: localWhisperCppEnabled,
          executableExists: localWhisperCppRuntime.executableExists,
          modelExists: localWhisperCppRuntime.modelExists,
        }),
        capabilities: manifest.providers[VoiceProvider.LocalWhisperCpp]?.capabilities ?? {},
      },
      [VoiceProvider.LocalSherpaOnnx]: {
        provider: VoiceProvider.LocalSherpaOnnx,
        packaged: sherpaOnnxPackaged,
        platformSupported: this.options.platform === 'darwin' || this.options.platform === 'win32',
        configured: sherpaOnnxConfigured,
        reason: resolveLocalSherpaOnnxReason({
          platform: this.options.platform,
          packaged: sherpaOnnxPackaged,
          enabled: sherpaOnnxEnabled,
          ready: sherpaOnnxAsrRuntime.ready,
        }),
        capabilities: manifest.providers[VoiceProvider.LocalSherpaOnnx]?.capabilities ?? {},
      },
      [VoiceProvider.LocalQwen3Tts]: {
        provider: VoiceProvider.LocalQwen3Tts,
        packaged: localQwen3TtsPackaged,
        platformSupported: this.options.platform === 'darwin',
        configured: localQwen3TtsConfigured,
        reason: this.options.platform !== 'darwin'
          ? VoiceCapabilityReason.UnsupportedPlatform
          : !localQwen3TtsPackaged
            ? VoiceCapabilityReason.MissingLocalModel
            : !localQwen3TtsEnabled
              ? VoiceCapabilityReason.DisabledByConfig
              : !localQwen3TtsRuntime.tokenizerExists
                ? VoiceCapabilityReason.MissingLocalModel
              : !localQwen3TtsRuntime.pythonAvailable
                || !localQwen3TtsRuntime.qwenTtsAvailable
                || !localQwen3TtsRuntime.torchAvailable
                || !localQwen3TtsRuntime.soundfileAvailable
                || !localQwen3TtsRuntime.runnerWritable
                ? VoiceCapabilityReason.MissingLocalRuntime
                : VoiceCapabilityReason.Available,
        capabilities: manifest.providers[VoiceProvider.LocalQwen3Tts]?.capabilities ?? {},
      },
      [VoiceProvider.CloudOpenAi]: {
        provider: VoiceProvider.CloudOpenAi,
        packaged: manifest.providers[VoiceProvider.CloudOpenAi]?.packaged === true,
        platformSupported: true,
        configured: cloudOpenAiConfigured,
        reason: resolveCloudProviderReason({
          packaged: manifest.providers[VoiceProvider.CloudOpenAi]?.packaged === true,
          enabled: cloudOpenAiEnabled,
          configured: cloudOpenAiConfigured,
        }),
        capabilities: manifest.providers[VoiceProvider.CloudOpenAi]?.capabilities ?? {},
      },
      [VoiceProvider.CloudAliyun]: {
        provider: VoiceProvider.CloudAliyun,
        packaged: manifest.providers[VoiceProvider.CloudAliyun]?.packaged === true,
        platformSupported: true,
        configured: cloudAliyunConfigured,
        reason: resolveCloudProviderReason({
          packaged: manifest.providers[VoiceProvider.CloudAliyun]?.packaged === true,
          enabled: cloudAliyunEnabled,
          configured: cloudAliyunConfigured,
        }),
        capabilities: manifest.providers[VoiceProvider.CloudAliyun]?.capabilities ?? {},
      },
      [VoiceProvider.CloudVolcengine]: {
        provider: VoiceProvider.CloudVolcengine,
        packaged: manifest.providers[VoiceProvider.CloudVolcengine]?.packaged === true,
        platformSupported: true,
        configured: cloudVolcengineConfigured,
        reason: resolveCloudProviderReason({
          packaged: manifest.providers[VoiceProvider.CloudVolcengine]?.packaged === true,
          enabled: cloudVolcengineEnabled,
          configured: cloudVolcengineConfigured,
        }),
        capabilities: manifest.providers[VoiceProvider.CloudVolcengine]?.capabilities ?? {},
      },
      [VoiceProvider.CloudAzure]: {
        provider: VoiceProvider.CloudAzure,
        packaged: manifest.providers[VoiceProvider.CloudAzure]?.packaged === true,
        platformSupported: true,
        configured: cloudAzureConfigured,
        reason: resolveCloudProviderReason({
          packaged: manifest.providers[VoiceProvider.CloudAzure]?.packaged === true,
          enabled: cloudAzureEnabled,
          configured: cloudAzureConfigured,
        }),
        capabilities: manifest.providers[VoiceProvider.CloudAzure]?.capabilities ?? {},
      },
      [VoiceProvider.CloudCustom]: {
        provider: VoiceProvider.CloudCustom,
        packaged: manifest.providers[VoiceProvider.CloudCustom]?.packaged === true,
        platformSupported: true,
        configured: cloudCustomConfigured,
        reason: resolveCloudProviderReason({
          packaged: manifest.providers[VoiceProvider.CloudCustom]?.packaged === true,
          enabled: cloudCustomEnabled,
          configured: cloudCustomConfigured,
        }),
        capabilities: manifest.providers[VoiceProvider.CloudCustom]?.capabilities ?? {},
      },
    };
  }

  private buildCapabilityStatus(options: {
    capability: typeof VoiceCapability[keyof typeof VoiceCapability];
    selectedProvider: VoiceProvider;
    enabled: boolean;
    providerStatuses: Record<VoiceProvider, VoiceProviderStatus>;
    speechAvailability: SpeechAvailability;
    ttsAvailability: TtsAvailability;
  }): VoiceCapabilityStatus {
    const providerStatus = options.providerStatuses[options.selectedProvider] ?? options.providerStatuses[VoiceProvider.None];
    const packaged = providerStatus.packaged && (providerStatus.capabilities[options.capability] ?? true);
    const providerRuntimeStatus = this.resolveCapabilityRuntimeStatus(
      options.capability,
      options.selectedProvider,
      providerStatus,
    );
    const baseStatus: VoiceCapabilityStatus = {
      capability: options.capability,
      selectedProvider: options.selectedProvider,
      platformSupported: providerStatus.platformSupported,
      packaged,
      runtimeAvailable: false,
      enabled: options.enabled,
      reason: VoiceCapabilityReason.DisabledByConfig,
    };

    if (!options.enabled || options.selectedProvider === VoiceProvider.None) {
      return baseStatus;
    }
    if (!providerStatus.platformSupported) {
      return {
        ...baseStatus,
        reason: VoiceCapabilityReason.UnsupportedPlatform,
      };
    }
    if (!packaged) {
      return {
        ...baseStatus,
        reason: VoiceCapabilityReason.ProviderNotPackaged,
      };
    }
    if (options.selectedProvider !== VoiceProvider.MacosNative && !providerRuntimeStatus.configured) {
      return {
        ...baseStatus,
        reason: providerRuntimeStatus.reason === VoiceCapabilityReason.Available
          ? VoiceCapabilityReason.ProviderConfigRequired
          : providerRuntimeStatus.reason,
      };
    }

    if (options.selectedProvider === VoiceProvider.MacosNative) {
      if (options.capability === VoiceCapability.Tts) {
        return {
          ...baseStatus,
          runtimeAvailable: options.ttsAvailability.supported,
          reason: options.ttsAvailability.supported
            ? VoiceCapabilityReason.Available
            : VoiceCapabilityReason.RuntimeUnavailable,
        };
      }

      const featureFlagEnabled = this.options.getStoreFlag(SpeechFeatureFlagKey.MacInputEnabled) !== false;
      const speechAvailable = featureFlagEnabled
        && options.speechAvailability.supported
        && options.speechAvailability.permission === SpeechPermissionStatus.Granted;
      return {
        ...baseStatus,
        runtimeAvailable: speechAvailable,
        reason: speechAvailable
          ? VoiceCapabilityReason.Available
          : resolveCapabilityReasonFromSpeech(options.speechAvailability),
      };
    }

    return {
      ...baseStatus,
      runtimeAvailable: providerRuntimeStatus.configured,
      reason: providerRuntimeStatus.configured
        ? VoiceCapabilityReason.Available
        : providerRuntimeStatus.reason,
    };
  }

  private resolveCapabilityRuntimeStatus(
    capability: typeof VoiceCapability[keyof typeof VoiceCapability],
    selectedProvider: VoiceProvider,
    providerStatus: VoiceProviderStatus,
  ): {
    configured: boolean;
    reason: typeof VoiceCapabilityReason[keyof typeof VoiceCapabilityReason];
  } {
    if (selectedProvider !== VoiceProvider.LocalSherpaOnnx) {
      return {
        configured: providerStatus.configured,
        reason: providerStatus.reason,
      };
    }

    const voiceConfig = this.options.getVoiceConfig();
    if (!voiceConfig.providers.sherpaOnnx.enabled) {
      return {
        configured: false,
        reason: VoiceCapabilityReason.DisabledByConfig,
      };
    }

    if (capability === VoiceCapability.Tts) {
      return {
        configured: false,
        reason: VoiceCapabilityReason.UnsupportedPlatform,
      };
    }

    if (capability === VoiceCapability.ManualStt || capability === VoiceCapability.FollowUpDictation) {
      const asrRuntime = inspectSherpaOnnxAsrRuntime(voiceConfig.providers.sherpaOnnx);
      return {
        configured: asrRuntime.ready,
        reason: asrRuntime.ready ? VoiceCapabilityReason.Available : VoiceCapabilityReason.MissingLocalModel,
      };
    }

    return {
      configured: providerStatus.configured,
      reason: providerStatus.reason,
    };
  }

  async getCapabilityMatrix(): Promise<VoiceCapabilityMatrix> {
    const voiceConfig = this.options.getVoiceConfig();
    const manifest = this.loadManifest();
    const providerStatuses = this.buildProviderStatuses(manifest, voiceConfig);
    const resolver = new VoiceProviderResolver(voiceConfig, providerStatuses);
    const speechAvailability = await this.options.getSpeechAvailability();
    const ttsAvailability = await this.options.getTtsAvailability();

    return {
      schemaVersion: VoiceManifestSchemaVersion,
      platform: this.options.platform,
      arch: this.options.arch,
      strategy: voiceConfig.strategy,
      providers: providerStatuses,
      capabilities: {
        [VoiceCapability.ManualStt]: this.buildCapabilityStatus({
          capability: VoiceCapability.ManualStt,
          selectedProvider: resolver.resolve(VoiceCapability.ManualStt),
          enabled: voiceConfig.capabilities.manualStt.enabled,
          providerStatuses,
          speechAvailability,
          ttsAvailability,
        }),
        [VoiceCapability.WakeInput]: this.buildCapabilityStatus({
          capability: VoiceCapability.WakeInput,
          selectedProvider: resolver.resolve(VoiceCapability.WakeInput),
          enabled: voiceConfig.capabilities.wakeInput.enabled,
          providerStatuses,
          speechAvailability,
          ttsAvailability,
        }),
        [VoiceCapability.FollowUpDictation]: this.buildCapabilityStatus({
          capability: VoiceCapability.FollowUpDictation,
          selectedProvider: resolver.resolve(VoiceCapability.FollowUpDictation),
          enabled: voiceConfig.capabilities.followUpDictation.enabled,
          providerStatuses,
          speechAvailability,
          ttsAvailability,
        }),
        [VoiceCapability.Tts]: this.buildCapabilityStatus({
          capability: VoiceCapability.Tts,
          selectedProvider: resolver.resolve(VoiceCapability.Tts),
          enabled: voiceConfig.capabilities.tts.enabled,
          providerStatuses,
          speechAvailability,
          ttsAvailability,
        }),
      },
    };
  }
}
