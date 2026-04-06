'use strict';

const path = require('path');
const { existsSync, mkdirSync, rmSync, cpSync, writeFileSync } = require('fs');
const { pinyin } = require('pinyin-pro');

const GENERATED_DIR = path.join(__dirname, '..', 'build', 'generated', 'sherpa-kws');
const SOURCE_DIR = path.join(__dirname, '..', 'resources', 'sherpa-kws');
const CONFIG_FILE_NAME = 'sherpa-kws-config.json';
const DEFAULT_KEYWORDS_FILE_NAME = 'keywords.default.txt';

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
];

const ZERO_INITIAL_FINAL_MAP = {
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

const VOWEL_TONE_MAP = {
  a: ['a', 'ā', 'á', 'ǎ', 'à'],
  e: ['e', 'ē', 'é', 'ě', 'è'],
  i: ['i', 'ī', 'í', 'ǐ', 'ì'],
  o: ['o', 'ō', 'ó', 'ǒ', 'ò'],
  u: ['u', 'ū', 'ú', 'ǔ', 'ù'],
  v: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

const DEFAULT_WAKE_WORDS = ['打开青书爪', '初一'];
const SHORT_WAKE_WORD_MAX_SYLLABLES = 2;
const SHORT_WAKE_WORD_VARIANT_TONES = [1, 2, 4, 5];

const MODEL_BINDINGS = [
  {
    key: 'encoder',
    sourceFileName: 'encoder.onnx',
    outputFileName: 'encoder.onnx',
    envKey: 'SHERPA_KWS_ENCODER_PATH',
  },
  {
    key: 'decoder',
    sourceFileName: 'decoder.onnx',
    outputFileName: 'decoder.onnx',
    envKey: 'SHERPA_KWS_DECODER_PATH',
  },
  {
    key: 'joiner',
    sourceFileName: 'joiner.onnx',
    outputFileName: 'joiner.onnx',
    envKey: 'SHERPA_KWS_JOINER_PATH',
  },
  {
    key: 'tokens',
    sourceFileName: 'tokens.txt',
    outputFileName: 'tokens.txt',
    envKey: 'SHERPA_KWS_TOKENS_PATH',
  },
];

function normalizeWakeWordText(value) {
  return String(value || '').trim().replace(/\s+/g, '');
}

function applyToneMark(finalBase, tone) {
  const normalizedBase = String(finalBase || '').toLowerCase();
  if (!normalizedBase) {
    return normalizedBase;
  }

  const normalizedTone = Number.isFinite(tone) ? tone : 5;
  const chars = normalizedBase.split('');
  let targetIndex = chars.indexOf('a');
  if (targetIndex < 0) {
    targetIndex = chars.indexOf('e');
  }
  if (targetIndex < 0) {
    const ouIndex = normalizedBase.indexOf('ou');
    if (ouIndex >= 0) {
      targetIndex = ouIndex;
    }
  }
  if (targetIndex < 0) {
    for (let index = chars.length - 1; index >= 0; index -= 1) {
      if (['a', 'e', 'i', 'o', 'u', 'v'].includes(chars[index])) {
        targetIndex = index;
        break;
      }
    }
  }

  if (targetIndex < 0) {
    return normalizedBase.replace(/v/g, 'ü');
  }

  const toneIndex = normalizedTone >= 1 && normalizedTone <= 4 ? normalizedTone : 0;
  const vowel = chars[targetIndex];
  const marked = (VOWEL_TONE_MAP[vowel] || [vowel])[toneIndex] || vowel;
  chars[targetIndex] = marked;
  return chars.join('').replace(/v/g, 'ü');
}

function splitPinyinSyllable(rawSyllable) {
  const normalized = String(rawSyllable || '').toLowerCase().replace(/u:|ü/g, 'v');
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
    }

    return { initial, final };
  }

  const mappedFinal = ZERO_INITIAL_FINAL_MAP[normalized];
  if (mappedFinal) {
    return { final: mappedFinal };
  }

  return { final: normalized };
}

function parseWakeWordSyllables(wakeWord) {
  const normalizedWakeWord = normalizeWakeWordText(wakeWord);
  if (!normalizedWakeWord) {
    return null;
  }

  const numericSyllables = pinyin(normalizedWakeWord, { toneType: 'num', type: 'array' });
  if (!Array.isArray(numericSyllables) || numericSyllables.length === 0) {
    return null;
  }

  const parsedSyllables = [];
  for (const syllable of numericSyllables) {
    const normalizedSyllable = String(syllable || '').trim().toLowerCase();
    const match = normalizedSyllable.match(/^([a-züv:]+?)([1-5])?$/);
    if (!match) {
      return null;
    }

    const base = match[1];
    const tone = match[2] ? Number(match[2]) : 5;
    parsedSyllables.push({ base, tone });
  }

  return parsedSyllables;
}

function tokenizeParsedWakeWord(parsedSyllables) {
  const tokens = [];
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
}

