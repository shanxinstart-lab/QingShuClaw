import {
  ArrowPathIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  MinusIcon,
  PaperAirplaneIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import React, { useEffect, useMemo, useState } from 'react';

import { PetMode, PetSource, PetStatus } from '../../shared/pet/constants';
import type { PetCatalogEntry, PetRuntimeSession, PetRuntimeState } from '../../shared/pet/types';
import { i18nService } from '../services/i18n';
import {
  nextPetFrameIndex,
  PetInteractionState,
  resolveFramePosition,
  resolvePetAnimation,
} from './animation';
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

const sessionStatusDotClass = (status: PetStatus): string => {
  switch (status) {
    case PetStatus.Waiting:
      return 'bg-orange-500 text-white';
    case PetStatus.Review:
      return 'bg-green-500 text-white';
    case PetStatus.Failed:
      return 'bg-red-500 text-white';
    case PetStatus.Running:
      return 'bg-blue-500 text-white';
    case PetStatus.Idle:
    default:
      return 'bg-neutral-300 text-neutral-800';
  }
};

const sessionStatusIcon = (status: PetStatus): React.ReactNode => {
  switch (status) {
    case PetStatus.Waiting:
      return <ClockIcon className="h-3.5 w-3.5" />;
    case PetStatus.Review:
      return <CheckCircleIcon className="h-3.5 w-3.5" />;
    case PetStatus.Failed:
      return <ExclamationTriangleIcon className="h-3.5 w-3.5" />;
    case PetStatus.Running:
      return <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />;
    case PetStatus.Idle:
    default:
      return null;
  }
};

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
  interaction?: PetInteractionState;
  animationKey?: string | null;
  size?: number;
}> = ({ pet, status, animationsEnabled, interaction = PetInteractionState.None, animationKey = null, size = 84 }) => {
  const manifest = pet.manifest;
  const animation = useMemo(
    () => manifest ? resolvePetAnimation(manifest, status, interaction) : null,
    [manifest, status, interaction],
  );
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    setFrameIndex(0);
  }, [pet.id, status, interaction, animationKey]);

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

type PetMenuProps = {
  pet: PetCatalogEntry;
  state: PetRuntimeState;
  isFloating: boolean;
  positionClass: string;
  onClosePet: () => void;
  onDismiss: () => void;
};

export const PetMenu: React.FC<PetMenuProps> = ({
  pet,
  state,
  isFloating,
  positionClass,
  onClosePet,
  onDismiss,
}) => (
  <div className={`non-draggable absolute z-[80] w-56 rounded-lg border border-border bg-surface p-2 text-sm shadow-xl ${positionClass}`}>
    <div className="mb-2 border-b border-border/70 pb-2">
      <div className="font-medium text-foreground">{pet.displayName}</div>
      <div className="text-xs text-secondary">{sourceLabel(pet)} · {statusLabel(state.status)}</div>
    </div>
    {isFloating ? (
      <button
        type="button"
        className="w-full rounded-md px-2 py-1.5 text-left text-foreground hover:bg-surface-hover"
        onClick={onClosePet}
      >
        {i18nService.t('petClose')}
      </button>
    ) : (
      <>
        <button
          type="button"
          className="w-full rounded-md px-2 py-1.5 text-left text-foreground hover:bg-surface-hover"
          onClick={() => {
            onDismiss();
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
            onDismiss();
            void petService.setFloatingVisible(!state.config.floatingWindow.visible);
          }}
        >
          {state.config.floatingWindow.visible ? i18nService.t('petHideFloatingWindow') : i18nService.t('petShowFloatingWindow')}
        </button>
        <button
          type="button"
          className="w-full rounded-md px-2 py-1.5 text-left text-secondary hover:bg-surface-hover"
          onClick={() => {
            onDismiss();
            void petService.setConfig({ enabled: false });
          }}
        >
          {i18nService.t('petHide')}
        </button>
      </>
    )}
  </div>
);

type PetSessionNotificationProps = {
  session: PetRuntimeSession;
  collapsed: boolean;
  onActivate: (sessionId: string) => void;
  onClose: (event: React.MouseEvent<HTMLButtonElement>, sessionId: string) => void;
  onToggleExpanded: (event: React.MouseEvent<HTMLButtonElement>, sessionId: string) => void;
};

