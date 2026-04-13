import React, { useEffect, useState } from 'react';
import { ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { qingshuGovernanceService } from '../../services/qingshuGovernance';
import { buildQingShuAgentGovernanceSummary } from '../../services/qingshuGovernanceSummary';
import { i18nService } from '../../services/i18n';
import type {
  QingShuAgentGovernanceSummary,
  QingShuGovernanceSkillItem,
} from '../../types/qingshuGovernance';

interface AgentSkillGovernancePreviewProps {
  skillIds: string[];
  toolBundleIds?: string[];
  usesAllEnabledSkills?: boolean;
}

const AgentSkillGovernancePreview: React.FC<AgentSkillGovernancePreviewProps> = ({
  skillIds,
  toolBundleIds = [],
  usesAllEnabledSkills = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<QingShuGovernanceSkillItem[]>([]);
  const [summary, setSummary] = useState<QingShuAgentGovernanceSummary>(() => (
    buildQingShuAgentGovernanceSummary([], toolBundleIds)
  ));

  useEffect(() => {
    let active = true;
    const normalizedSkillIds = Array.from(new Set(skillIds.map((item) => item.trim()).filter(Boolean)));
    if (normalizedSkillIds.length === 0) {
      setItems([]);
      setSummary(buildQingShuAgentGovernanceSummary([], toolBundleIds));
      setLoading(false);
      return;
    }

    setLoading(true);
    void qingshuGovernanceService.analyzeSkillIds(normalizedSkillIds).then((results) => {
      if (!active) {
        return;
      }
      setItems(results);
      setSummary(buildQingShuAgentGovernanceSummary(results, toolBundleIds));
      setLoading(false);
    }).catch(() => {
      if (!active) {
        return;
      }
      setItems([]);
      setSummary(buildQingShuAgentGovernanceSummary([], toolBundleIds));
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [skillIds, toolBundleIds]);

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-raised/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.14em] text-secondary uppercase">
            {i18nService.t('agentSkillGovernanceEyebrow')}
          </div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {i18nService.t('agentSkillGovernanceTitle')}
          </div>
        </div>
        {summary.missingBundles.length > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
            {i18nService.t('agentSkillGovernanceMissingBundles')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2 py-1 text-[11px] font-medium text-sky-700 dark:text-sky-300">
            <InformationCircleIcon className="h-3.5 w-3.5" />
            {i18nService.t('agentSkillGovernanceReadOnly')}
          </span>
        )}
      </div>

      <p className="mt-2 text-xs text-secondary">
        {usesAllEnabledSkills
          ? i18nService.t('agentSkillGovernanceAllEnabledHint')
          : i18nService.t('agentSkillGovernanceSelectedHint')}
      </p>

      {loading ? (
        <div className="mt-3 text-xs text-secondary">
          {i18nService.t('agentSkillGovernanceLoading')}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-3 text-xs text-secondary">
          {i18nService.t('agentSkillGovernanceEmpty')}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-surface px-3 py-2">
              <div className="text-[11px] text-secondary">{i18nService.t('agentSkillGovernanceSkills')}</div>
              <div className="mt-1 text-sm font-medium text-foreground">{summary.analyzedSkillCount}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface px-3 py-2">
              <div className="text-[11px] text-secondary">{i18nService.t('agentSkillGovernanceDeclaredSkills')}</div>
              <div className="mt-1 text-sm font-medium text-foreground">{summary.declaredSkillCount}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface px-3 py-2">
              <div className="text-[11px] text-secondary">{i18nService.t('agentSkillGovernanceIssues')}</div>
              <div className="mt-1 text-sm font-medium text-foreground">{summary.issueCount}</div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface px-3 py-3 text-xs">
            <div className="text-secondary">{i18nService.t('agentSkillGovernanceRequiredBundles')}</div>
            <div className="mt-1 text-foreground break-all">
              {summary.requiredBundles.join(', ') || i18nService.t('skillGovernancePreviewNone')}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface px-3 py-3 text-xs">
            <div className="text-secondary">{i18nService.t('agentSkillGovernanceCurrentBundles')}</div>
            <div className="mt-1 text-foreground break-all">
              {summary.currentBundles.join(', ') || i18nService.t('skillGovernancePreviewNone')}
            </div>
          </div>

          {summary.missingBundles.length > 0 ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs text-amber-800 dark:text-amber-200">
              <div className="font-medium">{i18nService.t('agentSkillGovernanceMissingBundlesTitle')}</div>
              <div className="mt-1 break-all">{summary.missingBundles.join(', ')}</div>
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-surface px-3 py-3 text-xs">
            <div className="text-secondary">{i18nService.t('agentSkillGovernanceToolRefs')}</div>
            <div className="mt-1 text-foreground break-all">
              {summary.declaredToolRefs.join(', ') || i18nService.t('skillGovernancePreviewNone')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentSkillGovernancePreview;
