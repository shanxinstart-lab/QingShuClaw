import {
  analyzeQingShuSkillGovernance,
  readQingShuSkillGovernance,
} from './skillGovernance';
import type {
  QingShuInstalledSkillGovernanceItem,
  QingShuSkillGovernanceBatchItem,
  QingShuGovernanceService,
  QingShuSharedToolCatalogSummary,
} from './types';

export type CreateQingShuGovernanceServiceDeps = {
  getSharedToolCatalogSummary: () => QingShuSharedToolCatalogSummary;
  resolveSkillPathById?: (skillId: string) => string | null;
  listInstalledSkills?: () => Array<{ id: string; skillPath: string }>;
};

export const createQingShuGovernanceService = (
  deps: CreateQingShuGovernanceServiceDeps,
): QingShuGovernanceService => {
  const getCatalogSummary = (): QingShuSharedToolCatalogSummary => deps.getSharedToolCatalogSummary();

  return {
    getSharedToolCatalogSummary(): QingShuSharedToolCatalogSummary {
      return getCatalogSummary();
    },

    analyzeSkillContent(rawSkillContent: string) {
      return analyzeQingShuSkillGovernance(rawSkillContent, getCatalogSummary());
    },

    analyzeSkillFile(skillFilePath: string) {
      return readQingShuSkillGovernance(skillFilePath, getCatalogSummary());
    },

    analyzeSkillFiles(skillFilePaths: string[]): QingShuSkillGovernanceBatchItem[] {
      return skillFilePaths.map((skillFilePath) => ({
        skillFilePath,
        governance: readQingShuSkillGovernance(skillFilePath, getCatalogSummary()),
      }));
    },

    analyzeInstalledSkills(): QingShuInstalledSkillGovernanceItem[] {
      return (deps.listInstalledSkills?.() ?? []).map((skill) => ({
        skillId: skill.id,
        skillFilePath: skill.skillPath,
        governance: readQingShuSkillGovernance(skill.skillPath, getCatalogSummary()),
      }));
    },

    analyzeSkillById(skillId: string) {
      const skillPath = deps.resolveSkillPathById?.(skillId) ?? null;
      if (!skillPath) {
        return null;
      }
      return readQingShuSkillGovernance(skillPath, getCatalogSummary());
    },
  };
};
