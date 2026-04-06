import React from 'react';
import type { GuideSession } from '../../../../shared/desktopAssistant/constants';

interface GuideSceneListProps {
  guideSession: GuideSession;
}

export const GuideSceneList: React.FC<GuideSceneListProps> = ({ guideSession }) => {
  return (
    <div className="space-y-2">
      {guideSession.scenes.map((scene, index) => {
        const isActive = index === guideSession.currentSceneIndex;
        return (
          <div
            key={scene.id}
            className={`rounded-xl border px-3 py-2 ${
              isActive
                ? 'border-primary bg-primary/5'
                : 'border-border bg-background'
            }`}
          >
            <div className="text-sm font-medium text-foreground">{scene.title}</div>
            <div className="mt-1 text-xs text-secondary">{scene.summary}</div>
          </div>
        );
      })}
    </div>
  );
};
