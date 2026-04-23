export const SkillImportSourceType = {
  GitHub: 'github',
  ClawHub: 'clawhub',
} as const;

export type SkillImportSourceType =
  typeof SkillImportSourceType[keyof typeof SkillImportSourceType];

export function validateSkillImportSource(
  source: string,
  sourceType: SkillImportSourceType,
): 'importSourceMismatchClawhub' | 'importSourceMismatchGithub' | null {
  const trimmedSource = source.trim();
  if (!trimmedSource) {
    return null;
  }

  try {
    const url = new URL(trimmedSource);
    const host = url.hostname.toLowerCase();
    if (sourceType === SkillImportSourceType.ClawHub) {
      return host === 'clawhub.ai' || host === 'www.clawhub.ai'
        ? null
        : 'importSourceMismatchClawhub';
    }

    return host.includes('github.com') || host.includes('github.io')
      ? null
      : 'importSourceMismatchGithub';
  } catch {
    return sourceType === SkillImportSourceType.ClawHub
      ? 'importSourceMismatchClawhub'
      : null;
  }
}