function buildWakeWordVariantSyllables(parsedSyllables) {
  if (!Array.isArray(parsedSyllables) || parsedSyllables.length === 0) {
    return [];
  }

  const variants = [
    parsedSyllables.map((item) => ({ ...item })),
  ];

  if (parsedSyllables.length > SHORT_WAKE_WORD_MAX_SYLLABLES) {
    return variants;
  }

  const lastSyllable = parsedSyllables[parsedSyllables.length - 1];
  const relaxedTones = new Set([lastSyllable.tone, 5]);

  if (lastSyllable.base === 'yi') {
    for (const tone of SHORT_WAKE_WORD_VARIANT_TONES) {
      relaxedTones.add(tone);
    }
  }

  for (const tone of relaxedTones) {
    if (tone === lastSyllable.tone) {
      continue;
    }

    variants.push(parsedSyllables.map((item, index) => (
      index === parsedSyllables.length - 1 ? { ...item, tone } : { ...item }
    )));
  }

  return variants;
}

function buildWakeWordKeywordLines(wakeWord) {
  const parsedSyllables = parseWakeWordSyllables(wakeWord);
  if (!parsedSyllables || parsedSyllables.length === 0) {
    return null;
  }

  const lines = new Set();
  for (const syllableVariant of buildWakeWordVariantSyllables(parsedSyllables)) {
    const tokens = tokenizeParsedWakeWord(syllableVariant);
    if (!tokens || tokens.length === 0) {
      continue;
    }
    lines.add(`${tokens.join(' ')} @${wakeWord}`);
  }

  return lines.size > 0 ? Array.from(lines) : null;
}

function prepareKeywords(wakeWords) {
  const dedupedWakeWords = Array.from(new Set((wakeWords || [])
    .map((item) => normalizeWakeWordText(item))
    .filter((item) => item.length > 0)));

  const acceptedWakeWords = [];
  const lines = [];
  for (const wakeWord of dedupedWakeWords) {
    const keywordLines = buildWakeWordKeywordLines(wakeWord);
    if (!keywordLines || keywordLines.length === 0) {
      console.warn('[prepare-sherpa-wake-resources] Skipped unsupported wake word:', wakeWord);
      continue;
    }

    acceptedWakeWords.push(wakeWord);
    lines.push(...keywordLines);
  }

  return {
    acceptedWakeWords,
    keywordsContent: lines.length > 0 ? `${lines.join('\n')}\n` : '',
  };
}

function resolveSourcePath(binding) {
  const envOverride = process.env[binding.envKey] && process.env[binding.envKey].trim();
  if (envOverride) {
    return path.resolve(envOverride);
  }
  return path.join(SOURCE_DIR, binding.sourceFileName);
}

function ensureGeneratedDir() {
  rmSync(GENERATED_DIR, { recursive: true, force: true });
  mkdirSync(GENERATED_DIR, { recursive: true });
}

function resolveWakeWords() {
  const envValue = process.env.SHERPA_KWS_DEFAULT_WAKE_WORDS;
  if (!envValue) {
    return [...DEFAULT_WAKE_WORDS];
  }

  const wakeWords = envValue
    .split(',')
    .map((item) => normalizeWakeWordText(item))
    .filter((item) => item.length > 0);

  return wakeWords.length > 0 ? wakeWords : [...DEFAULT_WAKE_WORDS];
}

function prepareSherpaWakeResources() {
  ensureGeneratedDir();

  const copiedModelFiles = {};
  for (const binding of MODEL_BINDINGS) {
    const sourcePath = resolveSourcePath(binding);
    if (!existsSync(sourcePath)) {
      continue;
    }

    cpSync(sourcePath, path.join(GENERATED_DIR, binding.outputFileName), { force: true });
    copiedModelFiles[binding.key] = binding.outputFileName;
  }

  const wakeWords = resolveWakeWords();
  const preparedKeywords = prepareKeywords(wakeWords);
  if (preparedKeywords.keywordsContent) {
    writeFileSync(
      path.join(GENERATED_DIR, DEFAULT_KEYWORDS_FILE_NAME),
      preparedKeywords.keywordsContent,
      'utf8',
    );
  }

  const payload = {
    schemaVersion: 1,
    sampleRate: 16000,
    featureDim: 80,
    maxActivePaths: 4,
    numTrailingBlanks: 1,
    keywordsScore: 1.0,
    keywordsThreshold: 0.25,
    recorderFrameLength: 512,
    model: {
      encoderFileName: copiedModelFiles.encoder || '',
      decoderFileName: copiedModelFiles.decoder || '',
      joinerFileName: copiedModelFiles.joiner || '',
      tokensFileName: copiedModelFiles.tokens || '',
      provider: 'cpu',
      numThreads: 1,
      debug: false,
    },
    defaultWakeWords: preparedKeywords.acceptedWakeWords,
  };

  writeFileSync(
    path.join(GENERATED_DIR, CONFIG_FILE_NAME),
    JSON.stringify(payload, null, 2) + '\n',
    'utf8',
  );

  const result = {
    outputDir: GENERATED_DIR,
    modelFiles: copiedModelFiles,
    keywordCount: preparedKeywords.acceptedWakeWords.length,
    keywords: preparedKeywords.acceptedWakeWords,
  };

  console.log(
    '[prepare-sherpa-wake-resources] Prepared Sherpa wake resources:',
    JSON.stringify(result),
  );

  return result;
}

module.exports = {
  prepareSherpaWakeResources,
  GENERATED_DIR,
  CONFIG_FILE_NAME,
  DEFAULT_KEYWORDS_FILE_NAME,
};

if (require.main === module) {
  try {
    prepareSherpaWakeResources();
  } catch (error) {
    console.error(
      '[prepare-sherpa-wake-resources] Failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
