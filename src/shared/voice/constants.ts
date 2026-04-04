import type { WakeInputConfig } from '../wakeInput/constants';
import { TtsEngine } from '../tts/constants';

export const VoiceCapability = {
  ManualStt: 'manual_stt',
  WakeInput: 'wake_input',
  FollowUpDictation: 'follow_up_dictation',
  Tts: 'tts',
} as const;
export type VoiceCapability = typeof VoiceCapability[keyof typeof VoiceCapability];

export const VoiceProvider = {
  None: 'none',
  MacosNative: 'macos_native',
  LocalWhisperCpp: 'local_whisper_cpp',
  LocalQwen3Tts: 'local_qwen3_tts',
  CloudOpenAi: 'cloud_openai',
  CloudAliyun: 'cloud_aliyun',
  CloudVolcengine: 'cloud_volcengine',
  CloudAzure: 'cloud_azure',
  CloudCustom: 'cloud_custom',
} as const;
export type VoiceProvider = typeof VoiceProvider[keyof typeof VoiceProvider];

export const VoiceStrategy = {
  Manual: 'manual',
  NativeFirst: 'native_first',
  CloudFirst: 'cloud_first',
} as const;
export type VoiceStrategy = typeof VoiceStrategy[keyof typeof VoiceStrategy];

export const VoiceCapabilityReason = {
  UnsupportedPlatform: 'unsupported_platform',
  ProviderNotPackaged: 'provider_not_packaged',
  MissingMicrophonePermission: 'missing_microphone_permission',
  MissingSpeechPermission: 'missing_speech_permission',
  MissingLocalBinary: 'missing_local_binary',
  MissingLocalModel: 'missing_local_model',
  MissingLocalRuntime: 'missing_local_runtime',
  DisabledByConfig: 'disabled_by_config',
  ProviderConfigRequired: 'provider_config_required',
  RuntimeUnavailable: 'runtime_unavailable',
  Available: 'available',
} as const;
export type VoiceCapabilityReason = typeof VoiceCapabilityReason[keyof typeof VoiceCapabilityReason];

export const VoiceIpcChannel = {
  GetCapabilityMatrix: 'voice:getCapabilityMatrix',
  GetConfig: 'voice:getConfig',
  GetLocalWhisperCppStatus: 'voice:getLocalWhisperCppStatus',
  GetLocalQwen3TtsStatus: 'voice:getLocalQwen3TtsStatus',
  EnsureLocalWhisperCppDirectories: 'voice:ensureLocalWhisperCppDirectories',
  GetLocalModelLibrary: 'voice:getLocalModelLibrary',
  InstallLocalModel: 'voice:installLocalModel',
  CancelLocalModelInstall: 'voice:cancelLocalModelInstall',
  UpdateConfig: 'voice:updateConfig',
  CapabilityChanged: 'voice:capabilityChanged',
  LocalModelLibraryChanged: 'voice:localModelLibraryChanged',
} as const;

export const VoiceManifestSchemaVersion = 1;

export interface LegacySpeechInputConfig {
  stopCommand: string;
  submitCommand: string;
}

export interface LegacyTtsConfig {
  enabled: boolean;
  autoPlayAssistantReply: boolean;
  engine: TtsEngine;
  voiceId: string;
  rate: number;
  volume: number;
}

export interface VoiceCapabilityConfig {
  enabled: boolean;
  provider: VoiceProvider;
}

export interface VoiceTtsCapabilityConfig extends VoiceCapabilityConfig {
  autoPlayAssistantReply: boolean;
  engine: TtsEngine;
}

export interface VoiceMacosNativeProviderConfig {
  enabled: boolean;
  ttsVoiceId: string;
  ttsRate: number;
  ttsVolume: number;
}

export interface VoiceEdgeTtsProviderConfig {
  enabled: boolean;
  ttsVoiceId: string;
  ttsRate: number;
  ttsVolume: number;
}

export interface VoiceLocalWhisperCppProviderConfig {
  enabled: boolean;
  packaged: boolean;
  binaryPath: string;
  modelPath: string;
  modelName: string;
  language: string;
  threads: number;
  useGpu: boolean;
  autoDownloadModel: boolean;
}

