import { app } from 'electron';
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pinyin } from 'pinyin-pro';
import { PvRecorder } from '@picovoice/pvrecorder-node';
import { WakeInputRuntimeProvider } from '../../shared/wakeInput/constants';
import type { SherpaOnnxWakeModelId as SherpaOnnxWakeModelIdValue } from '../../shared/voice/constants';
import { inspectSherpaOnnxWakeRuntime } from './sherpaOnnxWakeResourceService';

type SherpaKeywordSpotterInstance = {
  createStream: () => any;
  isReady: (stream: any) => boolean;
  decode: (stream: any) => void;
  getResult: (stream: any) => { keyword?: string };
  reset: (stream: any) => void;
};

const { KeywordSpotter } = require('sherpa-onnx-node') as {
  KeywordSpotter: new (config: unknown) => SherpaKeywordSpotterInstance;
};

const SHERPA_KWS_RUNTIME_DIR = path.join('voice', 'wake-input');
const SHERPA_KWS_RUNTIME_KEYWORDS_FILE_NAME = 'keywords.runtime.txt';
const SHERPA_KWS_BUFFERED_FRAMES_COUNT = 32;
const STOP_WAIT_TIMEOUT_MS = 300;

const SherpaWakeErrorCode = {
  ConfigMissing: 'sherpa_kws_config_missing',
  ModelMissing: 'sherpa_kws_model_missing',
  SelectedModelMissing: 'sherpa_kws_selected_model_missing',
  InvalidKeyword: 'sherpa_kws_invalid_keyword',
  RuntimeUnavailable: 'sherpa_kws_runtime_unavailable',
  RecorderStartFailed: 'sherpa_kws_recorder_start_failed',
  RecorderReadFailed: 'sherpa_kws_recorder_read_failed',
  EngineProcessFailed: 'sherpa_kws_engine_process_failed',
  KeywordsWriteFailed: 'sherpa_kws_keywords_write_failed',
} as const;

type SherpaWakeErrorCode = typeof SherpaWakeErrorCode[keyof typeof SherpaWakeErrorCode];

type SherpaWakeServiceEvents = {
  wake: (event: { wakeWord: string; provider: typeof WakeInputRuntimeProvider.SherpaOnnx }) => void;
  error: (event: { code: SherpaWakeErrorCode; message: string }) => void;
};

type PreparedWakeKeywords = {
  wakeWords: string[];
  keywordsContent: string;
};

type SherpaWakeStartOptions = {
  wakeWords?: string[];
  modelId?: SherpaOnnxWakeModelIdValue;
};

type SherpaSupportedTokens = Set<string>;

type ParsedWakeSyllable = {
  base: string;
  tone: number;
};

const INITIALS = [
  'zh',
  'ch',
  'sh',
  'b',
  'p',
  'm',
  'f',
  'd',
  't',
  'n',
  'l',
  'g',
  'k',
  'h',
  'j',
  'q',
  'x',
  'r',
  'z',
  'c',
  's',
] as const;

const ZERO_INITIAL_FINAL_MAP: Record<string, string> = {
  a: 'a',
  ai: 'ai',
  an: 'an',
  ang: 'ang',
  ao: 'ao',
  e: 'e',
  ei: 'ei',
  en: 'en',
  eng: 'eng',
  er: 'er',
  o: 'o',
  ou: 'ou',
  yi: 'i',
  ya: 'ia',
  yo: 'io',
  ye: 'ie',
  yao: 'iao',
  you: 'iu',
  yan: 'ian',
  yin: 'in',
  yang: 'iang',
  ying: 'ing',
  yong: 'iong',
  yu: 'v',
  yue: 've',
  yuan: 'van',
  yun: 'vn',
  wa: 'ua',
  wo: 'uo',
  wai: 'uai',
  wei: 'ui',
  wan: 'uan',
  wen: 'un',
  wang: 'uang',
  weng: 'ueng',
  wu: 'u',
};

const VOWEL_TONE_MAP: Record<string, [string, string, string, string, string]> = {
  a: ['a', 'ā', 'á', 'ǎ', 'à'],
  e: ['e', 'ē', 'é', 'ě', 'è'],
  i: ['i', 'ī', 'í', 'ǐ', 'ì'],
  o: ['o', 'ō', 'ó', 'ǒ', 'ò'],
  u: ['u', 'ū', 'ú', 'ǔ', 'ù'],
  v: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

const SHORT_WAKE_WORD_MAX_SYLLABLES = 2;
const SHORT_WAKE_WORD_VARIANT_TONES = [1, 2, 4, 5] as const;

const formatErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  return fallbackMessage;
};

