import React, { useEffect, useMemo, useRef, useState } from 'react';
import { i18nService } from '../../../services/i18n';
import type { GuideSession } from '../../../../shared/desktopAssistant/constants';
import { GuideStatus } from '../../../../shared/desktopAssistant/constants';
import {
  PresentationBridgeCommandType,
  PresentationBridgeEventType,
  PresentationBridgeMessageSource,
  PresentationBridgeVersion,
  type LinkedPresentationManifest,
  type PresentationBridgeCommand,
  type PresentationBridgeEvent,
} from '../../../../shared/desktopAssistant/presentationBridge';

interface GuideLinkedPreviewHostProps {
  guideSession: GuideSession;
  previewUrl: string;
  linkedManifest: LinkedPresentationManifest;
  onBridgeUnavailable: () => void;
}

const BRIDGE_READY_TIMEOUT_MS = 1500;

export const GuideLinkedPreviewHost: React.FC<GuideLinkedPreviewHostProps> = ({
  guideSession,
  previewUrl,
  linkedManifest,
  onBridgeUnavailable,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const bridgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bridgeUnavailableRef = useRef(false);
  const [bridgeReady, setBridgeReady] = useState(false);

  const currentSceneId = useMemo(() => {
    return linkedManifest.scenes[guideSession.currentSceneIndex]?.id
      || guideSession.scenes[guideSession.currentSceneIndex]?.id
      || null;
  }, [guideSession.currentSceneIndex, guideSession.scenes, linkedManifest.scenes]);

  const postBridgeCommand = (command: Omit<PresentationBridgeCommand, 'source' | 'version'>) => {
    const targetWindow = iframeRef.current?.contentWindow;
    if (!targetWindow) {
      return;
    }

    targetWindow.postMessage({
      source: PresentationBridgeMessageSource.Host,
      version: PresentationBridgeVersion.V1,
      ...command,
    } satisfies PresentationBridgeCommand, '*');
  };

  useEffect(() => {
    bridgeUnavailableRef.current = false;
    setBridgeReady(false);
  }, [previewUrl]);

  useEffect(() => {
    const handleBridgeMessage = (event: MessageEvent<PresentationBridgeEvent>) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const payload = event.data;
      if (!payload || payload.source !== PresentationBridgeMessageSource.Runtime || payload.version !== PresentationBridgeVersion.V1) {
        return;
      }

      if (payload.type === PresentationBridgeEventType.Ready) {
        if (bridgeTimeoutRef.current) {
          clearTimeout(bridgeTimeoutRef.current);
          bridgeTimeoutRef.current = null;
        }
        setBridgeReady(true);
        return;
      }

      if (payload.type === PresentationBridgeEventType.Error && !bridgeUnavailableRef.current) {
        bridgeUnavailableRef.current = true;
        onBridgeUnavailable();
      }
    };

    window.addEventListener('message', handleBridgeMessage);
    return () => {
      window.removeEventListener('message', handleBridgeMessage);
    };
  }, [onBridgeUnavailable]);

  useEffect(() => {
    return () => {
      if (bridgeTimeoutRef.current) {
        clearTimeout(bridgeTimeoutRef.current);
      }
    };
  }, []);

  const handleLoad = () => {
    setBridgeReady(false);
    bridgeUnavailableRef.current = false;
    if (bridgeTimeoutRef.current) {
      clearTimeout(bridgeTimeoutRef.current);
    }

    postBridgeCommand({
      type: PresentationBridgeCommandType.Handshake,
    });
    window.setTimeout(() => {
      postBridgeCommand({
        type: PresentationBridgeCommandType.Handshake,
      });
    }, 180);

    bridgeTimeoutRef.current = window.setTimeout(() => {
      if (!bridgeUnavailableRef.current) {
        bridgeUnavailableRef.current = true;
        onBridgeUnavailable();
      }
    }, BRIDGE_READY_TIMEOUT_MS);
  };

  useEffect(() => {
    if (!bridgeReady || !currentSceneId) {
      return;
    }

    postBridgeCommand({
      type: PresentationBridgeCommandType.GoToScene,
      sceneId: currentSceneId,
    });
    postBridgeCommand({
      type: PresentationBridgeCommandType.HighlightScene,
      sceneId: currentSceneId,
    });
  }, [bridgeReady, currentSceneId]);

  useEffect(() => {
    if (!bridgeReady) {
      return;
    }

    const playbackStatus = guideSession.status === GuideStatus.Active
      ? GuideStatus.Active
      : guideSession.status === GuideStatus.Paused
        ? GuideStatus.Paused
        : GuideStatus.Stopped;
    postBridgeCommand({
      type: PresentationBridgeCommandType.SetPlaybackStatus,
      playbackStatus,
    });
  }, [bridgeReady, guideSession.status]);

  return (
    <div className="overflow-hidden rounded-[28px] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,250,251,0.94))] shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${bridgeReady ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-secondary">
            {i18nService.t('desktopAssistantLinkedPreviewLabel')}
          </div>
        </div>
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-secondary/80">
          {i18nService.t('desktopAssistantGuideProgress', {
            current: String(guideSession.currentSceneIndex + 1),
            total: String(linkedManifest.scenes.length),
          })}
        </div>
      </div>
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.08),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,250,249,0.98))] p-3">
        <iframe
          ref={iframeRef}
          title="desktop-assistant-linked-preview"
          src={previewUrl}
          sandbox="allow-scripts"
          className="h-[520px] w-full rounded-[22px] border border-border/70 bg-white"
          onLoad={handleLoad}
        />
      </div>
    </div>
  );
};
