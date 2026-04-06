import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import {
  DEFAULT_SHERPA_ONNX_ASR_MODEL_ID,
  DEFAULT_SHERPA_ONNX_SAMPLE_RATE,
  SherpaOnnxAsrModelVariant,
  type SherpaOnnxAsrModelVariant as SherpaOnnxAsrModelVariantValue,
  VoiceProvider,
  type VoiceLocalSherpaOnnxStatus,
  type VoiceSherpaOnnxProviderConfig,
} from '../../shared/voice/constants';
import { resolveInstalledLocalModelPath, resolveLocalVoiceModelCatalogEntry } from './localVoiceModelManager';

const SHERPA_ASR_RESOURCE_DIR = 'sherpa-asr';
const SHERPA_ASR_CONFIG_FILE_NAME = 'sherpa-asr-config.json';
const DEFAULT_FEATURE_DIM = 80;

type SherpaAsrResourceConfig = {
  schemaVersion?: number;
  modelId?: string;
  sampleRate?: number;
  featureDim?: number;
  modelFileName?: string;
  tokensFileName?: string;
  bpeVocabFileName?: string;
  provider?: string;
  numThreads?: number;
};

export type SherpaOnnxAsrRuntimeInspection = {
  resourceRoot: string;
  modelId: string;
  variant: SherpaOnnxAsrModelVariantValue;
  sampleRate: number;
  featureDim: number;
  provider: string;
  threads: number;
  resolvedModelPath: string | null;
  resolvedTokensPath: string | null;
  resolvedBpeVocabPath: string | null;
  modelExists: boolean;
  tokensExists: boolean;
  bpeVocabExists: boolean;
  ready: boolean;
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

const resolveResourceRoots = (resourceDir: string): string[] => {
  if (app.isPackaged) {
    return [path.join(process.resourcesPath, resourceDir)];
  }

  return [
    path.join(resolveProjectRoot(), 'build', 'generated', resourceDir),
    path.join(resolveProjectRoot(), 'resources', resourceDir),
  ];
};

const resolveBundledRoot = (resourceDir: string, configFileName: string): { root: string; configPath: string } | null => {
  for (const root of resolveResourceRoots(resourceDir)) {
    const configPath = path.join(root, configFileName);
    if (fs.existsSync(configPath)) {
      return { root, configPath };
    }
  }
  return null;
};

const resolveOptionalFile = (root: string, fileName?: string): string | null => {
  const normalized = typeof fileName === 'string' ? fileName.trim() : '';
  if (!normalized) {
    return null;
  }
  const candidate = path.join(root, normalized);
  return fs.existsSync(candidate) ? candidate : null;
};

const resolveFileFromConfigOrSibling = (
  explicitPath: string,
  resourceRoot: string,
  configFileName: string | undefined,
  siblingFileName: string,
): string | null => {
  const normalizedExplicitPath = explicitPath.trim();
  if (normalizedExplicitPath) {
    if (fs.existsSync(normalizedExplicitPath)) {
      if (fs.statSync(normalizedExplicitPath).isDirectory()) {
        const nestedCandidate = path.join(normalizedExplicitPath, siblingFileName);
        return fs.existsSync(nestedCandidate) ? nestedCandidate : null;
      }
      return normalizedExplicitPath;
    }
    return null;
  }

  return resolveOptionalFile(resourceRoot, configFileName) ?? resolveOptionalFile(resourceRoot, siblingFileName);
};

export const inspectSherpaOnnxAsrRuntime = (
  config: VoiceSherpaOnnxProviderConfig,
): SherpaOnnxAsrRuntimeInspection => {
  const selectedLocalModelEntry = resolveLocalVoiceModelCatalogEntry(config.asrModelId.trim());
  const localModelRoot = selectedLocalModelEntry?.provider === VoiceProvider.LocalSherpaOnnx
    ? (resolveInstalledLocalModelPath(selectedLocalModelEntry.id) || '')
    : '';
  const bundled = resolveBundledRoot(SHERPA_ASR_RESOURCE_DIR, SHERPA_ASR_CONFIG_FILE_NAME);
  const bundledConfig = bundled ? readJsonFile<SherpaAsrResourceConfig>(bundled.configPath) : null;
  const resourceRoot = localModelRoot || bundled?.root || '';
  const variant = selectedLocalModelEntry?.runtimeVariant === SherpaOnnxAsrModelVariant.OfflineFireRedAsrCtc
    ? SherpaOnnxAsrModelVariant.OfflineFireRedAsrCtc
    : SherpaOnnxAsrModelVariant.StreamingZipformerCtc;
  const resolvedModelPath = resolveFileFromConfigOrSibling(
    config.asrModelPath,
    resourceRoot,
    variant === SherpaOnnxAsrModelVariant.OfflineFireRedAsrCtc ? 'model.int8.onnx' : bundledConfig?.modelFileName,
    'model.int8.onnx',
  );
  const resolvedTokensPath = resolveOptionalFile(resourceRoot, bundledConfig?.tokensFileName) ?? resolveOptionalFile(resourceRoot, 'tokens.txt');
  const resolvedBpeVocabPath = variant === SherpaOnnxAsrModelVariant.StreamingZipformerCtc
    ? (resolveOptionalFile(resourceRoot, bundledConfig?.bpeVocabFileName) ?? resolveOptionalFile(resourceRoot, 'bbpe.model'))
    : null;
  const modelExists = Boolean(resolvedModelPath);
  const tokensExists = Boolean(resolvedTokensPath);
  const bpeVocabExists = Boolean(resolvedBpeVocabPath);

  return {
    resourceRoot,
    modelId: config.asrModelId.trim() || bundledConfig?.modelId || DEFAULT_SHERPA_ONNX_ASR_MODEL_ID,
    variant,
    sampleRate: config.sampleRate || bundledConfig?.sampleRate || DEFAULT_SHERPA_ONNX_SAMPLE_RATE,
    featureDim: bundledConfig?.featureDim || DEFAULT_FEATURE_DIM,
    provider: config.provider.trim() || bundledConfig?.provider || 'cpu',
    threads: config.threads || bundledConfig?.numThreads || 2,
    resolvedModelPath,
    resolvedTokensPath,
    resolvedBpeVocabPath,
    modelExists,
    tokensExists,
    bpeVocabExists,
    ready: variant === SherpaOnnxAsrModelVariant.OfflineFireRedAsrCtc
      ? modelExists && tokensExists
      : modelExists && tokensExists && bpeVocabExists,
  };
};

export const inspectLocalSherpaOnnxStatus = (
  config: VoiceSherpaOnnxProviderConfig,
): VoiceLocalSherpaOnnxStatus => {
  const asrRuntime = inspectSherpaOnnxAsrRuntime(config);
  return {
    resourceRoot: asrRuntime.resourceRoot,
    enabled: config.enabled,
    provider: config.provider.trim() || asrRuntime.provider || 'cpu',
    threads: config.threads || asrRuntime.threads || 2,
    sampleRate: config.sampleRate || asrRuntime.sampleRate || DEFAULT_SHERPA_ONNX_SAMPLE_RATE,
    asrModelId: asrRuntime.modelId,
    asrModelPath: asrRuntime.resolvedModelPath,
    asrTokensPath: asrRuntime.resolvedTokensPath,
    asrBpeVocabPath: asrRuntime.resolvedBpeVocabPath,
    asrReady: asrRuntime.ready,
    ready: asrRuntime.ready,
  };
};