export const VoiceLocalQwen3TtsTask = {
  CustomVoice: 'custom_voice',
  VoiceDesign: 'voice_design',
} as const;
export type VoiceLocalQwen3TtsTask = typeof VoiceLocalQwen3TtsTask[keyof typeof VoiceLocalQwen3TtsTask];

export interface VoiceLocalQwen3TtsProviderConfig {
  enabled: boolean;
  packaged: boolean;
  pythonCommand: string;
  modelPath: string;
  modelId: string;
  tokenizerPath: string;
  task: VoiceLocalQwen3TtsTask;
  speaker: string;
  instruct: string;
  language: string;
  device: string;
}

export interface VoiceOpenAiProviderConfig {
  enabled: boolean;
  packaged: boolean;
  apiKey: string;
  baseUrl: string;
  sttModel: string;
  ttsModel: string;
  ttsVoice: string;
  locale: string;
}

export interface VoiceAzureProviderConfig {
  enabled: boolean;
  packaged: boolean;
  apiKey: string;
  region: string;
  endpoint: string;
  ttsVoice: string;
  locale: string;
}

export interface VoiceAliyunProviderConfig {
  enabled: boolean;
  packaged: boolean;
  apiKey: string;
  baseUrl: string;
  sttModel: string;
  ttsModel: string;
  ttsVoice: string;
  locale: string;
}

export interface VoiceVolcengineProviderConfig {
  enabled: boolean;
  packaged: boolean;
  appKey: string;
  accessToken: string;
  baseUrl: string;
  ttsVoice: string;
  locale: string;
}

export interface VoiceCustomProviderConfig {
  enabled: boolean;
  packaged: boolean;
  apiKey: string;
  baseUrl: string;
  sttPath: string;
  ttsPath: string;
  locale: string;
}

export interface VoicePostProcessConfig {
  sttLlmCorrectionEnabled: boolean;
  ttsLlmRewriteEnabled: boolean;
  ttsSkipKeywords: string[];
}

export interface VoiceConfig {
  capabilities: {
    manualStt: VoiceCapabilityConfig;
    wakeInput: VoiceCapabilityConfig;
    followUpDictation: VoiceCapabilityConfig;
    tts: VoiceTtsCapabilityConfig;
  };
  commands: {
    manualStopCommand: string;
    manualSubmitCommand: string;
    wakeWords: string[];
    wakeSubmitCommand: string;
    wakeCancelCommand: string;
    wakeSessionTimeoutMs: number;
    wakeActivationReplyEnabled: boolean;
    wakeActivationReplyText: string;
  };
  providers: {
    macosNative: VoiceMacosNativeProviderConfig;
    edgeTts: VoiceEdgeTtsProviderConfig;
    localWhisperCpp: VoiceLocalWhisperCppProviderConfig;
    localQwen3Tts: VoiceLocalQwen3TtsProviderConfig;
    openai: VoiceOpenAiProviderConfig;
    aliyun: VoiceAliyunProviderConfig;
    volcengine: VoiceVolcengineProviderConfig;
    azure: VoiceAzureProviderConfig;
    custom: VoiceCustomProviderConfig;
  };
  postProcess: VoicePostProcessConfig;
  strategy: VoiceStrategy;
}

export interface VoiceProviderStatus {
  provider: VoiceProvider;
  packaged: boolean;
  platformSupported: boolean;
  configured: boolean;
  reason: VoiceCapabilityReason;
  capabilities: Partial<Record<VoiceCapability, boolean>>;
}

export interface VoiceCapabilityStatus {
  capability: VoiceCapability;
  selectedProvider: VoiceProvider;
  platformSupported: boolean;
  packaged: boolean;
  runtimeAvailable: boolean;
  enabled: boolean;
  reason: VoiceCapabilityReason;
}

export interface VoiceLocalWhisperCppStatus {
  resourceRoot: string;
  binaryDirectory: string;
  modelsDirectory: string;
  expectedExecutablePath: string;
  expectedModelPath: string;
  executablePath: string | null;
  modelPath: string | null;
  executableExists: boolean;
  modelExists: boolean;
  enabled: boolean;
  ready: boolean;
}

