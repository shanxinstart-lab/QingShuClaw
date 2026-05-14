import React, { useEffect, useMemo, useState } from 'react';

import { PetMode, PetSource, PetStatus } from '../../shared/pet/constants';
import type { PetCatalogEntry, PetRuntimeState } from '../../shared/pet/types';
import { i18nService } from '../services/i18n';
import { nextPetFrameIndex, resolveFramePosition, resolvePetAnimation } from './animation';
import { petService } from './petService';

type PetCompanionProps = {
  state: PetRuntimeState;
  variant?: 'embedded' | 'floating';
  className?: string;
};

const statusLabel = (status: PetStatus): string => {
  switch (status) {
    case PetStatus.Running:
      return i18nService.t('petStatusRunning');
    case PetStatus.Waiting:
      return i18nService.t('petStatusWaiting');
    case PetStatus.Review:
      return i18nService.t('petStatusReview');
    case PetStatus.Failed:
      return i18nService.t('petStatusFailed');
    case PetStatus.Idle:
    default:
      return i18nService.t('petStatusIdle');
  }
};

const canRenderEmbedded = (state: PetRuntimeState): boolean => (
  state.config.enabled
  && (state.config.mode === PetMode.Embedded || state.config.mode === PetMode.Both)
  && !!state.activePet?.manifest
);

const canToggleFloatingWindow = (state: PetRuntimeState): boolean => (
  state.config.mode === PetMode.Floating || state.config.mode === PetMode.Both
);

const sourceLabel = (pet: PetCatalogEntry): string => {
  if (pet.source === PetSource.Custom) return i18nService.t('petSourceCustom');
  if (pet.source === PetSource.LegacyAvatar) return i18nService.t('petSourceLegacyAvatar');
  if (pet.source === PetSource.CodexCustom) return i18nService.t('petSourceCodexCustom');
  if (pet.bundled) return i18nService.t('petSourceBuiltIn');
  return pet.installed ? i18nService.t('petSourceCached') : i18nService.t('petSourceOnDemand');
};

export const PetSprite: React.FC<{
  pet: PetCatalogEntry;
  status: PetStatus;
  animationsEnabled: boolean;
  size?: number;
}> = ({ pet, status, animationsEnabled, size = 84 }) => {
  const manifest = pet.manifest;
  const animation = useMemo(
    () => manifest ? resolvePetAnimation(manifest, status) : null,
    [manifest, status],
  );
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    setFrameIndex(0);
  }, [pet.id, status]);

  useEffect(() => {
    if (!animation || !animationsEnabled || animation.frames.length <= 1) return;
    const frame = animation.frames[frameIndex] ?? animation.frames[0];
    const timer = window.setTimeout(() => {
      setFrameIndex((current) => nextPetFrameIndex(animation, current));
    }, frame.durationMs);
    return () => window.clearTimeout(timer);
  }, [animation, animationsEnabled, frameIndex]);

  if (!manifest || !animation) return null;

  const frame = animation.frames[frameIndex] ?? animation.frames[0];
  const { row, column } = resolveFramePosition(frame.spriteIndex, manifest.frame.columns);
  const scale = size / manifest.frame.width;
  const sheetWidth = manifest.frame.width * manifest.frame.columns * scale;
  const sheetHeight = manifest.frame.height * manifest.frame.rows * scale;

  return (
    <div
      className="relative overflow-hidden"
      style={{ width: size, height: Math.round(manifest.frame.height * scale) }}
      aria-label={`${pet.displayName} ${statusLabel(status)}`}
    >
      <img
        src={`localfile://${encodeURI(manifest.spritesheetPath)}`}
        alt=""
        draggable={false}
        className="pointer-events-none select-none"
        style={{
          width: sheetWidth,
          height: sheetHeight,
          maxWidth: 'none',
          transform: `translate(${-column * size}px, ${-row * manifest.frame.height * scale}px)`,
          imageRendering: 'auto',
        }}
      />
    </div>
  );
};