const normalizeWakeWordText = (value: string): string => {
  return (value ?? '').trim().replace(/\s+/g, '');
};

const applyToneMark = (finalBase: string, tone: number): string => {
  const normalizedBase = finalBase.toLowerCase();
  if (!normalizedBase) {
    return normalizedBase;
  }

  const normalizedTone = Number.isFinite(tone) ? tone : 5;
  const chars = normalizedBase.split('');
  const targetIndex = (() => {
    const indexOfA = chars.indexOf('a');
    if (indexOfA >= 0) {
      return indexOfA;
    }
    const indexOfE = chars.indexOf('e');
    if (indexOfE >= 0) {
      return indexOfE;
    }
    const ouIndex = normalizedBase.indexOf('ou');
    if (ouIndex >= 0) {
      return ouIndex;
    }
    for (let index = chars.length - 1; index >= 0; index -= 1) {
      if (['a', 'e', 'i', 'o', 'u', 'v'].includes(chars[index])) {
        return index;
      }
    }
    return -1;
  })();

  if (targetIndex < 0) {
    return normalizedBase.replace(/v/g, 'ü');
  }

  const toneIndex = normalizedTone >= 1 && normalizedTone <= 4 ? normalizedTone : 0;
  const vowel = chars[targetIndex];
  const marked = VOWEL_TONE_MAP[vowel]?.[toneIndex] ?? vowel;
  chars[targetIndex] = marked;
  return chars.join('').replace(/v/g, 'ü');
};

const splitPinyinSyllable = (rawSyllable: string): { initial?: string; final: string } | null => {
  const normalized = rawSyllable.toLowerCase().replace(/u:|ü/g, 'v');
  if (!normalized) {
    return null;
  }

  for (const initial of INITIALS) {
    if (!normalized.startsWith(initial)) {
      continue;
    }

    let final = normalized.slice(initial.length);
    if (!final) {
      return null;
    }

    if ((initial === 'j' || initial === 'q' || initial === 'x') && final.startsWith('u')) {
      if (final === 'u') final = 'v';
      else if (final === 'ue') final = 've';
      else if (final === 'uan') final = 'van';
      else if (final === 'un') final = 'vn';
    } else if ((initial === 'n' || initial === 'l') && final.startsWith('v')) {
      if (final === 've') final = 've';
    }

    return { initial, final };
  }

  const mappedFinal = ZERO_INITIAL_FINAL_MAP[normalized];
  if (mappedFinal) {
    return { final: mappedFinal };
  }

  return { final: normalized };
};

const parseWakeWordSyllables = (wakeWord: string): ParsedWakeSyllable[] | null => {
  const normalizedWakeWord = normalizeWakeWordText(wakeWord);
  if (!normalizedWakeWord) {
    return null;
  }

  const numericSyllables = pinyin(normalizedWakeWord, { toneType: 'num', type: 'array' }) as string[];
  if (!Array.isArray(numericSyllables) || numericSyllables.length === 0) {
    return null;
  }

  const parsedSyllables: ParsedWakeSyllable[] = [];
  for (const syllable of numericSyllables) {
    const normalizedSyllable = typeof syllable === 'string' ? syllable.trim().toLowerCase() : '';
    const match = normalizedSyllable.match(/^([a-züv:]+?)([1-5])?$/);
    if (!match) {
      return null;
    }

    const base = match[1];
    const tone = match[2] ? Number(match[2]) : 5;
    parsedSyllables.push({ base, tone });
  }

  return parsedSyllables;
};

const tokenizeParsedWakeWord = (parsedSyllables: ParsedWakeSyllable[]): string[] | null => {
  const tokens: string[] = [];
  for (const parsedSyllable of parsedSyllables) {
    const split = splitPinyinSyllable(parsedSyllable.base);
    if (!split) {
      return null;
    }

    if (split.initial) {
      tokens.push(split.initial);
    }
    tokens.push(applyToneMark(split.final, parsedSyllable.tone));
  }

  return tokens;
};

