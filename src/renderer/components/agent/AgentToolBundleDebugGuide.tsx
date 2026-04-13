import React from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { i18nService } from '../../services/i18n';

const AgentToolBundleDebugGuide: React.FC = () => {
  return (
    <div className="mb-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
        <InformationCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {i18nService.t('agentToolBundlesGuideTitle')}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-primary/10 bg-background/70 px-2.5 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
                {i18nService.t('agentToolBundlesGuideEditorLabel')}
              </div>
              <div className="mt-1 text-xs text-secondary">
                {i18nService.t('agentToolBundlesGuideEditor')}
              </div>
            </div>
            <div className="rounded-lg border border-primary/10 bg-background/70 px-2.5 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
                {i18nService.t('agentToolBundlesGuideSavedLabel')}
              </div>
              <div className="mt-1 text-xs text-secondary">
                {i18nService.t('agentToolBundlesGuideSaved')}
              </div>
            </div>
            <div className="rounded-lg border border-primary/10 bg-background/70 px-2.5 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
                {i18nService.t('agentToolBundlesGuideDraftLabel')}
              </div>
              <div className="mt-1 text-xs text-secondary">
                {i18nService.t('agentToolBundlesGuideDraft')}
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-secondary">
            {i18nService.t('agentToolBundlesGuideGovernance')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentToolBundleDebugGuide;
