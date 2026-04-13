import React, { useEffect, useMemo, useState } from 'react';
import { ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import {
  buildQingShuAgentGovernanceSummary,
  loadQingShuAgentGovernanceSummary,
} from '../../services/qingshuGovernanceSummary';
import { i18nService } from '../../services/i18n';
import type { QingShuAgentGovernanceSummary } from '../../types/qingshuGovernance';

interface AgentToolBundleCompatibilityHintProps {
  skillIds: string[];
  toolBundleIds: string[];
  usesAllEnabledSkills?: boolean;
}

const AgentToolBundleCompatibilityHint: React.FC<AgentToolBundleCompatibilityHintProps> = ({
  skillIds,
  toolBundleIds,
  usesAllEnabledSkills = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<QingShuAgentGovernanceSummary>(() => (
    buildQingShuAgentGovernanceSummary([], toolBundleIds)
  ));

  useEffect(() => {
    let active = true;
    const normalizedSkillIds = Array.from(new Set(skillIds.map((item) => item.trim()).filter(Boolean)));
    if (normalizedSkillIds.length === 0) {
      setSummary(buildQingShuAgentGovernanceSummary([], toolBundleIds));
      setLoading(false);
      return;
    }

    setLoading(true);
    void loadQingShuAgentGovernanceSummary(normalizedSkillIds, toolBundleIds).then((nextSummary) => {
      if (!active) {
        return;
      }
      setSummary(nextSummary);
      setLoading(false);
    }).catch(() => {
      if (!active) {
        return;
      }
      setSummary(buildQingShuAgentGovernanceSummary([], toolBundleIds));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [skillIds, toolBundleIds]);

  const tone = useMemo(() => {
    if (summary.missingBundles.length > 0) {
      return 'warn';
    }
    return 'info';
  }, [summary.missingBundles.length]);

  if (loading) {
    return (
      <div className="mb-3 rounded-xl border border-border bg-surface-raised/60 px-3 py-3 text-xs text-secondary">
        {i18nService.t('agentToolBundlesCompatibilityLoading')}
      </div>
    );
  }

  if (summary.analyzedSkillCount === 0) {
    return (
      <div className="mb-3 rounded-xl border border-border bg-surface-raised/60 px-3 py-3 text-xs text-secondary">
        {usesAllEnabledSkills
          ? i18nService.t('agentToolBundlesCompatibilityAllSkillsEmpty')
          : i18nService.t('agentToolBundlesCompatibilityEmpty')}
      </div>
    );
  }

  return (
    <div
      className={`mb-3 rounded-xl border px-3 py-3 ${
        tone === 'warn'
          ? 'border-amber-500/20 bg-amber-500/10'
          : 'border-sky-500/20 bg-sky-500/8'
      }`}
    >
      <div className="flex items-start gap-2">
        {tone === 'warn' ? (
          <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-300" />
        ) : (
          <InformationCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-600 dark:text-sky-300" />
        )}
        <div className="min-w-0">
          <div className={`text-sm font-medium ${
            tone === 'warn'
              ? 'text-amber-800 dark:text-amber-200'
              : 'text-sky-800 dark:text-sky-200'
          }`}>
            {tone === 'warn'
              ? i18nService.t('agentToolBundlesCompatibilityWarningTitle')
              : i18nService.t('agentToolBundlesCompatibilityOkTitle')}
          </div>
          <div className={`mt-1 text-xs ${
            tone === 'warn'
              ? 'text-amber-800/90 dark:text-amber-100/90'
              : 'text-sky-800/90 dark:text-sky-100/90'
          }`}>
            {tone === 'warn'
              ? i18nService.t('agentToolBundlesCompatibilityWarningBody')
                .replace('{bundles}', summary.missingBundles.join(', '))
              : i18nService.t('agentToolBundlesCompatibilityOkBody')}
          </div>
          <div className="mt-2 text-[11px] text-secondary">
            {i18nService.t('agentToolBundlesCompatibilityMeta')
              .replace('{skills}', String(summary.analyzedSkillCount))
              .replace('{declared}', String(summary.declaredSkillCount))
              .replace('{required}', String(summary.requiredBundles.length))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentToolBundleCompatibilityHint;
