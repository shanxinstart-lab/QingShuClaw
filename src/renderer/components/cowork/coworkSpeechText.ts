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
    if (!trimmedTail.endsWith(command.phrase)) {
      continue;
    }

    const cleanedSpeechText = trimmedTail.slice(0, -command.phrase.length).trimEnd();
    return {
      action: command.action,
      cleanedSpeechText,
    };
  }

  return {
    action: null,
    cleanedSpeechText: normalizedSpeech,
  };
};
