import React, { useMemo, useState } from 'react';

import { i18nService } from '../../services/i18n';
import type { CoworkSessionSummary } from '../../types/cowork';
import SearchIcon from '../icons/SearchIcon';
import XMarkIcon from '../icons/XMarkIcon';
import CoworkSessionList from './CoworkSessionList';

const emptySet = new Set<string>();

interface ConversationHistoryDrawerProps {
  isOpen: boolean;
  title: string;
  sessions: CoworkSessionSummary[];
  currentSessionId: string | null;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void | Promise<void>;
  onDeleteSession: (sessionId: string) => void | Promise<void>;
  onTogglePin: (sessionId: string, pinned: boolean) => void | Promise<void>;
  onRenameSession: (sessionId: string, title: string) => void | Promise<void>;
}

const ConversationHistoryDrawer: React.FC<ConversationHistoryDrawerProps> = ({
  isOpen,
  title,
  sessions,
  currentSessionId,
  onClose,
  onSelectSession,
  onDeleteSession,
  onTogglePin,
  onRenameSession,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return sessions;
    }
    return sessions.filter((session) => session.title.toLowerCase().includes(query));
  }, [searchQuery, sessions]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute inset-y-0 right-0 z-30 flex w-[360px] shrink-0 border-l border-border bg-surface/95 backdrop-blur-sm">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {i18nService.t('workbenchConversationHistoryTitle').replace('{group}', title)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
            aria-label={i18nService.t('close')}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border px-5 py-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={i18nService.t('workbenchConversationHistorySearchPlaceholder')}
              className="w-full rounded-2xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-secondary focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {filteredSessions.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-secondary">
              {i18nService.t('workbenchConversationEmpty')}
            </div>
          ) : (
            <CoworkSessionList
              sessions={filteredSessions}
              currentSessionId={currentSessionId}
              isBatchMode={false}
              selectedIds={emptySet}
              onSelectSession={onSelectSession}
              onDeleteSession={onDeleteSession}
              onTogglePin={onTogglePin}
              onRenameSession={onRenameSession}
              onToggleSelection={() => undefined}
              onEnterBatchMode={() => undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationHistoryDrawer;
