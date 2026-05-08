import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { AgentId } from '@shared/agent';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { agentService } from '../services/agent';
import { coworkService } from '../services/cowork';
import { i18nService } from '../services/i18n';
import { RootState } from '../store';
import {
  selectCoworkSessions,
  selectCurrentSessionId,
} from '../store/selectors/coworkSelectors';
import type { CoworkSessionSummary } from '../types/cowork';
import MyAgentSidebarTree from './agentSidebar/MyAgentSidebarTree';
import Modal from './common/Modal';
import CoworkSearchModal from './cowork/CoworkSearchModal';
import ClockIcon from './icons/ClockIcon';
import ComposeIcon from './icons/ComposeIcon';
import ConnectorIcon from './icons/ConnectorIcon';
import PuzzleIcon from './icons/PuzzleIcon';
import SearchIcon from './icons/SearchIcon';
import SidebarToggleIcon from './icons/SidebarToggleIcon';
import TrashIcon from './icons/TrashIcon';
import LoginButton from './LoginButton';

interface SidebarProps {
  onShowSettings: () => void;
  onShowLogin?: () => void;
  activeView: 'cowork' | 'skills' | 'scheduledTasks' | 'mcp';
  onShowSkills: () => void;
  onShowCowork: () => void;
  onShowScheduledTasks: () => void;
  onShowMcp: () => void;
  onNewChat: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  updateBadge?: React.ReactNode;
  hideLogin?: boolean;
}

const DEFAULT_SIDEBAR_WIDTH = 244;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 420;
const sidebarNavItemClassName =
  'w-full inline-flex h-[34px] items-center gap-2 rounded-md px-1.5 text-left text-[14px] font-normal text-foreground/80 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]';
const activeSidebarNavItemClassName =
  `${sidebarNavItemClassName} bg-black/[0.06] hover:bg-black/[0.06] dark:bg-white/[0.07] dark:hover:bg-white/[0.07]`;
const sidebarCreateIconClassName = 'h-4 w-4 shrink-0 text-secondary/40 dark:text-secondary/45';

