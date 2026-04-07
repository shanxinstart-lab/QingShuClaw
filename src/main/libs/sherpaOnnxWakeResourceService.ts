import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import {
  DEFAULT_SHERPA_ONNX_WAKE_MODEL_ID,
  SherpaOnnxWakeModelId,
  normalizeSherpaOnnxWakeModelId,
  type SherpaOnnxWakeModelId as SherpaOnnxWakeModelIdValue,
} from '../../shared/voice/constants';

const SHERPA_KWS_RESOURCE_DIR = 'sherpa-kws';
const SHERPA_KWS_CONFIG_FILE_NAME = 'sherpa-kws-config.json';
const SHERPA_KWS_MANIFEST_FILE_NAME = 'sherpa-kws-manifest.json';
const LEGACY_WAKE_MODEL_ID = SherpaOnnxWakeModelId.ZipformerWenetSpeech33M20240101;

const DEFAULT_SAMPLE_RATE = 16_000;
const DEFAULT_FEATURE_DIM = 80;
const DEFAULT_MAX_ACTIVE_PATHS = 4;
const DEFAULT_NUM_TRAILING_BLANKS = 1;
const DEFAULT_KEYWORDS_SCORE = 1.0;
const DEFAULT_KEYWORDS_THRESHOLD = 0.25;
const DEFAULT_RECORDER_FRAME_LENGTH = 512;

type SherpaWakeResourceConfig = {
  schemaVersion?: number;
  sampleRate?: number;
  featureDim?: number;
  maxActivePaths?: number;
  numTrailingBlanks?: number;
  keywordsScore?: number;
  keywordsThreshold?: number;
  recorderFrameLength?: number;
  model?: {
    encoderFileName?: string;
    decoderFileName?: string;
    joinerFileName?: string;
    tokensFileName?: string;
    provider?: string;
    numThreads?: number;
    debug?: boolean;
  };
  defaultWakeWords?: string[];
};

type SherpaWakeManifestModel = {
  id?: SherpaOnnxWakeModelIdValue;
  label?: string;
  directory?: string;
  configFileName?: string;
};

type SherpaWakeManifest = {
  schemaVersion?: number;
  defaultModelId?: SherpaOnnxWakeModelIdValue;
  models?: SherpaWakeManifestModel[];
};

export type SherpaOnnxWakeRuntimeInspection = {
  resourceRoot: string;
  modelRoot: string;
  modelId: SherpaOnnxWakeModelIdValue;
  modelLabel: string;
  legacy: boolean;
  sampleRate: number;
  featureDim: number;
  maxActivePaths: number;
  numTrailingBlanks: number;
  keywordsScore: number;
  keywordsThreshold: number;
  recorderFrameLength: number;
  provider: string;
  numThreads: number;
  debug: boolean;
  defaultWakeWords: string[];
  resolvedConfigPath: string | null;
  resolvedEncoderPath: string | null;
  resolvedDecoderPath: string | null;
  resolvedJoinerPath: string | null;
  resolvedTokensPath: string | null;
  ready: boolean;
  error?: string;
};

const resolveProjectRoot = (): string => {
  const appPath = app.getAppPath();
  return appPath.endsWith('dist-electron')
    ? path.join(appPath, '..')
    : appPath;
};

