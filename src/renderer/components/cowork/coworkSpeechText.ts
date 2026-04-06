export const buildSpeechDraftText = (baseText: string, speechText: string): string => {
  const normalizedBase = baseText ?? '';
  const normalizedSpeech = speechText.trim();
  if (!normalizedSpeech) {
    return normalizedBase;
  }
  if (!normalizedBase.trim()) {
    return normalizedSpeech;
  }
  return normalizedBase.endsWith('\n')
    ? `${normalizedBase}${normalizedSpeech}`
    : `${normalizedBase}\n${normalizedSpeech}`;
};

export const SpeechVoiceCommandAction = {
  Stop: 'stop',
  Submit: 'submit',
} as const;

export type SpeechVoiceCommandAction = typeof SpeechVoiceCommandAction[keyof typeof SpeechVoiceCommandAction];

export type SpeechVoiceCommandResult = {
  action: SpeechVoiceCommandAction | null;
  cleanedSpeechText: string;
};

export type SpeechVoiceCommandConfig = {
  stopCommand: string;
  submitCommand: string;
};

const TAIL_PUNCTUATION_PATTERN = /[\s,.!?;:，。！？；：、]+$/u;
const MAX_FUZZY_COMMAND_EDIT_DISTANCE = 1;
const MIN_FUZZY_COMMAND_LENGTH = 2;

const splitTextSymbols = (text: string): string[] => Array.from(text);

const computeBoundedEditDistance = (
  sourceSymbols: string[],
  targetSymbols: string[],
  limit: number
): number | null => {
  const sourceLength = sourceSymbols.length;
  const targetLength = targetSymbols.length;
  if (Math.abs(sourceLength - targetLength) > limit) {
    return null;
  }

  let previousRow = Array.from({ length: targetLength + 1 }, (_, index) => index);
  for (let sourceIndex = 1; sourceIndex <= sourceLength; sourceIndex += 1) {
    const currentRow = [sourceIndex];
    let rowMin = currentRow[0];

    for (let targetIndex = 1; targetIndex <= targetLength; targetIndex += 1) {
      const substitutionCost = sourceSymbols[sourceIndex - 1] === targetSymbols[targetIndex - 1] ? 0 : 1;
      const nextDistance = Math.min(
        previousRow[targetIndex] + 1,
        currentRow[targetIndex - 1] + 1,
        previousRow[targetIndex - 1] + substitutionCost
      );
      currentRow.push(nextDistance);
      rowMin = Math.min(rowMin, nextDistance);
    }

    if (rowMin > limit) {
      return null;
    }
    previousRow = currentRow;
  }

  const distance = previousRow[targetLength];
  return distance <= limit ? distance : null;
};

const resolveExactCommandMatch = (
  trimmedTail: string,
  phrase: string
): SpeechVoiceCommandResult | null => {
  if (!trimmedTail.endsWith(phrase)) {
    return null;
  }

  return {
    action: null,
    cleanedSpeechText: trimmedTail.slice(0, -phrase.length).trimEnd(),
  };
};

const resolveFuzzyCommandMatch = (
  trimmedTail: string,
  phrase: string
): SpeechVoiceCommandResult | null => {
  const phraseSymbols = splitTextSymbols(phrase);
  if (phraseSymbols.length < MIN_FUZZY_COMMAND_LENGTH) {
    return null;
  }

  const tailSymbols = splitTextSymbols(trimmedTail);
  if (tailSymbols.length === 0) {
    return null;
  }

  const candidateLengths = [
    phraseSymbols.length,
    phraseSymbols.length + 1,
    phraseSymbols.length - 1,
  ].filter((length, index, lengths) => length > 0 && lengths.indexOf(length) === index);

  for (const candidateLength of candidateLengths) {
    if (tailSymbols.length < candidateLength) {
      continue;
    }
    const candidateSymbols = tailSymbols.slice(-candidateLength);
    const distance = computeBoundedEditDistance(
      candidateSymbols,
      phraseSymbols,
      MAX_FUZZY_COMMAND_EDIT_DISTANCE
    );
    if (distance === null) {
      continue;
    }

    return {
      action: null,
      cleanedSpeechText: tailSymbols.slice(0, -candidateLength).join('').trimEnd(),
    };
  }

  return null;
};

const buildSpeechVoiceCommands = (
  config: SpeechVoiceCommandConfig
): Array<{ phrase: string; action: SpeechVoiceCommandAction }> => {
  return [
    { phrase: config.submitCommand.trim(), action: SpeechVoiceCommandAction.Submit },
    { phrase: config.stopCommand.trim(), action: SpeechVoiceCommandAction.Stop },
  ]
    .filter((command) => command.phrase.length > 0)
    .sort((left, right) => right.phrase.length - left.phrase.length);
};

export const resolveSpeechVoiceCommand = (
  speechText: string,
  config: SpeechVoiceCommandConfig
): SpeechVoiceCommandResult => {
  const normalizedSpeech = speechText ?? '';
  const trimmedTail = normalizedSpeech.replace(TAIL_PUNCTUATION_PATTERN, '');

  for (const command of buildSpeechVoiceCommands(config)) {
    const exactMatch = resolveExactCommandMatch(trimmedTail, command.phrase);
    if (exactMatch) {
      return {
        action: command.action,
        cleanedSpeechText: exactMatch.cleanedSpeechText,
      };
    }
  }

  for (const command of buildSpeechVoiceCommands(config)) {
    const fuzzyMatch = resolveFuzzyCommandMatch(trimmedTail, command.phrase);
    if (fuzzyMatch) {
      return {
        action: command.action,
        cleanedSpeechText: fuzzyMatch.cleanedSpeechText,
      };
    }
  }

  return {
    action: null,
    cleanedSpeechText: normalizedSpeech,
  };
};