const Sidebar: React.FC<SidebarProps> = ({
  onShowSettings,
  activeView,
  onShowSkills,
  onShowCowork,
  onShowScheduledTasks,
  onShowMcp,
  onNewChat,
  isCollapsed,
  onToggleCollapse,
  updateBadge,
  hideLogin,
}) => {
  const currentAgentId = useSelector((state: RootState) => state.agent.currentAgentId);
  const sessions = useSelector(selectCoworkSessions);
  const filteredSessions = sessions.filter(s => !s.agentId || s.agentId === currentAgentId);
  const currentSessionId = useSelector(selectCurrentSessionId);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);
  const isMac = window.electron.platform === 'darwin';

  useEffect(() => {
    const handleSearch = () => {
      onShowCowork();
      setIsSearchOpen(true);
    };
    window.addEventListener('cowork:shortcut:search', handleSearch);
    return () => {
      window.removeEventListener('cowork:shortcut:search', handleSearch);
    };
  }, [onShowCowork]);

  useEffect(() => {
    if (!isCollapsed) return;
    setIsSearchOpen(false);
    setIsBatchMode(false);
    setSelectedIds(new Set());
    setShowBatchDeleteConfirm(false);
  }, [isCollapsed]);

  const handleSelectSession = async (session: CoworkSessionSummary) => {
    const agentId = session.agentId?.trim() || AgentId.Main;
    if (agentId !== currentAgentId) {
      agentService.switchAgent(agentId);
      await coworkService.loadSessions(agentId);
    }
    onShowCowork();
    await coworkService.loadSession(session.id);
  };

  const handleEnterBatchMode = useCallback((sessionId: string) => {
    setIsBatchMode(true);
    setSelectedIds(new Set([sessionId]));
  }, []);

  const handleExitBatchMode = useCallback(() => {
    setIsBatchMode(false);
    setSelectedIds(new Set());
    setShowBatchDeleteConfirm(false);
  }, []);

  const handleToggleSelection = useCallback((sessionId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === filteredSessions.length) {
        return new Set();
      }
      return new Set(filteredSessions.map(s => s.id));
    });
  }, [filteredSessions]);

  const handleBatchDeleteClick = useCallback(() => {
    if (selectedIds.size === 0) return;
    setShowBatchDeleteConfirm(true);
  }, [selectedIds.size]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await coworkService.deleteSessions(ids);
    handleExitBatchMode();
  }, [selectedIds, handleExitBatchMode]);

  const handleResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (isCollapsed) return;
    event.preventDefault();
    isResizingRef.current = true;
    resizeStartXRef.current = event.clientX;
    resizeStartWidthRef.current = sidebarWidth;
    document.body.classList.add('select-none');

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const nextWidth = resizeStartWidthRef.current + moveEvent.clientX - resizeStartXRef.current;
      if (nextWidth < MIN_SIDEBAR_WIDTH) {
        isResizingRef.current = false;
        document.body.classList.remove('select-none');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        onToggleCollapse();
        return;
      }
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, nextWidth));
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.classList.remove('select-none');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isCollapsed, onToggleCollapse, sidebarWidth]);

  useEffect(() => {
    return () => {
      document.body.classList.remove('select-none');
    };
  }, []);

  return (
    <aside
      className="relative shrink-0 bg-surface-raised flex flex-col sidebar-transition overflow-hidden"
      style={{ width: isCollapsed ? 0 : sidebarWidth }}
    >
      <div className="pt-3 pb-3">
        <div className="draggable sidebar-header-drag h-8 flex items-center justify-between px-3">
          <div className={`${isMac ? 'pl-[68px]' : ''}`}>{updateBadge}</div>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="non-draggable h-8 w-8 inline-flex items-center justify-center rounded-lg text-secondary hover:bg-surface-raised transition-colors"
            aria-label={isCollapsed ? i18nService.t('expand') : i18nService.t('collapse')}
          >
            <SidebarToggleIcon className="h-4 w-4" isCollapsed={isCollapsed} />
          </button>
        </div>
        <div className="mt-3 space-y-0.5 px-3">
          <button
            type="button"
            onClick={onNewChat}
            className={sidebarNavItemClassName}
          >
            <ComposeIcon className={sidebarCreateIconClassName} />
            {i18nService.t('newChat')}
          </button>
          <button
            type="button"
            onClick={() => {
              onShowCowork();
              setIsSearchOpen(true);
            }}
            className={sidebarNavItemClassName}
          >
            <SearchIcon className="h-4 w-4 shrink-0" />
            {i18nService.t('search')}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(false);
              onShowScheduledTasks();
            }}
            className={activeView === 'scheduledTasks' ? activeSidebarNavItemClassName : sidebarNavItemClassName}
            aria-current={activeView === 'scheduledTasks' ? 'page' : undefined}
          >
            <ClockIcon className="h-4 w-4 shrink-0" />
            {i18nService.t('scheduledTasks')}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(false);
              onShowSkills();
            }}
            className={activeView === 'skills' ? activeSidebarNavItemClassName : sidebarNavItemClassName}
            aria-current={activeView === 'skills' ? 'page' : undefined}
          >
            <PuzzleIcon className="h-4 w-4 shrink-0" />
            {i18nService.t('skills')}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen(false);
              onShowMcp();
            }}
            className={activeView === 'mcp' ? activeSidebarNavItemClassName : sidebarNavItemClassName}
            aria-current={activeView === 'mcp' ? 'page' : undefined}
          >
            <ConnectorIcon className="h-4 w-4 shrink-0" />
            {i18nService.t('mcpServers')}
          </button>
        </div>
      </div>
      <div className="scrollbar-hidden flex-1 overflow-y-auto px-2.5 pb-4">
        <MyAgentSidebarTree
          isBatchMode={isBatchMode}
          selectedIds={selectedIds}
          onShowCowork={onShowCowork}
          onToggleSelection={handleToggleSelection}
          onEnterBatchMode={handleEnterBatchMode}
        />
      </div>
      {!isCollapsed && (
        <div
          className="non-draggable absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
          onMouseDown={handleResizeStart}
        />
      )}
      <CoworkSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
      />
      {isBatchMode ? (
        <div className="px-3 pb-3 pt-1 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-secondary">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredSessions.length && filteredSessions.length > 0}
              onChange={handleSelectAll}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 accent-primary cursor-pointer"
            />
            {i18nService.t('batchSelectAll')}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBatchDeleteClick}
              disabled={selectedIds.size === 0}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                selectedIds.size > 0
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              <TrashIcon className="h-3.5 w-3.5" />
              {selectedIds.size > 0 ? `${selectedIds.size}` : ''}
            </button>
            <button
              type="button"
              onClick={handleExitBatchMode}
              className="px-3 py-1.5 text-sm font-medium rounded-lg text-secondary hover:bg-surface-raised transition-colors"
            >
              {i18nService.t('batchCancel')}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3 pb-3 pt-1 flex items-center gap-1">
          {!hideLogin && (
            <div className="flex-1 min-w-0">
              <LoginButton />
            </div>
          )}
          <button
            type="button"
            onClick={() => onShowSettings()}
            className={`inline-flex items-center justify-start gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-secondary hover:text-foreground hover:bg-surface-raised transition-colors ${hideLogin ? 'w-full' : 'shrink-0'}`}
            aria-label={i18nService.t('settings')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M14 17H5" />
              <path d="M19 7h-9" />
              <circle cx="17" cy="17" r="3" />
              <circle cx="7" cy="7" r="3" />
            </svg>
            {i18nService.t('settings')}
          </button>
        </div>
      )}
      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteConfirm && (
        <Modal
          onClose={() => setShowBatchDeleteConfirm(false)}
          className="w-full max-w-sm mx-4 bg-surface rounded-2xl shadow-xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-500" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              {i18nService.t('batchDeleteConfirmTitle')}
            </h2>
          </div>
          <div className="px-5 pb-4">
            <p className="text-sm text-secondary">
              {i18nService
                .t('batchDeleteConfirmMessage')
                .replace('{count}', String(selectedIds.size))}
            </p>
          </div>
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
            <button
              onClick={() => setShowBatchDeleteConfirm(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg text-secondary hover:bg-surface-raised transition-colors"
            >
              {i18nService.t('cancel')}
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              {i18nService.t('batchDelete')} ({selectedIds.size})
            </button>
          </div>
        </Modal>
      )}
    </aside>
  );
};

export default Sidebar;