export interface VoiceLocalQwen3TtsStatus {
  resourceRoot: string;
  modelsRoot: string;
  runnerScriptPath: string;
  expectedModelPath: string;
  expectedTokenizerPath: string;
  modelPath: string | null;
  tokenizerPath: string | null;
  modelExists: boolean;
  tokenizerExists: boolean;
  pythonCommand: string;
  pythonResolvedPath: string | null;
  pythonAvailable: boolean;
  pythonVersion: string;
  qwenTtsAvailable: boolean;
  torchAvailable: boolean;
  soundfileAvailable: boolean;
  huggingfaceCliAvailable: boolean;
  huggingfaceHubAvailable: boolean;
  runnerWritable: boolean;
  runtimeIssues: string[];
  enabled: boolean;
  ready: boolean;
}

export const VoiceLocalModelKind = {
  WhisperCppModel: 'whisper_cpp_model',
  Qwen3TtsModel: 'qwen3_tts_model',
  Qwen3TtsTokenizer: 'qwen3_tts_tokenizer',
} as const;
export type VoiceLocalModelKind = typeof VoiceLocalModelKind[keyof typeof VoiceLocalModelKind];

export const VoiceLocalModelInstallBackend = {
  Direct: 'direct',
  HuggingFaceCli: 'huggingface_cli',
  ModelscopeCli: 'modelscope_cli',
} as const;
export type VoiceLocalModelInstallBackend = typeof VoiceLocalModelInstallBackend[keyof typeof VoiceLocalModelInstallBackend];

export const VoiceLocalModelInstallState = {
  NotInstalled: 'not_installed',
  Downloading: 'downloading',
  Installed: 'installed',
  Error: 'error',
} as const;
export type VoiceLocalModelInstallState = typeof VoiceLocalModelInstallState[keyof typeof VoiceLocalModelInstallState];

export interface VoiceLocalModelCatalogEntry {
  id: string;
  kind: VoiceLocalModelKind;
  label: string;
  description: string;
  version: string;
  recommended: boolean;
  defaultInstall: boolean;
  approximateSizeMb: number;
  installBackend: VoiceLocalModelInstallBackend;
  sourceUrl?: string;
  sourceRepoId?: string;
  targetRelativePath: string;
  requirements: string[];
  warnings: string[];
  provider: VoiceProvider;
}

export interface VoiceLocalModelInstallStatus {
  id: string;
  state: VoiceLocalModelInstallState;
  installed: boolean;
  downloading: boolean;
  progressPercent?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  resolvedPath: string;
  error?: string;
  updatedAt?: number;
}

export interface VoiceLocalModelLibrary {
  catalog: VoiceLocalModelCatalogEntry[];
  statuses: Record<string, VoiceLocalModelInstallStatus>;
}

export interface VoiceCapabilityMatrix {
  schemaVersion: number;
  platform: string;
  arch: string;
  strategy: VoiceStrategy;
  providers: Record<VoiceProvider, VoiceProviderStatus>;
  capabilities: Record<VoiceCapability, VoiceCapabilityStatus>;
}

export interface VoiceCapabilityManifest {
  schemaVersion: number;
  platform: string;
  arch: string;
  providers: Record<string, {
    packaged: boolean;
    capabilities: Partial<Record<VoiceCapability, boolean>>;
  }>;
  capabilities: Partial<Record<VoiceCapability, boolean>>;
}

