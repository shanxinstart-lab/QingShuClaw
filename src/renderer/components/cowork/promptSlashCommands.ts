import type { McpServerConfig } from '../../types/mcp';
import type { LocalizedPrompt, LocalizedQuickAction } from '../../types/quickAction';
import type { Skill } from '../../types/skill';

const MAX_SLASH_COMMAND_RESULTS = 8;

export const PromptSlashCommandKind = {
  Builtin: 'builtin',
  Skill: 'skill',
  McpServer: 'mcp_server',
  QuickActionPrompt: 'quick_action_prompt',
} as const;

export type PromptSlashCommandKind =
  typeof PromptSlashCommandKind[keyof typeof PromptSlashCommandKind];

export const PromptBuiltinSlashCommandId = {
  NewSession: 'new',
  ClearInput: 'clear',
  ManageSkills: 'skills',
  HelpPrompt: 'help',
} as const;

export type PromptBuiltinSlashCommandId =
  typeof PromptBuiltinSlashCommandId[keyof typeof PromptBuiltinSlashCommandId];

export type PromptBuiltinSlashCommand = {
  kind: typeof PromptSlashCommandKind.Builtin;
  id: PromptBuiltinSlashCommandId;
  label: string;
  description?: string;
  aliases?: string[];
};

export type PromptQuickActionSlashCommandMatch = {
  kind: typeof PromptSlashCommandKind.QuickActionPrompt;
  action: LocalizedQuickAction;
  prompt: LocalizedPrompt;
};

export type PromptSkillSlashCommandMatch = {
  kind: typeof PromptSlashCommandKind.Skill;
  skill: Skill;
};

export type PromptMcpServerSlashCommandMatch = {
  kind: typeof PromptSlashCommandKind.McpServer;
  server: McpServerConfig;
};

export type PromptSlashCommandMatch =
  | PromptBuiltinSlashCommand
  | PromptSkillSlashCommandMatch
  | PromptMcpServerSlashCommandMatch
  | PromptQuickActionSlashCommandMatch;

export type PromptSlashCommandSources = {
  builtinCommands?: PromptBuiltinSlashCommand[];
  skills?: Skill[];
  mcpServers?: McpServerConfig[];
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

function commandMatchesQuery(command: PromptBuiltinSlashCommand, query: string): boolean {
  if (!query) return true;
  const searchableText = [
    command.id,
    command.label,
    command.description,
    ...(command.aliases ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return searchableText.includes(query);
}

function textMatchesQuery(parts: Array<string | undefined>, query: string): boolean {
  if (!query) return true;
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query);
}

export function getBuiltinPromptSlashCommands(labels: {
  newSession: string;
  newSessionDescription?: string;
  clearInput: string;
  clearInputDescription?: string;
  manageSkills: string;
  manageSkillsDescription?: string;
  helpPrompt: string;
  helpPromptDescription?: string;
}): PromptBuiltinSlashCommand[] {
  return [
    {
      kind: PromptSlashCommandKind.Builtin,
      id: PromptBuiltinSlashCommandId.NewSession,
      label: labels.newSession,
      description: labels.newSessionDescription,
      aliases: ['new', 'session', 'chat', 'conversation', '新建', '会话'],
    },
    {
      kind: PromptSlashCommandKind.Builtin,
      id: PromptBuiltinSlashCommandId.ClearInput,
      label: labels.clearInput,
      description: labels.clearInputDescription,
      aliases: ['clear', 'reset', '清空', '重置'],
    },
    {
      kind: PromptSlashCommandKind.Builtin,
      id: PromptBuiltinSlashCommandId.ManageSkills,
      label: labels.manageSkills,
      description: labels.manageSkillsDescription,
      aliases: ['skills', 'skill', '技能'],
    },
    {
      kind: PromptSlashCommandKind.Builtin,
      id: PromptBuiltinSlashCommandId.HelpPrompt,
      label: labels.helpPrompt,
      description: labels.helpPromptDescription,
      aliases: ['help', 'plan', 'next', '帮助', '规划'],
    },
  ];
}

export function filterPromptSlashCommands(
  actions: LocalizedQuickAction[],
  value: string,
  sources: PromptSlashCommandSources | PromptBuiltinSlashCommand[] = {},
): PromptSlashCommandMatch[] {
  const query = parsePromptSlashCommand(value);
  if (query === null) {
    return [];
  }

  const normalizedSources = Array.isArray(sources)
    ? { builtinCommands: sources }
    : sources;
  const {
    builtinCommands = [],
    skills = [],
    mcpServers = [],
  } = normalizedSources;
  const builtinMatches = builtinCommands.filter((command) => commandMatchesQuery(command, query));
  const skillMatches = skills
    .filter((skill) => skill.allowed !== false)
    .filter((skill) => textMatchesQuery([
      skill.id,
      skill.name,
      skill.description,
      skill.version,
      skill.sourceType,
      skill.backendSkillId,
      ...(skill.toolRefs ?? []),
    ], query))
    .map((skill): PromptSlashCommandMatch => ({ kind: PromptSlashCommandKind.Skill, skill }));
  const mcpMatches = mcpServers
    .filter((server) => server.enabled)
    .filter((server) => textMatchesQuery([
      server.id,
      server.name,
      server.description,
      server.registryId,
      server.transportType,
      server.command,
      server.url,
      server.githubUrl,
      ...(server.args ?? []),
    ], query))
    .map((server): PromptSlashCommandMatch => ({ kind: PromptSlashCommandKind.McpServer, server }));
  const actionMatches = actions
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
      return [{ kind: PromptSlashCommandKind.QuickActionPrompt, action, prompt }];
    });

  return [...builtinMatches, ...skillMatches, ...mcpMatches, ...actionMatches].slice(0, MAX_SLASH_COMMAND_RESULTS);
}

export function applyPromptSlashCommand(value: string, prompt: string): string {
  const slashCommand = parsePromptSlashCommand(value);
  if (slashCommand === null) {
    return value;
  }
  return prompt;
}
