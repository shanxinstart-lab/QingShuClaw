import React, { useEffect, useMemo, useState } from 'react';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { qingshuGovernanceService } from '../../services/qingshuGovernance';
import { i18nService } from '../../services/i18n';
import type { QingShuSharedToolCatalogSummary } from '../../types/qingshuGovernance';

interface AgentToolBundleDebugSelectorProps {
  selectedBundleIds: string[];
  baselineBundleIds?: string[];
  onChange: (bundleIds: string[]) => void;
}

const AgentToolBundleDebugSelector: React.FC<AgentToolBundleDebugSelectorProps> = ({
  selectedBundleIds,
  baselineBundleIds = [],
  onChange,
}) => {
  const [catalogSummary, setCatalogSummary] = useState<QingShuSharedToolCatalogSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void qingshuGovernanceService.getCatalogSummary().then((summary) => {
      if (!active) {
        return;
      }
      setCatalogSummary(summary);
      setLoading(false);
    }).catch(() => {
      if (!active) {
        return;
      }
      setCatalogSummary(null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const availableBundles = useMemo(
    () => (catalogSummary?.bundles ?? []).map((bundle) => bundle.bundle).sort(),
    [catalogSummary],
  );

  const normalizedSelection = useMemo(
    () => Array.from(new Set(selectedBundleIds.map((item) => item.trim()).filter(Boolean))).sort(),
    [selectedBundleIds],
  );
  const normalizedBaseline = useMemo(
    () => Array.from(new Set(baselineBundleIds.map((item) => item.trim()).filter(Boolean))).sort(),
    [baselineBundleIds],
  );
  const isDraftDirty = normalizedSelection.join('|') !== normalizedBaseline.join('|');

  const handleToggleBundle = (bundleId: string) => {
    if (normalizedSelection.includes(bundleId)) {
      onChange(normalizedSelection.filter((item) => item !== bundleId));
      return;
    }
    onChange([...normalizedSelection, bundleId].sort());
  };

  return (
    <div className="mb-3 rounded-xl border border-border bg-surface-raised/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.14em] text-secondary uppercase">
            {i18nService.t('agentToolBundlesDebugEyebrow')}
          </div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {i18nService.t('agentToolBundlesDebugTitle')}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
          <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
          {i18nService.t('agentToolBundlesDebugBadge')}
        </span>
      </div>

      <p className="mt-2 text-xs text-secondary">
        {i18nService.t('agentToolBundlesDebugHint')}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-secondary">
          {i18nService.t('agentToolBundlesSavedCount').replace('{count}', String(normalizedBaseline.length))}
        </span>
        <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-secondary">
          {i18nService.t('agentToolBundlesDraftCount').replace('{count}', String(normalizedSelection.length))}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
            isDraftDirty
              ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
              : 'bg-sky-500/12 text-sky-700 dark:text-sky-300'
          }`}
        >
          {isDraftDirty
            ? i18nService.t('agentToolBundlesDebugDraftDirty')
            : i18nService.t('agentToolBundlesDebugDraftSynced')}
        </span>
      </div>

      {loading ? (
        <div className="mt-3 text-xs text-secondary">
          {i18nService.t('agentToolBundlesDebugLoading')}
        </div>
      ) : availableBundles.length === 0 ? (
        <div className="mt-3 text-xs text-secondary">
          {i18nService.t('agentToolBundlesDebugEmpty')}
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {availableBundles.map((bundleId) => {
            const active = normalizedSelection.includes(bundleId);
            return (
              <button
                key={bundleId}
                type="button"
                onClick={() => handleToggleBundle(bundleId)}
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:bg-surface'
                }`}
              >
                {bundleId}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AgentToolBundleDebugSelector;