const buildWakeWordVariantSyllables = (parsedSyllables: ParsedWakeSyllable[]): ParsedWakeSyllable[][] => {
  if (parsedSyllables.length === 0) {
    return [];
  }

  const variants: ParsedWakeSyllable[][] = [
    parsedSyllables.map((item) => ({ ...item })),
  ];

  if (parsedSyllables.length > SHORT_WAKE_WORD_MAX_SYLLABLES) {
    return variants;
  }

  const lastSyllable = parsedSyllables[parsedSyllables.length - 1];
  const relaxedTones = new Set<number>([lastSyllable.tone, 5]);

  if (lastSyllable.base === 'yi') {
    for (const tone of SHORT_WAKE_WORD_VARIANT_TONES) {
      relaxedTones.add(tone);
    }
  }

  for (const tone of relaxedTones) {
    if (tone === lastSyllable.tone) {
      continue;
    }

    const nextVariant = parsedSyllables.map((item, index) => (
      index === parsedSyllables.length - 1 ? { ...item, tone } : { ...item }
    ));
    variants.push(nextVariant);
  }

  return variants;
};

const buildWakeWordKeywordLines = (wakeWord: string): string[] | null => {
  const parsedSyllables = parseWakeWordSyllables(wakeWord);
  if (!parsedSyllables || parsedSyllables.length === 0) {
    return null;
  }

  const lines = new Set<string>();
  for (const syllableVariant of buildWakeWordVariantSyllables(parsedSyllables)) {
    const tokens = tokenizeParsedWakeWord(syllableVariant);
    if (!tokens || tokens.length === 0) {
      continue;
    }
    lines.add(`${tokens.join(' ')} @${wakeWord}`);
  }

  return lines.size > 0 ? Array.from(lines) : null;
};

const loadSupportedTokens = (tokensPath: string): SherpaSupportedTokens => {
  try {
    const content = fs.readFileSync(tokensPath, 'utf8');
    const supportedTokens = new Set<string>();
    for (const line of content.split(/\r?\n/)) {
      const normalized = line.trim();
      if (!normalized) {
        continue;
      }

      const [token] = normalized.split(/\s+/, 1);
      if (token) {
        supportedTokens.add(token);
      }
    }
    return supportedTokens;
  } catch (error) {
    console.warn('[SherpaWake] Failed to read supported tokens for keyword validation.', error);
    return new Set<string>();
  }
};

const filterKeywordLinesBySupportedTokens = (
  keywordLines: string[],
  supportedTokens?: SherpaSupportedTokens,
): string[] => {
  if (!supportedTokens || supportedTokens.size === 0) {
    return keywordLines;
  }

  return keywordLines.filter((line) => {
    const [tokensPart] = line.split('@', 1);
    const tokens = tokensPart.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return false;
    }

    return tokens.every((token) => supportedTokens.has(token));
  });
};

const prepareWakeKeywordsWithSupportedTokens = (
  wakeWords: string[],
  supportedTokens?: SherpaSupportedTokens,
): PreparedWakeKeywords | null => {
  const dedupedWakeWords = Array.from(
    new Set(
      wakeWords
        .map((item) => normalizeWakeWordText(item))
        .filter((item) => item.length > 0),
    ),
  );

  if (dedupedWakeWords.length === 0) {
    return null;
  }

  const lines: string[] = [];
  const acceptedWakeWords: string[] = [];
  for (const wakeWord of dedupedWakeWords) {
    const keywordLines = filterKeywordLinesBySupportedTokens(
      buildWakeWordKeywordLines(wakeWord) ?? [],
      supportedTokens,
    );
    if (!keywordLines || keywordLines.length === 0) {
      console.warn('[SherpaWake] Skipped unsupported wake word for Sherpa keyword generation.', JSON.stringify({ wakeWord }));
      continue;
    }

    lines.push(...keywordLines);
    acceptedWakeWords.push(wakeWord);
    if (keywordLines.length > 1) {
      console.log(
        '[SherpaWake] Expanded short wake word into multiple pronunciation variants.',
        JSON.stringify({ wakeWord, variants: keywordLines.length }),
      );
    }
  }

  if (acceptedWakeWords.length === 0) {
    return null;
  }

  return {
    wakeWords: acceptedWakeWords,
    keywordsContent: `${lines.join(os.EOL)}${os.EOL}`,
  };
};

