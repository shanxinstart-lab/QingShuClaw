import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import {
  VoiceLocalModelInstallBackend,
  VoiceLocalModelInstallState,
  VoiceLocalModelKind,
  VoiceProvider,
  type VoiceLocalModelCatalogEntry,
  type VoiceLocalModelInstallStatus,
  type VoiceLocalModelLibrary,
} from '../../shared/voice/constants';

const LOCAL_VOICE_MODELS_DIR = 'voice-models';
const LOCAL_WHISPER_CPP_MODELS_DIR = 'local-whisper-cpp/models';
const LOCAL_QWEN3_TTS_MODELS_DIR = 'local-qwen3-tts/models';
const LOCAL_QWEN3_TTS_RUNTIME_DIR = 'local-qwen3-tts/runtime';
const TOKENIZER_MODEL_ID = 'qwen3_tts_tokenizer_12hz';

type InstallTask = {
  id: string;
  abortController?: AbortController;
  child?: ChildProcessWithoutNullStreams;
  startedAt: number;
  downloadedBytes?: number;
  totalBytes?: number;
  progressPercent?: number;
  error?: string;
};

const LOCAL_MODEL_CATALOG: VoiceLocalModelCatalogEntry[] = [
  {
    id: 'whisper_tiny',
    kind: VoiceLocalModelKind.WhisperCppModel,
    label: 'whisper.cpp Tiny',
    description: '最小体积，适合快速验证，本地识别质量最低。',
    version: 'ggml',
    recommended: false,
    defaultInstall: false,
    approximateSizeMb: 75,
    installBackend: VoiceLocalModelInstallBackend.Direct,
    sourceUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    targetRelativePath: path.join(LOCAL_WHISPER_CPP_MODELS_DIR, 'ggml-tiny.bin'),
    requirements: ['CPU 即可运行', '适合开发环境快速验证'],
    warnings: ['中文识别准确率相对较低，不建议作为长期默认模型。'],
    provider: VoiceProvider.LocalWhisperCpp,
  },
  {
    id: 'whisper_base',
    kind: VoiceLocalModelKind.WhisperCppModel,
    label: 'whisper.cpp Base',
    description: '推荐起步模型，体积和识别质量更平衡。',
    version: 'ggml',
    recommended: true,
    defaultInstall: true,
    approximateSizeMb: 142,
    installBackend: VoiceLocalModelInstallBackend.Direct,
    sourceUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    targetRelativePath: path.join(LOCAL_WHISPER_CPP_MODELS_DIR, 'ggml-base.bin'),
    requirements: ['Apple Silicon / Intel macOS 均可运行', '建议至少 4 线程'],
    warnings: ['首次下载较大，请确认网络稳定。'],
    provider: VoiceProvider.LocalWhisperCpp,
  },
  {
    id: 'whisper_small',
    kind: VoiceLocalModelKind.WhisperCppModel,
    label: 'whisper.cpp Small',
    description: '更高识别准确率，但推理耗时和内存占用也更高。',
    version: 'ggml',
    recommended: false,
    defaultInstall: false,
    approximateSizeMb: 466,
    installBackend: VoiceLocalModelInstallBackend.Direct,
    sourceUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    targetRelativePath: path.join(LOCAL_WHISPER_CPP_MODELS_DIR, 'ggml-small.bin'),
    requirements: ['建议 Apple Silicon 机器', '建议 16GB 及以上内存'],
    warnings: ['模型较大，首次加载会更慢。'],
    provider: VoiceProvider.LocalWhisperCpp,
  },
  {
    id: TOKENIZER_MODEL_ID,
    kind: VoiceLocalModelKind.Qwen3TtsTokenizer,
    label: 'Qwen3-TTS Tokenizer 12Hz',
    description: 'Qwen3-TTS 本地推理依赖的 tokenizer 资源。',
    version: '12Hz',
    recommended: true,
    defaultInstall: true,
    approximateSizeMb: 50,
    installBackend: VoiceLocalModelInstallBackend.HuggingFaceCli,
    sourceRepoId: 'Qwen/Qwen3-TTS-Tokenizer-12Hz-v0.1',
    targetRelativePath: path.join(LOCAL_QWEN3_TTS_MODELS_DIR, 'Qwen3-TTS-Tokenizer-12Hz'),
    requirements: ['需要 Python 3 环境', '需要安装 huggingface_hub 或 huggingface-cli'],
    warnings: ['若网络访问 Hugging Face 受限，下载可能失败。'],
    provider: VoiceProvider.LocalQwen3Tts,
  },
  {
    id: 'qwen3_tts_0_6b_base',
    kind: VoiceLocalModelKind.Qwen3TtsModel,
    label: 'Qwen3-TTS 0.6B Base',
    description: '更轻量的本地 TTS 模型，适合实验和开发验证。',
    version: '0.6B',
    recommended: false,
    defaultInstall: false,
    approximateSizeMb: 1700,
    installBackend: VoiceLocalModelInstallBackend.HuggingFaceCli,
    sourceRepoId: 'Qwen/Qwen3-TTS-0.6B-Base',
    targetRelativePath: path.join(LOCAL_QWEN3_TTS_MODELS_DIR, 'Qwen3-TTS-0.6B'),
    requirements: ['需要 Python 3.10+', '建议安装 PyTorch 与 qwen-tts', 'CPU 可跑，但速度较慢'],
    warnings: ['Base 模型通常需要更复杂的调用方式，初版不作为默认执行模型。'],
    provider: VoiceProvider.LocalQwen3Tts,
  },
  {
    id: 'qwen3_tts_0_6b_custom_voice',
    kind: VoiceLocalModelKind.Qwen3TtsModel,
    label: 'Qwen3-TTS 0.6B Custom Voice',
    description: '较轻量的本地中文语音合成模型，适合先做本地 TTS 验证。',
    version: '0.6B',
    recommended: true,
    defaultInstall: false,
    approximateSizeMb: 1800,
    installBackend: VoiceLocalModelInstallBackend.HuggingFaceCli,
    sourceRepoId: 'Qwen/Qwen3-TTS-0.6B-CustomVoice-12Hz',
    targetRelativePath: path.join(LOCAL_QWEN3_TTS_MODELS_DIR, 'Qwen3-TTS-0.6B-CustomVoice'),
    requirements: ['需要 Python 3.10+', '需要安装 qwen-tts、torch、soundfile', '建议至少 16GB 内存'],
    warnings: ['首次加载模型时间较长。', '若无可用 GPU，将主要依赖 CPU 推理。'],
    provider: VoiceProvider.LocalQwen3Tts,
  },
  {
    id: 'qwen3_tts_1_7b_custom_voice',
    kind: VoiceLocalModelKind.Qwen3TtsModel,
    label: 'Qwen3-TTS 1.7B Custom Voice',
    description: '更高质量的本地语音合成模型，适合更自然的中文语音输出。',
    version: '1.7B',
    recommended: false,
    defaultInstall: false,
    approximateSizeMb: 4100,
    installBackend: VoiceLocalModelInstallBackend.HuggingFaceCli,
    sourceRepoId: 'Qwen/Qwen3-TTS-1.7B-CustomVoice-12Hz',
    targetRelativePath: path.join(LOCAL_QWEN3_TTS_MODELS_DIR, 'Qwen3-TTS-1.7B-CustomVoice'),
    requirements: ['建议 Apple Silicon 高配机器或带高显存 GPU 的宿主机', '需要 Python 3.10+ 和完整 qwen-tts 运行环境'],
    warnings: ['模型大、内存占用高，不建议在低配机器直接安装。'],
    provider: VoiceProvider.LocalQwen3Tts,
  },
  {
    id: 'qwen3_tts_1_7b_voice_design',
    kind: VoiceLocalModelKind.Qwen3TtsModel,
    label: 'Qwen3-TTS 1.7B Voice Design',
    description: '支持通过描述词设计语音风格，适合作为本地 TTS 初版默认模型。',
    version: '1.7B',
    recommended: true,
    defaultInstall: true,
    approximateSizeMb: 4300,
    installBackend: VoiceLocalModelInstallBackend.HuggingFaceCli,
    sourceRepoId: 'Qwen/Qwen3-TTS-1.7B-VoiceDesign-12Hz-v0.1',
    targetRelativePath: path.join(LOCAL_QWEN3_TTS_MODELS_DIR, 'Qwen3-TTS-1.7B-VoiceDesign'),
    requirements: ['建议 Apple Silicon 高配机器', '需要 Python 3.10+、qwen-tts、torch、soundfile', '建议预留 8GB 以上可用内存'],
    warnings: ['首次下载和首次加载时间都较长。', '宿主机若缺少 Python 运行环境，下载后也无法直接推理。'],
    provider: VoiceProvider.LocalQwen3Tts,
  },
];

