import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { configService } from '../services/config';
import { apiService } from '../services/api';
import { checkForAppUpdate } from '../services/appUpdate';
import type { AppUpdateInfo } from '../services/appUpdate';
import { themeService } from '../services/theme';
import { i18nService, LanguageType } from '../services/i18n';
import { decryptSecret, encryptWithPassword, decryptWithPassword, EncryptedPayload, PasswordEncryptedPayload } from '../services/encryption';
import { coworkService } from '../services/cowork';
import { APP_ID, APP_NAME, EXPORT_FORMAT_TYPE, EXPORT_PASSWORD } from '../constants/app';
import ErrorMessage from './ErrorMessage';
import { XMarkIcon, Cog6ToothIcon, SignalIcon, CheckCircleIcon, XCircleIcon, CubeIcon, ChatBubbleLeftIcon, EnvelopeIcon, CpuChipIcon, InformationCircleIcon, UserCircleIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { EyeIcon, EyeSlashIcon, XCircleIcon as XCircleIconSolid } from '@heroicons/react/20/solid';
import PlusCircleIcon from './icons/PlusCircleIcon';
import TrashIcon from './icons/TrashIcon';
import PencilIcon from './icons/PencilIcon';
import BrainIcon from './icons/BrainIcon';
import { useDispatch, useSelector } from 'react-redux';
import { setAvailableModels } from '../store/slices/modelSlice';
import { RootState } from '../store';
import ThemedSelect from './ui/ThemedSelect';
import type {
  CoworkAgentEngine,
  OpenClawEngineStatus,
  CoworkUserMemoryEntry,
  CoworkMemoryStats,
} from '../types/cowork';
import IMSettings from './im/IMSettings';
import { imService } from '../services/im';
import EmailSkillConfig from './skills/EmailSkillConfig';
import { ProviderRegistry, resolveCodingPlanBaseUrl } from '../../shared/providers';
import type { WakeInputStatus } from '../../shared/wakeInput/constants';
import type { VoiceCapabilityMatrix, VoiceConfig } from '../../shared/voice/constants';
import {
  VoiceCapability,
  VoiceLocalQwen3TtsTask,
  VoiceProvider,
  createVoiceConfigFromLegacy,
  normalizeVoiceKeywordList,
  parseWakeWordsInput,
} from '../../shared/voice/constants';
import { TtsEngine } from '../../shared/tts/constants';
import type { TtsAvailability, TtsVoice } from '../../shared/tts/constants';
import {
  DEFAULT_SPEECH_INPUT_CONFIG,
  DEFAULT_TTS_CONFIG,
  DEFAULT_WAKE_INPUT_CONFIG,
  defaultConfig,
  type AppConfig,
  getVisibleProviders,
  isCustomProvider,
  getCustomProviderDefaultName,
  getProviderDisplayName,
} from '../config';
import {
  AuthBackend,
  DEFAULT_QTB_API_BASE_URL,
  DEFAULT_QTB_WEB_BASE_URL,
} from '../../common/auth';
import {
  OpenAIIcon,
  DeepSeekIcon,
  GeminiIcon,
  AnthropicIcon,
  MoonshotIcon,
  ZhipuIcon,
  MiniMaxIcon,
  YouDaoZhiYunIcon,
  QwenIcon,
  XiaomiIcon,
  StepfunIcon,
  VolcengineIcon,
  OpenRouterIcon,
  OllamaIcon,
  CustomProviderIcon,
} from './icons/providers';

type TabType = 'general'| 'coworkAgentEngine' | 'model' | 'coworkMemory' | 'coworkAgent' | 'shortcuts' | 'im' | 'email' | 'about';

export type SettingsOpenOptions = {
  initialTab?: TabType;
  notice?: string;
};

interface SettingsProps extends SettingsOpenOptions {
  onClose: () => void;
  onUpdateFound?: (info: AppUpdateInfo) => void;
  enterpriseConfig?: {
    ui?: Record<string, 'hide' | 'disable' | 'readonly'>;
    disableUpdate?: boolean;
  } | null;
}


const CUSTOM_PROVIDER_KEYS = [
  'custom_0', 'custom_1', 'custom_2', 'custom_3', 'custom_4',
  'custom_5', 'custom_6', 'custom_7', 'custom_8', 'custom_9',
] as const;

const providerKeys = [
  'openai',
  'gemini',
  'anthropic',
  'deepseek',
  'moonshot',
  'zhipu',
  'minimax',
  'volcengine',
  'qwen',
  'youdaozhiyun',
  'stepfun',
  'xiaomi',
  'openrouter',
  'ollama',
  ...CUSTOM_PROVIDER_KEYS,
] as const;

type ProviderType = (typeof providerKeys)[number];
type ProvidersConfig = NonNullable<AppConfig['providers']>;
type ProviderConfig = ProvidersConfig[string];
type Model = NonNullable<ProviderConfig['models']>[number];
type ProviderConnectionTestResult = {
  success: boolean;
  message: string;
  provider: ProviderType;
};

type VoiceStrategyValue = VoiceConfig['strategy'];
type VoiceCapabilityProvider = typeof VoiceProvider[keyof typeof VoiceProvider];
type VoiceCapabilityKey = typeof VoiceCapability[keyof typeof VoiceCapability];
type VoiceProviderPanelKey = Exclude<typeof VoiceProvider[keyof typeof VoiceProvider], typeof VoiceProvider.None>;
type VoiceLocalWhisperCppConfig = VoiceConfig['providers']['localWhisperCpp'];
type VoiceLocalWhisperCppRuntimeStatus = import('../../shared/voice/constants').VoiceLocalWhisperCppStatus;
type VoiceLocalQwen3TtsConfig = VoiceConfig['providers']['localQwen3Tts'];
type VoiceLocalQwen3TtsRuntimeStatus = import('../../shared/voice/constants').VoiceLocalQwen3TtsStatus;
type VoiceLocalModelLibrary = import('../../shared/voice/constants').VoiceLocalModelLibrary;
type VoiceLocalModelCatalogEntry = VoiceLocalModelLibrary['catalog'][number];
type VoiceLocalModelInstallStatus = VoiceLocalModelLibrary['statuses'][string];
type VoiceEdgeTtsConfig = VoiceConfig['providers']['edgeTts'];
type VoiceOpenAiConfig = VoiceConfig['providers']['openai'];
type VoiceAliyunConfig = VoiceConfig['providers']['aliyun'];
type VoiceVolcengineConfig = VoiceConfig['providers']['volcengine'];
type VoiceAzureConfig = VoiceConfig['providers']['azure'];
type VoiceCustomConfig = VoiceConfig['providers']['custom'];
type ProviderGroupKey = 'foundation' | 'regional' | 'custom';
type ProviderPanelSectionKey = 'credentials' | 'endpoint' | 'features' | 'connection' | 'models' | 'advanced';

const voiceProviderPanelKeys = [
  VoiceProvider.MacosNative,
  VoiceProvider.LocalWhisperCpp,
  VoiceProvider.LocalQwen3Tts,
  VoiceProvider.CloudOpenAi,
  VoiceProvider.CloudAliyun,
  VoiceProvider.CloudVolcengine,
  VoiceProvider.CloudAzure,
  VoiceProvider.CloudCustom,
] as const satisfies readonly VoiceProviderPanelKey[];

const providerGroups: Array<{ key: ProviderGroupKey; providers: ProviderType[] }> = [
  {
    key: 'foundation',
    providers: ['openai', 'anthropic', 'gemini', 'deepseek', 'openrouter', 'ollama'],
  },
  {
    key: 'regional',
    providers: ['moonshot', 'zhipu', 'minimax', 'volcengine', 'qwen', 'youdaozhiyun', 'stepfun', 'xiaomi'],
  },
  {
    key: 'custom',
    providers: [...CUSTOM_PROVIDER_KEYS],
  },
];

interface ProviderExportEntry {
  enabled: boolean;
  apiKey: PasswordEncryptedPayload;
  baseUrl: string;
  apiFormat?: 'anthropic' | 'openai' | 'gemini';
  codingPlanEnabled?: boolean;
  models?: Model[];
}

interface ProvidersExportPayload {
  type: typeof EXPORT_FORMAT_TYPE;
  version: 2;
  exportedAt: string;
  encryption: {
    algorithm: 'AES-GCM';
    keySource: 'password';
    keyDerivation: 'PBKDF2';
  };
  providers: Record<string, ProviderExportEntry>;
}

interface ProvidersImportEntry {
  enabled?: boolean;
  apiKey?: EncryptedPayload | PasswordEncryptedPayload | string;
  apiKeyEncrypted?: string;
  apiKeyIv?: string;
  baseUrl?: string;
  apiFormat?: 'anthropic' | 'openai' | 'native';
  codingPlanEnabled?: boolean;
  models?: Model[];
}

interface ProvidersImportPayload {
  type?: string;
  version?: number;
  encryption?: {
    algorithm?: string;
    keySource?: string;
    keyDerivation?: string;
  };
  providers?: Record<string, ProvidersImportEntry>;
}

const providerMeta: Record<ProviderType, { label: string; icon: React.ReactNode }> = {
  openai: { label: 'OpenAI', icon: <OpenAIIcon /> },
  deepseek: { label: 'DeepSeek', icon: <DeepSeekIcon /> },
  gemini: { label: 'Gemini', icon: <GeminiIcon /> },
  anthropic: { label: 'Anthropic', icon: <AnthropicIcon /> },
  moonshot: { label: 'Moonshot', icon: <MoonshotIcon /> },
  zhipu: { label: 'Zhipu', icon: <ZhipuIcon /> },
  minimax: { label: 'MiniMax', icon: <MiniMaxIcon /> },
  youdaozhiyun: { label: 'Youdao', icon: <YouDaoZhiYunIcon /> },
  qwen: { label: 'Qwen', icon: <QwenIcon /> },
  xiaomi: { label: 'Xiaomi', icon: <XiaomiIcon /> },
  stepfun: { label: 'StepFun', icon: <StepfunIcon /> },
  volcengine: { label: 'Volcengine', icon: <VolcengineIcon /> },
  openrouter: { label: 'OpenRouter', icon: <OpenRouterIcon /> },
  ollama: { label: 'Ollama', icon: <OllamaIcon /> },
  ...Object.fromEntries(
    CUSTOM_PROVIDER_KEYS.map(key => [key, { label: getCustomProviderDefaultName(key), icon: <CustomProviderIcon /> }])
  ) as Record<(typeof CUSTOM_PROVIDER_KEYS)[number], { label: string; icon: React.ReactNode }>,
};

const providerRequiresApiKey = (provider: ProviderType) => provider !== 'ollama';
const normalizeBaseUrl = (baseUrl: string): string => baseUrl.trim().replace(/\/+$/, '').toLowerCase();
const normalizeApiFormat = (value: unknown): 'anthropic' | 'openai' => (
  value === 'openai' ? 'openai' : 'anthropic'
);
// MiniMax Portal OAuth constants
const MINIMAX_OAUTH_CLIENT_ID = '78257093-7e40-4613-99e0-527b14b39113';
const MINIMAX_OAUTH_SCOPE = 'group_id profile model.completion';
const MINIMAX_OAUTH_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:user_code';
const MINIMAX_BASE_URL_CN = 'https://api.minimaxi.com/anthropic';
const MINIMAX_BASE_URL_GLOBAL = 'https://api.minimax.io/anthropic';
const MINIMAX_CODE_ENDPOINT_CN = 'https://api.minimaxi.com/oauth/code';
const MINIMAX_CODE_ENDPOINT_GLOBAL = 'https://api.minimax.io/oauth/code';
const MINIMAX_TOKEN_ENDPOINT_CN = 'https://api.minimaxi.com/oauth/token';
const MINIMAX_TOKEN_ENDPOINT_GLOBAL = 'https://api.minimax.io/oauth/token';

type MiniMaxRegion = 'cn' | 'global';
type MiniMaxOAuthPhase =
  | { kind: 'idle' }
  | { kind: 'requesting_code' }
  | { kind: 'pending'; userCode: string; verificationUri: string }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

const renderBrandHighlight = (text: string) => {
  const match = /(灵工打卡|Linggong Daka)/.exec(text);
  if (!match || match.index < 0) {
    return text;
  }

  const brandText = match[0];
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + brandText.length);

  return (
    <>
      {before}
      <span className="text-emerald-600 dark:text-emerald-400">{brandText}</span>
      {after}
    </>
  );
};

async function generateMiniMaxPkce(): Promise<{ verifier: string; challenge: string; state: string }> {
  const verifierArray = new Uint8Array(32);
  crypto.getRandomValues(verifierArray);
  const verifier = btoa(String.fromCharCode(...verifierArray))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const stateArray = new Uint8Array(16);
  crypto.getRandomValues(stateArray);
  const state = btoa(String.fromCharCode(...stateArray))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return { verifier, challenge, state };
}

const getFixedApiFormatForProvider = (provider: string): 'anthropic' | 'openai' | 'gemini' | null => {
  if (provider === 'openai' || provider === 'stepfun') {
    return 'openai';
  }
  if (provider === 'youdaozhiyun') {
    return 'openai';
  }
  if (provider === 'anthropic') {
    return 'anthropic';
  }
  if (provider === 'gemini') {
    return 'gemini';
  }
  return null;
};
const getEffectiveApiFormat = (provider: string, value: unknown): 'anthropic' | 'openai' | 'gemini' => (
  getFixedApiFormatForProvider(provider) ?? normalizeApiFormat(value)
);
const shouldShowApiFormatSelector = (provider: string): boolean => (
  getFixedApiFormatForProvider(provider) === null
);
const getProviderDefaultBaseUrl = (
  provider: ProviderType,
  apiFormat: 'anthropic' | 'openai' | 'gemini'
): string | null => {
  if (apiFormat === 'gemini') return null;
  return ProviderRegistry.getSwitchableBaseUrl(provider, apiFormat) ?? null;
};
const resolveBaseUrl = (
  provider: ProviderType,
  baseUrl: string,
  apiFormat: 'anthropic' | 'openai' | 'gemini'
): string => {
  if (baseUrl.trim()) return baseUrl;
  return getProviderDefaultBaseUrl(provider, apiFormat)
    || defaultConfig.providers?.[provider]?.baseUrl
    || '';
};
const shouldAutoSwitchProviderBaseUrl = (provider: ProviderType, currentBaseUrl: string): boolean => {
  const anthropicUrl = ProviderRegistry.getSwitchableBaseUrl(provider, 'anthropic');
  const openaiUrl = ProviderRegistry.getSwitchableBaseUrl(provider, 'openai');
  if (!anthropicUrl && !openaiUrl) {
    return false;
  }

  const normalizedCurrent = normalizeBaseUrl(currentBaseUrl);
  return (
    (anthropicUrl ? normalizedCurrent === normalizeBaseUrl(anthropicUrl) : false)
    || (openaiUrl ? normalizedCurrent === normalizeBaseUrl(openaiUrl) : false)
  );
};
const buildOpenAICompatibleChatCompletionsUrl = (baseUrl: string, provider: string): string => {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) {
    return '/v1/chat/completions';
  }
  if (normalized.endsWith('/chat/completions')) {
    return normalized;
  }

  const isGeminiLike = provider === 'gemini' || normalized.includes('generativelanguage.googleapis.com');
  if (isGeminiLike) {
    if (normalized.endsWith('/v1beta/openai') || normalized.endsWith('/v1/openai')) {
      return `${normalized}/chat/completions`;
    }
    if (normalized.endsWith('/v1beta') || normalized.endsWith('/v1')) {
      const betaBase = normalized.endsWith('/v1')
        ? `${normalized.slice(0, -3)}v1beta`
        : normalized;
      return `${betaBase}/openai/chat/completions`;
    }
    return `${normalized}/v1beta/openai/chat/completions`;
  }

  // Handle /v1, /v4 etc. versioned paths
  if (/\/v\d+$/.test(normalized)) {
    return `${normalized}/chat/completions`;
  }
  return `${normalized}/v1/chat/completions`;
};
const buildOpenAIResponsesUrl = (baseUrl: string): string => {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) {
    return '/v1/responses';
  }
  if (normalized.endsWith('/responses')) {
    return normalized;
  }
  if (normalized.endsWith('/v1')) {
    return `${normalized}/responses`;
  }
  return `${normalized}/v1/responses`;
};
const shouldUseOpenAIResponsesForProvider = (provider: string): boolean => (
  provider === 'openai'
);
const shouldUseMaxCompletionTokensForOpenAI = (provider: string, modelId?: string): boolean => {
  if (provider !== 'openai') {
    return false;
  }
  const normalizedModel = (modelId ?? '').toLowerCase();
  const resolvedModel = normalizedModel.includes('/')
    ? normalizedModel.slice(normalizedModel.lastIndexOf('/') + 1)
    : normalizedModel;
  return resolvedModel.startsWith('gpt-5')
    || resolvedModel.startsWith('o1')
    || resolvedModel.startsWith('o3')
    || resolvedModel.startsWith('o4');
};
const CONNECTIVITY_TEST_TOKEN_BUDGET = 64;

const getDefaultProviders = (): ProvidersConfig => {
  const providers = (defaultConfig.providers ?? {}) as ProvidersConfig;
  const entries = Object.entries(providers) as Array<[string, ProviderConfig]>;
  return Object.fromEntries(
    entries.map(([providerKey, providerConfig]) => [
      providerKey,
      {
        ...providerConfig,
        models: providerConfig.models?.map(model => ({
          ...model,
          supportsImage: model.supportsImage ?? false,
        })),
      },
    ])
  ) as ProvidersConfig;
};

const getDefaultActiveProvider = (): ProviderType => {
  const providers = (defaultConfig.providers ?? {}) as ProvidersConfig;
  const firstEnabledProvider = providerKeys.find(providerKey => providers[providerKey]?.enabled);
  return firstEnabledProvider ?? providerKeys[0];
};

/** Join workspace directory with a filename using platform-aware separator. */
const joinWorkspacePath = (dir: string | undefined, filename: string): string => {
  const base = dir?.trim() || '~/.openclaw/workspace';
  const sep = window.electron.platform === 'win32' ? '\\' : '/';
  // Normalize: if base already ends with a separator, don't double it
  return base.endsWith(sep) || base.endsWith('/') || base.endsWith('\\')
    ? `${base}${filename}`
    : `${base}${sep}${filename}`;
};

// System shortcuts that should not be captured (clipboard, undo, select-all, quit, etc.)
const isSystemShortcut = (e: KeyboardEvent): boolean => {
  const key = e.key.toLowerCase();
  if (e.metaKey && ['c', 'v', 'x', 'z', 'y', 'a', 'q', 'w'].includes(key)) return true;
  if (e.metaKey && e.shiftKey && key === 'z') return true;
  if (e.ctrlKey && ['c', 'v', 'x', 'z', 'y', 'a', 'w'].includes(key)) return true;
  return false;
};

