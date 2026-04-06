import React from 'react';
import type { DesktopAssistantStatus } from '../../../../shared/desktopAssistant/constants';
import { i18nService } from '../../../services/i18n';

interface DesktopAssistantStatusBarProps {
  status: DesktopAssistantStatus;
}

export const DesktopAssistantStatusBar: React.FC<DesktopAssistantStatusBarProps> = ({ status }) => {
  if (!status.masterEnabled) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-3">
      <div className="rounded-2xl border border-border bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
              {i18nService.t('desktopAssistantTitle')}
            </div>
            <div className="mt-1 text-sm text-foreground">
              {i18nService.t(`desktopAssistantState_${status.state}`)}
            </div>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
            {status.guideSession ? i18nService.t('desktopAssistantGuideSessionActive') : i18nService.t('desktopAssistantGuideSessionIdle')}
          </span>
        </div>
        {status.lastError && (
          <div className="mt-2 text-xs text-red-500">
            {status.lastError}
          </div>
        )}
      </div>
    </div>
  );
};
