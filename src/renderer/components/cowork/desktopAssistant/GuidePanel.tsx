import React from 'react';
import type { GuideSession } from '../../../../shared/desktopAssistant/constants';
import type { PresentationDeck } from '../../../../shared/desktopAssistant/presentation';
import type { LinkedPresentationManifest } from '../../../../shared/desktopAssistant/presentationBridge';
import { GuideControlPanel } from './GuideControlPanel';
import { GuideSceneList } from './GuideSceneList';
import { GuideLinkedPreviewHost } from './GuideLinkedPreviewHost';
import { PresentationPlayer } from './PresentationPlayer';

interface GuidePanelProps {
  guideSession: GuideSession | null;
  presentationDeck: PresentationDeck | null;
  linkedPreviewUrl?: string | null;
  linkedPresentationManifest?: LinkedPresentationManifest | null;
  onLinkedPreviewUnavailable: () => void;
  onPause: () => void;
  onResume: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onStop: () => void;
}

export const GuidePanel: React.FC<GuidePanelProps> = ({
  guideSession,
  presentationDeck,
  linkedPreviewUrl,
  linkedPresentationManifest,
  onLinkedPreviewUnavailable,
  onPause,
  onResume,
  onPrevious,
  onNext,
  onStop,
}) => {
  if (!guideSession) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-3">
      <div className="rounded-2xl border border-border bg-surface px-4 py-4 space-y-4">
        {linkedPreviewUrl && linkedPresentationManifest ? (
          <GuideLinkedPreviewHost
            guideSession={guideSession}
            previewUrl={linkedPreviewUrl}
            linkedManifest={linkedPresentationManifest}
            onBridgeUnavailable={onLinkedPreviewUnavailable}
          />
        ) : (
          <PresentationPlayer deck={presentationDeck} guideSession={guideSession} />
        )}
        <GuideControlPanel
          guideSession={guideSession}
          onPause={onPause}
          onResume={onResume}
          onPrevious={onPrevious}
          onNext={onNext}
          onStop={onStop}
        />
        <GuideSceneList guideSession={guideSession} />
      </div>
    </div>
  );
};
