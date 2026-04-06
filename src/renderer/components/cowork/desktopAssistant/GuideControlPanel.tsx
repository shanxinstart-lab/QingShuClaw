import React from 'react';
import type { GuideSession } from '../../../../shared/desktopAssistant/constants';
import { i18nService } from '../../../services/i18n';

interface GuideControlPanelProps {
  guideSession: GuideSession;
  onPause: () => void;
  onResume: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onStop: () => void;
}

export const GuideControlPanel: React.FC<GuideControlPanelProps> = ({
  guideSession,
  onPause,
  onResume,
  onPrevious,
  onNext,
  onStop,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {guideSession.status === 'active' ? (
        <button type="button" onClick={onPause} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-raised">
          {i18nService.t('desktopAssistantPauseGuide')}
        </button>
      ) : (
        <button type="button" onClick={onResume} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-raised">
          {i18nService.t('desktopAssistantResumeGuide')}
        </button>
      )}
      <button type="button" onClick={onPrevious} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-raised">
        {i18nService.t('desktopAssistantPreviousScene')}
      </button>
      <button type="button" onClick={onNext} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-raised">
        {i18nService.t('desktopAssistantNextScene')}
      </button>
      <button type="button" onClick={onStop} className="rounded-lg border border-border px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10">
        {i18nService.t('desktopAssistantStopGuide')}
      </button>
    </div>
  );
};