const resolveResourceRoots = (): string[] => {
  if (app.isPackaged) {
    return [path.join(process.resourcesPath, SHERPA_KWS_RESOURCE_DIR)];
  }

  return [
    path.join(resolveProjectRoot(), 'build', 'generated', SHERPA_KWS_RESOURCE_DIR),
    path.join(resolveProjectRoot(), 'resources', SHERPA_KWS_RESOURCE_DIR),
  ];
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

const resolveOptionalFile = (root: string, fileName?: string): string | null => {
  const normalized = typeof fileName === 'string' ? fileName.trim() : '';
  if (!normalized) {
    return null;
  }

  const candidate = path.join(root, normalized);
  return fs.existsSync(candidate) ? candidate : null;
};

const buildInspection = (options: {
  resourceRoot: string;
  modelRoot: string;
  modelId: SherpaOnnxWakeModelIdValue;
  modelLabel: string;
  legacy: boolean;
  config: SherpaWakeResourceConfig | null;
  configPath: string | null;
}): SherpaOnnxWakeRuntimeInspection => {
  const config = options.config;
  const encoderPath = resolveOptionalFile(options.modelRoot, config?.model?.encoderFileName);
  const decoderPath = resolveOptionalFile(options.modelRoot, config?.model?.decoderFileName);
  const joinerPath = resolveOptionalFile(options.modelRoot, config?.model?.joinerFileName);
  const tokensPath = resolveOptionalFile(options.modelRoot, config?.model?.tokensFileName);
  const ready = Boolean(config && encoderPath && decoderPath && joinerPath && tokensPath);

  return {
    resourceRoot: options.resourceRoot,
    modelRoot: options.modelRoot,
    modelId: options.modelId,
    modelLabel: options.modelLabel,
    legacy: options.legacy,
    sampleRate: config?.sampleRate ?? DEFAULT_SAMPLE_RATE,
    featureDim: config?.featureDim ?? DEFAULT_FEATURE_DIM,
    maxActivePaths: config?.maxActivePaths ?? DEFAULT_MAX_ACTIVE_PATHS,
    numTrailingBlanks: config?.numTrailingBlanks ?? DEFAULT_NUM_TRAILING_BLANKS,
    keywordsScore: config?.keywordsScore ?? DEFAULT_KEYWORDS_SCORE,
    keywordsThreshold: config?.keywordsThreshold ?? DEFAULT_KEYWORDS_THRESHOLD,
    recorderFrameLength: config?.recorderFrameLength ?? DEFAULT_RECORDER_FRAME_LENGTH,
    provider: config?.model?.provider?.trim() || 'cpu',
    numThreads: config?.model?.numThreads ?? 1,
    debug: config?.model?.debug === true,
    defaultWakeWords: Array.isArray(config?.defaultWakeWords)
      ? config!.defaultWakeWords.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [],
    resolvedConfigPath: options.configPath,
    resolvedEncoderPath: encoderPath,
    resolvedDecoderPath: decoderPath,
    resolvedJoinerPath: joinerPath,
    resolvedTokensPath: tokensPath,
    ready,
    ...(ready ? {} : {
      error: config ? 'sherpa_kws_model_missing' : 'sherpa_kws_config_missing',
    }),
  };
};

const inspectLegacyWakeRuntime = (
  resourceRoot: string,
  requestedModelId: SherpaOnnxWakeModelIdValue,
): SherpaOnnxWakeRuntimeInspection | null => {
  const configPath = path.join(resourceRoot, SHERPA_KWS_CONFIG_FILE_NAME);
  const config = readJsonFile<SherpaWakeResourceConfig>(configPath);
  if (!config) {
    return null;
  }

  const inspection = buildInspection({
    resourceRoot,
    modelRoot: resourceRoot,
    modelId: LEGACY_WAKE_MODEL_ID,
    modelLabel: 'WenetSpeech 3.3M',
    legacy: true,
    config,
    configPath,
  });

  if (requestedModelId !== LEGACY_WAKE_MODEL_ID) {
    return {
      ...inspection,
      modelId: requestedModelId,
      ready: false,
      error: 'sherpa_kws_selected_model_missing',
    };
  }

  return inspection;
};

const inspectManifestWakeRuntime = (
  resourceRoot: string,
  requestedModelId: SherpaOnnxWakeModelIdValue,
): SherpaOnnxWakeRuntimeInspection | null => {
  const manifestPath = path.join(resourceRoot, SHERPA_KWS_MANIFEST_FILE_NAME);
  const manifest = readJsonFile<SherpaWakeManifest>(manifestPath);
  if (!manifest || !Array.isArray(manifest.models) || manifest.models.length === 0) {
    return null;
  }

  const defaultModelId = normalizeSherpaOnnxWakeModelId(manifest.defaultModelId ?? DEFAULT_SHERPA_ONNX_WAKE_MODEL_ID);
  const selectedModel = manifest.models.find((item) => item.id === requestedModelId);
  const defaultModel = manifest.models.find((item) => item.id === defaultModelId);
  const manifestModel = selectedModel ?? defaultModel;
  if (!manifestModel || !manifestModel.id || !manifestModel.directory) {
    return {
      resourceRoot,
      modelRoot: '',
      modelId: requestedModelId,
      modelLabel: '',
      legacy: false,
      sampleRate: DEFAULT_SAMPLE_RATE,
      featureDim: DEFAULT_FEATURE_DIM,
      maxActivePaths: DEFAULT_MAX_ACTIVE_PATHS,
      numTrailingBlanks: DEFAULT_NUM_TRAILING_BLANKS,
      keywordsScore: DEFAULT_KEYWORDS_SCORE,
      keywordsThreshold: DEFAULT_KEYWORDS_THRESHOLD,
      recorderFrameLength: DEFAULT_RECORDER_FRAME_LENGTH,
      provider: 'cpu',
      numThreads: 1,
      debug: false,
      defaultWakeWords: [],
      resolvedConfigPath: null,
      resolvedEncoderPath: null,
      resolvedDecoderPath: null,
      resolvedJoinerPath: null,
      resolvedTokensPath: null,
      ready: false,
      error: 'sherpa_kws_selected_model_missing',
    };
  }

  const modelRoot = path.join(resourceRoot, manifestModel.directory);
  const configPath = path.join(modelRoot, manifestModel.configFileName?.trim() || SHERPA_KWS_CONFIG_FILE_NAME);
  const config = readJsonFile<SherpaWakeResourceConfig>(configPath);
  const inspection = buildInspection({
    resourceRoot,
    modelRoot,
    modelId: manifestModel.id,
    modelLabel: manifestModel.label?.trim() || manifestModel.id,
    legacy: false,
    config,
    configPath: fs.existsSync(configPath) ? configPath : null,
  });

  if (!selectedModel) {
    return {
      ...inspection,
      modelId: requestedModelId,
      ready: false,
      error: 'sherpa_kws_selected_model_missing',
    };
  }

  return inspection;
};

export const inspectSherpaOnnxWakeRuntime = (
  modelId?: SherpaOnnxWakeModelIdValue,
): SherpaOnnxWakeRuntimeInspection => {
  const requestedModelId = normalizeSherpaOnnxWakeModelId(modelId ?? DEFAULT_SHERPA_ONNX_WAKE_MODEL_ID);

  for (const resourceRoot of resolveResourceRoots()) {
    const manifestInspection = inspectManifestWakeRuntime(resourceRoot, requestedModelId);
    if (manifestInspection) {
      return manifestInspection;
    }

    const legacyInspection = inspectLegacyWakeRuntime(resourceRoot, requestedModelId);
    if (legacyInspection) {
      return legacyInspection;
    }
  }

  return {
    resourceRoot: '',
    modelRoot: '',
    modelId: requestedModelId,
    modelLabel: '',
    legacy: false,
    sampleRate: DEFAULT_SAMPLE_RATE,
    featureDim: DEFAULT_FEATURE_DIM,
    maxActivePaths: DEFAULT_MAX_ACTIVE_PATHS,
    numTrailingBlanks: DEFAULT_NUM_TRAILING_BLANKS,
    keywordsScore: DEFAULT_KEYWORDS_SCORE,
    keywordsThreshold: DEFAULT_KEYWORDS_THRESHOLD,
    recorderFrameLength: DEFAULT_RECORDER_FRAME_LENGTH,
    provider: 'cpu',
    numThreads: 1,
    debug: false,
    defaultWakeWords: [],
    resolvedConfigPath: null,
    resolvedEncoderPath: null,
    resolvedDecoderPath: null,
    resolvedJoinerPath: null,
    resolvedTokensPath: null,
    ready: false,
    error: 'sherpa_kws_config_missing',
  };
};