const isDirectoryNonEmpty = (targetPath: string): boolean => {
  try {
    return fs.statSync(targetPath).isDirectory() && fs.readdirSync(targetPath).length > 0;
  } catch {
    return false;
  }
};

const resolveCommand = (command: string): string | null => {
  const trimmed = command.trim();
  if (!trimmed) {
    return null;
  }
  if (path.isAbsolute(trimmed) && fs.existsSync(trimmed)) {
    return trimmed;
  }

  const checker = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(checker, [trimmed], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    return null;
  }
  const firstLine = result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return firstLine || null;
};

export const resolveLocalVoiceModelsRoot = (): string => {
  return path.join(app.getPath('userData'), LOCAL_VOICE_MODELS_DIR);
};

export const resolveDownloadedWhisperCppModelsDirectory = (): string => {
  return path.join(resolveLocalVoiceModelsRoot(), LOCAL_WHISPER_CPP_MODELS_DIR);
};

export const resolveLocalQwen3TtsModelsRoot = (): string => {
  return path.join(resolveLocalVoiceModelsRoot(), LOCAL_QWEN3_TTS_MODELS_DIR);
};

export const resolveLocalQwen3TtsRuntimeRoot = (): string => {
  return path.join(resolveLocalVoiceModelsRoot(), LOCAL_QWEN3_TTS_RUNTIME_DIR);
};