const DEFAULT_WAKE_WORDS = ['打开青书爪'];

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  capabilities: {
    manualStt: {
      enabled: true,
      provider: VoiceProvider.MacosNative,
    },
    wakeInput: {
      enabled: false,
      provider: VoiceProvider.MacosNative,
    },
    followUpDictation: {
      enabled: false,
      provider: VoiceProvider.MacosNative,
    },
    tts: {
      enabled: true,
      autoPlayAssistantReply: false,
      provider: VoiceProvider.MacosNative,
      engine: TtsEngine.MacosNative,
    },
  },
  commands: {
    manualStopCommand: '停止',
    manualSubmitCommand: '结束发送',
    wakeWords: DEFAULT_WAKE_WORDS,
    wakeSubmitCommand: '发送',
    wakeCancelCommand: '取消',
    wakeSessionTimeoutMs: 20_000,
    wakeActivationReplyEnabled: false,
    wakeActivationReplyText: '在的',
  },
  providers: {
    macosNative: {
      enabled: true,
      ttsVoiceId: '',
      ttsRate: 0.5,
      ttsVolume: 1,
    },
    edgeTts: {
      enabled: true,
      ttsVoiceId: '',
      ttsRate: 0.5,
      ttsVolume: 1,
    },
    localWhisperCpp: {
      enabled: false,
      packaged: false,
      binaryPath: '',
      modelPath: '',
      modelName: 'base',
      language: 'zh',
      threads: 4,
      useGpu: true,
      autoDownloadModel: true,
    },
    localQwen3Tts: {
      enabled: false,
      packaged: false,
      pythonCommand: 'python3',
      modelPath: '',
      modelId: 'qwen3_tts_1_7b_voice_design',
      tokenizerPath: '',
      task: VoiceLocalQwen3TtsTask.VoiceDesign,
      speaker: 'Vivian',
      instruct: '自然、清晰、克制的中文女声',
      language: 'Chinese',
      device: 'auto',
    },
    openai: {
      enabled: false,
      packaged: false,
      apiKey: '',
      baseUrl: '',
      sttModel: 'gpt-4o-mini-transcribe',
      ttsModel: 'gpt-4o-mini-tts',
      ttsVoice: 'alloy',
      locale: 'zh-CN',
    },
    aliyun: {
      enabled: false,
      packaged: false,
      apiKey: '',
      baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
      sttModel: 'paraformer-realtime-v2',
      ttsModel: 'qwen3-tts-flash',
      ttsVoice: 'Cherry',
      locale: 'zh-CN',
    },
    volcengine: {
      enabled: false,
      packaged: false,
      appKey: '',
      accessToken: '',
      baseUrl: 'https://sami.bytedance.com',
      ttsVoice: 'zh_female_qingxin',
      locale: 'zh-CN',
    },
    azure: {
      enabled: false,
      packaged: false,
      apiKey: '',
      region: '',
      endpoint: '',
      ttsVoice: '',
      locale: 'zh-CN',
    },
    custom: {
      enabled: false,
      packaged: false,
      apiKey: '',
      baseUrl: '',
      sttPath: '',
      ttsPath: '',
      locale: 'zh-CN',
    },
  },
  postProcess: {
    sttLlmCorrectionEnabled: false,
    ttsLlmRewriteEnabled: false,
    ttsSkipKeywords: [],
  },
  strategy: VoiceStrategy.NativeFirst,
};

const uniqueNonEmptyStrings = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
};

export const normalizeVoiceKeywordList = (values?: unknown): string[] => {
  if (Array.isArray(values)) {
    return uniqueNonEmptyStrings(values);
  }
  if (typeof values === 'string') {
    return uniqueNonEmptyStrings(values.split(/\r?\n|,/g));
  }
  return [];
};

export const normalizeWakeWords = (wakeWords?: unknown, wakeWord?: unknown): string[] => {
  if (Array.isArray(wakeWords)) {
    const normalizedWakeWords = uniqueNonEmptyStrings(wakeWords);
    if (normalizedWakeWords.length > 0) {
      return normalizedWakeWords;
    }
  }

  if (typeof wakeWord === 'string' && wakeWord.trim()) {
    return [wakeWord.trim()];
  }

  return [...DEFAULT_WAKE_WORDS];
};

export const parseWakeWordsInput = (value: string): string[] => {
  return normalizeWakeWords(value.split(/\r?\n|,/g));
};

