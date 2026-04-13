import { generateQingShuSharedToolContracts } from './contractGenerator';
import {
  parseQingShuSkillDependencies,
  readQingShuSkillDependencies,
} from './skillDependencies';
import { validateQingShuSkillDependencies } from './skillDependencyValidator';
import type {
  QingShuSharedToolCatalogSummary,
  QingShuSkillGovernanceResult,
} from './types';

const buildGovernanceResult = (
  dependencies = parseQingShuSkillDependencies(''),
  catalog: QingShuSharedToolCatalogSummary,
): QingShuSkillGovernanceResult => {
  return {
    dependencies,
    validation: validateQingShuSkillDependencies(dependencies.dependencies, catalog),
    catalog,
    contracts: generateQingShuSharedToolContracts(catalog),
  };
};

export const analyzeQingShuSkillGovernance = (
  rawSkillContent: string,
  catalog: QingShuSharedToolCatalogSummary,
): QingShuSkillGovernanceResult => {
  return buildGovernanceResult(
    parseQingShuSkillDependencies(rawSkillContent),
    catalog,
  );
};

export const readQingShuSkillGovernance = (
  skillFilePath: string,
  catalog: QingShuSharedToolCatalogSummary,
): QingShuSkillGovernanceResult => {
  return buildGovernanceResult(
    readQingShuSkillDependencies(skillFilePath),
    catalog,
  );
};