export const resolveLocalQwen3TtsCatalogEntry = (id: string): VoiceLocalModelCatalogEntry | null => {
  return LOCAL_MODEL_CATALOG.find((entry) => entry.id === id) ?? null;
};

export const resolveInstalledLocalModelPath = (id: string): string | null => {
  const entry = resolveLocalQwen3TtsCatalogEntry(id);
  if (!entry) {
    return null;
  }
  return path.join(resolveLocalVoiceModelsRoot(), entry.targetRelativePath);
};

const getDependentModelIds = (entry: VoiceLocalModelCatalogEntry): string[] => {
  if (entry.kind === VoiceLocalModelKind.Qwen3TtsModel) {
    return [TOKENIZER_MODEL_ID];
  }
  return [];
};

const ensureParentDir = async (targetPath: string): Promise<void> => {
  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
};

const ensureDir = async (targetPath: string): Promise<void> => {
  await fs.promises.mkdir(targetPath, { recursive: true });
};

export class LocalVoiceModelManager {
  private readonly activeTasks = new Map<string, InstallTask>();
  private readonly lastErrors = new Map<string, string>();

  constructor(private readonly options?: {
    onChanged?: (library: VoiceLocalModelLibrary) => void;
  }) {}

  getCatalog(): VoiceLocalModelCatalogEntry[] {
    return LOCAL_MODEL_CATALOG.map((entry) => ({ ...entry }));
  }

  async ensureRoots(): Promise<void> {
    await ensureDir(resolveDownloadedWhisperCppModelsDirectory());
    await ensureDir(resolveLocalQwen3TtsModelsRoot());
    await ensureDir(resolveLocalQwen3TtsRuntimeRoot());
  }

  getLibrary(): VoiceLocalModelLibrary {
    const statuses = Object.fromEntries(
      this.getCatalog().map((entry) => {
        const resolvedPath = path.join(resolveLocalVoiceModelsRoot(), entry.targetRelativePath);
        const installed = entry.kind === VoiceLocalModelKind.WhisperCppModel
          ? fs.existsSync(resolvedPath)
          : isDirectoryNonEmpty(resolvedPath);
        const activeTask = this.activeTasks.get(entry.id);

        const status: VoiceLocalModelInstallStatus = {
          id: entry.id,
          state: activeTask
            ? VoiceLocalModelInstallState.Downloading
            : installed
              ? VoiceLocalModelInstallState.Installed
              : this.lastErrors.has(entry.id)
                ? VoiceLocalModelInstallState.Error
                : VoiceLocalModelInstallState.NotInstalled,
          installed,
          downloading: Boolean(activeTask),
          progressPercent: activeTask?.progressPercent,
          downloadedBytes: activeTask?.downloadedBytes,
          totalBytes: activeTask?.totalBytes,
          resolvedPath,
          error: activeTask?.error ?? this.lastErrors.get(entry.id),
          updatedAt: activeTask?.startedAt ?? Date.now(),
        };
        return [entry.id, status];
      }),
    ) as Record<string, VoiceLocalModelInstallStatus>;

    return {
      catalog: this.getCatalog(),
      statuses,
    };
  }

  private emitChanged(): void {
    this.options?.onChanged?.(this.getLibrary());
  }