export const PetSessionNotification: React.FC<PetSessionNotificationProps> = ({
  session,
  collapsed,
  onActivate,
  onClose,
  onToggleExpanded,
}) => {
  const canExpand = !!session.message && session.message.length > 96;

  return (
    <div
      className="group relative w-full snap-start scroll-mt-2 text-left"
      role="listitem"
    >
      <div className="relative z-[1] overflow-hidden rounded-[18px] border border-neutral-200 bg-white text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.42),inset_0_-1px_0_rgba(0,0,0,0.08),0_14px_30px_-20px_rgba(0,0,0,0.4)] transition-[background-color,border-color,box-shadow] duration-200 ease-out hover:border-neutral-300 hover:bg-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.52),inset_0_-1px_0_rgba(0,0,0,0.1),0_18px_38px_-22px_rgba(0,0,0,0.48)]">
        <button
          type="button"
          className="block w-full min-w-0 cursor-pointer px-3 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          onClick={() => onActivate(session.id)}
          title={session.message ?? session.title}
          aria-label={`${session.title}. ${session.message ?? statusLabel(session.status)}`}
        >
          <span className="flex min-w-0 items-center pr-7">
            <span className="min-w-0 truncate text-[13px] font-semibold leading-[17px] text-black">
              {session.title}
            </span>
          </span>
          <span className={`${collapsed ? 'line-clamp-2' : 'line-clamp-3'} mt-0.5 block overflow-hidden text-[12px] leading-4 text-neutral-800`}>
            {session.message ?? session.progressLabel ?? statusLabel(session.status)}
          </span>
        </button>
        <span className={`pointer-events-none absolute right-1 top-1 z-0 flex h-6 w-6 items-center justify-center rounded-full ${sessionStatusDotClass(session.status)}`}>
          {sessionStatusIcon(session.status)}
        </span>
        {canExpand && (
          <button
            type="button"
            className="absolute right-1 top-1 z-10 flex h-6 w-6 translate-x-1 items-center justify-center rounded-full bg-white text-neutral-600 opacity-0 shadow-sm ring-1 ring-neutral-200 transition hover:bg-neutral-100 hover:text-black focus:translate-x-0 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100"
            onClick={(event) => onToggleExpanded(event, session.id)}
            title={collapsed ? i18nService.t('petExpandSession') : i18nService.t('petCollapseSession')}
            aria-expanded={!collapsed}
            aria-label={collapsed ? i18nService.t('petExpandSession') : i18nService.t('petCollapseSession')}
          >
            <ChevronRightIcon className={`h-3.5 w-3.5 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
          </button>
        )}
        <button
          type="button"
          className="absolute left-1 top-1 z-20 flex h-6 w-6 -translate-x-1 items-center justify-center rounded-full bg-white text-neutral-500 opacity-0 shadow-sm ring-1 ring-neutral-200 transition hover:bg-neutral-100 hover:text-black focus:translate-x-0 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100"
          onClick={(event) => onClose(event, session.id)}
          title={i18nService.t('petCloseSession')}
          aria-label={i18nService.t('petCloseSession')}
        >
          <XMarkIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="absolute bottom-1 right-2 z-10 flex h-5 translate-x-1 items-center gap-1 rounded-full bg-white px-2 text-[11px] font-medium leading-none text-neutral-800 opacity-0 shadow-[0px_5px_10px_-7px_rgba(0,0,0,0.22)] ring-1 ring-neutral-200 transition hover:bg-neutral-100 focus:translate-x-0 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            onActivate(session.id);
          }}
          title={i18nService.t('petReplyInSession')}
          aria-label={i18nService.t('petReplyInSession')}
        >
          <PaperAirplaneIcon className="h-3 w-3" />
          {i18nService.t('petReplyInSession')}
        </button>
      </div>
    </div>
  );
};

const PetCompanion: React.FC<PetCompanionProps> = ({
  state,
  variant = 'embedded',
  className = '',
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [petHovered, setPetHovered] = useState(false);
  const [activityTrayOpen, setActivityTrayOpen] = useState(true);
  const [collapsedSessionIds, setCollapsedSessionIds] = useState<Record<string, boolean>>({});
  const [dragState, setDragState] = useState<{
    pointerId: number;
    lastX: number;
    lastY: number;
    moved: boolean;
    direction: 'left' | 'right' | null;
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
  const primarySessionStatus = activeSessions[0]?.status ?? PetStatus.Idle;
  const spriteAnimationKey = [
    state.session?.id ?? 'none',
    state.message ?? '',
    activeSessions.map((session) => `${session.id}:${session.status}:${session.updatedAt}`).join('|'),
  ].join(':');
  const bubbleTitle = state.session?.title ?? statusLabel(state.status);
  const bubbleMessage = state.message ?? statusLabel(state.status);
  const handlePetActivate = () => {
    if (isFloating) {
      if (hasActiveSessions) {
        setActivityTrayOpen((open) => !open);
        return;
      }
      void window.electron.pet.activateMainWindow();
      return;
    }
    setMenuOpen((open) => !open);
  };

  const closePet = () => {
    setMenuOpen(false);
    void petService.setFloatingVisible(false);
  };

  if (!visible || !pet) return null;

  const sprite = (
    <PetSprite
      pet={pet}
      status={state.status}
      animationsEnabled={state.config.animationsEnabled}
      animationKey={spriteAnimationKey}
      interaction={
        dragState?.direction === 'left'
          ? PetInteractionState.DraggingLeft
          : dragState?.direction === 'right'
            ? PetInteractionState.DraggingRight
            : dragState
              ? PetInteractionState.Dragging
              : petHovered
                ? PetInteractionState.Hover
                : PetInteractionState.None
      }
      size={spriteSize}
    />
  );

  const activateSession = (sessionId: string) => {
    setMenuOpen(false);
    void petService.acknowledgeSession(sessionId);
    void window.electron.pet.activateSession(sessionId);
  };

  const closeSessionNotification = (event: React.MouseEvent<HTMLButtonElement>, sessionId: string) => {
    event.stopPropagation();
    void petService.acknowledgeSession(sessionId);
  };

  const toggleSessionExpanded = (event: React.MouseEvent<HTMLButtonElement>, sessionId: string) => {
    event.stopPropagation();
    setCollapsedSessionIds((current) => ({
      ...current,
      [sessionId]: !current[sessionId],
    }));
  };

  const handleFloatingPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      lastX: event.screenX,
      lastY: event.screenY,
      moved: false,
      direction: null,
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
      direction: Math.abs(deltaX) >= 1
        ? deltaX > 0 ? 'right' : 'left'
        : dragState.direction,
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
    <div className={`pet-companion relative ${variant === 'floating' ? 'h-screen w-screen' : ''} ${className}`}>
      {isFloating ? (
        <button
          type="button"
          className="pet-companion-trigger non-draggable absolute right-3 top-3 inline-flex cursor-grab touch-none select-none items-end border-0 bg-transparent p-0 text-left shadow-none transition active:cursor-grabbing focus:outline-none"
          onPointerDown={handleFloatingPointerDown}
          onPointerMove={handleFloatingPointerMove}
          onPointerUp={handleFloatingPointerUp}
          onPointerEnter={() => setPetHovered(true)}
          onPointerLeave={() => setPetHovered(false)}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenuOpen(true);
          }}
          onDragStart={(event) => event.preventDefault()}
          onPointerCancel={() => {
            setDragState(null);
            void window.electron.pet.persistFloatingWindowPosition();
          }}
          title={`${pet.displayName} - ${statusLabel(state.status)}`}
          aria-label={hasActiveSessions
            ? i18nService.t(activityTrayOpen ? 'petCollapseActivity' : 'petOpenActivity')
            : `${pet.displayName} - ${statusLabel(state.status)}`}
        >
          {sprite}
          {hasActiveSessions && (
            activityTrayOpen ? (
              <span
                className="pointer-events-none absolute right-0 top-0 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white p-0 text-neutral-600 shadow-sm ring-2 ring-white"
                aria-hidden="true"
              >
                <MinusIcon className="h-3.5 w-3.5" />
              </span>
            ) : (
              <span
                className={`pointer-events-none absolute right-0 top-0 z-10 inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-white/70 px-2 text-xs font-semibold leading-none shadow-sm ring-2 ring-white ${sessionStatusDotClass(primarySessionStatus)}`}
                aria-hidden="true"
              >
                {activeSessionCount}
              </span>
            )
          )}
        </button>
      ) : (
        <button
          type="button"
          className="pet-companion-trigger non-draggable flex items-end gap-2 border-0 bg-transparent p-0 text-left shadow-none transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setMenuOpen((open) => !open)}
          onPointerEnter={() => setPetHovered(true)}
          onPointerLeave={() => setPetHovered(false)}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenuOpen(true);
          }}
          title={`${pet.displayName} - ${statusLabel(state.status)}`}
        >
          {sprite}
        </button>
      )}

      {isFloating && hasActiveSessions && activityTrayOpen && (
        <div
          className="non-draggable absolute right-[118px] top-3 z-[70] flex max-h-[300px] w-[276px] flex-col items-stretch gap-2 overflow-y-auto overflow-x-hidden text-left"
          role="list"
          aria-label={i18nService.t('petNotificationList')}
        >
          {activeSessions.map((session) => {
            const collapsed = collapsedSessionIds[session.id] ?? false;
            return (
              <PetSessionNotification
                key={session.id}
                session={session}
                collapsed={collapsed}
                onActivate={activateSession}
                onClose={closeSessionNotification}
                onToggleExpanded={toggleSessionExpanded}
              />
            );
          })}
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

      {menuOpen && (
        <PetMenu
          pet={pet}
          state={state}
          isFloating={isFloating}
          positionClass={menuPositionClass}
          onClosePet={closePet}
          onDismiss={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default PetCompanion;
