import React from 'react';
import type { GuideSession } from '../../../../shared/desktopAssistant/constants';
import { i18nService } from '../../../services/i18n';

interface GuideFloatingDockProps {
  guideSession: GuideSession | null;
  onPause: () => void;
  onResume: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onReplay: () => void;
  onStop: () => void;
}

export const GuideFloatingDock: React.FC<GuideFloatingDockProps> = ({
  guideSession,
  onPause,
  onResume,
  onPrevious,
  onNext,
  onReplay,
  onStop,
}) => {
  if (!guideSession) {
    return null;
  }

  const currentScene = guideSession.scenes[guideSession.currentSceneIndex];
  const progressLabel = i18nService.t('desktopAssistantGuideProgress')
    .replace('{current}', String(guideSession.currentSceneIndex + 1))
    .replace('{total}', String(guideSession.scenes.length));

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 w-[min(920px,calc(100%-2rem))] -translate-x-1/2">
      <div className="pointer-events-auto rounded-2xl border border-border bg-background/92 px-4 py-3 shadow-[0_20px_60px_rgba(15,23,42,0.16)] backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              {i18nService.t('desktopAssistantGuideDockTitle')}
            </div>
            <div className="mt-1 truncate text-sm font-medium text-foreground">
              {currentScene?.title || i18nService.t('desktopAssistantGuideSessionActive')}
            </div>
            <div className="mt-1 text-xs text-secondary">
              {progressLabel}
            </div>
          </div>
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
            <button type="button" onClick={onReplay} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-raised">
              {i18nService.t('desktopAssistantReplayScene')}
            </button>
            <button type="button" onClick={onStop} className="rounded-lg border border-border px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10">
              {i18nService.t('desktopAssistantStopGuide')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