  async installModel(id: string): Promise<VoiceLocalModelLibrary> {
    await this.ensureRoots();
    const entry = resolveLocalQwen3TtsCatalogEntry(id);
    if (!entry) {
      throw new Error(`Unknown local voice model: ${id}`);
    }
    if (this.activeTasks.has(id)) {
      return this.getLibrary();
    }

    for (const dependencyId of getDependentModelIds(entry)) {
      const dependencyPath = resolveInstalledLocalModelPath(dependencyId);
      const dependencyEntry = resolveLocalQwen3TtsCatalogEntry(dependencyId);
      const dependencyInstalled = dependencyEntry
        ? (dependencyEntry.kind === VoiceLocalModelKind.WhisperCppModel
          ? Boolean(dependencyPath && fs.existsSync(dependencyPath))
          : Boolean(dependencyPath && isDirectoryNonEmpty(dependencyPath)))
        : false;
      if (!dependencyInstalled) {
        await this.installModel(dependencyId);
      }
    }

    const task: InstallTask = {
      id,
      startedAt: Date.now(),
    };
    this.activeTasks.set(id, task);
    this.emitChanged();

    try {
      if (entry.installBackend === VoiceLocalModelInstallBackend.Direct) {
        await this.installByDirectDownload(entry, task);
      } else {
        await this.installByHuggingFaceCli(entry, task);
      }
      this.lastErrors.delete(id);
      this.activeTasks.delete(id);
      this.emitChanged();
      return this.getLibrary();
    } catch (error) {
      task.error = error instanceof Error ? error.message : String(error);
      this.lastErrors.set(id, task.error);
      this.emitChanged();
      this.activeTasks.delete(id);
      throw error;
    }
  }

  cancelInstall(id: string): VoiceLocalModelLibrary {
    const task = this.activeTasks.get(id);
    if (!task) {
      return this.getLibrary();
    }
    if (task?.abortController) {
      task.abortController.abort();
    }
    if (task?.child && !task.child.killed) {
      task.child.kill('SIGTERM');
    }
    task.error = 'canceled';
    this.lastErrors.set(id, 'canceled');
    this.activeTasks.delete(id);
    this.emitChanged();
    return this.getLibrary();
  }

  private async installByDirectDownload(entry: VoiceLocalModelCatalogEntry, task: InstallTask): Promise<void> {
    if (!entry.sourceUrl) {
      throw new Error('Missing direct download URL.');
    }

    const controller = new AbortController();
    task.abortController = controller;
    const targetPath = path.join(resolveLocalVoiceModelsRoot(), entry.targetRelativePath);
    const tempPath = `${targetPath}.download`;

    await ensureParentDir(targetPath);
    const response = await fetch(entry.sourceUrl, {
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`.trim());
    }

    const totalBytes = Number(response.headers.get('content-length') || 0) || undefined;
    task.totalBytes = totalBytes;
    const reader = response.body.getReader();
    const fileStream = fs.createWriteStream(tempPath);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (!value) {
          continue;
        }
        await new Promise<void>((resolve, reject) => {
          fileStream.write(Buffer.from(value), (error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        });
        task.downloadedBytes = (task.downloadedBytes || 0) + value.byteLength;
        if (task.totalBytes && task.totalBytes > 0) {
          task.progressPercent = Math.min(100, Math.round((task.downloadedBytes / task.totalBytes) * 100));
        }
        this.emitChanged();
      }
    } finally {
      await new Promise<void>((resolve) => {
        fileStream.end(() => resolve());
      });
    }

    await fs.promises.rename(tempPath, targetPath);
  }

  private async installByHuggingFaceCli(entry: VoiceLocalModelCatalogEntry, task: InstallTask): Promise<void> {
    if (!entry.sourceRepoId) {
      throw new Error('Missing Hugging Face repo id.');
    }

    const targetPath = path.join(resolveLocalVoiceModelsRoot(), entry.targetRelativePath);
    await ensureDir(targetPath);

    const huggingFaceCli = resolveCommand('huggingface-cli');
    const python = resolveCommand('python3') ?? resolveCommand('python');

    let command = '';
    let args: string[] = [];
    if (huggingFaceCli) {
      command = huggingFaceCli;
      args = ['download', entry.sourceRepoId, '--local-dir', targetPath];
    } else if (python) {
      command = python;
      args = ['-m', 'huggingface_hub', 'download', entry.sourceRepoId, '--local-dir', targetPath];
    } else {
      throw new Error('未找到 huggingface-cli 或 python3，请先在宿主机安装 Hugging Face 下载环境。');
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
      });
      task.child = child;
      let stderr = '';

      child.stdout.on('data', () => {
        task.progressPercent = undefined;
        this.emitChanged();
      });
      child.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
        this.emitChanged();
      });
      child.on('error', (error) => {
        reject(error);
      });
      child.on('close', (code) => {
        task.child = undefined;
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(stderr.trim() || `huggingface download exited with code ${code}`));
      });
    });
  }
}