export class SherpaOnnxWakeService extends EventEmitter {
  private keywordSpotter: SherpaKeywordSpotterInstance | null = null;

  private recorder: PvRecorder | null = null;

  private keywordStream: any = null;

  private listening = false;

  private wakePending = false;

  private listenSessionId = 0;

  private activeWakeWords: string[] = [];

  private captureLoopPromise: Promise<void> | null = null;

  override on<U extends keyof SherpaWakeServiceEvents>(event: U, listener: SherpaWakeServiceEvents[U]): this {
    return super.on(event, listener);
  }

  getAvailability(options?: SherpaWakeStartOptions): { supported: boolean; configuredWakeWords: string[]; error?: string } {
    const runtime = inspectSherpaOnnxWakeRuntime(options?.modelId);
    if (!runtime.ready || !runtime.resolvedTokensPath) {
      return {
        supported: false,
        configuredWakeWords: [],
        error: runtime.error,
      };
    }

    const supportedTokens = loadSupportedTokens(runtime.resolvedTokensPath);
    const preparedKeywords = prepareWakeKeywordsWithSupportedTokens(
      options?.wakeWords?.length ? options.wakeWords : runtime.defaultWakeWords,
      supportedTokens,
    );
    if (!preparedKeywords) {
      return {
        supported: false,
        configuredWakeWords: [],
        error: SherpaWakeErrorCode.InvalidKeyword,
      };
    }

    return {
      supported: true,
      configuredWakeWords: preparedKeywords.wakeWords,
    };
  }

  async start(options?: SherpaWakeStartOptions): Promise<{ success: boolean; error?: string; configuredWakeWords?: string[] }> {
    if (this.listening) {
      return {
        success: true,
        configuredWakeWords: [...this.activeWakeWords],
      };
    }

    const runtime = inspectSherpaOnnxWakeRuntime(options?.modelId);
    if (
      !runtime.ready
      || !runtime.resolvedEncoderPath
      || !runtime.resolvedDecoderPath
      || !runtime.resolvedJoinerPath
      || !runtime.resolvedTokensPath
    ) {
      return { success: false, error: runtime.error };
    }

    const supportedTokens = loadSupportedTokens(runtime.resolvedTokensPath);
    const preparedKeywords = prepareWakeKeywordsWithSupportedTokens(
      options?.wakeWords?.length ? options.wakeWords : runtime.defaultWakeWords,
      supportedTokens,
    );
    if (!preparedKeywords) {
      return { success: false, error: SherpaWakeErrorCode.InvalidKeyword };
    }

    let keywordsFilePath = '';
    try {
      keywordsFilePath = this.writeRuntimeKeywordsFile(preparedKeywords.keywordsContent);
    } catch (error) {
      return {
        success: false,
        error: formatErrorMessage(error, SherpaWakeErrorCode.KeywordsWriteFailed),
      };
    }

    try {
      this.keywordSpotter = new KeywordSpotter({
        featConfig: {
          sampleRate: runtime.sampleRate,
          featureDim: runtime.featureDim,
        },
        modelConfig: {
          transducer: {
            encoder: runtime.resolvedEncoderPath,
            decoder: runtime.resolvedDecoderPath,
            joiner: runtime.resolvedJoinerPath,
          },
          tokens: runtime.resolvedTokensPath,
          provider: runtime.provider,
          numThreads: runtime.numThreads,
          debug: runtime.debug ? 1 : 0,
        },
        maxActivePaths: runtime.maxActivePaths,
        numTrailingBlanks: runtime.numTrailingBlanks,
        keywordsScore: runtime.keywordsScore,
        keywordsThreshold: runtime.keywordsThreshold,
        keywordsFile: keywordsFilePath,
      });
      this.keywordStream = this.keywordSpotter.createStream();
    } catch (error) {
      await this.releaseResources();
      return {
        success: false,
        error: formatErrorMessage(error, SherpaWakeErrorCode.RuntimeUnavailable),
      };
    }

    try {
      this.recorder = new PvRecorder(
        runtime.recorderFrameLength,
        -1,
        SHERPA_KWS_BUFFERED_FRAMES_COUNT,
      );
      this.recorder.start();
    } catch (error) {
      await this.releaseResources();
      return {
        success: false,
        error: formatErrorMessage(error, SherpaWakeErrorCode.RecorderStartFailed),
      };
    }

    this.listening = true;
    this.wakePending = false;
    this.listenSessionId += 1;
    this.activeWakeWords = [...preparedKeywords.wakeWords];
    const currentSessionId = this.listenSessionId;
    this.captureLoopPromise = this.runCaptureLoop(currentSessionId, runtime.sampleRate);
    console.log(
      '[SherpaWake] Started background wake listener.',
      JSON.stringify({ wakeWords: this.activeWakeWords, modelId: runtime.modelId }),
    );

    return {
      success: true,
      configuredWakeWords: [...this.activeWakeWords],
    };
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    if (!this.listening && !this.keywordSpotter && !this.recorder) {
      return { success: true };
    }

    this.listening = false;
    this.wakePending = false;
    this.listenSessionId += 1;

    try {
      this.recorder?.stop();
    } catch (error) {
      console.warn('[SherpaWake] Failed to stop recorder cleanly.', error);
    }

    const currentLoop = this.captureLoopPromise;
    if (currentLoop) {
      await Promise.race([
        currentLoop.catch((): void => undefined),
        new Promise((resolve) => setTimeout(resolve, STOP_WAIT_TIMEOUT_MS)),
      ]);
    }

    await this.releaseResources();
    console.log('[SherpaWake] Stopped background wake listener.');
    return { success: true };
  }