const PetCompanion: React.FC<PetCompanionProps> = ({
  state,
  variant = 'embedded',
  className = '',
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionListCollapsed, setSessionListCollapsed] = useState(false);
  const [dragState, setDragState] = useState<{
    pointerId: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);
  const pet = state.activePet;
  const visible = variant === 'floating'
    ? state.config.enabled && !!pet?.manifest
    : canRenderEmbedded(state);

  const spriteSize = variant === 'floating' ? 104 : 72;
  const menuPositionClass = variant === 'floating' ? 'right-3 top-3' : 'right-0 bottom-full mb-2';
  const isFloating = variant === 'floating';
  const activeSessions = state.activeSessions;
  const hasActiveSessions = activeSessions.length > 0;
  const activeSessionCount = activeSessions.length;
  const bubbleTitle = state.session?.title ?? statusLabel(state.status);
  const bubbleMessage = state.message ?? statusLabel(state.status);
  const handlePetActivate = () => {
    if (isFloating) {
      void window.electron.pet.activateMainWindow();
      return;
    }
    setMenuOpen((open) => !open);
  };

  if (!visible || !pet) return null;

  const sprite = (
    <PetSprite
      pet={pet}
      status={state.status}
      animationsEnabled={state.config.animationsEnabled}
      size={spriteSize}
    />
  );

  const activateSession = (sessionId: string) => {
    void petService.acknowledgeSession(sessionId);
    void window.electron.pet.activateSession(sessionId);
  };

  const handleFloatingPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      lastX: event.screenX,
      lastY: event.screenY,
      moved: false,
    });
  };

  const handleFloatingPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const deltaX = event.screenX - dragState.lastX;
    const deltaY = event.screenY - dragState.lastY;
    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;
    setDragState({
      pointerId: event.pointerId,
      lastX: event.screenX,
      lastY: event.screenY,
      moved: dragState.moved || Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2,
    });
    void window.electron.pet.moveFloatingWindowBy({ deltaX, deltaY });
  };

  const handleFloatingPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const moved = dragState.moved;
    setDragState(null);
    void window.electron.pet.persistFloatingWindowPosition();
    if (!moved && !hasActiveSessions) {
      void window.electron.pet.activateMainWindow();
    }
  };

  return (
    <div className={`pet-companion relative ${variant === 'floating' ? 'h-screen w-screen app-drag' : ''} ${className}`}>
      {isFloating ? (
        <button
          type="button"
          className="pet-companion-trigger non-draggable m-3 inline-flex cursor-grab touch-none items-end border-0 bg-transparent p-0 text-left shadow-none transition active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onPointerDown={handleFloatingPointerDown}
          onPointerMove={handleFloatingPointerMove}
          onPointerUp={handleFloatingPointerUp}
          onPointerCancel={() => {
            setDragState(null);
            void window.electron.pet.persistFloatingWindowPosition();
          }}
          title={`${pet.displayName} - ${statusLabel(state.status)}`}
          aria-label={`${pet.displayName} - ${statusLabel(state.status)}`}
        >
          {sprite}
        </button>
      ) : (
        <button
          type="button"
          className="pet-companion-trigger non-draggable flex items-end gap-2 border-0 bg-transparent p-0 text-left shadow-none transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setMenuOpen((open) => !open)}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenuOpen(true);
          }}
          title={`${pet.displayName} - ${statusLabel(state.status)}`}
        >
          {sprite}
        </button>
      )}

      {isFloating && hasActiveSessions && (
        <div className="non-draggable absolute left-[90px] top-4 z-[70] flex w-[260px] flex-col overflow-hidden rounded-lg border border-border/70 bg-surface/95 p-1.5 text-left shadow-lg backdrop-blur">
          <div className="mb-1 flex h-6 items-center justify-between gap-2 px-1">
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-5 text-primary-foreground">
              {activeSessionCount}
            </span>
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded text-secondary transition hover:bg-surface-hover hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => setSessionListCollapsed((collapsed) => !collapsed)}
              title={sessionListCollapsed ? 'Show sessions' : 'Hide sessions'}
              aria-label={sessionListCollapsed ? 'Show sessions' : 'Hide sessions'}
            >
              <span className="text-[13px] leading-none">
                {sessionListCollapsed ? '+' : '-'}
              </span>
            </button>
          </div>
          {!sessionListCollapsed && (
            <div className="flex max-h-[154px] flex-col gap-1 overflow-hidden">
              {activeSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className="flex min-h-[44px] w-full min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => activateSession(session.id)}
                  title={session.message ?? session.title}
                >
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                    session.status === PetStatus.Waiting
                      ? 'bg-amber-500'
                      : session.status === PetStatus.Failed
                        ? 'bg-red-500'
                        : session.status === PetStatus.Review
                          ? 'bg-emerald-500'
                          : 'bg-primary'
                  } ${session.status === PetStatus.Running ? 'animate-pulse' : ''}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[11px] font-medium leading-tight text-foreground">
                        {session.title}
                      </span>
                      <span className="shrink-0 text-[9px] leading-tight text-secondary">
                        {session.progressLabel ?? statusLabel(session.status)}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-[10px] leading-snug text-secondary">
                      {session.message ?? statusLabel(session.status)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!isFloating && (state.status !== PetStatus.Idle || !!state.message || !!state.session) && (
        <button
          type="button"
          className={`non-draggable absolute z-[70] max-w-[220px] rounded-lg border border-border/70 bg-surface/95 px-3 py-2 text-left shadow-lg backdrop-blur transition hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isFloating ? 'left-[76px] top-5' : 'left-[58px] top-0'
          }`}
          onClick={handlePetActivate}
          title={bubbleMessage}
        >
          <span className="block truncate text-[11px] font-medium text-foreground">
            {bubbleTitle}
          </span>
          <span className="line-clamp-2 block text-[10px] leading-snug text-secondary">
            {bubbleMessage}
          </span>
        </button>
      )}

      {!isFloating && menuOpen && (
        <div className={`non-draggable absolute z-[80] w-56 rounded-lg border border-border bg-surface p-2 text-sm shadow-xl ${menuPositionClass}`}>
          <div className="mb-2 border-b border-border/70 pb-2">
            <div className="font-medium text-foreground">{pet.displayName}</div>
            <div className="text-xs text-secondary">{sourceLabel(pet)} · {statusLabel(state.status)}</div>
          </div>
          <button
            type="button"
            className="w-full rounded-md px-2 py-1.5 text-left text-foreground hover:bg-surface-hover"
            onClick={() => {
              setMenuOpen(false);
              void window.electron.pet.openSettings();
            }}
          >
            {i18nService.t('petOpenSettings')}
          </button>
          <button
            type="button"
            disabled={!canToggleFloatingWindow(state)}
            className="w-full rounded-md px-2 py-1.5 text-left text-foreground hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              setMenuOpen(false);
              void petService.setFloatingVisible(!state.config.floatingWindow.visible);
            }}
          >
            {state.config.floatingWindow.visible ? i18nService.t('petHideFloatingWindow') : i18nService.t('petShowFloatingWindow')}
          </button>
          <button
            type="button"
            className="w-full rounded-md px-2 py-1.5 text-left text-secondary hover:bg-surface-hover"
            onClick={() => {
              setMenuOpen(false);
              void petService.setConfig({ enabled: false });
            }}
          >
            {i18nService.t('petHide')}
          </button>
        </div>
      )}
    </div>
  );
};

export default PetCompanion;
