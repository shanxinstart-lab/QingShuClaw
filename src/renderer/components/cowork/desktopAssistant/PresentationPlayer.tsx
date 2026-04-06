import React, { useMemo } from 'react';
import { PresentationPlaybackStatus, type PresentationDeck } from '../../../../shared/desktopAssistant/presentation';
import type { GuideSession } from '../../../../shared/desktopAssistant/constants';
import { buildPresentationRuntimeHtml } from './presentationRuntimeDocument';

interface PresentationPlayerProps {
  deck: PresentationDeck | null;
  guideSession: GuideSession | null;
}

export const PresentationPlayer: React.FC<PresentationPlayerProps> = ({
  deck,
  guideSession,
}) => {
  const srcDoc = useMemo(() => {
    if (!deck || !guideSession) {
      return '';
    }

    return buildPresentationRuntimeHtml({
      deck,
      currentSceneIndex: guideSession.currentSceneIndex,
      playbackStatus: guideSession.status === 'active'
        ? PresentationPlaybackStatus.Active
        : guideSession.status === 'paused'
          ? PresentationPlaybackStatus.Paused
          : PresentationPlaybackStatus.Stopped,
    });
  }, [deck, guideSession]);

  if (!deck || !guideSession || !srcDoc) {
    return null;
  }

  return (
    <div className="rounded-[28px] border border-border bg-background/70 p-3">
      <iframe
        title="desktop-assistant-presentation-player"
        srcDoc={srcDoc}
        sandbox=""
        className="h-[480px] w-full rounded-[22px] border border-border bg-white"
      />
    </div>
  );
};
