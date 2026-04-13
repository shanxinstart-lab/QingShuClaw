import type {
  QingShuSharedToolCatalogSummary,
  QingShuSkillGovernanceBatchItem,
  QingShuGovernanceSkillItem,
  QingShuSkillGovernanceResult,
} from '../types/qingshuGovernance';

class QingShuGovernanceService {
  async analyzeSkillById(skillId: string): Promise<QingShuSkillGovernanceResult | null> {
    try {
      const result = await window.electron.skills.governance.analyzeById(skillId);
      if (result.success && result.result) {
        return result.result;
      }
      return null;
    } catch (error) {
      console.error('Failed to analyze skill governance by id:', error);
      return null;
    }
  }

  async analyzeSkillFiles(skillFilePaths: string[]): Promise<QingShuSkillGovernanceBatchItem[]> {
    try {
      const result = await window.electron.skills.governance.analyzeFiles(skillFilePaths);
      if (result.success && result.results) {
        return result.results;
      }
      return [];
    } catch (error) {
      console.error('Failed to analyze skill governance batch:', error);
      return [];
    }
  }

  async analyzeSkillIds(skillIds: string[]): Promise<QingShuGovernanceSkillItem[]> {
    const uniqueSkillIds = Array.from(new Set(skillIds.map((item) => item.trim()).filter(Boolean)));
    if (uniqueSkillIds.length === 0) {
      return [];
    }

    const results = await Promise.all(
      uniqueSkillIds.map(async (skillId) => ({
        skillId,
        governance: await this.analyzeSkillById(skillId),
      })),
    );

    return results.filter((item): item is QingShuGovernanceSkillItem => !!item.governance);
  }

  async getCatalogSummary(): Promise<QingShuSharedToolCatalogSummary | null> {
    try {
      const result = await window.electron.skills.governance.getCatalogSummary();
      if (result.success && result.summary) {
        return result.summary;
      }
      return null;
    } catch (error) {
      console.error('Failed to load skill governance catalog summary:', error);
      return null;
    }
  }
}

export const qingshuGovernanceService = new QingShuGovernanceService();