export const mergeVoiceConfig = (config?: Partial<VoiceConfig> | null): VoiceConfig => {
  return {
    ...DEFAULT_VOICE_CONFIG,
    ...(config ?? {}),
    capabilities: {
      manualStt: {
        ...DEFAULT_VOICE_CONFIG.capabilities.manualStt,
        ...(config?.capabilities?.manualStt ?? {}),
      },
      wakeInput: {
        ...DEFAULT_VOICE_CONFIG.capabilities.wakeInput,
        ...(config?.capabilities?.wakeInput ?? {}),
      },
      followUpDictation: {
        ...DEFAULT_VOICE_CONFIG.capabilities.followUpDictation,
        ...(config?.capabilities?.followUpDictation ?? {}),
      },
      tts: {
        ...DEFAULT_VOICE_CONFIG.capabilities.tts,
        ...(config?.capabilities?.tts ?? {}),
      },
    },
    commands: {
      ...DEFAULT_VOICE_CONFIG.commands,
      ...(config?.commands ?? {}),
      wakeWords: normalizeWakeWords(config?.commands?.wakeWords),
      wakeActivationReplyText: typeof config?.commands?.wakeActivationReplyText === 'string'
        ? config.commands.wakeActivationReplyText.trim() || DEFAULT_VOICE_CONFIG.commands.wakeActivationReplyText
        : DEFAULT_VOICE_CONFIG.commands.wakeActivationReplyText,
    },
    providers: {
      macosNative: {
        ...DEFAULT_VOICE_CONFIG.providers.macosNative,
        ...(config?.providers?.macosNative ?? {}),
      },
      edgeTts: {
        ...DEFAULT_VOICE_CONFIG.providers.edgeTts,
        ...(config?.providers?.edgeTts ?? {}),
      },
      localWhisperCpp: {
        ...DEFAULT_VOICE_CONFIG.providers.localWhisperCpp,
        ...(config?.providers?.localWhisperCpp ?? {}),
      },
      localQwen3Tts: {
        ...DEFAULT_VOICE_CONFIG.providers.localQwen3Tts,
        ...(config?.providers?.localQwen3Tts ?? {}),
      },
      openai: {
        ...DEFAULT_VOICE_CONFIG.providers.openai,
        ...(config?.providers?.openai ?? {}),
      },
      aliyun: {
        ...DEFAULT_VOICE_CONFIG.providers.aliyun,
        ...(config?.providers?.aliyun ?? {}),
      },
      volcengine: {
        ...DEFAULT_VOICE_CONFIG.providers.volcengine,
        ...(config?.providers?.volcengine ?? {}),
      },
      azure: {
        ...DEFAULT_VOICE_CONFIG.providers.azure,
        ...(config?.providers?.azure ?? {}),
      },
      custom: {
        ...DEFAULT_VOICE_CONFIG.providers.custom,
        ...(config?.providers?.custom ?? {}),
      },
    },
    postProcess: {
      ...DEFAULT_VOICE_CONFIG.postProcess,
      ...(config?.postProcess ?? {}),
      ttsSkipKeywords: normalizeVoiceKeywordList(config?.postProcess?.ttsSkipKeywords),
    },
    strategy: config?.strategy ?? DEFAULT_VOICE_CONFIG.strategy,
  };
};