  private writeRuntimeKeywordsFile(content: string): string {
    const runtimeDir = path.join(app.getPath('userData'), SHERPA_KWS_RUNTIME_DIR);
    fs.mkdirSync(runtimeDir, { recursive: true });
    const filePath = path.join(runtimeDir, SHERPA_KWS_RUNTIME_KEYWORDS_FILE_NAME);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  }

  private async runCaptureLoop(sessionId: number, sampleRate: number): Promise<void> {
    while (this.listening && sessionId === this.listenSessionId && this.recorder && this.keywordSpotter && this.keywordStream) {
      let frame: Int16Array;
      try {
        frame = await this.recorder.read();
      } catch (error) {
        if (!this.listening || sessionId !== this.listenSessionId) {
          return;
        }
        await this.handleRuntimeFailure(
          SherpaWakeErrorCode.RecorderReadFailed,
          formatErrorMessage(error, SherpaWakeErrorCode.RecorderReadFailed),
        );
        return;
      }

      if (!this.listening || sessionId !== this.listenSessionId || !this.keywordSpotter || !this.keywordStream) {
        return;
      }

      try {
        const samples = Float32Array.from(frame, (value) => value / 32768);
        this.keywordStream.acceptWaveform({ samples, sampleRate });
        while (this.keywordSpotter.isReady(this.keywordStream)) {
          this.keywordSpotter.decode(this.keywordStream);
        }
        const result = this.keywordSpotter.getResult(this.keywordStream);
        if (!result?.keyword || this.wakePending) {
          continue;
        }

        this.wakePending = true;
        const detectedWakeWord = result.keyword.trim();
        console.log(
          '[SherpaWake] Wake word detected.',
          JSON.stringify({ wakeWord: detectedWakeWord }),
        );
        this.keywordSpotter.reset(this.keywordStream);
        this.emit('wake', {
          wakeWord: detectedWakeWord,
          provider: WakeInputRuntimeProvider.SherpaOnnx,
        });
      } catch (error) {
        await this.handleRuntimeFailure(
          SherpaWakeErrorCode.EngineProcessFailed,
          formatErrorMessage(error, SherpaWakeErrorCode.EngineProcessFailed),
        );
        return;
      }
    }
  }

  private async handleRuntimeFailure(code: SherpaWakeErrorCode, message: string): Promise<void> {
    this.listening = false;
    this.wakePending = false;
    await this.releaseResources();
    console.warn(
      '[SherpaWake] Runtime failure stopped background wake listener.',
      JSON.stringify({ code, message }),
    );
    this.emit('error', { code, message });
  }

  private async releaseResources(): Promise<void> {
    try {
      this.recorder?.release();
    } catch (error) {
      console.warn('[SherpaWake] Failed to release recorder resources.', error);
    }

    this.recorder = null;
    this.keywordSpotter = null;
    this.keywordStream = null;
    this.captureLoopPromise = null;
    this.activeWakeWords = [];
  }
}

export const __testUtils = {
  loadSupportedTokens,
  prepareWakeKeywordsWithSupportedTokens,
};
