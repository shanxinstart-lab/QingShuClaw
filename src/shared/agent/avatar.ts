export const AgentAvatarIconFormat = {
  Designed: 'agent-avatar',
} as const;

export type AgentAvatarIconFormat = typeof AgentAvatarIconFormat[keyof typeof AgentAvatarIconFormat];

export const AgentAvatarIconSeparator = {
  Value: ':',
} as const;

export const AgentAvatarColor = {
  Ink: 'ink',
  Coral: 'coral',
  Orange: 'orange',
  Amber: 'amber',
  Green: 'green',
  Blue: 'blue',
  Violet: 'violet',
  Pink: 'pink',
} as const;

export type AgentAvatarColor = typeof AgentAvatarColor[keyof typeof AgentAvatarColor];

export const AgentAvatarGlyph = {
  Folder: 'folder',
  Finance: 'finance',
  Book: 'book',
  Education: 'education',
  Writing: 'writing',
  Design: 'design',
  Code: 'code',
  Terminal: 'terminal',
  Music: 'music',
  Media: 'media',
  Art: 'art',
  Operations: 'operations',
  Research: 'research',
  Automation: 'automation',
  Growth: 'growth',
  Business: 'business',
  Analytics: 'analytics',
  Support: 'support',
  Training: 'training',
  Notes: 'notes',
  Legal: 'legal',
  Voice: 'voice',
  Travel: 'travel',
  Global: 'global',
  Tools: 'tools',
  Science: 'science',
  Memory: 'memory',
  Care: 'care',
  Gift: 'gift',
  Launch: 'launch',
} as const;

export type AgentAvatarGlyph = typeof AgentAvatarGlyph[keyof typeof AgentAvatarGlyph];

export interface DesignedAgentAvatar {
  color: AgentAvatarColor;
  glyph: AgentAvatarGlyph;
}

const AGENT_AVATAR_PART_COUNT = 3;

const AGENT_AVATAR_COLORS = new Set<string>(Object.values(AgentAvatarColor));
const AGENT_AVATAR_GLYPHS = new Set<string>(Object.values(AgentAvatarGlyph));

export const DefaultAgentAvatar = {
  color: AgentAvatarColor.Ink,
  glyph: AgentAvatarGlyph.Folder,
} as const satisfies DesignedAgentAvatar;

export const isAgentAvatarColor = (value: string): value is AgentAvatarColor => {
  return AGENT_AVATAR_COLORS.has(value);
};

export const isAgentAvatarGlyph = (value: string): value is AgentAvatarGlyph => {
  return AGENT_AVATAR_GLYPHS.has(value);
};

export const encodeAgentAvatarIcon = (avatar: DesignedAgentAvatar): string => {
  return [
    AgentAvatarIconFormat.Designed,
    avatar.color,
    avatar.glyph,
  ].join(AgentAvatarIconSeparator.Value);
};

export const DefaultAgentAvatarIcon = encodeAgentAvatarIcon(DefaultAgentAvatar);

export const parseAgentAvatarIcon = (value: string | null | undefined): DesignedAgentAvatar | null => {
  const normalized = value?.trim() ?? '';
  if (!normalized) return null;

  const parts = normalized.split(AgentAvatarIconSeparator.Value);
  if (parts.length !== AGENT_AVATAR_PART_COUNT) return null;

  const [format, color, glyph] = parts;
  if (format !== AgentAvatarIconFormat.Designed) return null;
  if (!isAgentAvatarColor(color) || !isAgentAvatarGlyph(glyph)) return null;

  return { color, glyph };
};

export const isDesignedAgentAvatarIcon = (value: string | null | undefined): boolean => {
  return parseAgentAvatarIcon(value) !== null;
};