export const createVoiceConfigFromLegacy = (options?: {
  voice?: Partial<VoiceConfig> | null;
  speechInput?: Partial<LegacySpeechInputConfig> | null;
  wakeInput?: Partial<WakeInputConfig> | null;
  tts?: Partial<LegacyTtsConfig> | null;
}): VoiceConfig => {
  const voice = options?.voice ?? null;
  const speechInput = options?.speechInput ?? null;
  const wakeInput = options?.wakeInput ?? null;
  const tts = options?.tts ?? null;

  return mergeVoiceConfig({
    ...voice,
    capabilities: {
      ...voice?.capabilities,
      manualStt: {
        enabled: voice?.capabilities?.manualStt?.enabled ?? DEFAULT_VOICE_CONFIG.capabilities.manualStt.enabled,
        provider: voice?.capabilities?.manualStt?.provider ?? DEFAULT_VOICE_CONFIG.capabilities.manualStt.provider,
      },
      wakeInput: {
        enabled: voice?.capabilities?.wakeInput?.enabled ?? wakeInput?.enabled ?? DEFAULT_VOICE_CONFIG.capabilities.wakeInput.enabled,
        provider: voice?.capabilities?.wakeInput?.provider ?? DEFAULT_VOICE_CONFIG.capabilities.wakeInput.provider,
      },
      followUpDictation: {
        enabled: voice?.capabilities?.followUpDictation?.enabled ?? DEFAULT_VOICE_CONFIG.capabilities.followUpDictation.enabled,
        provider: voice?.capabilities?.followUpDictation?.provider ?? DEFAULT_VOICE_CONFIG.capabilities.followUpDictation.provider,
      },
      tts: {
        enabled: voice?.capabilities?.tts?.enabled ?? tts?.enabled ?? DEFAULT_VOICE_CONFIG.capabilities.tts.enabled,
        autoPlayAssistantReply: voice?.capabilities?.tts?.autoPlayAssistantReply
          ?? tts?.autoPlayAssistantReply
          ?? DEFAULT_VOICE_CONFIG.capabilities.tts.autoPlayAssistantReply,
        provider: voice?.capabilities?.tts?.provider ?? DEFAULT_VOICE_CONFIG.capabilities.tts.provider,
        engine: voice?.capabilities?.tts?.engine ?? tts?.engine ?? DEFAULT_VOICE_CONFIG.capabilities.tts.engine,
      },
    },
    commands: {
      ...voice?.commands,
      manualStopCommand: voice?.commands?.manualStopCommand ?? speechInput?.stopCommand ?? DEFAULT_VOICE_CONFIG.commands.manualStopCommand,
      manualSubmitCommand: voice?.commands?.manualSubmitCommand ?? speechInput?.submitCommand ?? DEFAULT_VOICE_CONFIG.commands.manualSubmitCommand,
      wakeWords: voice?.commands?.wakeWords ?? normalizeWakeWords(wakeInput?.wakeWords, wakeInput?.wakeWord),
      wakeSubmitCommand: voice?.commands?.wakeSubmitCommand ?? wakeInput?.submitCommand ?? DEFAULT_VOICE_CONFIG.commands.wakeSubmitCommand,
      wakeCancelCommand: voice?.commands?.wakeCancelCommand ?? wakeInput?.cancelCommand ?? DEFAULT_VOICE_CONFIG.commands.wakeCancelCommand,
      wakeSessionTimeoutMs: voice?.commands?.wakeSessionTimeoutMs ?? wakeInput?.sessionTimeoutMs ?? DEFAULT_VOICE_CONFIG.commands.wakeSessionTimeoutMs,
      wakeActivationReplyEnabled: voice?.commands?.wakeActivationReplyEnabled
        ?? wakeInput?.activationReplyEnabled
        ?? DEFAULT_VOICE_CONFIG.commands.wakeActivationReplyEnabled,
      wakeActivationReplyText: voice?.commands?.wakeActivationReplyText
        ?? wakeInput?.activationReplyText
        ?? DEFAULT_VOICE_CONFIG.commands.wakeActivationReplyText,
    },
    providers: {
      macosNative: {
        ...DEFAULT_VOICE_CONFIG.providers.macosNative,
        ...(voice?.providers?.macosNative ?? {}),
        enabled: voice?.providers?.macosNative?.enabled ?? DEFAULT_VOICE_CONFIG.providers.macosNative.enabled,
        ttsVoiceId: voice?.providers?.macosNative?.ttsVoiceId ?? (
          tts?.engine === TtsEngine.MacosNative
            ? (tts.voiceId ?? DEFAULT_VOICE_CONFIG.providers.macosNative.ttsVoiceId)
            : DEFAULT_VOICE_CONFIG.providers.macosNative.ttsVoiceId
        ),
        ttsRate: voice?.providers?.macosNative?.ttsRate ?? (
          tts?.engine === TtsEngine.MacosNative
            ? (tts.rate ?? DEFAULT_VOICE_CONFIG.providers.macosNative.ttsRate)
            : DEFAULT_VOICE_CONFIG.providers.macosNative.ttsRate
        ),
        ttsVolume: voice?.providers?.macosNative?.ttsVolume ?? (
          tts?.engine === TtsEngine.MacosNative
            ? (tts.volume ?? DEFAULT_VOICE_CONFIG.providers.macosNative.ttsVolume)
            : DEFAULT_VOICE_CONFIG.providers.macosNative.ttsVolume
        ),
      },
      edgeTts: {
        ...DEFAULT_VOICE_CONFIG.providers.edgeTts,
        ...(voice?.providers?.edgeTts ?? {}),
        enabled: voice?.providers?.edgeTts?.enabled ?? DEFAULT_VOICE_CONFIG.providers.edgeTts.enabled,
        ttsVoiceId: voice?.providers?.edgeTts?.ttsVoiceId ?? (
          tts?.engine === TtsEngine.EdgeTts
            ? (tts.voiceId ?? DEFAULT_VOICE_CONFIG.providers.edgeTts.ttsVoiceId)
            : DEFAULT_VOICE_CONFIG.providers.edgeTts.ttsVoiceId
        ),
        ttsRate: voice?.providers?.edgeTts?.ttsRate ?? (
          tts?.engine === TtsEngine.EdgeTts
            ? (tts.rate ?? DEFAULT_VOICE_CONFIG.providers.edgeTts.ttsRate)
            : DEFAULT_VOICE_CONFIG.providers.edgeTts.ttsRate
        ),
        ttsVolume: voice?.providers?.edgeTts?.ttsVolume ?? (
          tts?.engine === TtsEngine.EdgeTts
            ? (tts.volume ?? DEFAULT_VOICE_CONFIG.providers.edgeTts.ttsVolume)
            : DEFAULT_VOICE_CONFIG.providers.edgeTts.ttsVolume
        ),
      },
      localWhisperCpp: {
        ...DEFAULT_VOICE_CONFIG.providers.localWhisperCpp,
        ...(voice?.providers?.localWhisperCpp ?? {}),
      },
      localQwen3Tts: {
        ...DEFAULT_VOICE_CONFIG.providers.localQwen3Tts,
        ...(voice?.providers?.localQwen3Tts ?? {}),
      },
      openai: {
        ...DEFAULT_VOICE_CONFIG.providers.openai,
        ...(voice?.providers?.openai ?? {}),
      },
      aliyun: {
        ...DEFAULT_VOICE_CONFIG.providers.aliyun,
        ...(voice?.providers?.aliyun ?? {}),
      },
      volcengine: {
        ...DEFAULT_VOICE_CONFIG.providers.volcengine,
        ...(voice?.providers?.volcengine ?? {}),
      },
      azure: {
        ...DEFAULT_VOICE_CONFIG.providers.azure,
        ...(voice?.providers?.azure ?? {}),
      },
      custom: {
        ...DEFAULT_VOICE_CONFIG.providers.custom,
        ...(voice?.providers?.custom ?? {}),
      },
    },
    postProcess: {
      ...DEFAULT_VOICE_CONFIG.postProcess,
      ...(voice?.postProcess ?? {}),
      ttsSkipKeywords: normalizeVoiceKeywordList(voice?.postProcess?.ttsSkipKeywords),
    },
  });
};

