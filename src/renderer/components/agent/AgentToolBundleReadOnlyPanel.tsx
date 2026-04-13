import React from 'react';
import { EyeIcon } from '@heroicons/react/24/outline';
import { i18nService } from '../../services/i18n';

interface AgentToolBundleReadOnlyPanelProps {
  toolBundleIds: string[];
}

const AgentToolBundleReadOnlyPanel: React.FC<AgentToolBundleReadOnlyPanelProps> = ({
  toolBundleIds,
}) => {
  const normalizedBundleIds = Array.from(new Set(
    toolBundleIds
      .map((item) => item.trim())
      .filter(Boolean),
  )).sort();

  return (
    <div className="mb-3 rounded-xl border border-border bg-surface-raised/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold tracking-[0.14em] text-secondary uppercase">
            {i18nService.t('agentToolBundlesEyebrow')}
          </div>
          <div className="mt-1 text-sm font-medium text-foreground">
            {i18nService.t('agentToolBundlesTitle')}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2 py-1 text-[11px] font-medium text-sky-700 dark:text-sky-300">
          <EyeIcon className="h-3.5 w-3.5" />
          {i18nService.t('agentToolBundlesReadOnly')}
        </span>
      </div>

      <p className="mt-2 text-xs text-secondary">
        {i18nService.t('agentToolBundlesHint')}
      </p>

      <div className="mt-3 rounded-lg border border-border bg-surface px-3 py-3">
        {normalizedBundleIds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {normalizedBundleIds.map((bundleId) => (
              <span
                key={bundleId}
                className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground"
              >
                {bundleId}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-xs text-secondary">
            {i18nService.t('agentToolBundlesEmpty')}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentToolBundleReadOnlyPanel;
