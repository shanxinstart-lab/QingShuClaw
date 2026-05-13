import type { LocalizedPrompt, LocalizedQuickAction } from '../../types/quickAction';

const MAX_SLASH_COMMAND_RESULTS = 6;

export type PromptSlashCommandMatch = {
  action: LocalizedQuickAction;
  prompt: LocalizedPrompt;
};

export function parsePromptSlashCommand(value: string): string | null {
  const trimmedStart = value.replace(/^\s+/, '');
  if (!trimmedStart.startsWith('/')) {
    return null;
  }
  const query = trimmedStart.slice(1);
  if (query.includes('\n')) {
    return null;
  }
  return query.trim().toLowerCase();
}

export function getDefaultPromptForAction(action: LocalizedQuickAction): LocalizedPrompt | null {
  return action.prompts.find((prompt) => prompt.prompt.trim()) ?? null;
}

export function filterPromptSlashCommands(
  actions: LocalizedQuickAction[],
  value: string,
): PromptSlashCommandMatch[] {
  const query = parsePromptSlashCommand(value);
  if (query === null) {
    return [];
  }

  return actions
    .flatMap((action): PromptSlashCommandMatch[] => {
      const prompt = getDefaultPromptForAction(action);
      if (!prompt) {
        return [];
      }
      const searchableText = [
        action.id,
        action.label,
        action.skillMapping,
        prompt.label,
        prompt.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (query && !searchableText.includes(query)) {
        return [];
      }
      return [{ action, prompt }];
    })
    .slice(0, MAX_SLASH_COMMAND_RESULTS);
}

export function applyPromptSlashCommand(value: string, prompt: string): string {
  const slashCommand = parsePromptSlashCommand(value);
  if (slashCommand === null) {
    return value;
  }
  return prompt;
}