const formatShortcutFromEvent = (e: React.KeyboardEvent): string | null => {
  // Skip standalone modifier keys
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return null;
  // Require at least one non-Shift modifier
  if (!e.metaKey && !e.ctrlKey && !e.altKey) return null;
  if (isSystemShortcut(e.nativeEvent)) return null;

  const parts: string[] = [];
  if (e.metaKey) parts.push('Cmd');
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  const keyMap: Record<string, string> = {
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    ' ': 'Space', Escape: 'Esc', Enter: 'Enter', Backspace: 'Backspace',
    Delete: 'Delete', Tab: 'Tab',
  };
  const key = keyMap[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  parts.push(key);
  return parts.join('+');
};

const ShortcutRecorder: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [recording, setRecording] = useState(false);
  const divRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') { setRecording(false); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { onChange(''); setRecording(false); return; }
    const shortcut = formatShortcutFromEvent(e);
    if (shortcut) { onChange(shortcut); setRecording(false); }
  };

  useEffect(() => {
    if (!recording) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (divRef.current && !divRef.current.contains(e.target as Node)) setRecording(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [recording]);

  return (
    <div
      ref={divRef}
      tabIndex={0}
      data-shortcut-input="true"
      onKeyDown={handleKeyDown}
      onClick={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      className={`w-36 rounded-xl border px-3 py-1.5 text-sm cursor-pointer select-none text-center outline-none transition-colors
        dark:bg-claude-darkSurfaceInset bg-claude-surfaceInset dark:text-claude-darkText text-claude-text
        ${recording
          ? 'border-claude-accent ring-1 ring-claude-accent/30 dark:text-claude-darkTextSecondary text-claude-textSecondary'
          : 'dark:border-claude-darkBorder border-claude-border hover:border-claude-accent/50'
        }`}
    >
      {value || i18nService.t('shortcutNotSet')}
    </div>
  );
};

const Settings: React.FC<SettingsProps> = ({ onClose, initialTab, notice, onUpdateFound, enterpriseConfig }) => {
  const dispatch = useDispatch();
  // 状态
  const [activeTab, setActiveTab] = useState<TabType>(initialTab ?? 'general');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [themeId, setThemeId] = useState<string>(themeService.getThemeId());
  const [language, setLanguage] = useState<LanguageType>('zh');
  const [autoLaunch, setAutoLaunchState] = useState(false);
  const [useSystemProxy, setUseSystemProxy] = useState(false);
  const [manualSttEnabled, setManualSttEnabled] = useState(true);
  const [speechStopCommand, setSpeechStopCommand] = useState(DEFAULT_SPEECH_INPUT_CONFIG.stopCommand);
  const [speechSubmitCommand, setSpeechSubmitCommand] = useState(DEFAULT_SPEECH_INPUT_CONFIG.submitCommand);
  const [sttLlmCorrectionEnabled, setSttLlmCorrectionEnabled] = useState(false);
  const [wakeInputEnabled, setWakeInputEnabled] = useState(DEFAULT_WAKE_INPUT_CONFIG.enabled);
  const [wakeInputWakeWordsText, setWakeInputWakeWordsText] = useState(DEFAULT_WAKE_INPUT_CONFIG.wakeWords.join('\n'));
  const [wakeInputSubmitCommand, setWakeInputSubmitCommand] = useState(DEFAULT_WAKE_INPUT_CONFIG.submitCommand);
  const [wakeInputCancelCommand, setWakeInputCancelCommand] = useState(DEFAULT_WAKE_INPUT_CONFIG.cancelCommand);
  const [wakeActivationReplyEnabled, setWakeActivationReplyEnabled] = useState(DEFAULT_WAKE_INPUT_CONFIG.activationReplyEnabled);
  const [wakeActivationReplyText, setWakeActivationReplyText] = useState(DEFAULT_WAKE_INPUT_CONFIG.activationReplyText);
  const [followUpDictationEnabled, setFollowUpDictationEnabled] = useState(false);
  const [wakeInputStatus, setWakeInputStatus] = useState<WakeInputStatus | null>(null);
  const [voiceCapabilityMatrix, setVoiceCapabilityMatrix] = useState<VoiceCapabilityMatrix | null>(null);
  const [voiceStrategy, setVoiceStrategy] = useState<VoiceStrategyValue>(defaultConfig.voice!.strategy);
  const [manualSttProvider, setManualSttProvider] = useState<VoiceCapabilityProvider>(VoiceProvider.MacosNative);
  const [ttsProvider, setTtsProvider] = useState<VoiceCapabilityProvider>(VoiceProvider.MacosNative);
  const [ttsEngine, setTtsEngine] = useState<TtsEngine>(DEFAULT_TTS_CONFIG.engine);
  const [voiceMacosNativeTtsConfig, setVoiceMacosNativeTtsConfig] = useState(defaultConfig.voice!.providers.macosNative);
  const [voiceLocalWhisperCppConfig, setVoiceLocalWhisperCppConfig] = useState<VoiceLocalWhisperCppConfig>(defaultConfig.voice!.providers.localWhisperCpp);
  const [voiceLocalWhisperCppStatus, setVoiceLocalWhisperCppStatus] = useState<VoiceLocalWhisperCppRuntimeStatus | null>(null);
  const [voiceLocalQwen3TtsConfig, setVoiceLocalQwen3TtsConfig] = useState<VoiceLocalQwen3TtsConfig>(defaultConfig.voice!.providers.localQwen3Tts);
  const [voiceLocalQwen3TtsStatus, setVoiceLocalQwen3TtsStatus] = useState<VoiceLocalQwen3TtsRuntimeStatus | null>(null);
  const [voiceLocalModelLibrary, setVoiceLocalModelLibrary] = useState<VoiceLocalModelLibrary | null>(null);
  const [voiceEdgeTtsConfig, setVoiceEdgeTtsConfig] = useState<VoiceEdgeTtsConfig>(defaultConfig.voice!.providers.edgeTts);
  const [voiceOpenAiConfig, setVoiceOpenAiConfig] = useState<VoiceOpenAiConfig>(defaultConfig.voice!.providers.openai);
  const [voiceAliyunConfig, setVoiceAliyunConfig] = useState<VoiceAliyunConfig>(defaultConfig.voice!.providers.aliyun);
  const [voiceVolcengineConfig, setVoiceVolcengineConfig] = useState<VoiceVolcengineConfig>(defaultConfig.voice!.providers.volcengine);
  const [voiceAzureConfig, setVoiceAzureConfig] = useState<VoiceAzureConfig>(defaultConfig.voice!.providers.azure);
  const [voiceCustomConfig, setVoiceCustomConfig] = useState<VoiceCustomConfig>(defaultConfig.voice!.providers.custom);
  const [ttsEnabled, setTtsEnabled] = useState(DEFAULT_TTS_CONFIG.enabled);
  const [ttsAutoPlayAssistantReply, setTtsAutoPlayAssistantReply] = useState(DEFAULT_TTS_CONFIG.autoPlayAssistantReply);
  const [ttsLlmRewriteEnabled, setTtsLlmRewriteEnabled] = useState(false);
  const [ttsSkipKeywordsText, setTtsSkipKeywordsText] = useState('');
  const [ttsVoiceId, setTtsVoiceId] = useState(DEFAULT_TTS_CONFIG.voiceId);
  const [ttsRate, setTtsRate] = useState(DEFAULT_TTS_CONFIG.rate);
  const [ttsVolume, setTtsVolume] = useState(DEFAULT_TTS_CONFIG.volume);
  const [ttsVoices, setTtsVoices] = useState<TtsVoice[]>([]);
  const [ttsAvailability, setTtsAvailability] = useState<TtsAvailability | null>(null);
  const [expandedVoiceSection, setExpandedVoiceSection] = useState<VoiceCapabilityKey | null>(VoiceCapability.ManualStt);
  const [selectedVoiceProvider, setSelectedVoiceProvider] = useState<VoiceProviderPanelKey>(VoiceProvider.MacosNative);
  const [showAllVoiceProviderStatuses, setShowAllVoiceProviderStatuses] = useState(false);
  const [isVoiceProviderWorkspaceExpanded, setIsVoiceProviderWorkspaceExpanded] = useState(false);
  const [expandedProviderGroup, setExpandedProviderGroup] = useState<ProviderGroupKey | null>('foundation');
  const [expandedProviderPanelSections, setExpandedProviderPanelSections] = useState<Record<ProviderPanelSectionKey, boolean>>({
    credentials: true,
    endpoint: false,
    features: false,
    connection: false,
    models: true,
    advanced: false,
  });
  const [qtbApiBaseUrl, setQtbApiBaseUrl] = useState(DEFAULT_QTB_API_BASE_URL);
  const [qtbWebBaseUrl, setQtbWebBaseUrl] = useState(DEFAULT_QTB_WEB_BASE_URL);
  const [isUpdatingAutoLaunch, setIsUpdatingAutoLaunch] = useState(false);
  const [preventSleep, setPreventSleepState] = useState(false);
  const [isUpdatingPreventSleep, setIsUpdatingPreventSleep] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(notice ?? null);
  const [testResult, setTestResult] = useState<ProviderConnectionTestResult | null>(null);
  const [isTestResultModalOpen, setIsTestResultModalOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [pendingDeleteProvider, setPendingDeleteProvider] = useState<ProviderType | null>(null);
  const [isImportingProviders, setIsImportingProviders] = useState(false);
  const [isExportingProviders, setIsExportingProviders] = useState(false);
  const initialThemeRef = useRef<'light' | 'dark' | 'system'>(themeService.getTheme());
  const initialThemeIdRef = useRef<string>(themeService.getThemeId());
  const initialLanguageRef = useRef<LanguageType>(i18nService.getLanguage());
  const didSaveRef = useRef(false);

  // Add state for active provider
  const [activeProvider, setActiveProvider] = useState<ProviderType>(getDefaultActiveProvider());
  const [showApiKey, setShowApiKey] = useState(false);

  // MiniMax OAuth state
  const [minimaxOAuthPhase, setMinimaxOAuthPhase] = useState<MiniMaxOAuthPhase>({ kind: 'idle' });
  const [minimaxOAuthRegion, setMinimaxOAuthRegion] = useState<MiniMaxRegion>('cn');
  const minimaxOAuthCancelRef = useRef(false);

  // Add state for providers configuration
  const [providers, setProviders] = useState<ProvidersConfig>(() => getDefaultProviders());

  const isBaseUrlLocked = (activeProvider === 'zhipu' && providers.zhipu.codingPlanEnabled) || (activeProvider === 'qwen' && providers.qwen.codingPlanEnabled) || (activeProvider === 'volcengine' && providers.volcengine.codingPlanEnabled) || (activeProvider === 'moonshot' && providers.moonshot.codingPlanEnabled) || (activeProvider === 'minimax' && providers.minimax.authType === 'oauth');
  
  // 创建引用来确保内容区域的滚动
  const contentRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const updateCheckTimerRef = useRef<number | null>(null);
  
  // 快捷键设置
  const [shortcuts, setShortcuts] = useState({
    newChat: 'Ctrl+N',
    search: 'Ctrl+F',
    settings: 'Ctrl+,',
  });

  // State for model editing
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [isEditingModel, setIsEditingModel] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [newModelName, setNewModelName] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newModelSupportsImage, setNewModelSupportsImage] = useState(false);
  const [modelFormError, setModelFormError] = useState<string | null>(null);

  // About tab
  const [appVersion, setAppVersion] = useState('');
  const [isExportingLogs, setIsExportingLogs] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [testModeUnlocked, setTestModeUnlocked] = useState(false);
  const [updateCheckStatus, setUpdateCheckStatus] = useState<'idle' | 'checking' | 'upToDate' | 'error'>('idle');

  const getVoiceCapabilityStatus = useCallback((capability: typeof VoiceCapability[keyof typeof VoiceCapability]) => {
    return voiceCapabilityMatrix?.capabilities?.[capability] ?? null;
  }, [voiceCapabilityMatrix]);

  const getVoiceProviderStatus = useCallback((provider: typeof VoiceProvider[keyof typeof VoiceProvider]) => {
    return voiceCapabilityMatrix?.providers?.[provider] ?? null;
  }, [voiceCapabilityMatrix]);

  const getVoiceProviderLabel = useCallback((provider?: string | null) => {
    if (!provider) {
      return i18nService.t('voiceProvider_none');
    }
    return i18nService.t('voiceProvider_' + provider);
  }, []);

  const getVoiceReasonLabel = useCallback((reason?: string | null) => {
    if (!reason) {
      return i18nService.t('voiceCapabilityReason_available');
    }
    return i18nService.t('voiceCapabilityReason_' + reason);
  }, []);

  const getWakeInputStatusText = useCallback(() => {
    if (!wakeInputEnabled) {
      return i18nService.t('wakeInputStatus_disabled');
    }
    if (!wakeInputStatus) {
      return i18nService.t('loading');
    }
    if (wakeInputStatus.status !== 'disabled') {
      return i18nService.t(`wakeInputStatus_${wakeInputStatus.status}`);
    }
    const capability = getVoiceCapabilityStatus(VoiceCapability.WakeInput);
    if (capability && capability.reason && capability.reason !== 'disabled_by_config') {
      return `${i18nService.t('wakeInputStatus_disabled')} · ${getVoiceReasonLabel(capability.reason)}`;
    }
    return i18nService.t(`wakeInputStatus_${wakeInputStatus.status}`);
  }, [getVoiceCapabilityStatus, getVoiceReasonLabel, wakeInputEnabled, wakeInputStatus]);

  const loadVoiceCapabilityMatrix = useCallback(async () => {
    try {
      return await window.electron.voice.getCapabilityMatrix();
    } catch (error) {
      console.error('Failed to load voice capability matrix:', error);
      return null;
    }
  }, []);

  const loadLocalWhisperCppStatus = useCallback(async () => {
    try {
      return await window.electron.voice.getLocalWhisperCppStatus();
    } catch (error) {
      console.error('Failed to load local whisper.cpp status:', error);
      return null;
    }
  }, []);

  const loadLocalQwen3TtsStatus = useCallback(async () => {
    try {
      return await window.electron.voice.getLocalQwen3TtsStatus();
    } catch (error) {
      console.error('Failed to load local Qwen3-TTS status:', error);
      return null;
    }
  }, []);

  const loadLocalModelLibrary = useCallback(async () => {
    try {
      return await window.electron.voice.getLocalModelLibrary();
    } catch (error) {
      console.error('Failed to load local voice model library:', error);
      return null;
    }
  }, []);

  const updateVoiceOpenAiConfig = useCallback((updates: Partial<VoiceOpenAiConfig>) => {
    setVoiceOpenAiConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateVoiceAliyunConfig = useCallback((updates: Partial<VoiceAliyunConfig>) => {
    setVoiceAliyunConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateVoiceVolcengineConfig = useCallback((updates: Partial<VoiceVolcengineConfig>) => {
    setVoiceVolcengineConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateVoiceAzureConfig = useCallback((updates: Partial<VoiceAzureConfig>) => {
    setVoiceAzureConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateVoiceCustomConfig = useCallback((updates: Partial<VoiceCustomConfig>) => {
    setVoiceCustomConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateVoiceLocalWhisperCppConfig = useCallback((updates: Partial<VoiceLocalWhisperCppConfig>) => {
    setVoiceLocalWhisperCppConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateVoiceLocalQwen3TtsConfig = useCallback((updates: Partial<VoiceLocalQwen3TtsConfig>) => {
    setVoiceLocalQwen3TtsConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateDisplayedTtsConfig = useCallback((updates: Partial<Pick<VoiceEdgeTtsConfig, 'ttsVoiceId' | 'ttsRate' | 'ttsVolume'>>) => {
    setTtsVoiceId((prev) => updates.ttsVoiceId ?? prev);
    setTtsRate((prev) => updates.ttsRate ?? prev);
    setTtsVolume((prev) => updates.ttsVolume ?? prev);
    if (ttsEngine === TtsEngine.EdgeTts) {
      setVoiceEdgeTtsConfig((prev) => ({ ...prev, ...updates }));
      return;
    }
    setVoiceMacosNativeTtsConfig((prev) => ({ ...prev, ...updates }));
  }, [ttsEngine]);

  const voiceStrategyOptions = [
    { value: 'manual', label: i18nService.t('voiceStrategy_manual') },
    { value: 'native_first', label: i18nService.t('voiceStrategy_native_first') },
    { value: 'cloud_first', label: i18nService.t('voiceStrategy_cloud_first') },
  ];

  const manualSttProviderOptions = [
    { value: VoiceProvider.MacosNative, label: getVoiceProviderLabel(VoiceProvider.MacosNative) },
    { value: VoiceProvider.LocalWhisperCpp, label: getVoiceProviderLabel(VoiceProvider.LocalWhisperCpp) },
    { value: VoiceProvider.CloudOpenAi, label: getVoiceProviderLabel(VoiceProvider.CloudOpenAi) },
    { value: VoiceProvider.CloudAliyun, label: getVoiceProviderLabel(VoiceProvider.CloudAliyun) },
    { value: VoiceProvider.CloudVolcengine, label: getVoiceProviderLabel(VoiceProvider.CloudVolcengine) },
  ];

  const ttsProviderOptions = [
    { value: VoiceProvider.MacosNative, label: getVoiceProviderLabel(VoiceProvider.MacosNative) },
    { value: VoiceProvider.LocalQwen3Tts, label: getVoiceProviderLabel(VoiceProvider.LocalQwen3Tts) },
    { value: VoiceProvider.CloudOpenAi, label: getVoiceProviderLabel(VoiceProvider.CloudOpenAi) },
    { value: VoiceProvider.CloudAliyun, label: getVoiceProviderLabel(VoiceProvider.CloudAliyun) },
    { value: VoiceProvider.CloudVolcengine, label: getVoiceProviderLabel(VoiceProvider.CloudVolcengine) },
    { value: VoiceProvider.CloudAzure, label: getVoiceProviderLabel(VoiceProvider.CloudAzure) },
  ];

  const getLocalModelStatus = useCallback((modelId: string): VoiceLocalModelInstallStatus | null => {
    return voiceLocalModelLibrary?.statuses?.[modelId] ?? null;
  }, [voiceLocalModelLibrary]);

  const getLocalModelsByProvider = useCallback((provider: typeof VoiceProvider[keyof typeof VoiceProvider]) => {
    return (voiceLocalModelLibrary?.catalog ?? []).filter((entry) => entry.provider === provider);
  }, [voiceLocalModelLibrary]);

  const renderVoiceCapabilityMeta = (capabilityKey: typeof VoiceCapability[keyof typeof VoiceCapability]) => {
    const capability = getVoiceCapabilityStatus(capabilityKey);
    if (!capability) {
      return (
        <div className="mt-2 text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary">
          {i18nService.t('loading')}
        </div>
      );
    }

    return (
      <div className="mt-2 space-y-1 text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary">
        <div>{i18nService.t('voiceCurrentProviderLabel')}: {getVoiceProviderLabel(capability.selectedProvider)}</div>
        <div>{i18nService.t('voicePlatformSupportLabel')}: {capability.platformSupported ? i18nService.t('voiceAvailabilityYes') : i18nService.t('voiceAvailabilityNo')}</div>
        <div>{i18nService.t('voicePackagedSupportLabel')}: {capability.packaged ? i18nService.t('voiceAvailabilityYes') : i18nService.t('voiceAvailabilityNo')}</div>
        <div>{i18nService.t('voiceRuntimeAvailableLabel')}: {capability.runtimeAvailable ? i18nService.t('voiceAvailabilityYes') : i18nService.t('voiceAvailabilityNo')}</div>
        <div>{i18nService.t('voiceReasonLabel')}: {getVoiceReasonLabel(capability.reason)}</div>
      </div>
    );
  };

  const renderVoiceProviderMeta = (providerKey: typeof VoiceProvider[keyof typeof VoiceProvider]) => {
    const provider = getVoiceProviderStatus(providerKey);
    if (!provider) {
      return null;
    }

    return (
      <div className="rounded-xl border dark:border-claude-darkBorder border-claude-border px-4 py-3">
        <div className="text-sm font-medium dark:text-claude-darkText text-claude-text">
          {getVoiceProviderLabel(provider.provider)}
        </div>
        <div className="mt-2 space-y-1 text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary">
          <div>{i18nService.t('voicePlatformSupportLabel')}: {provider.platformSupported ? i18nService.t('voiceAvailabilityYes') : i18nService.t('voiceAvailabilityNo')}</div>
          <div>{i18nService.t('voicePackagedSupportLabel')}: {provider.packaged ? i18nService.t('voiceAvailabilityYes') : i18nService.t('voiceAvailabilityNo')}</div>
          <div>{i18nService.t('voiceConfiguredLabel')}: {provider.configured ? i18nService.t('voiceAvailabilityYes') : i18nService.t('voiceAvailabilityNo')}</div>
          <div>{i18nService.t('voiceReasonLabel')}: {getVoiceReasonLabel(provider.reason)}</div>
        </div>
      </div>
    );
  };

  const toggleProviderPanelSection = useCallback((section: ProviderPanelSectionKey) => {
    setExpandedProviderPanelSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const getProviderGroupForKey = useCallback((provider: ProviderType): ProviderGroupKey => {
    return providerGroups.find((group) => group.providers.includes(provider))?.key ?? 'foundation';
  }, []);

  const getVoiceProviderConfiguredText = useCallback((providerKey: VoiceProviderPanelKey): string => {
    return getVoiceProviderStatus(providerKey)?.configured
      ? i18nService.t('voiceProviderConfigured')
      : i18nService.t('voiceProviderNotConfigured');
  }, [getVoiceProviderStatus]);

  const getVoiceProviderInUseTags = useCallback((providerKey: VoiceProviderPanelKey): string[] => {
    const tags: string[] = [];
    if (manualSttProvider === providerKey) {
      tags.push(i18nService.t('voiceCapabilityManualSttTitle'));
    }
    if (ttsProvider === providerKey) {
      tags.push(i18nService.t('voiceCapabilityTtsTitle'));
    }
    if (wakeInputEnabled && providerKey === VoiceProvider.MacosNative) {
      tags.push(i18nService.t('voiceCapabilityWakeInputTitle'));
    }
    if (followUpDictationEnabled && manualSttProvider === providerKey) {
      tags.push(i18nService.t('voiceCapabilityFollowUpTitle'));
    }
    return tags;
  }, [followUpDictationEnabled, manualSttProvider, ttsProvider, wakeInputEnabled]);

  const getProviderRailBadges = useCallback((providerKey: ProviderType, config: ProviderConfig): string[] => {
    const badges: string[] = [];
    if (providerKey === activeProvider) {
      badges.push(i18nService.t('statusCurrent'));
    }
    if (isCustomProvider(providerKey)) {
      badges.push(i18nService.t('customBadge'));
    }
    if (providerKey === 'minimax' && providers.minimax.authType === 'oauth') {
      badges.push('OAuth');
    }
    if (config.enabled) {
      badges.push(i18nService.t('providerStatusOn'));
    } else {
      badges.push(i18nService.t('providerStatusOff'));
    }
    if (providerRequiresApiKey(providerKey) && !config.apiKey.trim() && providerKey !== 'minimax') {
      badges.push(i18nService.t('providerMissingApiKey'));
    }
    if ((config.models ?? []).length > 0) {
      badges.push(`${(config.models ?? []).length} ${i18nService.t('providerModelCountUnit')}`);
    }
    return badges;
  }, [activeProvider, providers.minimax.authType]);

  const renderDisclosureHeader = useCallback((options: {
    title: string;
    subtitle?: string;
    expanded: boolean;
    onToggle: () => void;
    trailing?: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={options.onToggle}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-raised"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{options.title}</div>
        {options.subtitle && (
          <div className="mt-1 text-xs text-secondary">{options.subtitle}</div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {options.trailing}
        {options.expanded ? (
          <ChevronDownIcon className="h-4 w-4 text-secondary" />
        ) : (
          <ChevronRightIcon className="h-4 w-4 text-secondary" />
        )}
      </div>
    </button>
  ), []);

  const getVoiceCapabilitySummary = useCallback((capabilityKey: VoiceCapabilityKey): string => {
    switch (capabilityKey) {
      case VoiceCapability.ManualStt:
        return getVoiceProviderLabel(manualSttProvider);
      case VoiceCapability.WakeInput:
        return wakeInputEnabled
          ? getWakeInputStatusText()
          : i18nService.t('statusDisabled');
      case VoiceCapability.FollowUpDictation:
        return followUpDictationEnabled
          ? `${i18nService.t('voiceCurrentProviderLabel')}: ${getVoiceProviderLabel(manualSttProvider)}`
          : i18nService.t('statusDisabled');
      case VoiceCapability.Tts:
        return [
          getVoiceProviderLabel(ttsProvider),
          ttsProvider === VoiceProvider.MacosNative ? i18nService.t(`ttsEngine_${ttsEngine}`) : null,
          ttsAvailability?.lastResolvedEngine ? i18nService.t(`ttsEngine_${ttsAvailability.lastResolvedEngine}`) : null,
        ].filter(Boolean).join(' · ');
      default:
        return '';
    }
  }, [followUpDictationEnabled, getVoiceProviderLabel, getWakeInputStatusText, manualSttProvider, ttsAvailability?.lastResolvedEngine, ttsEngine, ttsProvider, wakeInputEnabled]);

  const inUseVoiceProviderKeys = useMemo(() => {
    const keys = new Set<VoiceProviderPanelKey>();
    if (manualSttProvider !== VoiceProvider.None) {
      keys.add(manualSttProvider as VoiceProviderPanelKey);
    }
    if (ttsProvider !== VoiceProvider.None) {
      keys.add(ttsProvider as VoiceProviderPanelKey);
    }
    if (wakeInputEnabled) {
      keys.add(VoiceProvider.MacosNative);
    }
    return Array.from(keys);
  }, [manualSttProvider, ttsProvider, wakeInputEnabled]);

  const renderLocalModelEntry = (entry: VoiceLocalModelCatalogEntry) => {
    const status = getLocalModelStatus(entry.id);
    const isDownloading = status?.downloading === true;
    const isInstalled = status?.installed === true;
    return (
      <div key={entry.id} className="rounded-lg border dark:border-claude-darkBorder border-claude-border px-3 py-2 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium dark:text-claude-darkText text-claude-text">{entry.label}</div>
            <div className="text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary">{entry.description}</div>
          </div>
          {entry.recommended && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {i18nService.t('voiceLocalModelRecommendedTag')}
            </span>
          )}
        </div>
        <div className="space-y-1 text-[11px] dark:text-claude-darkTextSecondary text-claude-textSecondary">
          <div>{i18nService.t('voiceLocalModelSizeLabel')}: ~{entry.approximateSizeMb} MB</div>
          <div>{i18nService.t('voiceLocalModelInstallBackendLabel')}: {i18nService.t('voiceLocalModelBackend_' + entry.installBackend)}</div>
          <div>{i18nService.t('voiceLocalModelStatusLabel')}: {i18nService.t('voiceLocalModelState_' + (status?.state || 'not_installed'))}</div>
          {typeof status?.progressPercent === 'number' && (
            <div>{i18nService.t('voiceLocalModelProgressLabel')}: {status.progressPercent}%</div>
          )}
          {status?.error && (
            <div>{i18nService.t('voiceLocalModelLastErrorLabel')}: {status.error}</div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!isDownloading && (
            <button
              type="button"
              onClick={() => { void handleInstallLocalModel(entry); }}
              className="rounded-lg border dark:border-claude-darkBorder border-claude-border px-3 py-1.5 text-[11px] font-medium dark:text-claude-darkText text-claude-text hover:bg-gray-50 dark:hover:bg-claude-darkHover"
            >
              {isInstalled ? i18nService.t('voiceLocalModelReinstallButton') : i18nService.t('voiceLocalModelInstallButton')}
            </button>
          )}
          {isDownloading && (
            <button
              type="button"
              onClick={() => { void handleCancelLocalModelInstall(entry.id); }}
              className="rounded-lg border dark:border-claude-darkBorder border-claude-border px-3 py-1.5 text-[11px] font-medium dark:text-claude-darkText text-claude-text hover:bg-gray-50 dark:hover:bg-claude-darkHover"
            >
              {i18nService.t('voiceLocalModelCancelButton')}
            </button>
          )}
          {status?.resolvedPath && (
            <button
              type="button"
              onClick={() => { void window.electron.shell.openPath(status.resolvedPath); }}
              className="rounded-lg border dark:border-claude-darkBorder border-claude-border px-3 py-1.5 text-[11px] font-medium dark:text-claude-darkText text-claude-text hover:bg-gray-50 dark:hover:bg-claude-darkHover"
            >
              {i18nService.t('voiceLocalModelOpenPathButton')}
            </button>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    window.electron.appInfo.getVersion().then(setAppVersion);
  }, []);

  useEffect(() => {
    setShowApiKey(false);
  }, [activeProvider]);

  const handleCheckUpdate = useCallback(async () => {
    if (updateCheckStatus === 'checking' || !appVersion) return;
    setUpdateCheckStatus('checking');
    try {
      const info = await checkForAppUpdate(appVersion, true);
      if (info) {
        setUpdateCheckStatus('idle');
        onUpdateFound?.(info);
      } else {
        setUpdateCheckStatus('upToDate');
        if (updateCheckTimerRef.current != null) {
          window.clearTimeout(updateCheckTimerRef.current);
        }
        updateCheckTimerRef.current = window.setTimeout(() => {
          setUpdateCheckStatus('idle');
          updateCheckTimerRef.current = null;
        }, 3000);
      }
    } catch {
      setUpdateCheckStatus('error');
      if (updateCheckTimerRef.current != null) {
        window.clearTimeout(updateCheckTimerRef.current);
      }
      updateCheckTimerRef.current = window.setTimeout(() => {
        setUpdateCheckStatus('idle');
        updateCheckTimerRef.current = null;
      }, 3000);
    }
  }, [appVersion, updateCheckStatus, onUpdateFound]);

  const handleExportLogs = useCallback(async () => {
    if (isExportingLogs) {
      return;
    }

    setError(null);
    setNoticeMessage(null);
    setIsExportingLogs(true);
    try {
      const result = await window.electron.log.exportZip();
      if (!result.success) {
        setError(result.error || i18nService.t('aboutExportLogsFailed'));
        return;
      }
      if (result.canceled) {
        return;
      }

      if (result.path) {
        await window.electron.shell.showItemInFolder(result.path);
      }

      if ((result.missingEntries?.length ?? 0) > 0) {
        const missingList = result.missingEntries?.join(', ') || '';
        setNoticeMessage(`${i18nService.t('aboutExportLogsPartial')}: ${missingList}`);
      } else {
        setNoticeMessage(i18nService.t('aboutExportLogsSuccess'));
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : i18nService.t('aboutExportLogsFailed'));
    } finally {
      setIsExportingLogs(false);
    }
  }, [isExportingLogs]);

  const handleRefreshLocalWhisperCppStatus = useCallback(async () => {
    setError(null);
    const [matrix, status] = await Promise.all([
      loadVoiceCapabilityMatrix(),
      loadLocalWhisperCppStatus(),
    ]);
    if (matrix && status) {
      setVoiceCapabilityMatrix(matrix);
      setVoiceLocalWhisperCppStatus(status);
      setNoticeMessage(i18nService.t('voiceLocalWhisperCppRefreshSuccess'));
    }
  }, [loadLocalWhisperCppStatus, loadVoiceCapabilityMatrix]);

  const handleRefreshLocalQwen3TtsStatus = useCallback(async () => {
    setError(null);
    const [matrix, status, library] = await Promise.all([
      loadVoiceCapabilityMatrix(),
      loadLocalQwen3TtsStatus(),
      loadLocalModelLibrary(),
    ]);
    if (matrix) {
      setVoiceCapabilityMatrix(matrix);
    }
    if (status) {
      setVoiceLocalQwen3TtsStatus(status);
    }
    if (library) {
      setVoiceLocalModelLibrary(library);
    }
    if (matrix && status) {
      setNoticeMessage(i18nService.t('voiceLocalQwen3TtsRefreshSuccess'));
    }
  }, [loadLocalModelLibrary, loadLocalQwen3TtsStatus, loadVoiceCapabilityMatrix]);

  const handlePrepareLocalWhisperCppDirectories = useCallback(async () => {
    setError(null);
    try {
      const result = await window.electron.voice.ensureLocalWhisperCppDirectories();
      if (!result.success || !result.status) {
        setError(result.error || i18nService.t('voiceLocalWhisperCppPrepareFailed'));
        return;
      }
      setVoiceLocalWhisperCppStatus(result.status);
      const matrix = await loadVoiceCapabilityMatrix();
      if (matrix) {
        setVoiceCapabilityMatrix(matrix);
      }
      setNoticeMessage(i18nService.t('voiceLocalWhisperCppPrepareSuccess'));
    } catch (error) {
      setError(error instanceof Error ? error.message : i18nService.t('voiceLocalWhisperCppPrepareFailed'));
    }
  }, [loadVoiceCapabilityMatrix]);

  const handleInstallLocalModel = useCallback(async (entry: VoiceLocalModelCatalogEntry) => {
    const requirements = entry.requirements.join('\n');
    const warnings = entry.warnings.join('\n');
    const confirmed = window.confirm(
      `${i18nService.t('voiceLocalModelInstallConfirmTitle')}\n\n${entry.label}\n\n${i18nService.t('voiceLocalModelRequirementsLabel')}:\n${requirements || '-'}\n\n${i18nService.t('voiceLocalModelWarningsLabel')}:\n${warnings || '-'}`
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    const result = await window.electron.voice.installLocalModel(entry.id);
    if (!result.success) {
      setError(result.error || i18nService.t('voiceLocalModelInstallFailed'));
    }
    if (result.library) {
      setVoiceLocalModelLibrary(result.library);
    }
    const [whisperStatus, qwenStatus, matrix] = await Promise.all([
      loadLocalWhisperCppStatus(),
      loadLocalQwen3TtsStatus(),
      loadVoiceCapabilityMatrix(),
    ]);
    if (whisperStatus) {
      setVoiceLocalWhisperCppStatus(whisperStatus);
    }
    if (qwenStatus) {
      setVoiceLocalQwen3TtsStatus(qwenStatus);
    }
    if (matrix) {
      setVoiceCapabilityMatrix(matrix);
    }
  }, [loadLocalQwen3TtsStatus, loadLocalWhisperCppStatus, loadVoiceCapabilityMatrix]);

  const handleCancelLocalModelInstall = useCallback(async (modelId: string) => {
    const result = await window.electron.voice.cancelLocalModelInstall(modelId);
    if (result.library) {
      setVoiceLocalModelLibrary(result.library);
    }
  }, []);

  const handleOpenLocalWhisperCppDirectory = useCallback(async (target: 'resourceRoot' | 'binaryDirectory' | 'modelsDirectory') => {
    setError(null);
    const status = voiceLocalWhisperCppStatus ?? await loadLocalWhisperCppStatus();
    const targetPath = status?.[target];
    if (!targetPath) {
      setError(i18nService.t('voiceLocalWhisperCppDirectoryUnavailable'));
      return;
    }
    if (!voiceLocalWhisperCppStatus && status) {
      setVoiceLocalWhisperCppStatus(status);
    }
    const result = await window.electron.shell.openPath(targetPath);
    if (!result.success) {
      setError(result.error || i18nService.t('voiceLocalWhisperCppDirectoryUnavailable'));
    }
  }, [loadLocalWhisperCppStatus, voiceLocalWhisperCppStatus]);

  const handleOpenLocalQwen3TtsDirectory = useCallback(async (target: 'resourceRoot' | 'modelsRoot') => {
    setError(null);
    const status = voiceLocalQwen3TtsStatus ?? await loadLocalQwen3TtsStatus();
    const targetPath = status?.[target];
    if (!targetPath) {
      setError(i18nService.t('voiceLocalQwen3TtsDirectoryUnavailable'));
      return;
    }
    if (!voiceLocalQwen3TtsStatus && status) {
      setVoiceLocalQwen3TtsStatus(status);
    }
    const result = await window.electron.shell.openPath(targetPath);
    if (!result.success) {
      setError(result.error || i18nService.t('voiceLocalQwen3TtsDirectoryUnavailable'));
    }
  }, [loadLocalQwen3TtsStatus, voiceLocalQwen3TtsStatus]);

  const coworkConfig = useSelector((state: RootState) => state.cowork.config);

  const [coworkAgentEngine, setCoworkAgentEngine] = useState<CoworkAgentEngine>(coworkConfig.agentEngine || 'openclaw');
  const [coworkMemoryEnabled, setCoworkMemoryEnabled] = useState<boolean>(coworkConfig.memoryEnabled ?? true);
  const [coworkMemoryLlmJudgeEnabled, setCoworkMemoryLlmJudgeEnabled] = useState<boolean>(coworkConfig.memoryLlmJudgeEnabled ?? false);
  const [coworkMemoryEntries, setCoworkMemoryEntries] = useState<CoworkUserMemoryEntry[]>([]);
  const [coworkMemoryStats, setCoworkMemoryStats] = useState<CoworkMemoryStats | null>(null);
  const [coworkMemoryListLoading, setCoworkMemoryListLoading] = useState<boolean>(false);
  const [coworkMemoryQuery, setCoworkMemoryQuery] = useState<string>('');
  const [coworkMemoryEditingId, setCoworkMemoryEditingId] = useState<string | null>(null);
  const [coworkMemoryDraftText, setCoworkMemoryDraftText] = useState<string>('');
  const [showMemoryModal, setShowMemoryModal] = useState<boolean>(false);
  const [bootstrapIdentity, setBootstrapIdentity] = useState<string>('');
  const [bootstrapUser, setBootstrapUser] = useState<string>('');
  const [bootstrapSoul, setBootstrapSoul] = useState<string>('');
  const [bootstrapLoaded, setBootstrapLoaded] = useState<boolean>(false);
  const [openClawEngineStatus, setOpenClawEngineStatus] = useState<OpenClawEngineStatus | null>(null);

  useEffect(() => {
    setCoworkAgentEngine(coworkConfig.agentEngine || 'openclaw');
    setCoworkMemoryEnabled(coworkConfig.memoryEnabled ?? true);
    setCoworkMemoryLlmJudgeEnabled(coworkConfig.memoryLlmJudgeEnabled ?? false);
  }, [
    coworkConfig.agentEngine,
    coworkConfig.memoryEnabled,
    coworkConfig.memoryLlmJudgeEnabled,
  ]);

  useEffect(() => () => {
    if (updateCheckTimerRef.current != null) {
      window.clearTimeout(updateCheckTimerRef.current);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void coworkService.getOpenClawEngineStatus().then((status) => {
      if (!active || !status) return;
      setOpenClawEngineStatus(status);
    });
    const unsubscribe = coworkService.onOpenClawEngineStatus((status) => {
      if (!active) return;
      setOpenClawEngineStatus(status);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      const config = configService.getConfig();
      
      // Set general settings
      initialThemeRef.current = config.theme;
      initialLanguageRef.current = config.language;
      setTheme(config.theme);
      setLanguage(config.language);
      setUseSystemProxy(config.useSystemProxy ?? false);
      const voiceConfig = createVoiceConfigFromLegacy({
        voice: config.voice,
        speechInput: config.speechInput,
        wakeInput: config.wakeInput,
        tts: config.tts,
      });
      setManualSttEnabled(voiceConfig.capabilities.manualStt.enabled);
      setSpeechStopCommand(voiceConfig.commands.manualStopCommand);
      setSpeechSubmitCommand(voiceConfig.commands.manualSubmitCommand);
      setSttLlmCorrectionEnabled(voiceConfig.postProcess.sttLlmCorrectionEnabled);
      setWakeInputEnabled(voiceConfig.capabilities.wakeInput.enabled);
      setWakeInputWakeWordsText(voiceConfig.commands.wakeWords.join('\n'));
      setWakeInputSubmitCommand(voiceConfig.commands.wakeSubmitCommand);
      setWakeInputCancelCommand(voiceConfig.commands.wakeCancelCommand);
      setWakeActivationReplyEnabled(voiceConfig.commands.wakeActivationReplyEnabled);
      setWakeActivationReplyText(voiceConfig.commands.wakeActivationReplyText);
      setFollowUpDictationEnabled(voiceConfig.capabilities.followUpDictation.enabled);
      setVoiceStrategy(voiceConfig.strategy);
      setManualSttProvider(voiceConfig.capabilities.manualStt.provider);
      setTtsProvider(voiceConfig.capabilities.tts.provider);
      setTtsEngine(voiceConfig.capabilities.tts.engine);
      setVoiceMacosNativeTtsConfig(voiceConfig.providers.macosNative);
      setVoiceLocalWhisperCppConfig(voiceConfig.providers.localWhisperCpp);
      setVoiceLocalQwen3TtsConfig(voiceConfig.providers.localQwen3Tts);
      setVoiceEdgeTtsConfig(voiceConfig.providers.edgeTts);
      setVoiceOpenAiConfig(voiceConfig.providers.openai);
      setVoiceAliyunConfig(voiceConfig.providers.aliyun);
      setVoiceVolcengineConfig(voiceConfig.providers.volcengine);
      setVoiceAzureConfig(voiceConfig.providers.azure);
      setVoiceCustomConfig(voiceConfig.providers.custom);
      setTtsEnabled(voiceConfig.capabilities.tts.enabled);
      setTtsAutoPlayAssistantReply(voiceConfig.capabilities.tts.autoPlayAssistantReply);
      setTtsLlmRewriteEnabled(voiceConfig.postProcess.ttsLlmRewriteEnabled);
      setTtsSkipKeywordsText(voiceConfig.postProcess.ttsSkipKeywords.join('\n'));
      setTtsVoiceId(voiceConfig.capabilities.tts.engine === TtsEngine.EdgeTts
        ? voiceConfig.providers.edgeTts.ttsVoiceId
        : voiceConfig.providers.macosNative.ttsVoiceId);
      setTtsRate(voiceConfig.capabilities.tts.engine === TtsEngine.EdgeTts
        ? voiceConfig.providers.edgeTts.ttsRate
        : voiceConfig.providers.macosNative.ttsRate);
      setTtsVolume(voiceConfig.capabilities.tts.engine === TtsEngine.EdgeTts
        ? voiceConfig.providers.edgeTts.ttsVolume
        : voiceConfig.providers.macosNative.ttsVolume);
      if (voiceConfig.capabilities.tts.enabled) {
        setExpandedVoiceSection(VoiceCapability.Tts);
        setSelectedVoiceProvider(voiceConfig.capabilities.tts.provider as VoiceProviderPanelKey);
      } else if (voiceConfig.capabilities.manualStt.enabled) {
        setExpandedVoiceSection(VoiceCapability.ManualStt);
        setSelectedVoiceProvider(voiceConfig.capabilities.manualStt.provider as VoiceProviderPanelKey);
      } else if (voiceConfig.capabilities.wakeInput.enabled) {
        setExpandedVoiceSection(VoiceCapability.WakeInput);
        setSelectedVoiceProvider(VoiceProvider.MacosNative);
      } else if (voiceConfig.capabilities.followUpDictation.enabled) {
        setExpandedVoiceSection(VoiceCapability.FollowUpDictation);
        setSelectedVoiceProvider(voiceConfig.capabilities.manualStt.provider as VoiceProviderPanelKey);
      }
      setQtbApiBaseUrl(config.auth?.qtbApiBaseUrl || DEFAULT_QTB_API_BASE_URL);
      setQtbWebBaseUrl(config.auth?.qtbWebBaseUrl || DEFAULT_QTB_WEB_BASE_URL);
      const savedTestMode = config.app?.testMode ?? false;
      setTestMode(savedTestMode);
      if (savedTestMode) setTestModeUnlocked(true);

      // Load auto-launch setting
      window.electron.autoLaunch.get().then(({ enabled }) => {
        setAutoLaunchState(enabled);
      }).catch(err => {
        console.error('Failed to load auto-launch setting:', err);
      });

      // Load prevent-sleep setting
      window.electron.preventSleep.get().then(({ enabled }) => {
        setPreventSleepState(enabled);
      }).catch(err => {
        console.error('Failed to load prevent-sleep setting:', err);
      });

      // Set up providers based on saved config
      if (config.api) {
        // For backward compatibility with older config
        // Initialize active provider based on baseUrl
        const normalizedApiBaseUrl = config.api.baseUrl.toLowerCase();
        if (normalizedApiBaseUrl.includes('openai')) {
          setActiveProvider('openai');
          setProviders(prev => ({
            ...prev,
            openai: {
              ...prev.openai,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('deepseek')) {
          setActiveProvider('deepseek');
          setProviders(prev => ({
            ...prev,
            deepseek: {
              ...prev.deepseek,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('moonshot.ai') || normalizedApiBaseUrl.includes('moonshot.cn')) {
          setActiveProvider('moonshot');
          setProviders(prev => ({
            ...prev,
            moonshot: {
              ...prev.moonshot,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('bigmodel.cn')) {
          setActiveProvider('zhipu');
          setProviders(prev => ({
            ...prev,
            zhipu: {
              ...prev.zhipu,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('minimax')) {
          setActiveProvider('minimax');
          setProviders(prev => ({
            ...prev,
            minimax: {
              ...prev.minimax,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('openapi.youdao.com')) {
          setActiveProvider('youdaozhiyun');
          setProviders(prev => ({
            ...prev,
            youdaozhiyun: {
              ...prev.youdaozhiyun,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('dashscope')) {
          setActiveProvider('qwen');
          setProviders(prev => ({
            ...prev,
            qwen: {
              ...prev.qwen,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('stepfun')) {
          setActiveProvider('stepfun');
          setProviders(prev => ({
            ...prev,
            stepfun: {
              ...prev.stepfun,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('openrouter.ai')) {
          setActiveProvider('openrouter');
          setProviders(prev => ({
            ...prev,
            openrouter: {
              ...prev.openrouter,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('googleapis')) {
          setActiveProvider('gemini');
          setProviders(prev => ({
            ...prev,
            gemini: {
              ...prev.gemini,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('anthropic')) {
          setActiveProvider('anthropic');
          setProviders(prev => ({
            ...prev,
            anthropic: {
              ...prev.anthropic,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        } else if (normalizedApiBaseUrl.includes('ollama') || normalizedApiBaseUrl.includes('11434')) {
          setActiveProvider('ollama');
          setProviders(prev => ({
            ...prev,
            ollama: {
              ...prev.ollama,
              enabled: true,
              apiKey: config.api.key,
              baseUrl: config.api.baseUrl
            }
          }));
        }
      }
      
      // Load provider-specific configurations if available
      // 合并已保存的配置和默认配置，确保新添加的 provider 能被显示
      if (config.providers) {
        setProviders(prev => {
          const merged = {
            ...prev,  // 保留默认的 providers（包括新添加的 anthropic）
            ...config.providers,  // 覆盖已保存的配置
          };

          // After merging, find the first enabled provider to set as activeProvider
          // This ensures we don't use stale activeProvider from old config.api.baseUrl
          const firstEnabledProvider = providerKeys.find(providerKey => merged[providerKey]?.enabled);
          if (firstEnabledProvider) {
            setActiveProvider(firstEnabledProvider);
          }

          return Object.fromEntries(
            Object.entries(merged).map(([providerKey, providerConfig]) => {
              const models = providerConfig.models?.map(model => ({
                ...model,
                supportsImage: model.supportsImage ?? false,
              }));
              return [
                providerKey,
                {
                  ...providerConfig,
                  apiFormat: getEffectiveApiFormat(providerKey, (providerConfig as ProviderConfig).apiFormat),
                  models,
                },
              ];
            })
          ) as ProvidersConfig;
        });
      }
      
      // 加载快捷键设置
      if (config.shortcuts) {
        setShortcuts(prev => ({
          ...prev,
          ...config.shortcuts,
        }));
      }
    } catch (error) {
      setError('Failed to load settings');
    }
  }, []);

  useEffect(() => {
    let active = true;
    void loadVoiceCapabilityMatrix().then((matrix) => {
      if (!active || !matrix) {
        return;
      }
      setVoiceCapabilityMatrix(matrix);
    });
    void loadLocalWhisperCppStatus().then((status) => {
      if (!active || !status) {
        return;
      }
      setVoiceLocalWhisperCppStatus(status);
    });
    void loadLocalQwen3TtsStatus().then((status) => {
      if (!active || !status) {
        return;
      }
      setVoiceLocalQwen3TtsStatus(status);
    });
    void loadLocalModelLibrary().then((library) => {
      if (!active || !library) {
        return;
      }
      setVoiceLocalModelLibrary(library);
    });

    void window.electron.wakeInput.getStatus().then((status) => {
      if (active) {
        setWakeInputStatus(status);
      }
    }).catch((error) => {
      console.error('Failed to load wake input status:', error);
    });

    const unsubscribeWakeInput = window.electron.wakeInput.onStateChanged((status) => {
      if (active) {
        setWakeInputStatus(status);
      }
    });
    const unsubscribeVoice = window.electron.voice.onCapabilityChanged((matrix) => {
      if (active) {
        setVoiceCapabilityMatrix(matrix);
        void loadLocalWhisperCppStatus().then((status) => {
          if (active && status) {
            setVoiceLocalWhisperCppStatus(status);
          }
        });
        void loadLocalQwen3TtsStatus().then((status) => {
          if (active && status) {
            setVoiceLocalQwen3TtsStatus(status);
          }
        });
      }
    });
    const unsubscribeLocalModels = window.electron.voice.onLocalModelLibraryChanged((library) => {
      if (active) {
        setVoiceLocalModelLibrary(library);
      }
    });
    const unsubscribeTts = window.electron.tts.onStateChanged((event) => {
      if (!active || event.type !== 'availability_changed' || !event.availability) {
        return;
      }
      setTtsAvailability(event.availability);
    });

    return () => {
      active = false;
      unsubscribeWakeInput();
      unsubscribeVoice();
      unsubscribeLocalModels();
      unsubscribeTts();
    };
  }, [loadLocalModelLibrary, loadLocalQwen3TtsStatus, loadLocalWhisperCppStatus, loadVoiceCapabilityMatrix]);

  useEffect(() => {
    if (ttsEngine === TtsEngine.EdgeTts) {
      setTtsVoiceId(voiceEdgeTtsConfig.ttsVoiceId);
      setTtsRate(voiceEdgeTtsConfig.ttsRate);
      setTtsVolume(voiceEdgeTtsConfig.ttsVolume);
      return;
    }
    setTtsVoiceId(voiceMacosNativeTtsConfig.ttsVoiceId);
    setTtsRate(voiceMacosNativeTtsConfig.ttsRate);
    setTtsVolume(voiceMacosNativeTtsConfig.ttsVolume);
  }, [ttsEngine, voiceEdgeTtsConfig.ttsRate, voiceEdgeTtsConfig.ttsVoiceId, voiceEdgeTtsConfig.ttsVolume, voiceMacosNativeTtsConfig.ttsRate, voiceMacosNativeTtsConfig.ttsVoiceId, voiceMacosNativeTtsConfig.ttsVolume]);

  useEffect(() => {
    let active = true;
    const syncTtsRuntime = async () => {
      try {
        const availability = ttsEngine === TtsEngine.EdgeTts
          ? await window.electron.tts.prepare({ engine: ttsEngine }).then((result) => result.availability)
          : await window.electron.tts.getAvailability({ engine: ttsEngine });
        if (active && availability) {
          setTtsAvailability(availability);
        }
      } catch (error) {
        console.error('Failed to prepare TTS engine:', error);
      }

      try {
        const result = await window.electron.tts.getVoices({ engine: ttsEngine });
        if (!active) {
          return;
        }
        if (result.success && result.voices) {
          setTtsVoices(result.voices);
          const currentVoiceId = ttsVoiceId.trim();
          if (currentVoiceId && !result.voices.some((voice) => voice.identifier === currentVoiceId)) {
            updateDisplayedTtsConfig({ ttsVoiceId: '' });
          }
          return;
        }
        setTtsVoices([]);
      } catch (error) {
        console.error('Failed to load TTS voices:', error);
        if (active) {
          setTtsVoices([]);
        }
      }
    };

    void syncTtsRuntime();
    return () => {
      active = false;
    };
  }, [ttsEngine, ttsVoiceId, updateDisplayedTtsConfig]);

  useEffect(() => {
    return () => {
      if (didSaveRef.current) {
        return;
      }
      themeService.restoreTheme(initialThemeIdRef.current, initialThemeRef.current);
      i18nService.setLanguage(initialLanguageRef.current, { persist: false });
    };
  }, []);

  // 监听标签页切换，确保内容区域滚动到顶部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  useEffect(() => {
    setNoticeMessage(notice ?? null);
  }, [notice]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Subscribe to language changes
  useEffect(() => {
    const unsubscribe = i18nService.subscribe(() => {
      setLanguage(i18nService.getLanguage());
    });
    return unsubscribe;
  }, []);

  // Compute visible providers based on language, including active custom_N entries
  const visibleProviders = useMemo(() => {
    const visibleKeys = getVisibleProviders(language);
    const filtered: Partial<ProvidersConfig> = {};
    for (const key of visibleKeys) {
      if (providers[key as keyof ProvidersConfig]) {
        filtered[key as keyof ProvidersConfig] = providers[key as keyof ProvidersConfig];
      }
    }
    // Append custom_N providers that exist in state, sorted by numeric suffix
    for (const key of CUSTOM_PROVIDER_KEYS) {
      if (providers[key]) {
        filtered[key] = providers[key];
      }
    }
    return filtered as ProvidersConfig;
  }, [language, providers]);

  const buildProviderGroupsForRail = useCallback(() => {
    return providerGroups
      .map((group) => ({
        key: group.key,
        providers: group.providers.filter((provider) => visibleProviders[provider]),
      }))
      .filter((group) => group.providers.length > 0);
  }, [visibleProviders]);

  // Ensure activeProvider is always in visibleProviders when language changes
  useEffect(() => {
    const visibleKeys = Object.keys(visibleProviders) as ProviderType[];
    if (visibleKeys.length > 0 && !visibleKeys.includes(activeProvider)) {
      // If current activeProvider is not visible, switch to first visible provider
      const firstEnabledVisible = visibleKeys.find(key => visibleProviders[key]?.enabled);
      setActiveProvider(firstEnabledVisible ?? visibleKeys[0]);
    }
  }, [visibleProviders, activeProvider]);

  useEffect(() => {
    setExpandedProviderGroup(getProviderGroupForKey(activeProvider));
  }, [activeProvider, getProviderGroupForKey]);

  useEffect(() => {
    if (expandedVoiceSection === VoiceCapability.Tts && ttsProvider !== VoiceProvider.None) {
      setSelectedVoiceProvider(ttsProvider as VoiceProviderPanelKey);
      return;
    }
    if (
      (expandedVoiceSection === VoiceCapability.ManualStt || expandedVoiceSection === VoiceCapability.FollowUpDictation)
      && manualSttProvider !== VoiceProvider.None
    ) {
      setSelectedVoiceProvider(manualSttProvider as VoiceProviderPanelKey);
      return;
    }
    if (expandedVoiceSection === VoiceCapability.WakeInput) {
      setSelectedVoiceProvider(VoiceProvider.MacosNative);
    }
  }, [expandedVoiceSection, manualSttProvider, ttsProvider]);

  const handleVoiceSectionToggle = useCallback((section: VoiceCapabilityKey) => {
    setExpandedVoiceSection((current) => (current === section ? null : section));
  }, []);

  const handleProviderGroupToggle = useCallback((group: ProviderGroupKey) => {
    setExpandedProviderGroup((current) => (current === group ? null : group));
  }, []);

  // Handle adding a new custom provider
  const handleAddCustomProvider = () => {
    // Find the first unused custom slot
    const usedKeys = new Set(Object.keys(providers));
    const newKey = CUSTOM_PROVIDER_KEYS.find(k => !usedKeys.has(k));
    if (!newKey) return; // All 10 slots used
    setProviders(prev => ({
      ...prev,
      [newKey]: {
        enabled: false,
        apiKey: '',
        baseUrl: '',
        apiFormat: 'openai' as const,
        models: [],
        displayName: undefined,
      },
    }));
    setActiveProvider(newKey);
    setShowApiKey(false);
    setIsAddingModel(false);
    setIsEditingModel(false);
    setEditingModelId(null);
    setNewModelName('');
    setNewModelId('');
    setNewModelSupportsImage(false);
    setModelFormError(null);
  };

  // Handle deleting a custom provider
  const handleDeleteCustomProvider = (key: ProviderType) => {
    setPendingDeleteProvider(key);
  };

  const confirmDeleteCustomProvider = () => {
    const key = pendingDeleteProvider;
    if (!key) return;
    setPendingDeleteProvider(null);
    setProviders(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    // Persist the deletion immediately so it survives window close
    const currentConfig = configService.getConfig();
    const updatedProviders = { ...currentConfig.providers };
    delete updatedProviders[key];
    configService.updateConfig({ providers: updatedProviders as AppConfig['providers'] });
    // If the deleted provider was active, switch to first visible
    if (activeProvider === key) {
      const visibleKeys = Object.keys(visibleProviders).filter(k => k !== key) as ProviderType[];
      const firstEnabled = visibleKeys.find(k => visibleProviders[k]?.enabled);
      setActiveProvider(firstEnabled ?? visibleKeys[0] ?? providerKeys[0]);
    }
  };

  // Handle provider change
  const handleProviderChange = (provider: ProviderType) => {
    setIsAddingModel(false);
    setIsEditingModel(false);
    setEditingModelId(null);
    setNewModelName('');
    setNewModelId('');
    setNewModelSupportsImage(false);
    setModelFormError(null);
    setActiveProvider(provider);
    // 切换 provider 时清除测试结果
    setIsTestResultModalOpen(false);
    setTestResult(null);
  };

  // Handle provider configuration change
  const handleProviderConfigChange = (provider: ProviderType, field: string, value: string) => {
    setProviders(prev => {
      if (field === 'apiFormat') {
        const nextApiFormat = getEffectiveApiFormat(provider, value);
        const nextProviderConfig: ProviderConfig = {
          ...prev[provider],
          apiFormat: nextApiFormat,
        };

        // Only auto-switch URL when current value is still a known default URL.
        if (shouldAutoSwitchProviderBaseUrl(provider, prev[provider].baseUrl)) {
          const defaultBaseUrl = getProviderDefaultBaseUrl(provider, nextApiFormat);
          if (defaultBaseUrl) {
            nextProviderConfig.baseUrl = defaultBaseUrl;
          }
        }

        return {
          ...prev,
          [provider]: nextProviderConfig,
        };
      }

      // Handle codingPlanEnabled toggle for zhipu
      if (field === 'codingPlanEnabled' && provider === 'zhipu') {
        const codingPlanEnabled = value === 'true';
        return {
          ...prev,
          zhipu: {
            ...prev.zhipu,
            codingPlanEnabled,
          },
        };
      }

      // Handle codingPlanEnabled toggle for qwen
      if (field === 'codingPlanEnabled' && provider === 'qwen') {
        const codingPlanEnabled = value === 'true';
        return {
          ...prev,
          qwen: {
            ...prev.qwen,
            codingPlanEnabled,
          },
        };
      }

      // Handle codingPlanEnabled toggle for volcengine
      if (field === 'codingPlanEnabled' && provider === 'volcengine') {
        const codingPlanEnabled = value === 'true';
        return {
          ...prev,
          volcengine: {
            ...prev.volcengine,
            codingPlanEnabled,
          },
        };
      }

      // Handle codingPlanEnabled toggle for moonshot
      if (field === 'codingPlanEnabled' && provider === 'moonshot') {
        const codingPlanEnabled = value === 'true';
        return {
          ...prev,
          moonshot: {
            ...prev.moonshot,
            codingPlanEnabled,
          },
        };
      }

      return {
        ...prev,
        [provider]: {
          ...prev[provider],
          [field]: value,
        },
      };
    });
  };

  const handleMiniMaxDeviceLogin = async (region: MiniMaxRegion) => {
    minimaxOAuthCancelRef.current = false;
    setMinimaxOAuthPhase({ kind: 'requesting_code' });

    const codeEndpoint = region === 'cn' ? MINIMAX_CODE_ENDPOINT_CN : MINIMAX_CODE_ENDPOINT_GLOBAL;
    const tokenEndpoint = region === 'cn' ? MINIMAX_TOKEN_ENDPOINT_CN : MINIMAX_TOKEN_ENDPOINT_GLOBAL;
    const defaultBaseUrl = region === 'cn' ? MINIMAX_BASE_URL_CN : MINIMAX_BASE_URL_GLOBAL;

    try {
      const { verifier, challenge, state } = await generateMiniMaxPkce();

      const codeBody = [
        'response_type=code',
        `client_id=${encodeURIComponent(MINIMAX_OAUTH_CLIENT_ID)}`,
        `scope=${encodeURIComponent(MINIMAX_OAUTH_SCOPE)}`,
        `code_challenge=${encodeURIComponent(challenge)}`,
        'code_challenge_method=S256',
        `state=${encodeURIComponent(state)}`,
      ].join('&');

      const codeRes = await window.electron.api.fetch({
        url: codeEndpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: codeBody,
      });

      if (!codeRes.ok) {
        throw new Error(`MiniMax OAuth authorization failed: ${codeRes.status}`);
      }

      const codePayload = (codeRes.data ?? {}) as {
        user_code?: string;
        verification_uri?: string;
        expired_in?: number;
        interval?: number;
        state?: string;
        error?: string;
      };

      if (!codePayload.user_code || !codePayload.verification_uri) {
        throw new Error(codePayload.error ?? 'MiniMax OAuth returned incomplete authorization payload');
      }

      if (codePayload.state !== state) {
        throw new Error('MiniMax OAuth state mismatch: possible CSRF attack or session corruption');
      }

      try {
        await window.electron.shell.openExternal(codePayload.verification_uri);
      } catch { /* ignore: user can open manually */ }

      setMinimaxOAuthPhase({
        kind: 'pending',
        userCode: codePayload.user_code,
        verificationUri: codePayload.verification_uri,
      });

      let pollIntervalMs = codePayload.interval ?? 2000;
      const expireTimeMs = codePayload.expired_in ?? (Date.now() + 5 * 60 * 1000);

      while (Date.now() < expireTimeMs) {
        if (minimaxOAuthCancelRef.current) {
          setMinimaxOAuthPhase({ kind: 'idle' });
          return;
        }

        await new Promise(r => setTimeout(r, pollIntervalMs));

        if (minimaxOAuthCancelRef.current) {
          setMinimaxOAuthPhase({ kind: 'idle' });
          return;
        }

        const tokenBody = [
          `grant_type=${encodeURIComponent(MINIMAX_OAUTH_GRANT_TYPE)}`,
          `client_id=${encodeURIComponent(MINIMAX_OAUTH_CLIENT_ID)}`,
          `user_code=${encodeURIComponent(codePayload.user_code)}`,
          `code_verifier=${encodeURIComponent(verifier)}`,
        ].join('&');

        const tokenRes = await window.electron.api.fetch({
          url: tokenEndpoint,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: tokenBody,
        });

        const tokenPayload = (tokenRes.data ?? {}) as {
          status?: string;
          access_token?: string;
          refresh_token?: string;
          expired_in?: number;
          resource_url?: string;
          notification_message?: string;
          base_resp?: { status_code?: number; status_msg?: string };
        };

        if (tokenPayload.status === 'error') {
          throw new Error(tokenPayload.base_resp?.status_msg ?? 'MiniMax OAuth error');
        }

        if (tokenPayload.status === 'success') {
          if (!tokenPayload.access_token || !tokenPayload.refresh_token) {
            throw new Error('MiniMax OAuth returned incomplete token payload');
          }

          let baseUrl = (tokenPayload.resource_url ?? '').trim();
          if (baseUrl && !baseUrl.startsWith('http')) {
            baseUrl = `https://${baseUrl}`;
          }
          if (!baseUrl) {
            baseUrl = defaultBaseUrl;
          }

          setProviders(prev => ({
            ...prev,
            minimax: {
              ...prev.minimax,
              enabled: true,
              apiKey: tokenPayload.access_token!,
              baseUrl,
              apiFormat: 'anthropic',
              authType: 'oauth',
              oauthRefreshToken: tokenPayload.refresh_token,
              oauthTokenExpiresAt: tokenPayload.expired_in,
              models: [...(defaultConfig.providers?.minimax.models ?? [])],
            },
          }));

          setMinimaxOAuthPhase({ kind: 'success' });
          setTimeout(() => setMinimaxOAuthPhase({ kind: 'idle' }), 1500);
          return;
        }

        // Still pending — back off gradually
        pollIntervalMs = Math.min(pollIntervalMs * 1.5, 10000);
      }

      throw new Error('MiniMax OAuth timed out waiting for authorization');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMinimaxOAuthPhase({ kind: 'error', message });
    }
  };

  const handleCancelMiniMaxLogin = () => {
    minimaxOAuthCancelRef.current = true;
    setMinimaxOAuthPhase({ kind: 'idle' });
  };

  const handleMiniMaxOAuthLogout = () => {
    setProviders(prev => ({
      ...prev,
      minimax: {
        ...prev.minimax,
        apiKey: '',
        oauthRefreshToken: undefined,
        oauthTokenExpiresAt: undefined,
      },
    }));
    setMinimaxOAuthPhase({ kind: 'idle' });
  };

  const hasCoworkConfigChanges = coworkAgentEngine !== coworkConfig.agentEngine
    || coworkMemoryEnabled !== coworkConfig.memoryEnabled
    || coworkMemoryLlmJudgeEnabled !== coworkConfig.memoryLlmJudgeEnabled;
  const isOpenClawAgentEngine = coworkAgentEngine === 'openclaw';

  const openClawProgressPercent = useMemo(() => {
    if (typeof openClawEngineStatus?.progressPercent !== 'number' || !Number.isFinite(openClawEngineStatus.progressPercent)) {
      return null;
    }
    return Math.max(0, Math.min(100, Math.round(openClawEngineStatus.progressPercent)));
  }, [openClawEngineStatus]);

  const resolveOpenClawStatusText = (status: OpenClawEngineStatus | null): string => {
    if (!status) {
      return i18nService.t('coworkOpenClawNotInstalledNotice');
    }
    if (status.message?.trim()) {
      return status.message.trim();
    }
    switch (status.phase) {
      case 'not_installed':
        return i18nService.t('coworkOpenClawNotInstalledNotice');
      case 'installing':
        return i18nService.t('coworkOpenClawInstalling');
      case 'ready':
        return i18nService.t('coworkOpenClawReadyNotice');
      case 'starting':
        return i18nService.t('coworkOpenClawStarting');
      case 'error':
        return i18nService.t('coworkOpenClawError');
      case 'running':
      default:
        return i18nService.t('coworkOpenClawRunning');
    }
  };

  const loadCoworkMemoryData = useCallback(async () => {
    setCoworkMemoryListLoading(true);
    try {
      const [entries, stats] = await Promise.all([
        coworkService.listMemoryEntries({
          query: coworkMemoryQuery.trim() || undefined,
        }),
        coworkService.getMemoryStats(),
      ]);
      setCoworkMemoryEntries(entries);
      setCoworkMemoryStats(stats);
    } catch (loadError) {
      console.error('Failed to load cowork memory data:', loadError);
      setCoworkMemoryEntries([]);
      setCoworkMemoryStats(null);
    } finally {
      setCoworkMemoryListLoading(false);
    }
  }, [
    coworkMemoryQuery,
  ]);

  useEffect(() => {
    if (activeTab !== 'coworkMemory') return;
    void loadCoworkMemoryData();
  }, [activeTab, loadCoworkMemoryData]);

  /**
   * Detect OpenClaw default template content and return empty string.
   * Templates contain YAML frontmatter and specific marker phrases.
   */
  const stripDefaultTemplate = (content: string): string => {
    if (!content.trim()) return '';
    const TEMPLATE_MARKERS = [
      'Fill this in during your first conversation',
      "You're not a chatbot. You're becoming someone",
      'Learn about the person you\'re helping',
    ];
    if (TEMPLATE_MARKERS.some((m) => content.includes(m))) return '';
    return content;
  };

  useEffect(() => {
    if (activeTab !== 'coworkAgent') return;
    if (!bootstrapLoaded) {
      void (async () => {
        const [identity, user, soul] = await Promise.all([
          coworkService.readBootstrapFile('IDENTITY.md'),
          coworkService.readBootstrapFile('USER.md'),
          coworkService.readBootstrapFile('SOUL.md'),
        ]);
        setBootstrapIdentity(stripDefaultTemplate(identity));
        setBootstrapUser(stripDefaultTemplate(user));
        setBootstrapSoul(stripDefaultTemplate(soul));
        setBootstrapLoaded(true);
      })();
    }
  }, [activeTab, bootstrapLoaded]);

  const resetCoworkMemoryEditor = () => {
    setCoworkMemoryEditingId(null);
    setCoworkMemoryDraftText('');
    setShowMemoryModal(false);
  };

  const handleSaveCoworkMemoryEntry = async () => {
    const text = coworkMemoryDraftText.trim();
    if (!text) return;

    setCoworkMemoryListLoading(true);
    try {
      if (coworkMemoryEditingId) {
        await coworkService.updateMemoryEntry({
          id: coworkMemoryEditingId,
          text,
        });
      } else {
        await coworkService.createMemoryEntry({
          text,
        });
      }
      resetCoworkMemoryEditor();
      await loadCoworkMemoryData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : i18nService.t('coworkMemoryCrudSaveFailed'));
    } finally {
      setCoworkMemoryListLoading(false);
    }
  };

  const handleEditCoworkMemoryEntry = (entry: CoworkUserMemoryEntry) => {
    setCoworkMemoryEditingId(entry.id);
    setCoworkMemoryDraftText(entry.text);
    setShowMemoryModal(true);
  };

  const handleDeleteCoworkMemoryEntry = async (entry: CoworkUserMemoryEntry) => {
    setCoworkMemoryListLoading(true);
    try {
      await coworkService.deleteMemoryEntry({ id: entry.id });
      if (coworkMemoryEditingId === entry.id) {
        resetCoworkMemoryEditor();
      }
      await loadCoworkMemoryData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : i18nService.t('coworkMemoryCrudDeleteFailed'));
    } finally {
      setCoworkMemoryListLoading(false);
    }
  };

  const handleOpenCoworkMemoryModal = () => {
    resetCoworkMemoryEditor();
    setShowMemoryModal(true);
  };

  // Toggle provider enabled status
  const toggleProviderEnabled = (provider: ProviderType) => {
    const providerConfig = providers[provider];
    const isEnabling = !providerConfig.enabled;
    const missingApiKey = providerRequiresApiKey(provider) && !providerConfig.apiKey.trim();

    if (isEnabling && missingApiKey) {
      setError(i18nService.t('apiKeyRequired'));
      return;
    }

    setProviders(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        enabled: !prev[provider].enabled
      }
    }));
  };

  const enableProvider = (provider: ProviderType) => {
    setProviders(prev => {
      if (prev[provider].enabled) {
        return prev;
      }

      return {
        ...prev,
        [provider]: {
          ...prev[provider],
          enabled: true,
        },
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const normalizedQtbApiBaseUrl = qtbApiBaseUrl.trim().replace(/\/+$/, '') || DEFAULT_QTB_API_BASE_URL;
      const normalizedQtbWebBaseUrl = qtbWebBaseUrl.trim().replace(/\/+$/, '') || DEFAULT_QTB_WEB_BASE_URL;
      const normalizedSpeechStopCommand = speechStopCommand.trim();
      const normalizedSpeechSubmitCommand = speechSubmitCommand.trim();

      if (
        normalizedSpeechStopCommand
        && normalizedSpeechSubmitCommand
        && normalizedSpeechStopCommand === normalizedSpeechSubmitCommand
      ) {
        setError(i18nService.t('speechInputCommandDuplicateError'));
        return;
      }
      const normalizedWakeSubmitCommand = wakeInputSubmitCommand.trim();
      const normalizedWakeCancelCommand = wakeInputCancelCommand.trim();
      const normalizedWakeActivationReplyText = wakeActivationReplyText.trim() || DEFAULT_WAKE_INPUT_CONFIG.activationReplyText;
      const normalizedWakeWords = parseWakeWordsInput(wakeInputWakeWordsText);
      const normalizedTtsSkipKeywords = normalizeVoiceKeywordList(ttsSkipKeywordsText);
      if (
        normalizedWakeSubmitCommand
        && normalizedWakeCancelCommand
        && normalizedWakeSubmitCommand === normalizedWakeCancelCommand
      ) {
        setError(i18nService.t('wakeInputCommandDuplicateError'));
        return;
      }

      const normalizedProviders = Object.fromEntries(
        Object.entries(providers).map(([providerKey, providerConfig]) => {
          const apiFormat = getEffectiveApiFormat(providerKey, providerConfig.apiFormat);
          return [
            providerKey,
            {
              ...providerConfig,
              apiFormat,
              baseUrl: resolveBaseUrl(providerKey as ProviderType, providerConfig.baseUrl, apiFormat),
            },
          ];
        })
      ) as ProvidersConfig;

      // Find the first enabled provider to use as the primary API
      const firstEnabledProvider = Object.entries(normalizedProviders).find(
        ([_, config]) => config.enabled
      );

      const primaryProvider = firstEnabledProvider
        ? firstEnabledProvider[1]
        : normalizedProviders[activeProvider];

      await configService.updateConfig({
        api: {
          key: primaryProvider.apiKey,
          baseUrl: primaryProvider.baseUrl,
        },
        auth: {
          backend: AuthBackend.Qtb,
          qtbApiBaseUrl: normalizedQtbApiBaseUrl,
          qtbWebBaseUrl: normalizedQtbWebBaseUrl,
        },
        providers: normalizedProviders, // Save all providers configuration
        theme,
        language,
        useSystemProxy,
        voice: {
          capabilities: {
            manualStt: { enabled: manualSttEnabled, provider: manualSttProvider },
            wakeInput: { enabled: wakeInputEnabled, provider: VoiceProvider.MacosNative },
            followUpDictation: { enabled: followUpDictationEnabled, provider: manualSttProvider },
            tts: {
              enabled: ttsEnabled,
              autoPlayAssistantReply: ttsAutoPlayAssistantReply,
              provider: ttsProvider,
              engine: ttsEngine,
            },
          },
          commands: {
            manualStopCommand: normalizedSpeechStopCommand,
            manualSubmitCommand: normalizedSpeechSubmitCommand,
            wakeWords: normalizedWakeWords,
            wakeSubmitCommand: normalizedWakeSubmitCommand,
            wakeCancelCommand: normalizedWakeCancelCommand,
            wakeSessionTimeoutMs: DEFAULT_WAKE_INPUT_CONFIG.sessionTimeoutMs,
            wakeActivationReplyEnabled,
            wakeActivationReplyText: normalizedWakeActivationReplyText,
          },
          providers: {
            macosNative: voiceMacosNativeTtsConfig,
            edgeTts: voiceEdgeTtsConfig,
            localWhisperCpp: voiceLocalWhisperCppConfig,
            localQwen3Tts: voiceLocalQwen3TtsConfig,
            openai: voiceOpenAiConfig,
            aliyun: voiceAliyunConfig,
            volcengine: voiceVolcengineConfig,
            azure: voiceAzureConfig,
            custom: voiceCustomConfig,
          },
          postProcess: {
            sttLlmCorrectionEnabled,
            ttsLlmRewriteEnabled,
            ttsSkipKeywords: normalizedTtsSkipKeywords,
          },
          strategy: voiceStrategy,
        },
        shortcuts,
        app: {
          ...configService.getConfig().app,
          testMode,
        },
      });

      // 应用主题
      themeService.setTheme(theme);

      // 应用语言
      i18nService.setLanguage(language, { persist: false });

      // Set API with the primary provider
      apiService.setConfig({
        apiKey: primaryProvider.apiKey,
        baseUrl: primaryProvider.baseUrl,
      });

      // 更新 Redux store 中的可用模型列表
      const allModels: { id: string; name: string; provider?: string; providerKey?: string; supportsImage?: boolean }[] = [];
      Object.entries(normalizedProviders).forEach(([providerName, config]) => {
        if (config.enabled && config.models) {
          config.models.forEach(model => {
            allModels.push({
              id: model.id,
              name: model.name,
              provider: getProviderDisplayName(providerName, config),
              providerKey: providerName,
              supportsImage: model.supportsImage ?? false,
            });
          });
        }
      });
      dispatch(setAvailableModels(allModels));

      if (hasCoworkConfigChanges) {
        const updated = await coworkService.updateConfig({
          agentEngine: coworkAgentEngine,
          memoryEnabled: coworkMemoryEnabled,
          memoryLlmJudgeEnabled: coworkMemoryLlmJudgeEnabled,
        });
        if (!updated) {
          throw new Error(i18nService.t('coworkConfigSaveFailed'));
        }
      }

      // Save bootstrap files (IDENTITY.md, USER.md, SOUL.md) only if loaded
      if (bootstrapLoaded) {
        const results = await Promise.all([
          coworkService.writeBootstrapFile('IDENTITY.md', bootstrapIdentity),
          coworkService.writeBootstrapFile('USER.md', bootstrapUser),
          coworkService.writeBootstrapFile('SOUL.md', bootstrapSoul),
        ]);
        if (results.some(r => !r)) {
          throw new Error(i18nService.t('coworkBootstrapSaveFailed'));
        }
      }

      // Sync IM gateway config (regenerate openclaw.json and restart gateway if running).
      // This is done on every save regardless of activeTab, because the user may have
      // edited IM config then switched tabs before clicking Save.
      await imService.saveAndSyncConfig();

      didSaveRef.current = true;
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // 标签页切换处理
  const handleTabChange = (tab: TabType) => {
    if (tab !== 'model') {
      setIsAddingModel(false);
      setIsEditingModel(false);
      setEditingModelId(null);
      setNewModelName('');
      setNewModelId('');
      setNewModelSupportsImage(false);
      setModelFormError(null);
    }
    setActiveTab(tab);
  };

  // 快捷键更新处理
  const handleShortcutChange = (key: keyof typeof shortcuts, value: string) => {
    setShortcuts(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 阻止点击设置窗口时事件传播到背景
  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Handlers for model operations
  const handleAddModel = () => {
    setIsAddingModel(true);
    setIsEditingModel(false);
    setEditingModelId(null);
    setNewModelName('');
    setNewModelId('');
    setNewModelSupportsImage(false);
    setModelFormError(null);
  };

  const handleEditModel = (modelId: string, modelName: string, supportsImage?: boolean) => {
    setIsAddingModel(false);
    setIsEditingModel(true);
    setEditingModelId(modelId);
    setNewModelName(modelName);
    setNewModelId(modelId);
    setNewModelSupportsImage(!!supportsImage);
    setModelFormError(null);
  };

  const handleDeleteModel = (modelId: string) => {
    if (!providers[activeProvider].models) return;
    
    const updatedModels = providers[activeProvider].models.filter(
      model => model.id !== modelId
    );
    
    setProviders(prev => ({
      ...prev,
      [activeProvider]: {
        ...prev[activeProvider],
        models: updatedModels
      }
    }));
  };

  const handleSaveNewModel = () => {
    const modelId = newModelId.trim();

    if (activeProvider === 'ollama') {
      // For Ollama, only the model name (stored as modelId) is required
      if (!modelId) {
        setModelFormError(i18nService.t('ollamaModelNameRequired'));
        return;
      }
    } else {
      const modelName = newModelName.trim();
      if (!modelName || !modelId) {
        setModelFormError(i18nService.t('modelNameAndIdRequired'));
        return;
      }
    }

    // For Ollama, auto-fill display name from modelId if not provided
    const modelName = activeProvider === 'ollama'
      ? (newModelName.trim() && newModelName.trim() !== modelId ? newModelName.trim() : modelId)
      : newModelName.trim();

    const currentModels = providers[activeProvider].models ?? [];
    const duplicateModel = currentModels.find(
      model => model.id === modelId && (!isEditingModel || model.id !== editingModelId)
    );
    if (duplicateModel) {
      setModelFormError(i18nService.t('modelIdExists'));
      return;
    }

    const nextModel = {
      id: modelId,
      name: modelName,
      supportsImage: newModelSupportsImage,
    };
    const updatedModels = isEditingModel && editingModelId
      ? currentModels.map(model => (model.id === editingModelId ? nextModel : model))
      : [...currentModels, nextModel];

    setProviders(prev => ({
      ...prev,
      [activeProvider]: {
        ...prev[activeProvider],
        models: updatedModels
      }
    }));

    setIsAddingModel(false);
    setIsEditingModel(false);
    setEditingModelId(null);
    setNewModelName('');
    setNewModelId('');
    setNewModelSupportsImage(false);
    setModelFormError(null);
  };

  const handleCancelModelEdit = () => {
    setIsAddingModel(false);
    setIsEditingModel(false);
    setEditingModelId(null);
    setNewModelName('');
    setNewModelId('');
    setNewModelSupportsImage(false);
    setModelFormError(null);
  };

  const handleModelDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelModelEdit();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveNewModel();
    }
  };

  const showTestResultModal = (
    result: Omit<ProviderConnectionTestResult, 'provider'>,
    provider: ProviderType
  ) => {
    setTestResult({
      ...result,
      provider,
    });
    setIsTestResultModalOpen(true);
  };

  // 测试 API 连接
  const handleTestConnection = async () => {
    const testingProvider = activeProvider;
    const providerConfig = providers[testingProvider];
    setIsTesting(true);
    setIsTestResultModalOpen(false);
    setTestResult(null);

    if (providerRequiresApiKey(testingProvider) && !providerConfig.apiKey) {
      showTestResultModal({ success: false, message: i18nService.t('apiKeyRequired') }, testingProvider);
      setIsTesting(false);
      return;
    }

    // 获取第一个可用模型
    const firstModel = providerConfig.models?.[0];
    if (!firstModel) {
      showTestResultModal({ success: false, message: i18nService.t('noModelsConfigured') }, testingProvider);
      setIsTesting(false);
      return;
    }

    try {
      let response: Awaited<ReturnType<typeof window.electron.api.fetch>>;
      // Apply Coding Plan endpoint switch
      let effectiveBaseUrl = resolveBaseUrl(testingProvider, providerConfig.baseUrl, getEffectiveApiFormat(testingProvider, providerConfig.apiFormat));
      let effectiveApiFormat = getEffectiveApiFormat(testingProvider, providerConfig.apiFormat);
      
      // Handle Coding Plan endpoint switch for supported providers
      if ((providerConfig as { codingPlanEnabled?: boolean }).codingPlanEnabled && (effectiveApiFormat === 'anthropic' || effectiveApiFormat === 'openai')) {
        const resolved = resolveCodingPlanBaseUrl(testingProvider, true, effectiveApiFormat, effectiveBaseUrl);
        effectiveBaseUrl = resolved.baseUrl;
        effectiveApiFormat = resolved.effectiveFormat;
      }
      
      const normalizedBaseUrl = effectiveBaseUrl.replace(/\/+$/, '');
      // 统一为两种协议格式：
      // - anthropic: /v1/messages
      // - openai provider: /v1/responses
      // - other openai-compatible providers: /v1/chat/completions
      const useAnthropicFormat = effectiveApiFormat === 'anthropic';

      if (useAnthropicFormat) {
        const anthropicUrl = normalizedBaseUrl.endsWith('/v1')
          ? `${normalizedBaseUrl}/messages`
          : `${normalizedBaseUrl}/v1/messages`;
        response = await window.electron.api.fetch({
          url: anthropicUrl,
          method: 'POST',
          headers: {
            'x-api-key': providerConfig.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: firstModel.id,
            max_tokens: CONNECTIVITY_TEST_TOKEN_BUDGET,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
      } else {
        const useResponsesApi = shouldUseOpenAIResponsesForProvider(testingProvider);
        const openaiUrl = useResponsesApi
          ? buildOpenAIResponsesUrl(normalizedBaseUrl)
          : buildOpenAICompatibleChatCompletionsUrl(normalizedBaseUrl, testingProvider);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (providerConfig.apiKey) {
          headers.Authorization = `Bearer ${providerConfig.apiKey}`;
        }
        const openAIRequestBody: Record<string, unknown> = useResponsesApi
          ? {
              model: firstModel.id,
              input: [{ role: 'user', content: [{ type: 'input_text', text: 'Hi' }] }],
              max_output_tokens: CONNECTIVITY_TEST_TOKEN_BUDGET,
            }
          : {
              model: firstModel.id,
              messages: [{ role: 'user', content: 'Hi' }],
            };
        if (!useResponsesApi && shouldUseMaxCompletionTokensForOpenAI(testingProvider, firstModel.id)) {
          openAIRequestBody.max_completion_tokens = CONNECTIVITY_TEST_TOKEN_BUDGET;
        } else {
          if (!useResponsesApi) {
            openAIRequestBody.max_tokens = CONNECTIVITY_TEST_TOKEN_BUDGET;
          }
        }
        response = await window.electron.api.fetch({
          url: openaiUrl,
          method: 'POST',
          headers,
          body: JSON.stringify(openAIRequestBody),
        });
      }

      if (response.ok) {
        enableProvider(testingProvider);
        showTestResultModal({ success: true, message: i18nService.t('connectionSuccess') }, testingProvider);
      } else {
        const data = response.data || {};
        // 提取错误信息
        const errorMessage = data.error?.message || data.message || `${i18nService.t('connectionFailed')}: ${response.status}`;
        if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('model output limit was reached')) {
          enableProvider(testingProvider);
          showTestResultModal({ success: true, message: i18nService.t('connectionSuccess') }, testingProvider);
          return;
        }
        showTestResultModal({ success: false, message: errorMessage }, testingProvider);
      }
    } catch (err) {
      showTestResultModal({
        success: false,
        message: err instanceof Error ? err.message : i18nService.t('connectionFailed'),
      }, testingProvider);
    } finally {
      setIsTesting(false);
    }
  };

  const buildProvidersExport = async (password: string): Promise<ProvidersExportPayload> => {
    const entries = await Promise.all(
      Object.entries(providers).map(async ([providerKey, providerConfig]) => {
        const apiKey = await encryptWithPassword(providerConfig.apiKey, password);
        const apiFormat = getEffectiveApiFormat(providerKey, providerConfig.apiFormat);
        return [
          providerKey,
          {
            enabled: providerConfig.enabled,
            apiKey,
            baseUrl: resolveBaseUrl(providerKey as ProviderType, providerConfig.baseUrl, apiFormat),
            apiFormat,
            codingPlanEnabled: (providerConfig as ProviderConfig).codingPlanEnabled,
            models: providerConfig.models,
          },
        ] as const;
      })
    );

    return {
      type: EXPORT_FORMAT_TYPE,
      version: 2,
      exportedAt: new Date().toISOString(),
      encryption: {
        algorithm: 'AES-GCM',
        keySource: 'password',
        keyDerivation: 'PBKDF2',
      },
      providers: Object.fromEntries(entries),
    };
  };

  const normalizeModels = (models?: Model[]) =>
    models?.map(model => ({
      ...model,
      supportsImage: model.supportsImage ?? false,
    }));

  const DEFAULT_EXPORT_PASSWORD = EXPORT_PASSWORD;

  const handleExportProviders = async () => {
    setError(null);
    setIsExportingProviders(true);

    try {
      const payload = await buildProvidersExport(DEFAULT_EXPORT_PASSWORD);
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${APP_ID}-providers-${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      console.error('Failed to export providers:', err);
      setError(i18nService.t('exportProvidersFailed'));
    } finally {
      setIsExportingProviders(false);
    }
  };

  const handleImportProvidersClick = () => {
    importInputRef.current?.click();
  };

  const handleImportProviders = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    setError(null);

    try {
      const raw = await file.text();
      let payload: ProvidersImportPayload;
      try {
        payload = JSON.parse(raw) as ProvidersImportPayload;
      } catch (parseError) {
        setError(i18nService.t('invalidProvidersFile'));
        return;
      }

      if (!payload || payload.type !== EXPORT_FORMAT_TYPE || !payload.providers) {
        setError(i18nService.t('invalidProvidersFile'));
        return;
      }

      // Check if it's version 2 (password-based encryption)
      if (payload.version === 2 && payload.encryption?.keySource === 'password') {
        await processImportPayloadWithPassword(payload);
        return;
      }

      // Version 1 (legacy local-store key) - try to decrypt with local key
      if (payload.version === 1) {
        await processImportPayloadWithLocalKey(payload);
        return;
      }

      setError(i18nService.t('invalidProvidersFile'));
    } catch (err) {
      console.error('Failed to import providers:', err);
      setError(i18nService.t('importProvidersFailed'));
    }
  };

  const processImportPayloadWithLocalKey = async (payload: ProvidersImportPayload) => {
    setIsImportingProviders(true);
    try {
      const providerUpdates: Partial<ProvidersConfig> = {};
      let hadDecryptFailure = false;
      for (const providerKey of providerKeys) {
        const providerData = payload.providers?.[providerKey];
        if (!providerData) {
          continue;
        }

        let apiKey: string | undefined;
        if (typeof providerData.apiKey === 'string') {
          apiKey = providerData.apiKey;
        } else if (providerData.apiKey && typeof providerData.apiKey === 'object') {
          try {
            apiKey = await decryptSecret(providerData.apiKey as EncryptedPayload);
          } catch (error) {
            hadDecryptFailure = true;
            console.warn(`Failed to decrypt provider key for ${providerKey}`, error);
          }
        } else if (typeof providerData.apiKeyEncrypted === 'string' && typeof providerData.apiKeyIv === 'string') {
          try {
            apiKey = await decryptSecret({ encrypted: providerData.apiKeyEncrypted, iv: providerData.apiKeyIv });
          } catch (error) {
            hadDecryptFailure = true;
            console.warn(`Failed to decrypt provider key for ${providerKey}`, error);
          }
        }

        const models = normalizeModels(providerData.models);

        providerUpdates[providerKey] = {
          enabled: typeof providerData.enabled === 'boolean' ? providerData.enabled : providers[providerKey].enabled,
          apiKey: apiKey ?? providers[providerKey].apiKey,
          baseUrl: typeof providerData.baseUrl === 'string' ? providerData.baseUrl : providers[providerKey].baseUrl,
          apiFormat: getEffectiveApiFormat(providerKey, providerData.apiFormat ?? providers[providerKey].apiFormat),
          codingPlanEnabled: typeof providerData.codingPlanEnabled === 'boolean' ? providerData.codingPlanEnabled : (providers[providerKey] as ProviderConfig).codingPlanEnabled,
          models: models ?? providers[providerKey].models,
        };
      }

      if (Object.keys(providerUpdates).length === 0) {
        setError(i18nService.t('invalidProvidersFile'));
        return;
      }

      setProviders(prev => {
        const next = { ...prev };
        Object.entries(providerUpdates).forEach(([providerKey, update]) => {
          next[providerKey] = {
            ...prev[providerKey],
            ...update,
          };
        });
        return next;
      });
      setIsTestResultModalOpen(false);
      setTestResult(null);
      if (hadDecryptFailure) {
        setNoticeMessage(i18nService.t('decryptProvidersPartial'));
      }
    } catch (err) {
      console.error('Failed to import providers:', err);
      const isDecryptError = err instanceof Error
        && (err.message === 'Invalid encrypted payload' || err.name === 'OperationError');
      const message = isDecryptError
        ? i18nService.t('decryptProvidersFailed')
        : i18nService.t('importProvidersFailed');
      setError(message);
    } finally {
      setIsImportingProviders(false);
    }
  };

  const processImportPayloadWithPassword = async (payload: ProvidersImportPayload) => {
    if (!payload.providers) {
      return;
    }

    setIsImportingProviders(true);

    try {
      const providerUpdates: Partial<ProvidersConfig> = {};
      let hadDecryptFailure = false;

      for (const providerKey of providerKeys) {
        const providerData = payload.providers[providerKey];
        if (!providerData) {
          continue;
        }

        let apiKey: string | undefined;
        if (typeof providerData.apiKey === 'string') {
          apiKey = providerData.apiKey;
        } else if (providerData.apiKey && typeof providerData.apiKey === 'object') {
          const apiKeyObj = providerData.apiKey as PasswordEncryptedPayload;
          if (apiKeyObj.salt) {
            // Version 2 password-based encryption
            try {
              apiKey = await decryptWithPassword(apiKeyObj, DEFAULT_EXPORT_PASSWORD);
            } catch (error) {
              hadDecryptFailure = true;
              console.warn(`Failed to decrypt provider key for ${providerKey}`, error);
            }
          }
        }

        const models = normalizeModels(providerData.models);

        providerUpdates[providerKey] = {
          enabled: typeof providerData.enabled === 'boolean' ? providerData.enabled : providers[providerKey].enabled,
          apiKey: apiKey ?? providers[providerKey].apiKey,
          baseUrl: typeof providerData.baseUrl === 'string' ? providerData.baseUrl : providers[providerKey].baseUrl,
          apiFormat: getEffectiveApiFormat(providerKey, providerData.apiFormat ?? providers[providerKey].apiFormat),
          codingPlanEnabled: typeof providerData.codingPlanEnabled === 'boolean' ? providerData.codingPlanEnabled : (providers[providerKey] as ProviderConfig).codingPlanEnabled,
          models: models ?? providers[providerKey].models,
        };
      }

      if (Object.keys(providerUpdates).length === 0) {
        setError(i18nService.t('invalidProvidersFile'));
        return;
      }

      // Check if any key was successfully decrypted
      const anyKeyDecrypted = Object.entries(providerUpdates).some(
        ([key, update]) => update?.apiKey && update.apiKey !== providers[key]?.apiKey
      );

      if (!anyKeyDecrypted && hadDecryptFailure) {
        // All decryptions failed - likely wrong password
        setError(i18nService.t('decryptProvidersFailed'));
        return;
      }

      setProviders(prev => {
        const next = { ...prev };
        Object.entries(providerUpdates).forEach(([providerKey, update]) => {
          next[providerKey] = {
            ...prev[providerKey],
            ...update,
          };
        });
        return next;
      });
      setIsTestResultModalOpen(false);
      setTestResult(null);
      if (hadDecryptFailure) {
        setNoticeMessage(i18nService.t('decryptProvidersPartial'));
      }
    } catch (err) {
      console.error('Failed to import providers:', err);
      const isDecryptError = err instanceof Error
        && (err.message === 'Invalid encrypted payload' || err.name === 'OperationError');
      const message = isDecryptError
        ? i18nService.t('decryptProvidersFailed')
        : i18nService.t('importProvidersFailed');
      setError(message);
    } finally {
      setIsImportingProviders(false);
    }
  };

  // 渲染标签页
  const sidebarTabs: { key: TabType; label: string; icon: React.ReactNode }[] = useMemo(() => {
    const allTabs = [
      { key: 'general' as TabType,        label: i18nService.t('general'),        icon: <Cog6ToothIcon className="h-5 w-5" /> },
      { key: 'coworkAgentEngine' as TabType, label: i18nService.t('coworkAgentEngine'), icon: <CpuChipIcon className="h-5 w-5" /> },
      { key: 'model' as TabType,          label: i18nService.t('model'),          icon: <CubeIcon className="h-5 w-5" /> },
      { key: 'im' as TabType,             label: i18nService.t('imBot'),          icon: <ChatBubbleLeftIcon className="h-5 w-5" /> },
      { key: 'email' as TabType,          label: i18nService.t('emailTab'),       icon: <EnvelopeIcon className="h-5 w-5" /> },
      { key: 'coworkMemory' as TabType,   label: i18nService.t('coworkMemoryTitle'), icon: <BrainIcon className="h-5 w-5" /> },
      { key: 'coworkAgent' as TabType,    label: i18nService.t('coworkAgentTab'),    icon: <UserCircleIcon className="h-5 w-5" /> },
      { key: 'shortcuts' as TabType,      label: i18nService.t('shortcuts'),      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5"><rect x="2" y="4" width="20" height="14" rx="2" /><line x1="6" y1="8" x2="8" y2="8" /><line x1="10" y1="8" x2="12" y2="8" /><line x1="14" y1="8" x2="16" y2="8" /><line x1="6" y1="12" x2="8" y2="12" /><line x1="10" y1="12" x2="14" y2="12" /><line x1="16" y1="12" x2="18" y2="12" /><line x1="8" y1="15.5" x2="16" y2="15.5" /></svg> },
      { key: 'about' as TabType,          label: i18nService.t('about'),          icon: <InformationCircleIcon className="h-5 w-5" /> },
    ];
    // Filter out tabs hidden by enterprise config
    // Filter out tabs with 'hide' action in enterprise config
    // e.g., ui: { "settings.im": "hide" } → hide the 'im' tab
    const ui = enterpriseConfig?.ui;
    if (ui) {
      return allTabs.filter(tab => ui[`settings.${tab.key}`] !== 'hide');
    }
    return allTabs;
  }, [language, enterpriseConfig]);

  const activeTabLabel = useMemo(() => {
    return sidebarTabs.find(t => t.key === activeTab)?.label ?? '';
  }, [activeTab, sidebarTabs]);

  const renderSwitch = (
    checked: boolean,
    onToggle: () => void,
    options?: { disabled?: boolean }
  ) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={options?.disabled ? true : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (options?.disabled) {
          return;
        }
        onToggle();
      }}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        options?.disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${checked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  const getProviderDisplayLabel = (providerKey: ProviderType): string => {
    if (isCustomProvider(providerKey)) {
      return (providers[providerKey] as ProviderConfig)?.displayName || getCustomProviderDefaultName(providerKey);
    }
    return providerMeta[providerKey]?.label ?? getProviderDisplayName(providerKey);
  };

  const getVoiceProviderDescription = (providerKey: VoiceProviderPanelKey): string => {
    switch (providerKey) {
      case VoiceProvider.MacosNative:
        return i18nService.t('ttsDescription');
      case VoiceProvider.LocalWhisperCpp:
        return i18nService.t('voiceLocalWhisperCppDescription');
      case VoiceProvider.LocalQwen3Tts:
        return i18nService.t('voiceLocalQwen3TtsDescription');
      case VoiceProvider.CloudOpenAi:
        return i18nService.t('voiceCloudOpenAiDescription');
      case VoiceProvider.CloudAliyun:
        return i18nService.t('voiceCloudAliyunDescription');
      case VoiceProvider.CloudVolcengine:
        return i18nService.t('voiceCloudVolcengineDescription');
      case VoiceProvider.CloudAzure:
        return i18nService.t('voiceCloudAzureDescription');
      case VoiceProvider.CloudCustom:
        return i18nService.t('voiceCloudCustomDescription');
      default:
        return '';
    }
  };

  const renderSettingsCardSection = (
    title: string,
    children: React.ReactNode,
    subtitle?: string,
    actions?: React.ReactNode,
  ) => (
    <div className="rounded-2xl border border-border bg-surface px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{title}</div>
          {subtitle && (
            <div className="mt-1 text-xs text-secondary">{subtitle}</div>
          )}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );

  const renderVoiceProviderStatusFacts = (providerKey: VoiceProviderPanelKey) => {
    const providerStatus = getVoiceProviderStatus(providerKey);
    if (!providerStatus) {
      return (
        <div className="text-xs text-secondary">
          {i18nService.t('loading')}
        </div>
      );
    }

    const linkedCapabilities = getVoiceProviderInUseTags(providerKey);
    return (
      <div className="grid gap-2 text-xs text-secondary sm:grid-cols-2">
        <div>{i18nService.t('voicePlatformSupportLabel')}: {providerStatus.platformSupported ? i18nService.t('voiceAvailabilityYes') : i18nService.t('voiceAvailabilityNo')}</div>
        <div>{i18nService.t('voicePackagedSupportLabel')}: {providerStatus.packaged ? i18nService.t('voiceAvailabilityYes') : i18nService.t('voiceAvailabilityNo')}</div>
        <div>{i18nService.t('voiceConfiguredLabel')}: {providerStatus.configured ? i18nService.t('voiceAvailabilityYes') : i18nService.t('voiceAvailabilityNo')}</div>
        <div>{i18nService.t('voiceReasonLabel')}: {getVoiceReasonLabel(providerStatus.reason)}</div>
        <div className="sm:col-span-2">
          {i18nService.t('voiceProviderLinkedCapabilitiesLabel')}: {linkedCapabilities.length > 0 ? linkedCapabilities.join(' / ') : i18nService.t('voiceProviderInUse')}
        </div>
      </div>
    );
  };

  const renderSelectedVoiceProviderPanel = () => {
    switch (selectedVoiceProvider) {
      case VoiceProvider.MacosNative:
        return (
          <div className="space-y-4">
            {renderSettingsCardSection(
              i18nService.t('settingsPanelBasic'),
              <div className="space-y-3">
                <p className="text-sm text-secondary">{getVoiceProviderDescription(VoiceProvider.MacosNative)}</p>
                {renderVoiceProviderStatusFacts(VoiceProvider.MacosNative)}
              </div>,
            )}
            {renderSettingsCardSection(
              i18nService.t('settingsPanelRuntime'),
              <div className="space-y-3">
                <div className="grid gap-2 text-xs text-secondary sm:grid-cols-2">
                  <div>{i18nService.t('ttsEngineLabel')}: {i18nService.t(`ttsEngine_${ttsEngine}`)}</div>
                  <div>{i18nService.t('voiceOverviewActualEngine')}: {ttsAvailability?.lastResolvedEngine ? i18nService.t(`ttsEngine_${ttsAvailability.lastResolvedEngine}`) : i18nService.t('ttsActualEngineNone')}</div>
                  <div>{i18nService.t('voiceOverviewRuntimeStatus')}: {ttsAvailability ? i18nService.t(`ttsPrepareStatus_${ttsAvailability.prepareStatus}`) : i18nService.t('loading')}</div>
                  <div>{i18nService.t('ttsPrepareLastErrorLabel')}: {ttsAvailability?.recentError || '-'}</div>
                </div>
                <div className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-secondary">
                  {i18nService.t('voiceProviderManagedInTtsHint')}
                </div>
              </div>,
              undefined,
              <div className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                {getVoiceProviderConfiguredText(VoiceProvider.MacosNative)}
              </div>,
            )}
          </div>
        );
      case VoiceProvider.LocalWhisperCpp:
        return (
          <div className="space-y-4">
            {renderSettingsCardSection(
              i18nService.t('settingsPanelBasic'),
              <div className="space-y-3">
                <p className="text-sm text-secondary">{getVoiceProviderDescription(VoiceProvider.LocalWhisperCpp)}</p>
                {renderVoiceProviderStatusFacts(VoiceProvider.LocalWhisperCpp)}
              </div>,
              undefined,
              renderSwitch(voiceLocalWhisperCppConfig.enabled, () => updateVoiceLocalWhisperCppConfig({ enabled: !voiceLocalWhisperCppConfig.enabled })),
            )}
            {renderSettingsCardSection(
              i18nService.t('settingsPanelRuntime'),
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderBinaryPathLabel')}</div>
                  <input type="text" value={voiceLocalWhisperCppConfig.binaryPath} onChange={(event) => updateVoiceLocalWhisperCppConfig({ binaryPath: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderModelPathLabel')}</div>
                  <input type="text" value={voiceLocalWhisperCppConfig.modelPath} onChange={(event) => updateVoiceLocalWhisperCppConfig({ modelPath: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderModelNameLabel')}</div>
                    <input type="text" value={voiceLocalWhisperCppConfig.modelName} onChange={(event) => updateVoiceLocalWhisperCppConfig({ modelName: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderLocaleLabel')}</div>
                    <input type="text" value={voiceLocalWhisperCppConfig.language} onChange={(event) => updateVoiceLocalWhisperCppConfig({ language: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderThreadsLabel')}</div>
                    <input type="number" min={1} max={32} value={voiceLocalWhisperCppConfig.threads} onChange={(event) => updateVoiceLocalWhisperCppConfig({ threads: Math.max(1, Number(event.target.value) || 1) })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                    <span>{i18nService.t('voiceProviderUseGpuLabel')}</span>
                    <input type="checkbox" checked={voiceLocalWhisperCppConfig.useGpu} onChange={(event) => updateVoiceLocalWhisperCppConfig({ useGpu: event.target.checked })} />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                    <span>{i18nService.t('voiceProviderAutoDownloadModelLabel')}</span>
                    <input type="checkbox" checked={voiceLocalWhisperCppConfig.autoDownloadModel} onChange={(event) => updateVoiceLocalWhisperCppConfig({ autoDownloadModel: event.target.checked })} />
                  </label>
                </div>
                {voiceLocalWhisperCppStatus && (
                  <div className="rounded-xl border border-border px-3 py-3 text-xs text-secondary">
                    <div>{i18nService.t('voiceLocalWhisperCppReadyLabel')}: {voiceLocalWhisperCppStatus.ready ? i18nService.t('voiceAvailabilityYes') : i18nService.t('voiceAvailabilityNo')}</div>
                    <div>{i18nService.t('voiceLocalWhisperCppResolvedBinaryLabel')}: {voiceLocalWhisperCppStatus.executablePath || '-'}</div>
                    <div>{i18nService.t('voiceLocalWhisperCppResolvedModelLabel')}: {voiceLocalWhisperCppStatus.modelPath || '-'}</div>
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => { void handleRefreshLocalWhisperCppStatus(); }} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-raised">
                    {i18nService.t('voiceLocalWhisperCppRefreshButton')}
                  </button>
                  <button type="button" onClick={() => { void handlePrepareLocalWhisperCppDirectories(); }} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-raised">
                    {i18nService.t('voiceLocalWhisperCppPrepareButton')}
                  </button>
                  <button type="button" onClick={() => { void handleOpenLocalWhisperCppDirectory('resourceRoot'); }} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-raised">
                    {i18nService.t('voiceLocalWhisperCppOpenRootButton')}
                  </button>
                  <button type="button" onClick={() => { void handleOpenLocalWhisperCppDirectory('modelsDirectory'); }} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-raised">
                    {i18nService.t('voiceLocalWhisperCppOpenModelsButton')}
                  </button>
                </div>
              </div>,
            )}
            {renderSettingsCardSection(
              i18nService.t('providerPanel_models'),
              <div className="space-y-2">
                {getLocalModelsByProvider(VoiceProvider.LocalWhisperCpp).map(renderLocalModelEntry)}
              </div>,
            )}
          </div>
        );
      case VoiceProvider.LocalQwen3Tts:
        return (
          <div className="space-y-4">
            {renderSettingsCardSection(
              i18nService.t('settingsPanelBasic'),
              <div className="space-y-3">
                <p className="text-sm text-secondary">{getVoiceProviderDescription(VoiceProvider.LocalQwen3Tts)}</p>
                {renderVoiceProviderStatusFacts(VoiceProvider.LocalQwen3Tts)}
              </div>,
              undefined,
              renderSwitch(voiceLocalQwen3TtsConfig.enabled, () => updateVoiceLocalQwen3TtsConfig({ enabled: !voiceLocalQwen3TtsConfig.enabled })),
            )}
            {renderSettingsCardSection(
              i18nService.t('settingsPanelRuntime'),
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderPythonCommandLabel')}</div>
                  <input type="text" value={voiceLocalQwen3TtsConfig.pythonCommand} onChange={(event) => updateVoiceLocalQwen3TtsConfig({ pythonCommand: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderModelPathLabel')}</div>
                    <input type="text" value={voiceLocalQwen3TtsConfig.modelPath} onChange={(event) => updateVoiceLocalQwen3TtsConfig({ modelPath: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderTokenizerPathLabel')}</div>
                    <input type="text" value={voiceLocalQwen3TtsConfig.tokenizerPath} onChange={(event) => updateVoiceLocalQwen3TtsConfig({ tokenizerPath: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderModelIdLabel')}</div>
                    <input type="text" value={voiceLocalQwen3TtsConfig.modelId} onChange={(event) => updateVoiceLocalQwen3TtsConfig({ modelId: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderLocaleLabel')}</div>
                    <input type="text" value={voiceLocalQwen3TtsConfig.language} onChange={(event) => updateVoiceLocalQwen3TtsConfig({ language: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderDeviceLabel')}</div>
                    <input type="text" value={voiceLocalQwen3TtsConfig.device} onChange={(event) => updateVoiceLocalQwen3TtsConfig({ device: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                  </label>
                </div>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderLocalTaskLabel')}</div>
                  <ThemedSelect
                    id="voice-provider-qwen-task"
                    value={voiceLocalQwen3TtsConfig.task}
                    onChange={(value) => updateVoiceLocalQwen3TtsConfig({ task: value as VoiceLocalQwen3TtsConfig['task'] })}
                    options={[
                      { value: VoiceLocalQwen3TtsTask.CustomVoice, label: i18nService.t('voiceLocalQwen3TtsTask_custom_voice') },
                      { value: VoiceLocalQwen3TtsTask.VoiceDesign, label: i18nService.t('voiceLocalQwen3TtsTask_voice_design') },
                    ]}
                  />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderSpeakerLabel')}</div>
                  <input type="text" value={voiceLocalQwen3TtsConfig.speaker} onChange={(event) => updateVoiceLocalQwen3TtsConfig({ speaker: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderInstructLabel')}</div>
                  <textarea value={voiceLocalQwen3TtsConfig.instruct} onChange={(event) => updateVoiceLocalQwen3TtsConfig({ instruct: event.target.value })} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                {voiceLocalQwen3TtsStatus && (
                  <div className="rounded-xl border border-border px-3 py-3 text-xs text-secondary">
                    <div>{i18nService.t('voiceLocalQwen3TtsReadyLabel')}: {voiceLocalQwen3TtsStatus.ready ? i18nService.t('voiceAvailabilityYes') : i18nService.t('voiceAvailabilityNo')}</div>
                    <div>{i18nService.t('voiceLocalQwen3TtsPythonResolvedPathLabel')}: {voiceLocalQwen3TtsStatus.pythonResolvedPath || '-'}</div>
                    <div>{i18nService.t('voiceLocalQwen3TtsResolvedModelLabel')}: {voiceLocalQwen3TtsStatus.modelPath || '-'}</div>
                    <div>{i18nService.t('voiceLocalQwen3TtsResolvedTokenizerLabel')}: {voiceLocalQwen3TtsStatus.tokenizerPath || '-'}</div>
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => { void handleRefreshLocalQwen3TtsStatus(); }} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-raised">
                    {i18nService.t('voiceLocalQwen3TtsRefreshButton')}
                  </button>
                  <button type="button" onClick={() => { void handleOpenLocalQwen3TtsDirectory('resourceRoot'); }} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-raised">
                    {i18nService.t('voiceLocalQwen3TtsOpenRootButton')}
                  </button>
                  <button type="button" onClick={() => { void handleOpenLocalQwen3TtsDirectory('modelsRoot'); }} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-raised">
                    {i18nService.t('voiceLocalQwen3TtsOpenModelsButton')}
                  </button>
                </div>
              </div>,
            )}
            {renderSettingsCardSection(
              i18nService.t('providerPanel_models'),
              <div className="space-y-2">
                {getLocalModelsByProvider(VoiceProvider.LocalQwen3Tts).map(renderLocalModelEntry)}
              </div>,
            )}
          </div>
        );
      case VoiceProvider.CloudOpenAi:
        return (
          <div className="space-y-4">
            {renderSettingsCardSection(
              i18nService.t('settingsPanelBasic'),
              <div className="space-y-3">
                <p className="text-sm text-secondary">{getVoiceProviderDescription(VoiceProvider.CloudOpenAi)}</p>
                {renderVoiceProviderStatusFacts(VoiceProvider.CloudOpenAi)}
              </div>,
              undefined,
              renderSwitch(voiceOpenAiConfig.enabled, () => updateVoiceOpenAiConfig({ enabled: !voiceOpenAiConfig.enabled })),
            )}
            {renderSettingsCardSection(
              i18nService.t('providerPanel_credentials'),
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderApiKeyLabel')}</div>
                  <input type="password" value={voiceOpenAiConfig.apiKey} onChange={(event) => updateVoiceOpenAiConfig({ apiKey: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderBaseUrlLabel')}</div>
                  <input type="text" value={voiceOpenAiConfig.baseUrl} onChange={(event) => updateVoiceOpenAiConfig({ baseUrl: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
              </div>,
            )}
            {renderSettingsCardSection(
              i18nService.t('settingsPanelParameters'),
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderSttModelLabel')}</div>
                  <input type="text" value={voiceOpenAiConfig.sttModel} onChange={(event) => updateVoiceOpenAiConfig({ sttModel: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderTtsModelLabel')}</div>
                  <input type="text" value={voiceOpenAiConfig.ttsModel} onChange={(event) => updateVoiceOpenAiConfig({ ttsModel: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderTtsVoiceLabel')}</div>
                  <input type="text" value={voiceOpenAiConfig.ttsVoice} onChange={(event) => updateVoiceOpenAiConfig({ ttsVoice: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderLocaleLabel')}</div>
                  <input type="text" value={voiceOpenAiConfig.locale} onChange={(event) => updateVoiceOpenAiConfig({ locale: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
              </div>,
            )}
          </div>
        );
      case VoiceProvider.CloudAliyun:
        return (
          <div className="space-y-4">
            {renderSettingsCardSection(
              i18nService.t('settingsPanelBasic'),
              <div className="space-y-3">
                <p className="text-sm text-secondary">{getVoiceProviderDescription(VoiceProvider.CloudAliyun)}</p>
                {renderVoiceProviderStatusFacts(VoiceProvider.CloudAliyun)}
              </div>,
              undefined,
              renderSwitch(voiceAliyunConfig.enabled, () => updateVoiceAliyunConfig({ enabled: !voiceAliyunConfig.enabled })),
            )}
            {renderSettingsCardSection(
              i18nService.t('providerPanel_credentials'),
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderApiKeyLabel')}</div>
                  <input type="password" value={voiceAliyunConfig.apiKey} onChange={(event) => updateVoiceAliyunConfig({ apiKey: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderBaseUrlLabel')}</div>
                  <input type="text" value={voiceAliyunConfig.baseUrl} onChange={(event) => updateVoiceAliyunConfig({ baseUrl: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
              </div>,
            )}
            {renderSettingsCardSection(
              i18nService.t('settingsPanelParameters'),
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderSttModelLabel')}</div>
                  <input type="text" value={voiceAliyunConfig.sttModel} onChange={(event) => updateVoiceAliyunConfig({ sttModel: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderTtsModelLabel')}</div>
                  <input type="text" value={voiceAliyunConfig.ttsModel} onChange={(event) => updateVoiceAliyunConfig({ ttsModel: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderTtsVoiceLabel')}</div>
                  <input type="text" value={voiceAliyunConfig.ttsVoice} onChange={(event) => updateVoiceAliyunConfig({ ttsVoice: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderLocaleLabel')}</div>
                  <input type="text" value={voiceAliyunConfig.locale} onChange={(event) => updateVoiceAliyunConfig({ locale: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
              </div>,
            )}
          </div>
        );
      case VoiceProvider.CloudVolcengine:
        return (
          <div className="space-y-4">
            {renderSettingsCardSection(
              i18nService.t('settingsPanelBasic'),
              <div className="space-y-3">
                <p className="text-sm text-secondary">{getVoiceProviderDescription(VoiceProvider.CloudVolcengine)}</p>
                {renderVoiceProviderStatusFacts(VoiceProvider.CloudVolcengine)}
              </div>,
              undefined,
              renderSwitch(voiceVolcengineConfig.enabled, () => updateVoiceVolcengineConfig({ enabled: !voiceVolcengineConfig.enabled })),
            )}
            {renderSettingsCardSection(
              i18nService.t('providerPanel_credentials'),
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderVolcengineAppKeyLabel')}</div>
                  <input type="password" value={voiceVolcengineConfig.appKey} onChange={(event) => updateVoiceVolcengineConfig({ appKey: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderVolcengineTokenLabel')}</div>
                  <input type="password" value={voiceVolcengineConfig.accessToken} onChange={(event) => updateVoiceVolcengineConfig({ accessToken: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderBaseUrlLabel')}</div>
                  <input type="text" value={voiceVolcengineConfig.baseUrl} onChange={(event) => updateVoiceVolcengineConfig({ baseUrl: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
              </div>,
            )}
            {renderSettingsCardSection(
              i18nService.t('settingsPanelParameters'),
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderTtsVoiceLabel')}</div>
                  <input type="text" value={voiceVolcengineConfig.ttsVoice} onChange={(event) => updateVoiceVolcengineConfig({ ttsVoice: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderLocaleLabel')}</div>
                  <input type="text" value={voiceVolcengineConfig.locale} onChange={(event) => updateVoiceVolcengineConfig({ locale: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
              </div>,
            )}
          </div>
        );
      case VoiceProvider.CloudAzure:
        return (
          <div className="space-y-4">
            {renderSettingsCardSection(
              i18nService.t('settingsPanelBasic'),
              <div className="space-y-3">
                <p className="text-sm text-secondary">{getVoiceProviderDescription(VoiceProvider.CloudAzure)}</p>
                {renderVoiceProviderStatusFacts(VoiceProvider.CloudAzure)}
              </div>,
              undefined,
              renderSwitch(voiceAzureConfig.enabled, () => updateVoiceAzureConfig({ enabled: !voiceAzureConfig.enabled })),
            )}
            {renderSettingsCardSection(
              i18nService.t('providerPanel_credentials'),
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderApiKeyLabel')}</div>
                  <input type="password" value={voiceAzureConfig.apiKey} onChange={(event) => updateVoiceAzureConfig({ apiKey: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderAzureRegionLabel')}</div>
                    <input type="text" value={voiceAzureConfig.region} onChange={(event) => updateVoiceAzureConfig({ region: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderAzureEndpointLabel')}</div>
                    <input type="text" value={voiceAzureConfig.endpoint} onChange={(event) => updateVoiceAzureConfig({ endpoint: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                  </label>
                </div>
              </div>,
            )}
            {renderSettingsCardSection(
              i18nService.t('settingsPanelParameters'),
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderTtsVoiceLabel')}</div>
                  <input type="text" value={voiceAzureConfig.ttsVoice} onChange={(event) => updateVoiceAzureConfig({ ttsVoice: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderLocaleLabel')}</div>
                  <input type="text" value={voiceAzureConfig.locale} onChange={(event) => updateVoiceAzureConfig({ locale: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
              </div>,
            )}
          </div>
        );
      case VoiceProvider.CloudCustom:
        return (
          <div className="space-y-4">
            {renderSettingsCardSection(
              i18nService.t('settingsPanelBasic'),
              <div className="space-y-3">
                <p className="text-sm text-secondary">{getVoiceProviderDescription(VoiceProvider.CloudCustom)}</p>
                {renderVoiceProviderStatusFacts(VoiceProvider.CloudCustom)}
              </div>,
              undefined,
              renderSwitch(voiceCustomConfig.enabled, () => updateVoiceCustomConfig({ enabled: !voiceCustomConfig.enabled })),
            )}
            {renderSettingsCardSection(
              i18nService.t('providerPanel_credentials'),
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderApiKeyLabel')}</div>
                  <input type="password" value={voiceCustomConfig.apiKey} onChange={(event) => updateVoiceCustomConfig({ apiKey: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderBaseUrlLabel')}</div>
                  <input type="text" value={voiceCustomConfig.baseUrl} onChange={(event) => updateVoiceCustomConfig({ baseUrl: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
              </div>,
            )}
            {renderSettingsCardSection(
              i18nService.t('settingsPanelParameters'),
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderCustomSttPathLabel')}</div>
                  <input type="text" value={voiceCustomConfig.sttPath} onChange={(event) => updateVoiceCustomConfig({ sttPath: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderCustomTtsPathLabel')}</div>
                  <input type="text" value={voiceCustomConfig.ttsPath} onChange={(event) => updateVoiceCustomConfig({ ttsPath: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
                <label className="block">
                  <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceProviderLocaleLabel')}</div>
                  <input type="text" value={voiceCustomConfig.locale} onChange={(event) => updateVoiceCustomConfig({ locale: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                </label>
              </div>,
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const renderGeneralSettingsPanel = () => {
    const voiceCapabilityEntries: Array<{
      key: VoiceCapabilityKey;
      title: string;
      description: string;
      enabled: boolean;
      toggle: () => void;
    }> = [
      {
        key: VoiceCapability.ManualStt,
        title: i18nService.t('voiceCapabilityManualSttTitle'),
        description: i18nService.t('voiceManualSttDescription'),
        enabled: manualSttEnabled,
        toggle: () => setManualSttEnabled((prev) => !prev),
      },
      {
        key: VoiceCapability.WakeInput,
        title: i18nService.t('voiceCapabilityWakeInputTitle'),
        description: i18nService.t('wakeInputDescription'),
        enabled: wakeInputEnabled,
        toggle: () => setWakeInputEnabled((prev) => !prev),
      },
      {
        key: VoiceCapability.FollowUpDictation,
        title: i18nService.t('voiceCapabilityFollowUpTitle'),
        description: i18nService.t('followUpDictationDescription'),
        enabled: followUpDictationEnabled,
        toggle: () => setFollowUpDictationEnabled((prev) => !prev),
      },
      {
        key: VoiceCapability.Tts,
        title: i18nService.t('voiceCapabilityTtsTitle'),
        description: i18nService.t('ttsDescription'),
        enabled: ttsEnabled,
        toggle: () => setTtsEnabled((prev) => !prev),
      },
    ];

    const visibleVoiceProviderStatuses = showAllVoiceProviderStatuses
      ? voiceProviderPanelKeys
      : (inUseVoiceProviderKeys.length > 0 ? inUseVoiceProviderKeys : [selectedVoiceProvider]);
    const selectedWorkspaceTags = getVoiceProviderInUseTags(selectedVoiceProvider);

    const renderVoiceCapabilityDetail = (capabilityKey: VoiceCapabilityKey) => {
      switch (capabilityKey) {
        case VoiceCapability.ManualStt:
          return (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_320px]">
              <div className="space-y-4">
                {renderSettingsCardSection(
                  i18nService.t('voiceRoutingTitle'),
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceStrategyLabel')}</div>
                      <ThemedSelect
                        id="voice-strategy-panel"
                        value={voiceStrategy}
                        onChange={(value) => setVoiceStrategy(value as VoiceStrategyValue)}
                        options={voiceStrategyOptions}
                      />
                    </label>
                    <label className="block">
                      <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceManualSttProviderLabel')}</div>
                      <ThemedSelect
                        id="voice-manual-provider-panel"
                        value={manualSttProvider}
                        onChange={(value) => setManualSttProvider(value as VoiceCapabilityProvider)}
                        options={manualSttProviderOptions}
                      />
                    </label>
                  </div>,
                )}
                {renderSettingsCardSection(
                  i18nService.t('speechInputCommandsTitle'),
                  <div className="space-y-3">
                    <label className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                      <span className="text-sm text-foreground">{i18nService.t('speechInputLlmCorrectionLabel')}</span>
                      {renderSwitch(sttLlmCorrectionEnabled, () => setSttLlmCorrectionEnabled((prev) => !prev))}
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <div className="mb-1 text-xs text-secondary">{i18nService.t('speechInputStopCommandLabel')}</div>
                        <input type="text" value={speechStopCommand} onChange={(event) => setSpeechStopCommand(event.target.value)} placeholder={i18nService.t('speechInputStopCommandPlaceholder')} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs text-secondary">{i18nService.t('speechInputSubmitCommandLabel')}</div>
                        <input type="text" value={speechSubmitCommand} onChange={(event) => setSpeechSubmitCommand(event.target.value)} placeholder={i18nService.t('speechInputSubmitCommandPlaceholder')} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                      </label>
                    </div>
                    <p className="text-xs text-secondary">{i18nService.t('speechInputCommandsHint')}</p>
                  </div>,
                )}
              </div>
              {renderSettingsCardSection(
                i18nService.t('voiceProviderStatusTitle'),
                renderVoiceCapabilityMeta(VoiceCapability.ManualStt),
                i18nService.t('voiceProviderStatusDescription'),
              )}
            </div>
          );
        case VoiceCapability.WakeInput:
          return (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_320px]">
              <div className="space-y-4">
                {renderSettingsCardSection(
                  i18nService.t('wakeInputTitle'),
                  <div className="space-y-3">
                    <label className="block">
                      <div className="mb-1 text-xs text-secondary">{i18nService.t('wakeInputWakeWordsLabel')}</div>
                      <textarea value={wakeInputWakeWordsText} onChange={(event) => setWakeInputWakeWordsText(event.target.value)} placeholder={i18nService.t('wakeInputWakeWordsPlaceholder')} rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <div className="mb-1 text-xs text-secondary">{i18nService.t('wakeInputSubmitCommandLabel')}</div>
                        <input type="text" value={wakeInputSubmitCommand} onChange={(event) => setWakeInputSubmitCommand(event.target.value)} placeholder={i18nService.t('wakeInputSubmitCommandPlaceholder')} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                      </label>
                      <label className="block">
                        <div className="mb-1 text-xs text-secondary">{i18nService.t('wakeInputCancelCommandLabel')}</div>
                        <input type="text" value={wakeInputCancelCommand} onChange={(event) => setWakeInputCancelCommand(event.target.value)} placeholder={i18nService.t('wakeInputCancelCommandPlaceholder')} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                      </label>
                    </div>
                    <label className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                      <span className="text-sm text-foreground">{i18nService.t('wakeInputActivationReplyEnabledLabel')}</span>
                      {renderSwitch(wakeActivationReplyEnabled, () => setWakeActivationReplyEnabled((prev) => !prev))}
                    </label>
                    <label className="block">
                      <div className="mb-1 text-xs text-secondary">{i18nService.t('wakeInputActivationReplyTextLabel')}</div>
                      <input type="text" value={wakeActivationReplyText} onChange={(event) => setWakeActivationReplyText(event.target.value)} placeholder={i18nService.t('wakeInputActivationReplyTextPlaceholder')} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                    </label>
                  </div>,
                )}
              </div>
              {renderSettingsCardSection(
                i18nService.t('voiceProviderStatusTitle'),
                <div className="space-y-3">
                  {renderVoiceCapabilityMeta(VoiceCapability.WakeInput)}
                  <div className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-secondary">
                    {i18nService.t('wakeInputStatusLabel')}: {getWakeInputStatusText()}
                  </div>
                </div>,
                i18nService.t('voiceProviderStatusDescription'),
              )}
            </div>
          );
        case VoiceCapability.FollowUpDictation:
          return (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_320px]">
              <div className="space-y-4">
                {renderSettingsCardSection(
                  i18nService.t('voiceCapabilityFollowUpTitle'),
                  <div className="space-y-3">
                    <label className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                      <span className="text-sm text-foreground">{i18nService.t('voiceCapabilityFollowUpTitle')}</span>
                      {renderSwitch(followUpDictationEnabled, () => setFollowUpDictationEnabled((prev) => !prev))}
                    </label>
                    <div className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-secondary">
                      {i18nService.t('followUpDictationDescription')}
                    </div>
                    <div className="rounded-xl border border-border px-3 py-3 text-sm text-secondary">
                      {i18nService.t('voiceFollowUpProviderHint')}
                    </div>
                  </div>,
                )}
              </div>
              {renderSettingsCardSection(
                i18nService.t('voiceProviderStatusTitle'),
                renderVoiceCapabilityMeta(VoiceCapability.FollowUpDictation),
                i18nService.t('voiceProviderStatusDescription'),
              )}
            </div>
          );
        case VoiceCapability.Tts:
          return (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_320px]">
              <div className="space-y-4">
                {renderSettingsCardSection(
                  i18nService.t('voiceRoutingTitle'),
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <div className="mb-1 text-xs text-secondary">{i18nService.t('voiceTtsProviderLabel')}</div>
                      <ThemedSelect
                        id="voice-tts-provider-panel"
                        value={ttsProvider}
                        onChange={(value) => setTtsProvider(value as VoiceCapabilityProvider)}
                        options={ttsProviderOptions}
                      />
                    </label>
                    <label className="block">
                      <div className="mb-1 text-xs text-secondary">{i18nService.t('ttsEngineLabel')}</div>
                      <ThemedSelect
                        id="voice-tts-engine-panel"
                        value={ttsEngine}
                        onChange={(value) => setTtsEngine(value as TtsEngine)}
                        options={[
                          { value: TtsEngine.MacosNative, label: i18nService.t('ttsEngine_macos_native') },
                          { value: TtsEngine.EdgeTts, label: i18nService.t('ttsEngine_edge_tts') },
                        ]}
                      />
                    </label>
                  </div>,
                )}
                {renderSettingsCardSection(
                  i18nService.t('ttsTitle'),
                  <div className="space-y-3">
                    <label className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                      <span className="text-sm text-foreground">{i18nService.t('ttsAutoPlayLabel')}</span>
                      {renderSwitch(ttsAutoPlayAssistantReply, () => setTtsAutoPlayAssistantReply((prev) => !prev))}
                    </label>
                    <label className="flex items-center justify-between rounded-xl border border-border px-3 py-3">
                      <span className="text-sm text-foreground">{i18nService.t('ttsLlmRewriteLabel')}</span>
                      {renderSwitch(ttsLlmRewriteEnabled, () => setTtsLlmRewriteEnabled((prev) => !prev))}
                    </label>
                    <label className="block">
                      <div className="mb-1 text-xs text-secondary">{i18nService.t('ttsSkipKeywordsLabel')}</div>
                      <textarea value={ttsSkipKeywordsText} onChange={(event) => setTtsSkipKeywordsText(event.target.value)} placeholder={i18nService.t('ttsSkipKeywordsPlaceholder')} rows={3} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
                      <p className="mt-2 text-xs text-secondary">{i18nService.t('ttsSkipKeywordsHint')}</p>
                    </label>
                    <label className="block">
                      <div className="mb-1 text-xs text-secondary">{i18nService.t('ttsVoiceLabel')}</div>
                      <ThemedSelect
                        id="tts-voice-panel"
                        value={ttsVoiceId}
                        onChange={(value) => updateDisplayedTtsConfig({ ttsVoiceId: value })}
                        options={[
                          { value: '', label: i18nService.t('ttsVoiceAuto') },
                          ...ttsVoices.map((voice) => ({
                            value: voice.identifier,
                            label: `${voice.name} (${voice.language})`,
                          })),
                        ]}
                      />
                    </label>
                    <label className="block">
                      <div className="mb-1 text-xs text-secondary">{i18nService.t('ttsRateLabel')}: {ttsRate.toFixed(2)}</div>
                      <input type="range" min="0.1" max="1" step="0.05" value={ttsRate} onChange={(event) => updateDisplayedTtsConfig({ ttsRate: Number(event.target.value) })} className="w-full" />
                    </label>
                    <label className="block">
                      <div className="mb-1 text-xs text-secondary">{i18nService.t('ttsVolumeLabel')}: {ttsVolume.toFixed(2)}</div>
                      <input type="range" min="0" max="1" step="0.05" value={ttsVolume} onChange={(event) => updateDisplayedTtsConfig({ ttsVolume: Number(event.target.value) })} className="w-full" />
                    </label>
                  </div>,
                )}
              </div>
              {renderSettingsCardSection(
                i18nService.t('voiceProviderStatusTitle'),
                <div className="space-y-3">
                  {renderVoiceCapabilityMeta(VoiceCapability.Tts)}
                  <div className="rounded-xl border border-border px-3 py-3 text-xs text-secondary">
                    <div>{i18nService.t('voiceOverviewRuntimeStatus')}: {ttsAvailability ? i18nService.t(`ttsPrepareStatus_${ttsAvailability.prepareStatus}`) : i18nService.t('loading')}</div>
                    <div>{i18nService.t('voiceOverviewActualEngine')}: {ttsAvailability?.lastResolvedEngine ? i18nService.t(`ttsEngine_${ttsAvailability.lastResolvedEngine}`) : i18nService.t('ttsActualEngineNone')}</div>
                    {ttsAvailability?.lastRequestedEngine && ttsAvailability?.lastResolvedEngine && ttsAvailability.lastRequestedEngine !== ttsAvailability.lastResolvedEngine && (
                      <div className="text-amber-600 dark:text-amber-400">
                        {i18nService.t('ttsActualEngineFallbackLabel')}: {i18nService.t(`ttsEngine_${ttsAvailability.lastRequestedEngine}`)}
                      </div>
                    )}
                    {(ttsAvailability?.recentError || ttsAvailability?.lastFallbackReason) && (
                      <div>{i18nService.t('ttsPrepareLastErrorLabel')}: {ttsAvailability?.recentError || ttsAvailability?.lastFallbackReason}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void window.electron.tts.prepare({ engine: ttsEngine }).then((result) => {
                        if (result.availability) {
                          setTtsAvailability(result.availability);
                        }
                      }).catch((error) => {
                        console.error('Failed to retry TTS runtime preparation:', error);
                      });
                    }}
                    className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-raised"
                  >
                    {i18nService.t('ttsPrepareRetryButton')}
                  </button>
                </div>,
                i18nService.t('voiceProviderStatusDescription'),
              )}
            </div>
          );
        default:
          return null;
      }
    };

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-foreground">
            {i18nService.t('language')}
          </h4>
          <div className="w-[140px] shrink-0">
            <ThemedSelect
              id="language"
              value={language}
              onChange={(value) => {
                const nextLanguage = value as LanguageType;
                setLanguage(nextLanguage);
                i18nService.setLanguage(nextLanguage, { persist: false });
              }}
              options={[
                { value: 'zh', label: i18nService.t('chinese') },
                { value: 'en', label: i18nService.t('english') }
              ]}
            />
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-medium text-foreground">{i18nService.t('autoLaunch')}</h4>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-secondary">{i18nService.t('autoLaunchDescription')}</span>
            {renderSwitch(autoLaunch, async () => {
              if (isUpdatingAutoLaunch) return;
              const next = !autoLaunch;
              setIsUpdatingAutoLaunch(true);
              try {
                const result = await window.electron.autoLaunch.set(next);
                if (result.success) {
                  setAutoLaunchState(next);
                } else {
                  setError(result.error || 'Failed to update auto-launch setting');
                }
              } catch (err) {
                console.error('Failed to set auto-launch:', err);
                setError('Failed to update auto-launch setting');
              } finally {
                setIsUpdatingAutoLaunch(false);
              }
            }, { disabled: isUpdatingAutoLaunch })}
          </label>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-medium text-foreground">{i18nService.t('preventSleep')}</h4>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-secondary">{i18nService.t('preventSleepDescription')}</span>
            {renderSwitch(preventSleep, async () => {
              if (isUpdatingPreventSleep) return;
              const next = !preventSleep;
              setIsUpdatingPreventSleep(true);
              try {
                const result = await window.electron.preventSleep.set(next);
                if (result.success) {
                  setPreventSleepState(next);
                } else {
                  setError(result.error || 'Failed to update prevent-sleep setting');
                }
              } catch (err) {
                console.error('Failed to set prevent-sleep:', err);
                setError('Failed to update prevent-sleep setting');
              } finally {
                setIsUpdatingPreventSleep(false);
              }
            }, { disabled: isUpdatingPreventSleep })}
          </label>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-medium text-foreground">{i18nService.t('useSystemProxy')}</h4>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-secondary">{i18nService.t('useSystemProxyDescription')}</span>
            {renderSwitch(useSystemProxy, () => setUseSystemProxy((prev) => !prev))}
          </label>
        </div>

        <section className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-foreground">{i18nService.t('voiceSettingsTitle')}</h4>
            <p className="mt-1 text-sm text-secondary">{i18nService.t('voiceSettingsDescription')}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {voiceCapabilityEntries.map((entry) => {
              const isActive = expandedVoiceSection === entry.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => handleVoiceSectionToggle(entry.key)}
                  className={`min-h-[132px] rounded-2xl border px-4 py-4 text-left transition-colors ${
                    isActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-surface hover:bg-surface-raised'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-secondary">
                      {entry.title}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      entry.enabled ? 'bg-primary/10 text-primary' : 'bg-surface-raised text-secondary'
                    }`}>
                      {entry.enabled ? i18nService.t('enabled') : i18nService.t('statusDisabled')}
                    </span>
                  </div>
                  <div className="mt-3 text-sm font-medium text-foreground">
                    {getVoiceCapabilitySummary(entry.key)}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-secondary">
                    {entry.description}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {voiceCapabilityEntries.map((entry) => {
              const isExpanded = expandedVoiceSection === entry.key;
              return (
                <div key={entry.key} className="rounded-2xl border border-border bg-surface px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <button
                      type="button"
                      onClick={() => handleVoiceSectionToggle(entry.key)}
                      className="flex min-w-0 flex-1 items-start justify-between gap-4 text-left"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">{entry.title}</div>
                        <div className="mt-1 text-xs text-secondary">{entry.description}</div>
                      </div>
                      {isExpanded ? (
                        <ChevronDownIcon className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                      ) : (
                        <ChevronRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                      )}
                    </button>
                    <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                      <div className="hidden max-w-[260px] truncate text-xs text-secondary lg:block">
                        {getVoiceCapabilitySummary(entry.key)}
                      </div>
                      {renderSwitch(entry.enabled, entry.toggle)}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-4 border-t border-border pt-4">
                      {renderVoiceCapabilityDetail(entry.key)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium text-foreground">{i18nService.t('voiceProviderStatusTitle')}</h4>
                <p className="mt-1 text-sm text-secondary">{i18nService.t('voiceProviderStatusDescription')}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllVoiceProviderStatuses((prev) => !prev)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-raised"
              >
                {showAllVoiceProviderStatuses ? i18nService.t('voiceShowInUseStatuses') : i18nService.t('voiceShowAllStatuses')}
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {visibleVoiceProviderStatuses.map((providerKey) => renderVoiceProviderMeta(providerKey))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-medium text-foreground">{i18nService.t('voiceProviderWorkspaceTitle')}</h4>
              <p className="mt-1 text-sm text-secondary">{i18nService.t('voiceProviderWorkspaceDescription')}</p>
            </div>
            <div className="overflow-hidden rounded-[28px] border border-border bg-background/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <button
                type="button"
                onClick={() => setIsVoiceProviderWorkspaceExpanded((prev) => !prev)}
                className="flex w-full flex-col gap-4 px-4 py-4 text-left transition-colors hover:bg-primary/5 sm:px-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                      {i18nService.t('voiceProviderWorkspaceTitle')}
                    </div>
                    <div className="mt-2 text-base font-medium text-foreground">
                      {getVoiceProviderLabel(selectedVoiceProvider)}
                    </div>
                    <div className="mt-1 text-sm text-secondary">
                      {getVoiceProviderDescription(selectedVoiceProvider) || i18nService.t('voiceProviderSelectHint')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden rounded-full bg-primary/12 px-2.5 py-1 text-[11px] font-medium text-primary sm:inline-flex">
                      {isVoiceProviderWorkspaceExpanded
                        ? i18nService.t('voiceProviderWorkspaceCollapse')
                        : i18nService.t('voiceProviderWorkspaceExpand')}
                    </span>
                    {isVoiceProviderWorkspaceExpanded ? (
                      <ChevronDownIcon className="h-4 w-4 shrink-0 text-secondary" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-secondary" />
                    )}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-3">
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                      {i18nService.t('voiceProviderWorkspaceSelectedLabel')}
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {getVoiceProviderConfiguredText(selectedVoiceProvider)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/70 px-3 py-3">
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-secondary">
                      {i18nService.t('voiceProviderWorkspaceRoutesLabel')}
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {selectedWorkspaceTags.length > 0 ? selectedWorkspaceTags.join(' / ') : i18nService.t('voiceProviderSelectHint')}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/70 px-3 py-3">
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-secondary">
                      {i18nService.t('voiceProviderWorkspaceInUseCountLabel')}
                    </div>
                    <div className="mt-2 text-sm font-medium text-foreground">
                      {i18nService.t('voiceProviderWorkspaceInUseCountValue').replace('{count}', String(inUseVoiceProviderKeys.length))}
                    </div>
                  </div>
                </div>
              </button>

              {isVoiceProviderWorkspaceExpanded && (
                <div className="border-t border-border/80 px-4 py-4 sm:px-5">
                  <div className="grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      {voiceProviderPanelKeys.map((providerKey) => {
                        const providerStatus = getVoiceProviderStatus(providerKey);
                        const linkedTags = getVoiceProviderInUseTags(providerKey);
                        const visibleTags = linkedTags.slice(0, 2);
                        const isActive = selectedVoiceProvider === providerKey;
                        const statusToneClass = isActive
                          ? 'border-primary/40 bg-primary/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                          : linkedTags.length > 0
                            ? 'border-border bg-background/80'
                            : 'border-border/80 bg-transparent hover:bg-background/70';
                        return (
                          <button
                            key={providerKey}
                            type="button"
                            onClick={() => setSelectedVoiceProvider(providerKey)}
                            className={`relative w-full overflow-hidden rounded-2xl border px-4 py-3 text-left transition-colors ${statusToneClass}`}
                          >
                            <div className={`absolute inset-y-3 left-2 w-0.5 rounded-full ${
                              isActive ? 'bg-primary' : linkedTags.length > 0 ? 'bg-primary/45' : 'bg-transparent'
                            }`} />
                            <div className="flex items-start justify-between gap-3 pl-2">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-foreground">{getVoiceProviderLabel(providerKey)}</div>
                                <div className="mt-1 text-xs text-secondary">{getVoiceProviderConfiguredText(providerKey)}</div>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {isActive && (
                                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-white">
                                    {i18nService.t('statusCurrent')}
                                  </span>
                                )}
                                {linkedTags.length > 0 && (
                                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                    {i18nService.t('voiceProviderInUse')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5 pl-2">
                              {visibleTags.map((tag) => (
                                <span key={`${providerKey}-${tag}`} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  isActive ? 'bg-primary/12 text-primary' : 'bg-surface-raised text-secondary'
                                }`}>
                                  {tag}
                                </span>
                              ))}
                              {linkedTags.length > visibleTags.length && (
                                <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] font-medium text-secondary">
                                  +{linkedTags.length - visibleTags.length}
                                </span>
                              )}
                              {providerStatus && !providerStatus.platformSupported && (
                                <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-500">
                                  {i18nService.t('voiceCapabilityReason_unsupported_platform')}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-primary/20 bg-background/95 px-4 py-4 backdrop-blur xl:sticky xl:top-0 xl:z-10">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
                              {i18nService.t('voiceProviderWorkspaceSelectedLabel')}
                            </div>
                            <div className="mt-2 text-base font-medium text-foreground">{getVoiceProviderLabel(selectedVoiceProvider)}</div>
                            <div className="mt-1 text-sm text-secondary">{getVoiceProviderDescription(selectedVoiceProvider) || i18nService.t('voiceProviderSelectHint')}</div>
                          </div>
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                            {getVoiceProviderConfiguredText(selectedVoiceProvider)}
                          </span>
                        </div>
                      </div>
                      {renderSelectedVoiceProviderPanel()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium dark:text-claude-darkText text-claude-text mb-1">
              {i18nService.t('authSettingsTitle')}
            </h4>
            <p className="text-sm dark:text-claude-darkSecondaryText text-claude-secondaryText">
              {i18nService.t('authSettingsDescription')}
            </p>
          </div>

          <div className="rounded-xl border dark:border-claude-darkBorder border-claude-border px-4 py-3">
            <div className="text-sm font-medium dark:text-claude-darkText text-claude-text">
              {i18nService.t('authBackendQtb')}
            </div>
            <div className="mt-3 space-y-3">
              <label className="block">
                <div className="mb-1 text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary">
                  {i18nService.t('authQtbApiBaseUrl')}
                </div>
                <input
                  type="text"
                  value={qtbApiBaseUrl}
                  onChange={(event) => setQtbApiBaseUrl(event.target.value)}
                  placeholder={i18nService.t('authQtbApiBaseUrlPlaceholder')}
                  className="w-full rounded-lg border dark:border-claude-darkBorder border-claude-border px-3 py-2 text-sm dark:bg-claude-darkSurface bg-white dark:text-claude-darkText text-claude-text"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary">
                  {i18nService.t('authQtbWebBaseUrl')}
                </div>
                <input
                  type="text"
                  value={qtbWebBaseUrl}
                  onChange={(event) => setQtbWebBaseUrl(event.target.value)}
                  placeholder={i18nService.t('authQtbWebBaseUrlPlaceholder')}
                  className="w-full rounded-lg border dark:border-claude-darkBorder border-claude-border px-3 py-2 text-sm dark:bg-claude-darkSurface bg-white dark:text-claude-darkText text-claude-text"
                />
              </label>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--lobster-text-primary)' }}>
            {i18nService.t('appearance')}
          </h4>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {(['light', 'dark', 'system'] as const).map((mode) => {
              const isSelected = theme === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setTheme(mode);
                    themeService.setTheme(mode);
                    setThemeId(themeService.getThemeId());
                  }}
                  className="flex flex-col items-center rounded-xl border-2 p-3 transition-colors cursor-pointer"
                  style={{
                    borderColor: isSelected ? 'var(--lobster-primary)' : 'var(--lobster-border)',
                    backgroundColor: isSelected ? 'var(--lobster-primary-muted)' : undefined,
                  }}
                >
                  <svg viewBox="0 0 120 80" className="w-full h-auto rounded-md mb-2 overflow-hidden" xmlns="http://www.w3.org/2000/svg">
                    {mode === 'light' && (
                      <>
                        <rect width="120" height="80" fill="#F8F9FB" />
                        <rect x="0" y="0" width="30" height="80" fill="#EBEDF0" />
                        <rect x="4" y="8" width="22" height="4" rx="2" fill="#C8CBD0" />
                        <rect x="4" y="16" width="18" height="3" rx="1.5" fill="#D5D7DB" />
                        <rect x="4" y="22" width="20" height="3" rx="1.5" fill="#D5D7DB" />
                        <rect x="4" y="28" width="16" height="3" rx="1.5" fill="#D5D7DB" />
                        <rect x="36" y="8" width="78" height="64" rx="4" fill="#FFFFFF" />
                        <rect x="42" y="16" width="50" height="4" rx="2" fill="#D5D7DB" />
                        <rect x="42" y="24" width="66" height="3" rx="1.5" fill="#E2E4E7" />
                        <rect x="42" y="30" width="60" height="3" rx="1.5" fill="#E2E4E7" />
                        <rect x="42" y="36" width="55" height="3" rx="1.5" fill="#E2E4E7" />
                        <rect x="42" y="46" width="40" height="4" rx="2" fill="#D5D7DB" />
                        <rect x="42" y="54" width="66" height="3" rx="1.5" fill="#E2E4E7" />
                        <rect x="42" y="60" width="58" height="3" rx="1.5" fill="#E2E4E7" />
                      </>
                    )}
                    {mode === 'dark' && (
                      <>
                        <rect width="120" height="80" fill="#0F1117" />
                        <rect x="0" y="0" width="30" height="80" fill="#151820" />
                        <rect x="4" y="8" width="22" height="4" rx="2" fill="#3A3F4B" />
                        <rect x="4" y="16" width="18" height="3" rx="1.5" fill="#2A2F3A" />
                        <rect x="4" y="22" width="20" height="3" rx="1.5" fill="#2A2F3A" />
                        <rect x="4" y="28" width="16" height="3" rx="1.5" fill="#2A2F3A" />
                        <rect x="36" y="8" width="78" height="64" rx="4" fill="#1A1D27" />
                        <rect x="42" y="16" width="50" height="4" rx="2" fill="#3A3F4B" />
                        <rect x="42" y="24" width="66" height="3" rx="1.5" fill="#252930" />
                        <rect x="42" y="30" width="60" height="3" rx="1.5" fill="#252930" />
                        <rect x="42" y="36" width="55" height="3" rx="1.5" fill="#252930" />
                        <rect x="42" y="46" width="40" height="4" rx="2" fill="#3A3F4B" />
                        <rect x="42" y="54" width="66" height="3" rx="1.5" fill="#252930" />
                        <rect x="42" y="60" width="58" height="3" rx="1.5" fill="#252930" />
                      </>
                    )}
                    {mode === 'system' && (
                      <>
                        <defs>
                          <clipPath id="left-half">
                            <rect x="0" y="0" width="60" height="80" />
                          </clipPath>
                          <clipPath id="right-half">
                            <rect x="60" y="0" width="60" height="80" />
                          </clipPath>
                        </defs>
                        <g clipPath="url(#left-half)">
                          <rect width="120" height="80" fill="#F8F9FB" />
                          <rect x="0" y="0" width="30" height="80" fill="#EBEDF0" />
                          <rect x="4" y="8" width="22" height="4" rx="2" fill="#C8CBD0" />
                          <rect x="4" y="16" width="18" height="3" rx="1.5" fill="#D5D7DB" />
                          <rect x="4" y="22" width="20" height="3" rx="1.5" fill="#D5D7DB" />
                          <rect x="4" y="28" width="16" height="3" rx="1.5" fill="#D5D7DB" />
                          <rect x="36" y="8" width="78" height="64" rx="4" fill="#FFFFFF" />
                          <rect x="42" y="16" width="50" height="4" rx="2" fill="#D5D7DB" />
                          <rect x="42" y="24" width="66" height="3" rx="1.5" fill="#E2E4E7" />
                          <rect x="42" y="30" width="60" height="3" rx="1.5" fill="#E2E4E7" />
                          <rect x="42" y="36" width="55" height="3" rx="1.5" fill="#E2E4E7" />
                          <rect x="42" y="46" width="40" height="4" rx="2" fill="#D5D7DB" />
                          <rect x="42" y="54" width="66" height="3" rx="1.5" fill="#E2E4E7" />
                        </g>
                        <g clipPath="url(#right-half)">
                          <rect width="120" height="80" fill="#0F1117" />
                          <rect x="0" y="0" width="30" height="80" fill="#151820" />
                          <rect x="4" y="8" width="22" height="4" rx="2" fill="#3A3F4B" />
                          <rect x="4" y="16" width="18" height="3" rx="1.5" fill="#2A2F3A" />
                          <rect x="4" y="22" width="20" height="3" rx="1.5" fill="#2A2F3A" />
                          <rect x="4" y="28" width="16" height="3" rx="1.5" fill="#2A2F3A" />
                          <rect x="36" y="8" width="78" height="64" rx="4" fill="#1A1D27" />
                          <rect x="42" y="16" width="50" height="4" rx="2" fill="#3A3F4B" />
                          <rect x="42" y="24" width="66" height="3" rx="1.5" fill="#252930" />
                          <rect x="42" y="30" width="60" height="3" rx="1.5" fill="#252930" />
                          <rect x="42" y="36" width="55" height="3" rx="1.5" fill="#252930" />
                          <rect x="42" y="46" width="40" height="4" rx="2" fill="#3A3F4B" />
                          <rect x="42" y="54" width="66" height="3" rx="1.5" fill="#252930" />
                        </g>
                        <line x1="60" y1="0" x2="60" y2="80" stroke="#888" strokeWidth="0.5" />
                      </>
                    )}
                  </svg>
                  <span className="text-xs font-medium" style={{ color: isSelected ? 'var(--lobster-primary)' : 'var(--lobster-text-primary)' }}>
                    {i18nService.t(mode)}
                  </span>
                </button>
              );
            })}
          </div>

          <h4 className="text-sm font-medium mb-3 mt-5" style={{ color: 'var(--lobster-text-primary)' }}>
            {i18nService.t('themeColor')}
          </h4>
          {(() => {
            const allThemes = themeService.getAllThemes();
            const classicThemes = allThemes.filter(t => t.meta.id === 'classic-light' || t.meta.id === 'classic-dark');
            const otherThemes = allThemes.filter(t => t.meta.id !== 'classic-light' && t.meta.id !== 'classic-dark');
            const renderTile = (t: import('../theme').ThemeDefinition) => {
              const isSelected = themeId === t.meta.id;
              const [bg, c1, c2, c3] = t.meta.preview;
              return (
                <button
                  key={t.meta.id}
                  type="button"
                  onClick={() => {
                    themeService.setThemeById(t.meta.id);
                    setThemeId(t.meta.id);
                    setTheme(t.meta.appearance as 'light' | 'dark');
                  }}
                  className="flex flex-col items-center rounded-xl border-2 p-2 transition-colors cursor-pointer"
                  style={{
                    borderColor: isSelected ? 'var(--lobster-primary)' : undefined,
                    backgroundColor: isSelected ? 'var(--lobster-primary-muted)' : undefined,
                  }}
                >
                  <svg viewBox="0 0 80 48" className="w-full h-auto rounded-md mb-1.5 overflow-hidden" xmlns="http://www.w3.org/2000/svg">
                    <rect width="80" height="48" fill={bg} />
                    <rect x="4" y="6" width="20" height="36" rx="3" fill={c1} opacity="0.7" />
                    <rect x="28" y="6" width="48" height="36" rx="3" fill={c2} opacity="0.5" />
                    <circle cx="52" cy="24" r="8" fill={c3} opacity="0.8" />
                    <rect x="32" y="34" width="40" height="4" rx="2" fill={c1} opacity="0.6" />
                  </svg>
                  <span className="text-[10px] font-medium truncate w-full text-center" style={{ color: isSelected ? 'var(--lobster-primary)' : 'var(--lobster-text-primary)' }}>
                    {t.meta.name}
                  </span>
                </button>
              );
            };
            return (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {classicThemes.map(renderTile)}
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {otherThemes.map(renderTile)}
                </div>
              </>
            );
          })()}
        </div>
      </div>
    );
  };

  const renderModelSettingsPanel = () => {
    const providerGroupsForRail = buildProviderGroupsForRail();
    const activeProviderConfig = providers[activeProvider];
    const activeProviderLabel = getProviderDisplayLabel(activeProvider);
    const activeProviderBadges = getProviderRailBadges(activeProvider, activeProviderConfig);

    const renderProviderPanelSection = (
      section: ProviderPanelSectionKey,
      title: string,
      children: React.ReactNode,
      subtitle?: string,
      trailing?: React.ReactNode,
    ) => (
      <div className="space-y-2">
        {renderDisclosureHeader({
          title,
          subtitle,
          expanded: expandedProviderPanelSections[section],
          onToggle: () => toggleProviderPanelSection(section),
          trailing,
        })}
        {expandedProviderPanelSections[section] && (
          <div className="rounded-2xl border border-border bg-surface px-4 py-4">
            {children}
          </div>
        )}
      </div>
    );

    return (
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-foreground">{i18nService.t('modelProviders')}</h3>
              <p className="mt-1 text-xs text-secondary">{i18nService.t('providerSettings')}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleImportProvidersClick}
                disabled={isImportingProviders || isExportingProviders}
                className="inline-flex items-center rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-raised disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {i18nService.t('import')}
              </button>
              <button
                type="button"
                onClick={handleExportProviders}
                disabled={isImportingProviders || isExportingProviders}
                className="inline-flex items-center rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-raised disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {i18nService.t('export')}
              </button>
            </div>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportProviders}
          />

          {providerGroupsForRail.map((group) => {
            const isExpanded = expandedProviderGroup === group.key;
            return (
              <div key={group.key} className="rounded-2xl border border-border bg-surface">
                <button
                  type="button"
                  onClick={() => handleProviderGroupToggle(group.key)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{i18nService.t(`providerGroup_${group.key}`)}</div>
                    <div className="mt-1 text-xs text-secondary">{group.providers.length} {i18nService.t('providerGroupCountUnit')}</div>
                  </div>
                  {isExpanded ? (
                    <ChevronDownIcon className="h-4 w-4 text-secondary" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4 text-secondary" />
                  )}
                </button>
                {isExpanded && (
                  <div className="space-y-2 border-t border-border px-3 py-3">
                    {group.providers.map((providerKey) => {
                      const config = visibleProviders[providerKey];
                      const badges = getProviderRailBadges(providerKey, config);
                      const visibleBadges = badges.slice(0, 3);
                      const isCurrent = activeProvider === providerKey;
                      return (
                        <button
                          key={providerKey}
                          type="button"
                          onClick={() => handleProviderChange(providerKey)}
                          className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                            isCurrent ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-surface-raised'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center text-foreground">
                              {isCustomProvider(providerKey) ? <CustomProviderIcon /> : providerMeta[providerKey]?.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-foreground">{getProviderDisplayLabel(providerKey)}</div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {visibleBadges.map((badge) => (
                                  <span key={`${providerKey}-${badge}`} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                    badge === i18nService.t('providerMissingApiKey')
                                      ? 'bg-red-500/10 text-red-500'
                                      : badge === i18nService.t('statusCurrent')
                                        ? 'bg-primary/10 text-primary'
                                        : 'bg-surface-raised text-secondary'
                                  }`}>
                                    {badge}
                                  </span>
                                ))}
                                {badges.length > visibleBadges.length && (
                                  <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[11px] font-medium text-secondary">
                                    +{badges.length - visibleBadges.length}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {CUSTOM_PROVIDER_KEYS.some(k => !providers[k]) && (
            <button
              type="button"
              onClick={handleAddCustomProvider}
              className="w-full rounded-2xl border border-dashed border-border px-4 py-3 text-sm font-medium text-secondary hover:border-primary hover:text-primary"
            >
              {i18nService.t('addCustomProvider')}
            </button>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-border bg-background/95 px-4 py-4 backdrop-blur xl:sticky xl:top-0 xl:z-10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-medium text-foreground">{activeProviderLabel}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeProviderBadges.map((badge) => (
                    <span key={`${activeProvider}-${badge}`} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      badge === i18nService.t('providerMissingApiKey')
                        ? 'bg-red-500/10 text-red-500'
                        : badge === i18nService.t('statusCurrent')
                          ? 'bg-primary/10 text-primary'
                          : 'bg-surface-raised text-secondary'
                    }`}>
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
              {renderSwitch(
                activeProviderConfig.enabled,
                () => toggleProviderEnabled(activeProvider),
                {
                  disabled: !activeProviderConfig.enabled && providerRequiresApiKey(activeProvider) && !activeProviderConfig.apiKey.trim() && !(activeProvider === 'minimax' && providers.minimax.authType === 'oauth'),
                },
              )}
            </div>
          </div>

          {renderProviderPanelSection(
            'credentials',
            i18nService.t('providerPanel_credentials'),
            <div className="space-y-4">
              {activeProvider === 'minimax' && (
                <div className="space-y-3">
                  <div className="flex rounded-xl overflow-hidden border border-border">
                    <button
                      type="button"
                      onClick={() => setProviders(prev => ({ ...prev, minimax: { ...prev.minimax, authType: 'oauth' } }))}
                      className={`flex-1 py-1.5 text-xs font-medium transition-colors ${providers.minimax.authType === 'oauth' ? 'bg-primary text-white' : 'text-secondary hover:bg-surface-raised'}`}
                    >
                      {i18nService.t('minimaxOAuthTabOAuth')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProviders(prev => ({ ...prev, minimax: { ...prev.minimax, authType: 'apikey' } }));
                        setMinimaxOAuthPhase({ kind: 'idle' });
                      }}
                      className={`flex-1 py-1.5 text-xs font-medium transition-colors ${providers.minimax.authType !== 'oauth' ? 'bg-primary text-white' : 'text-secondary hover:bg-surface-raised'}`}
                    >
                      {i18nService.t('minimaxOAuthTabApiKey')}
                    </button>
                  </div>

                  {providers.minimax.authType !== 'oauth' && (
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        id="minimax-apiKey"
                        value={providers.minimax.apiKey}
                        onChange={(e) => handleProviderConfigChange('minimax', 'apiKey', e.target.value)}
                        className="block w-full rounded-xl bg-surface-inset border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 pr-16 text-xs"
                        placeholder={i18nService.t('apiKeyPlaceholder')}
                      />
                      <div className="absolute right-2 inset-y-0 flex items-center gap-1">
                        {providers.minimax.apiKey && (
                          <button
                            type="button"
                            onClick={() => handleProviderConfigChange('minimax', 'apiKey', '')}
                            className="p-0.5 rounded text-secondary hover:text-primary transition-colors"
                            title={i18nService.t('clear') || 'Clear'}
                          >
                            <XCircleIconSolid className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="p-0.5 rounded text-secondary hover:text-primary transition-colors"
                          title={showApiKey ? (i18nService.t('hide') || 'Hide') : (i18nService.t('show') || 'Show')}
                        >
                          {showApiKey ? <EyeIcon className="h-4 w-4" /> : <EyeSlashIcon className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {providers.minimax.authType === 'oauth' && (
                    <div className="space-y-2">
                      {minimaxOAuthPhase.kind === 'idle' && providers.minimax.apiKey && (
                        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 space-y-2">
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                            {i18nService.t('minimaxOAuthLoggedIn')}
                          </p>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleMiniMaxDeviceLogin(minimaxOAuthRegion)} className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-border text-foreground hover:bg-surface-raised transition-colors">
                              {i18nService.t('minimaxOAuthRelogin')}
                            </button>
                            <button type="button" onClick={handleMiniMaxOAuthLogout} className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors">
                              {i18nService.t('minimaxOAuthLogout')}
                            </button>
                          </div>
                        </div>
                      )}

                      {minimaxOAuthPhase.kind === 'idle' && !providers.minimax.apiKey && (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-foreground mb-1">{i18nService.t('minimaxOAuthRegionLabel')}</label>
                            <div className="flex rounded-xl overflow-hidden border border-border">
                              <button type="button" onClick={() => setMinimaxOAuthRegion('cn')} className={`flex-1 py-1.5 text-xs font-medium transition-colors ${minimaxOAuthRegion === 'cn' ? 'bg-primary text-white' : 'text-secondary hover:bg-surface-raised'}`}>
                                {i18nService.t('minimaxOAuthRegionCN')}
                              </button>
                              <button type="button" onClick={() => setMinimaxOAuthRegion('global')} className={`flex-1 py-1.5 text-xs font-medium transition-colors ${minimaxOAuthRegion === 'global' ? 'bg-primary text-white' : 'text-secondary hover:bg-surface-raised'}`}>
                                {i18nService.t('minimaxOAuthRegionGlobal')}
                              </button>
                            </div>
                          </div>
                          <button type="button" onClick={() => handleMiniMaxDeviceLogin(minimaxOAuthRegion)} className="w-full py-2 text-xs font-medium rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors">
                            {i18nService.t('minimaxOAuthLogin')}
                          </button>
                          <p className="text-[11px] text-secondary">{i18nService.t('minimaxOAuthHint')}</p>
                        </div>
                      )}

                      {minimaxOAuthPhase.kind === 'requesting_code' && (
                        <div className="p-3 rounded-xl bg-surface-inset border border-border">
                          <p className="text-xs text-secondary">{i18nService.t('minimaxOAuthLoggingIn')}</p>
                        </div>
                      )}

                      {minimaxOAuthPhase.kind === 'pending' && (
                        <div className="p-3 rounded-xl bg-surface-inset border border-border space-y-2">
                          <p className="text-xs text-foreground font-medium">{i18nService.t('minimaxOAuthOpenBrowserHint')}</p>
                          <div>
                            <span className="text-[11px] text-secondary">{i18nService.t('minimaxOAuthUserCode')}: </span>
                            <code className="text-xs font-mono text-primary">{minimaxOAuthPhase.userCode}</code>
                          </div>
                          <a href={minimaxOAuthPhase.verificationUri} onClick={(e) => { e.preventDefault(); void window.electron.shell.openExternal(minimaxOAuthPhase.verificationUri); }} className="block truncate text-[11px] text-primary underline">
                            {minimaxOAuthPhase.verificationUri}
                          </a>
                          <p className="text-[11px] text-secondary">{i18nService.t('minimaxOAuthStatusPending')}</p>
                          <button type="button" onClick={handleCancelMiniMaxLogin} className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-border text-foreground hover:bg-surface-raised transition-colors">
                            {i18nService.t('minimaxOAuthCancel')}
                          </button>
                        </div>
                      )}

                      {minimaxOAuthPhase.kind === 'success' && (
                        <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium">{i18nService.t('minimaxOAuthStatusSuccess')}</p>
                        </div>
                      )}

                      {minimaxOAuthPhase.kind === 'error' && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 space-y-2">
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium">{i18nService.t('minimaxOAuthStatusError')}</p>
                          <p className="text-[11px] text-red-600/80 dark:text-red-400/80 break-words">{minimaxOAuthPhase.message}</p>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleMiniMaxDeviceLogin(minimaxOAuthRegion)} className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors">
                              {i18nService.t('minimaxOAuthRelogin')}
                            </button>
                            <button type="button" onClick={() => setMinimaxOAuthPhase({ kind: 'idle' })} className="px-2.5 py-1 text-[11px] font-medium rounded-lg border border-border text-foreground hover:bg-surface-raised transition-colors">
                              {i18nService.t('minimaxOAuthCancel')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {providerRequiresApiKey(activeProvider) && activeProvider !== 'minimax' && (
                <div>
                  <label htmlFor={`${activeProvider}-apiKey`} className="mb-1 block text-xs font-medium text-foreground">
                    {i18nService.t('apiKey')}
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      id={`${activeProvider}-apiKey`}
                      value={activeProviderConfig.apiKey}
                      onChange={(e) => handleProviderConfigChange(activeProvider, 'apiKey', e.target.value)}
                      className="block w-full rounded-xl bg-surface-inset border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 pr-16 text-xs"
                      placeholder={i18nService.t('apiKeyPlaceholder')}
                    />
                    <div className="absolute right-2 inset-y-0 flex items-center gap-1">
                      {activeProviderConfig.apiKey && (
                        <button
                          type="button"
                          onClick={() => handleProviderConfigChange(activeProvider, 'apiKey', '')}
                          className="p-0.5 rounded text-secondary hover:text-primary transition-colors"
                          title={i18nService.t('clear') || 'Clear'}
                        >
                          <XCircleIconSolid className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="p-0.5 rounded text-secondary hover:text-primary transition-colors"
                        title={showApiKey ? (i18nService.t('hide') || 'Hide') : (i18nService.t('show') || 'Show')}
                      >
                        {showApiKey ? <EyeIcon className="h-4 w-4" /> : <EyeSlashIcon className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>,
          )}

          {renderProviderPanelSection(
            'endpoint',
            i18nService.t('providerPanel_endpoint'),
            <div className="space-y-4">
              {!(activeProvider === 'minimax' && providers.minimax.authType === 'oauth') && (
                <div>
                  <label htmlFor={`${activeProvider}-baseUrl`} className="mb-1 block text-xs font-medium text-foreground">
                    {i18nService.t('baseUrl')}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id={`${activeProvider}-baseUrl`}
                      value={(() => {
                        const fmt = getEffectiveApiFormat(activeProvider, activeProviderConfig.apiFormat);
                        if (fmt !== 'gemini') {
                          const cpUrl = (activeProviderConfig as { codingPlanEnabled?: boolean }).codingPlanEnabled
                            ? ProviderRegistry.getCodingPlanUrl(activeProvider, fmt)
                            : undefined;
                          if (cpUrl) return cpUrl;
                        }
                        return activeProviderConfig.baseUrl;
                      })()}
                      onChange={(e) => handleProviderConfigChange(activeProvider, 'baseUrl', e.target.value)}
                      disabled={isBaseUrlLocked}
                      className={`block w-full rounded-xl bg-surface-inset border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 pr-8 text-xs ${isBaseUrlLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                      placeholder={getProviderDefaultBaseUrl(activeProvider, getEffectiveApiFormat(activeProvider, activeProviderConfig.apiFormat)) || defaultConfig.providers?.[activeProvider]?.baseUrl || i18nService.t('baseUrlPlaceholder')}
                    />
                    {activeProviderConfig.baseUrl && !isBaseUrlLocked && (
                      <div className="absolute right-2 inset-y-0 flex items-center">
                        <button
                          type="button"
                          onClick={() => handleProviderConfigChange(activeProvider, 'baseUrl', '')}
                          className="p-0.5 rounded text-secondary hover:text-primary transition-colors"
                          title={i18nService.t('clear') || 'Clear'}
                        >
                          <XCircleIconSolid className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {shouldShowApiFormatSelector(activeProvider) && !(activeProvider === 'minimax' && providers.minimax.authType === 'oauth') && (
                <div>
                  <label htmlFor={`${activeProvider}-apiFormat`} className="mb-1 block text-xs font-medium text-foreground">
                    {i18nService.t('apiFormat')}
                  </label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name={`${activeProvider}-apiFormat`}
                        value="anthropic"
                        checked={getEffectiveApiFormat(activeProvider, activeProviderConfig.apiFormat) !== 'openai'}
                        onChange={() => handleProviderConfigChange(activeProvider, 'apiFormat', 'anthropic')}
                        className="h-3.5 w-3.5 text-primary focus:ring-primary bg-surface"
                      />
                      <span className="ml-2 text-xs text-foreground">{i18nService.t('apiFormatNative')}</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name={`${activeProvider}-apiFormat`}
                        value="openai"
                        checked={getEffectiveApiFormat(activeProvider, activeProviderConfig.apiFormat) === 'openai'}
                        onChange={() => handleProviderConfigChange(activeProvider, 'apiFormat', 'openai')}
                        className="h-3.5 w-3.5 text-primary focus:ring-primary bg-surface"
                      />
                      <span className="ml-2 text-xs text-foreground">{i18nService.t('apiFormatOpenAI')}</span>
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-secondary">{i18nService.t('apiFormatHint')}</p>
                </div>
              )}

              {isCustomProvider(activeProvider) && (
                <div className="rounded-xl border border-dashed border-border px-3 py-3 text-[11px] text-secondary">
                  <p>
                    {i18nService.t('baseUrlHint1')}
                    <code className="ml-1 break-all text-primary">{i18nService.t('baseUrlHintExample1')}</code>
                  </p>
                  <p className="mt-1">
                    {i18nService.t('baseUrlHint2')}
                    <code className="ml-1 break-all text-primary">{i18nService.t('baseUrlHintExample2')}</code>
                  </p>
                </div>
              )}

              {activeProvider === 'zhipu' && providers.zhipu.codingPlanEnabled && (
                <div className="rounded-lg bg-primary-muted border border-primary-muted p-2 text-[11px] text-primary">
                  <span className="font-medium">GLM Coding Plan:</span> {i18nService.t('zhipuCodingPlanEndpointHint')}
                </div>
              )}
              {activeProvider === 'qwen' && providers.qwen.codingPlanEnabled && (
                <div className="rounded-lg bg-primary-muted border border-primary-muted p-2 text-[11px] text-primary">
                  <span className="font-medium">Coding Plan:</span> {i18nService.t('qwenCodingPlanEndpointHint')}
                </div>
              )}
              {activeProvider === 'volcengine' && providers.volcengine.codingPlanEnabled && (
                <div className="rounded-lg bg-primary-muted border border-primary-muted p-2 text-[11px] text-primary">
                  <span className="font-medium">Coding Plan:</span> {i18nService.t('volcengineCodingPlanEndpointHint')}
                </div>
              )}
              {activeProvider === 'moonshot' && providers.moonshot.codingPlanEnabled && (
                <div className="rounded-lg bg-primary-muted border border-primary-muted p-2 text-[11px] text-primary">
                  <span className="font-medium">Coding Plan:</span> {i18nService.t('moonshotCodingPlanEndpointHint')}
                </div>
              )}
            </div>,
          )}

          {renderProviderPanelSection(
            'features',
            i18nService.t('providerPanel_features'),
            <div className="space-y-3">
              {activeProvider === 'zhipu' && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-foreground">GLM Coding Plan</span>
                      <span className="rounded-md bg-primary-muted px-1.5 py-0.5 text-[10px] text-primary">Beta</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-secondary">{i18nService.t('zhipuCodingPlanHint')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-3">
                    <input type="checkbox" checked={providers.zhipu.codingPlanEnabled ?? false} onChange={(e) => handleProviderConfigChange('zhipu', 'codingPlanEnabled', e.target.checked ? 'true' : 'false')} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>
              )}
              {activeProvider === 'qwen' && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-foreground">Coding Plan</span>
                      <span className="rounded-md bg-primary-muted px-1.5 py-0.5 text-[10px] text-primary">订阅套餐</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-secondary">{i18nService.t('qwenCodingPlanHint')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-3">
                    <input type="checkbox" checked={providers.qwen.codingPlanEnabled ?? false} onChange={(e) => handleProviderConfigChange('qwen', 'codingPlanEnabled', e.target.checked ? 'true' : 'false')} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>
              )}
              {activeProvider === 'volcengine' && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-foreground">Coding Plan</span>
                      <span className="rounded-md bg-primary-muted px-1.5 py-0.5 text-[10px] text-primary">Beta</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-secondary">{i18nService.t('volcengineCodingPlanHint')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-3">
                    <input type="checkbox" checked={providers.volcengine.codingPlanEnabled ?? false} onChange={(e) => handleProviderConfigChange('volcengine', 'codingPlanEnabled', e.target.checked ? 'true' : 'false')} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>
              )}
              {activeProvider === 'moonshot' && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-foreground">Coding Plan</span>
                      <span className="rounded-md bg-primary-muted px-1.5 py-0.5 text-[10px] text-primary">Beta</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-secondary">{i18nService.t('moonshotCodingPlanHint')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-3">
                    <input type="checkbox" checked={providers.moonshot.codingPlanEnabled ?? false} onChange={(e) => handleProviderConfigChange('moonshot', 'codingPlanEnabled', e.target.checked ? 'true' : 'false')} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                  </label>
                </div>
              )}
              {!['zhipu', 'qwen', 'volcengine', 'moonshot'].includes(activeProvider) && (
                <div className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-secondary">
                  {i18nService.t('providerSettings')}
                </div>
              )}
            </div>,
          )}

          {renderProviderPanelSection(
            'connection',
            i18nService.t('providerPanel_connection'),
            <div className="flex items-center space-x-3">
              {!(activeProvider === 'minimax' && providers.minimax.authType === 'oauth') && (
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || (providerRequiresApiKey(activeProvider) && !activeProviderConfig.apiKey)}
                  className="inline-flex items-center rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-raised disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SignalIcon className="mr-1.5 h-3.5 w-3.5" />
                  {isTesting ? i18nService.t('testing') : i18nService.t('testConnection')}
                </button>
              )}
            </div>,
          )}

          {renderProviderPanelSection(
            'models',
            i18nService.t('providerPanel_models'),
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-secondary">
                  {(activeProviderConfig.models ?? []).length} {i18nService.t('providerModelCountUnit')}
                </div>
                <button
                  type="button"
                  onClick={handleAddModel}
                  className="inline-flex items-center text-xs text-primary hover:text-primary-hover"
                >
                  <PlusCircleIcon className="mr-1 h-3.5 w-3.5" />
                  {i18nService.t('addModel')}
                </button>
              </div>
              <div className="space-y-1.5">
                {(activeProviderConfig.models ?? []).map(model => (
                  <div key={model.id} className="rounded-xl border border-border bg-background p-2 transition-colors hover:border-primary group">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-400"></div>
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-medium text-foreground">{model.name}</div>
                          <div className="truncate text-[10px] text-secondary">{model.id}</div>
                        </div>
                      </div>
                      <div className="flex items-center shrink-0 space-x-1">
                        {model.supportsImage && (
                          <span className="rounded-md bg-primary-muted px-1.5 py-0.5 text-[10px] text-primary">
                            {i18nService.t('imageInput')}
                          </span>
                        )}
                        <button type="button" onClick={() => handleEditModel(model.id, model.name, model.supportsImage)} className="p-0.5 text-secondary hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteModel(model.id)} className="p-0.5 text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {(!activeProviderConfig.models || activeProviderConfig.models.length === 0) && (
                  <div className="rounded-xl border border-border-subtle bg-background p-2.5 text-center">
                    <p className="text-[11px] text-secondary">{i18nService.t('noModelsAvailable')}</p>
                    <button type="button" onClick={handleAddModel} className="mt-1.5 inline-flex items-center text-[11px] font-medium text-primary hover:text-primary-hover">
                      <PlusCircleIcon className="mr-1 h-3 w-3" />
                      {i18nService.t('addFirstModel')}
                    </button>
                  </div>
                )}
              </div>
            </div>,
          )}

          {renderProviderPanelSection(
            'advanced',
            i18nService.t('providerPanel_advanced'),
            <div className="space-y-4">
              {isCustomProvider(activeProvider) && (
                <>
                  <div>
                    <label htmlFor={`${activeProvider}-displayName`} className="mb-1 block text-xs font-medium text-foreground">
                      {i18nService.t('customDisplayName')}
                    </label>
                    <input
                      type="text"
                      id={`${activeProvider}-displayName`}
                      value={(activeProviderConfig as ProviderConfig)?.displayName ?? ''}
                      onChange={(e) => handleProviderConfigChange(activeProvider, 'displayName', e.target.value)}
                      className="block w-full rounded-xl bg-surface-inset border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 text-xs"
                      placeholder={i18nService.t('customDisplayNamePlaceholder')}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomProvider(activeProvider)}
                    className="inline-flex items-center rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10"
                  >
                    {i18nService.t('deleteCustomProvider')}
                  </button>
                </>
              )}
              {!isCustomProvider(activeProvider) && (
                <div className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-secondary">
                  {i18nService.t('providerSettings')}
                </div>
              )}
            </div>,
          )}
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch(activeTab) {
      case 'general':
        return renderGeneralSettingsPanel();

      case 'email':
        return <EmailSkillConfig />;

      case 'coworkAgentEngine':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border px-3 py-2 text-sm border-border">
                <input
                  type="radio"
                  checked={true}
                  readOnly
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium text-foreground">
                    {i18nService.t('coworkAgentEngineOpenClaw')}
                  </span>
                  <span className="block text-xs text-secondary">
                    {i18nService.t('coworkAgentEngineOpenClawHint')}
                  </span>
                </span>
              </div>
            </div>
            {isOpenClawAgentEngine && (
              <div className="space-y-3 rounded-xl border px-4 py-4 border-border">
                <div className="text-xs text-secondary">
                  {i18nService.t('coworkOpenClawInstallHint')}
                </div>
                <div className={`rounded-xl border px-4 py-3 text-sm ${openClawEngineStatus?.phase === 'error'
                  ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
                  : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      {resolveOpenClawStatusText(openClawEngineStatus)}
                      {openClawProgressPercent !== null && (
                        <span className="ml-2 text-xs opacity-80">{openClawProgressPercent}%</span>
                      )}
                    </div>
                  </div>
                  {openClawProgressPercent !== null && (
                    <div className="mt-2 h-2 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${openClawProgressPercent}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );

      case 'coworkMemory':
        return (
          <div className="space-y-6">
            {/* Section 1: Long-term Memory (MEMORY.md) */}
            <div className="space-y-3 rounded-xl border px-4 py-4 border-border">
              <div className="text-sm font-medium text-foreground">
                {i18nService.t('coworkMemoryTitle')}
              </div>
              {/* Memory toggle hidden – always enabled by default */}
              <div className="mt-2 text-xs text-secondary">
                <span className="font-medium">{i18nService.t('coworkMemoryFilePath')}:</span>{' '}
                <span className="break-all font-mono opacity-80">
                  {joinWorkspacePath(coworkConfig.workingDirectory, 'MEMORY.md')}
                </span>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border px-4 py-4 border-border">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">
                    {i18nService.t('coworkMemoryCrudTitle')}
                  </div>
                  <div className="text-xs text-secondary">
                    {i18nService.t('coworkMemoryManageHint')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleOpenCoworkMemoryModal}
                  className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm transition-colors active:scale-[0.98]"
                >
                  <PlusCircleIcon className="h-4 w-4 mr-1.5" />
                  {i18nService.t('coworkMemoryCrudCreate')}
                </button>
              </div>

              {coworkMemoryStats && (
                <div className="text-xs text-secondary">
                  {`${i18nService.t('coworkMemoryTotalLabel')}: ${coworkMemoryStats.total}`}
                </div>
              )}

              <input
                type="text"
                value={coworkMemoryQuery}
                onChange={(event) => setCoworkMemoryQuery(event.target.value)}
                placeholder={i18nService.t('coworkMemorySearchPlaceholder')}
                className="w-full rounded-lg border px-3 py-2 text-sm border-border bg-surface"
              />

              <div className="rounded-lg border border-border">
                {coworkMemoryListLoading ? (
                  <div className="px-3 py-3 text-xs text-secondary">
                    {i18nService.t('loading')}
                  </div>
                ) : coworkMemoryEntries.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-secondary">
                    {i18nService.t('coworkMemoryEmpty')}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {coworkMemoryEntries.map((entry) => (
                      <div key={entry.id} className="px-3 py-3 text-xs hover:bg-surface-raised transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground break-words">
                              {entry.text}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditCoworkMemoryEntry(entry)}
                              className="rounded border px-2 py-1 border-border text-foreground hover:bg-surface-raised transition-colors"
                            >
                              {i18nService.t('edit')}
                            </button>
                            <button
                              type="button"
                              onClick={() => { void handleDeleteCoworkMemoryEntry(entry); }}
                              className="rounded border px-2 py-1 text-red-500 border-border hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 transition-colors"
                              disabled={coworkMemoryListLoading}
                            >
                              {i18nService.t('delete')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        );

      case 'model':
        return renderModelSettingsPanel();

      case 'coworkAgent':
        return (
          <div className="space-y-6">
            {/* Agent Settings (IDENTITY.md + SOUL.md) */}
            <div className="space-y-4 rounded-xl border px-4 py-4 border-border">
              <div className="text-sm font-medium text-foreground">
                {i18nService.t('coworkBootstrapAgentSectionTitle')}
              </div>
              {[
                { filename: 'IDENTITY.md', titleKey: 'coworkBootstrapIdentityTitle', hintKey: 'coworkBootstrapIdentityHint', value: bootstrapIdentity, setter: setBootstrapIdentity },
                { filename: 'SOUL.md', titleKey: 'coworkBootstrapSoulTitle', hintKey: 'coworkBootstrapSoulHint', value: bootstrapSoul, setter: setBootstrapSoul },
              ].map(({ filename, titleKey, hintKey, value, setter }) => (
                <div key={filename} className="space-y-2">
                  <div className="text-xs font-medium text-secondary">
                    {i18nService.t(titleKey)}
                    <span className="ml-1.5 font-normal opacity-60">
                      （{i18nService.t('coworkBootstrapStoragePath')}：<span className="font-mono">{joinWorkspacePath(coworkConfig.workingDirectory, filename)}</span>）
                    </span>
                  </div>
                  <textarea
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 text-sm border-border bg-surface text-foreground resize-y"
                    placeholder={i18nService.t(hintKey)}
                  />
                </div>
              ))}
            </div>

            {/* User Profile (USER.md) */}
            <div className="space-y-3 rounded-xl border px-4 py-4 border-border">
              <div className="text-sm font-medium text-foreground">
                {i18nService.t('coworkBootstrapUserTitle')}
                <span className="ml-1.5 text-xs font-normal opacity-60 text-secondary">
                  （{i18nService.t('coworkBootstrapStoragePath')}：<span className="font-mono">{joinWorkspacePath(coworkConfig.workingDirectory, 'USER.md')}</span>）
                </span>
              </div>
              <textarea
                value={bootstrapUser}
                onChange={(e) => setBootstrapUser(e.target.value)}
                rows={3}
                className="w-full rounded-lg border px-3 py-2 text-sm border-border bg-surface text-foreground resize-y"
                placeholder={i18nService.t('coworkBootstrapUserHint')}
              />
            </div>
          </div>
        );

      case 'shortcuts':
        return (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                {i18nService.t('keyboardShortcuts')}
              </label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{i18nService.t('newChat')}</span>
                  <ShortcutRecorder value={shortcuts.newChat} onChange={(v) => handleShortcutChange('newChat', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{i18nService.t('search')}</span>
                  <ShortcutRecorder value={shortcuts.search} onChange={(v) => handleShortcutChange('search', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{i18nService.t('openSettings')}</span>
                  <ShortcutRecorder value={shortcuts.settings} onChange={(v) => handleShortcutChange('settings', v)} />
                </div>
              </div>
            </div>
          </div>
        );

      case 'im':
        return <IMSettings />;

      case 'about':
        return (
          <div className="flex min-h-full flex-col pt-4 pb-3">
            <div className="rounded-2xl border border-border bg-surface px-5 py-5 shadow-sm">
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => {
                    const next = logoClickCount + 1;
                    setLogoClickCount(next);
                    if (next >= 10 && !testModeUnlocked) {
                      setTestModeUnlocked(true);
                    }
                  }}
                  className="shrink-0 rounded-2xl border border-border bg-surface-raised p-3 transition-colors hover:border-primary/30"
                >
                  <img
                    src="logo.png"
                    alt={APP_NAME}
                    className="h-12 w-12 cursor-pointer select-none"
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-secondary">
                    {renderBrandHighlight(i18nService.t('aboutBrandEyebrow'))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold tracking-tight text-foreground">{APP_NAME}</h3>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                      {i18nService.t('aboutProductBadge')}
                    </span>
                    <span className="rounded-full bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-secondary">
                      {i18nService.t('aboutPlatformBadge')}
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
                    {renderBrandHighlight(i18nService.t('aboutBrandDescription'))}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 w-full overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm text-foreground">{i18nService.t('aboutVersion')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-secondary">{appVersion}</span>
                  {!enterpriseConfig?.disableUpdate && (
                    <button
                      type="button"
                      disabled={updateCheckStatus === 'checking'}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleCheckUpdate();
                      }}
                      className="text-xs px-2 py-0.5 rounded-md border border-border text-secondary hover:text-primary dark:hover:text-primary hover:border-primary dark:hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {updateCheckStatus === 'checking' && i18nService.t('updateChecking')}
                      {updateCheckStatus === 'upToDate' && i18nService.t('updateUpToDate')}
                      {updateCheckStatus === 'error' && i18nService.t('updateCheckFailed')}
                      {updateCheckStatus === 'idle' && i18nService.t('checkForUpdate')}
                    </button>
                  )}
                  {enterpriseConfig?.disableUpdate && (
                    <span className="text-xs text-claude-textSecondary dark:text-claude-darkTextSecondary">
                      {i18nService.t('settings.enterprise.managed')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm text-foreground">{i18nService.t('aboutProductType')}</span>
                <span className="text-sm text-secondary">
                  {renderBrandHighlight(i18nService.t('aboutProductTypeValue'))}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm text-foreground">{i18nService.t('aboutPlatform')}</span>
                <span className="text-sm text-secondary">{i18nService.t('aboutPlatformValue')}</span>
              </div>
              <div className={`flex items-center justify-between px-4 py-3${testModeUnlocked ? ' border-b border-border' : ''}`}>
                <span className="text-sm text-foreground">{i18nService.t('aboutDataScope')}</span>
                <span className="text-right text-sm text-secondary">
                  {renderBrandHighlight(i18nService.t('aboutDataScopeValue'))}
                </span>
              </div>
              {testModeUnlocked && (
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-foreground">{i18nService.t('testMode')}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={testMode}
                    onClick={() => setTestMode((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                      testMode ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        testMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>

            <div className="mt-auto w-full pt-8 pb-2">
              <div className="flex items-center justify-center text-sm text-secondary">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleExportLogs();
                  }}
                  disabled={isExportingLogs}
                  className="bg-transparent border-none appearance-none px-1.5 py-0.5 -mx-1.5 -my-0.5 rounded-md cursor-pointer hover:text-primary dark:hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExportingLogs ? i18nService.t('aboutExportingLogs') : i18nService.t('aboutExportLogs')}
                </button>
              </div>

              <p className="mt-1 text-center text-xs text-secondary">
                {i18nService.t('aboutCopyright').replace('{year}', String(new Date().getFullYear()))}
              </p>
              <p className="mt-1 text-center text-xs text-secondary">
                {i18nService.t('aboutRightsReserved')}
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 modal-backdrop flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex h-[min(90vh,960px)] w-[min(1120px,96vw)] flex-col overflow-hidden rounded-2xl border border-border shadow-modal modal-content md:h-[min(88vh,920px)] md:flex-row"
        onClick={handleSettingsClick}
      >
        {/* Left sidebar */}
        <div className="flex max-h-[34vh] w-full shrink-0 flex-col overflow-hidden border-b border-border bg-surface-raised md:max-h-none md:w-[220px] md:border-b-0 md:border-r md:rounded-l-2xl">
          <div className="px-4 pt-4 pb-3 md:px-5 md:pt-5">
            <h2 className="text-lg font-semibold text-foreground">{i18nService.t('settings')}</h2>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:gap-0.5 md:overflow-visible md:pb-4">
            {sidebarTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors md:w-full ${
                  activeTab === tab.key
                    ? 'bg-primary-muted text-primary'
                    : 'text-secondary hover:text-foreground hover:bg-surface-raised'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right content */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-2xl bg-background md:min-w-0 md:rounded-b-none md:rounded-r-2xl">
          {/* Content header */}
          <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
            <h3 className="text-lg font-semibold text-foreground">{activeTabLabel}</h3>
            <button
              onClick={onClose}
              className="text-secondary hover:text-foreground p-1.5 hover:bg-surface-raised rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {noticeMessage && (
            <div className="px-4 sm:px-6">
              <ErrorMessage
                message={noticeMessage}
                onClose={() => setNoticeMessage(null)}
              />
            </div>
          )}

          {error && (
            <div className="px-4 sm:px-6">
              <ErrorMessage
                message={error}
                onClose={() => setError(null)}
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            {/* Tab content */}
            <div
              ref={contentRef}
              className="flex-1 overflow-y-auto px-4 py-4 sm:px-6"
              style={{ scrollbarGutter: 'stable' }}
            >
              {renderTabContent()}
            </div>

            {/* Footer buttons */}
            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-border bg-background p-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised active:scale-[0.98] sm:w-auto"
              >
                {i18nService.t('cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] sm:w-auto"
              >
                {isSaving ? i18nService.t('saving') : i18nService.t('save')}
              </button>
            </div>
          </form>

        </div>

        {isTestResultModalOpen && testResult && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/35 px-4 rounded-2xl"
            onClick={() => setIsTestResultModalOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={i18nService.t('connectionTestResult')}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-background border-border border shadow-modal p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-foreground">
                  {i18nService.t('connectionTestResult')}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsTestResultModalOpen(false)}
                  className="p-1 text-secondary hover:text-foreground rounded-md hover:bg-surface-raised"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-secondary">
                <span>{providerMeta[testResult.provider]?.label ?? testResult.provider}</span>
                <span className="text-[11px]">•</span>
                <span className={`inline-flex items-center gap-1 ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {testResult.success ? (
                    <CheckCircleIcon className="h-4 w-4" />
                  ) : (
                    <XCircleIcon className="h-4 w-4" />
                  )}
                  {testResult.success ? i18nService.t('connectionSuccess') : i18nService.t('connectionFailed')}
                </span>
              </div>

              <p className="mt-3 text-xs leading-5 text-foreground whitespace-pre-wrap break-words max-h-56 overflow-y-auto">
                {testResult.message}
              </p>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsTestResultModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-xl border border-border text-foreground hover:bg-surface-raised transition-colors active:scale-[0.98]"
                >
                  {i18nService.t('close')}
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingDeleteProvider && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-4 rounded-2xl"
            onClick={() => setPendingDeleteProvider(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl dark:bg-claude-darkSurface bg-claude-bg dark:border-claude-darkBorder border-claude-border border shadow-modal p-4"
            >
              <p className="text-sm dark:text-claude-darkText text-claude-text">
                {i18nService.t('confirmDeleteCustomProvider')}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingDeleteProvider(null)}
                  className="px-3 py-1.5 text-xs font-medium rounded-xl border dark:border-claude-darkBorder border-claude-border dark:text-claude-darkText text-claude-text dark:hover:bg-claude-darkSurfaceHover hover:bg-claude-surfaceHover transition-colors active:scale-[0.98]"
                >
                  {i18nService.t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteCustomProvider}
                  className="px-3 py-1.5 text-xs font-medium rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors active:scale-[0.98]"
                >
                  {i18nService.t('deleteCustomProvider')}
                </button>
              </div>
            </div>
          </div>
        )}

        {(isAddingModel || isEditingModel) && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-4 rounded-2xl"
            onClick={handleCancelModelEdit}
          >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={isEditingModel ? i18nService.t('editModel') : i18nService.t('addNewModel')}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleModelDialogKeyDown}
                className="w-full max-w-md rounded-2xl bg-background border-border border shadow-modal p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-foreground">
                    {isEditingModel ? i18nService.t('editModel') : i18nService.t('addNewModel')}
                  </h4>
                  <button
                    type="button"
                    onClick={handleCancelModelEdit}
                    className="p-1 text-secondary hover:text-foreground rounded-md hover:bg-surface-raised"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>

                {modelFormError && (
                  <p className="mb-3 text-xs text-red-600 dark:text-red-400">
                    {modelFormError}
                  </p>
                )}

                <div className="space-y-3">
                  {activeProvider === 'ollama' ? (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-secondary mb-1">
                          {i18nService.t('ollamaModelName')}
                        </label>
                        <input
                          autoFocus
                          type="text"
                          value={newModelId}
                          onChange={(e) => {
                            setNewModelId(e.target.value);
                            if (!newModelName || newModelName === newModelId) {
                              setNewModelName(e.target.value);
                            }
                            if (modelFormError) {
                              setModelFormError(null);
                            }
                          }}
                          className="block w-full rounded-xl bg-surface-inset border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 text-xs"
                          placeholder={i18nService.t('ollamaModelNamePlaceholder')}
                        />
                        <p className="mt-1 text-[11px] text-muted">
                          {i18nService.t('ollamaModelNameHint')}
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-secondary mb-1">
                          {i18nService.t('ollamaDisplayName')}
                        </label>
                        <input
                          type="text"
                          value={newModelName === newModelId ? '' : newModelName}
                          onChange={(e) => {
                            setNewModelName(e.target.value || newModelId);
                            if (modelFormError) {
                              setModelFormError(null);
                            }
                          }}
                          className="block w-full rounded-xl bg-surface-inset border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 text-xs"
                          placeholder={i18nService.t('ollamaDisplayNamePlaceholder')}
                        />
                        <p className="mt-1 text-[11px] text-muted">
                          {i18nService.t('ollamaDisplayNameHint')}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-secondary mb-1">
                          {i18nService.t('modelName')}
                        </label>
                        <input
                          autoFocus
                          type="text"
                          value={newModelName}
                          onChange={(e) => {
                            setNewModelName(e.target.value);
                            if (modelFormError) {
                              setModelFormError(null);
                            }
                          }}
                          className="block w-full rounded-xl bg-surface-inset border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 text-xs"
                          placeholder="GPT-4"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-secondary mb-1">
                          {i18nService.t('modelId')}
                        </label>
                        <input
                          type="text"
                          value={newModelId}
                          onChange={(e) => {
                            setNewModelId(e.target.value);
                            if (modelFormError) {
                              setModelFormError(null);
                            }
                          }}
                          className="block w-full rounded-xl bg-surface-inset border-border border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground px-3 py-2 text-xs"
                          placeholder="gpt-4"
                        />
                      </div>
                    </>
                  )}
                  <div className="flex items-center space-x-2">
                    <input
                      id={`${activeProvider}-supportsImage`}
                      type="checkbox"
                      checked={newModelSupportsImage}
                      onChange={(e) => setNewModelSupportsImage(e.target.checked)}
                      className="h-3.5 w-3.5 text-primary focus:ring-primary bg-surface border-border rounded"
                    />
                    <label
                      htmlFor={`${activeProvider}-supportsImage`}
                      className="text-xs text-secondary"
                    >
                      {i18nService.t('supportsImageInput')}
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    type="button"
                    onClick={handleCancelModelEdit}
                    className="px-3 py-1.5 text-xs text-foreground hover:bg-surface-raised rounded-xl border border-border"
                  >
                    {i18nService.t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNewModel}
                    className="px-3 py-1.5 text-xs text-white bg-primary hover:bg-primary-hover rounded-xl active:scale-[0.98]"
                  >
                    {i18nService.t('save')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Memory Modal */}
          {showMemoryModal && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 px-4 rounded-2xl"
              onClick={resetCoworkMemoryEditor}
            >
              <div
                className="bg-surface border-border border rounded-2xl shadow-xl w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-5 pt-5 pb-4 border-b border-border">
                  <h3 className="text-base font-semibold text-foreground">
                    {coworkMemoryEditingId ? i18nService.t('coworkMemoryCrudUpdate') : i18nService.t('coworkMemoryCrudCreate')}
                  </h3>
                </div>

                <div className="px-5 py-4 space-y-4">
                  {coworkMemoryEditingId && (
                    <div className="rounded-lg border px-2 py-1 text-xs border-border text-secondary">
                      {i18nService.t('coworkMemoryEditingTag')}
                    </div>
                  )}
                  <textarea
                    value={coworkMemoryDraftText}
                    onChange={(event) => setCoworkMemoryDraftText(event.target.value)}
                    placeholder={i18nService.t('coworkMemoryCrudTextPlaceholder')}
                    autoFocus
                    className="min-h-[200px] w-full rounded-lg border px-3 py-2 text-sm border-border bg-surface text-foreground focus:border-primary focus:ring-1 focus:ring-primary/30"
                  />
                </div>

                <div className="flex justify-end space-x-2 px-5 pb-5">
                  <button
                    type="button"
                    onClick={resetCoworkMemoryEditor}
                    className="px-3 py-1.5 text-sm text-foreground hover:bg-surface-raised rounded-xl border border-border transition-colors"
                  >
                    {i18nService.t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { void handleSaveCoworkMemoryEntry(); }}
                    disabled={!coworkMemoryDraftText.trim() || coworkMemoryListLoading}
                    className="px-3 py-1.5 text-sm text-white bg-primary hover:bg-primary-hover rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
                  >
                    {coworkMemoryEditingId ? i18nService.t('save') : i18nService.t('coworkMemoryCrudCreate')}
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default Settings; 
