import type { QingShuObjectSourceType } from '@shared/qingshuManaged/constants';

// Skill type definition
export interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;       // Whether visible in popover
  isOfficial: boolean;    // "官方" badge
  isBuiltIn: boolean;     // Bundled with app, cannot be deleted
  updatedAt: number;      // Timestamp
  prompt: string;         // System prompt content
  skillPath: string;      // Absolute path to SKILL.md
  version?: string;       // Skill version from SKILL.md frontmatter
  sourceType?: QingShuObjectSourceType;
  readOnly?: boolean;
  backendSkillId?: string;
  backendAgentIds?: string[];
  packageUrl?: string;
  catalogVersion?: string;
  installedBy?: string;
  toolRefs?: string[];
  policyNote?: string;
  allowed?: boolean;
}

export interface WorkspaceSkillInstall {
  agentId: string;
  agentName: string;
  workspacePath: string;
  skillIds: string[];
}

export type LocalizedText = { en: string; zh: string };

export interface MarketTag {
  id: string;
  en: string;
  zh: string;
}

export interface LocalSkillInfo {
  id: string;
  name: string;
  description: string | LocalizedText;
  version: string;
}

export interface MarketplaceSkill {
  id: string;
  name: string;
  description: string | LocalizedText;
  tags?: string[];
  url: string;              // Download URL (.zip)
  version: string;
  source: {
    from: string;           // e.g. "Github"
    url: string;            // Source repo URL
    author?: string;        // Author name
  };
}