export const deriveLegacySpeechInputConfig = (voiceConfig: VoiceConfig): LegacySpeechInputConfig => ({
  stopCommand: voiceConfig.commands.manualStopCommand,
  submitCommand: voiceConfig.commands.manualSubmitCommand,
});

export const deriveLegacyWakeInputConfig = (voiceConfig: VoiceConfig): WakeInputConfig => ({
  enabled: voiceConfig.capabilities.wakeInput.enabled,
  wakeWords: [...voiceConfig.commands.wakeWords],
  wakeWord: voiceConfig.commands.wakeWords[0] ?? DEFAULT_VOICE_CONFIG.commands.wakeWords[0],
  submitCommand: voiceConfig.commands.wakeSubmitCommand,
  cancelCommand: voiceConfig.commands.wakeCancelCommand,
  sessionTimeoutMs: voiceConfig.commands.wakeSessionTimeoutMs,
  activationReplyEnabled: voiceConfig.commands.wakeActivationReplyEnabled,
  activationReplyText: voiceConfig.commands.wakeActivationReplyText,
});

export const deriveLegacyTtsConfig = (voiceConfig: VoiceConfig): LegacyTtsConfig => ({
  enabled: voiceConfig.capabilities.tts.enabled,
  autoPlayAssistantReply: voiceConfig.capabilities.tts.autoPlayAssistantReply,
  engine: voiceConfig.capabilities.tts.engine,
  voiceId: voiceConfig.capabilities.tts.engine === TtsEngine.MacosNative
    ? voiceConfig.providers.macosNative.ttsVoiceId
    : voiceConfig.providers.edgeTts.ttsVoiceId,
  rate: voiceConfig.capabilities.tts.engine === TtsEngine.MacosNative
    ? voiceConfig.providers.macosNative.ttsRate
    : voiceConfig.providers.edgeTts.ttsRate,
  volume: voiceConfig.capabilities.tts.engine === TtsEngine.MacosNative
    ? voiceConfig.providers.macosNative.ttsVolume
    : voiceConfig.providers.edgeTts.ttsVolume,
});
