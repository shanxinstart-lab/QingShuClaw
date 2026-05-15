import { createSelector } from '@reduxjs/toolkit';

import type { RootState } from '../index';

export const selectCoworkSessions = (state: RootState) => state.cowork.sessions;
export const selectCurrentSessionId = (state: RootState) => state.cowork.currentSessionId;
export const selectCurrentSession = (state: RootState) => state.cowork.currentSession;
export const selectIsStreaming = (state: RootState) => state.cowork.isStreaming;
export const selectIsCoworkActive = (state: RootState) => state.cowork.isCoworkActive;
export const selectRemoteManaged = (state: RootState) => state.cowork.remoteManaged;
export const selectCoworkConfig = (state: RootState) => state.cowork.config;
export const selectDraftPrompts = (state: RootState) => state.cowork.draftPrompts;
export const selectPendingPermissions = (state: RootState) => state.cowork.pendingPermissions;
export const selectQueuedInputsBySessionId = (state: RootState) => state.cowork.queuedInputsBySessionId;
export const selectUnreadSessionIds = (state: RootState) => state.cowork.unreadSessionIds;

export const selectAgentEngine = createSelector(
  selectCoworkConfig,
  (config) => config.agentEngine,
);

export const selectIsOpenClawEngine = createSelector(
  selectAgentEngine,
  (engine) => engine === 'openclaw',
);

export const selectCurrentMessages = createSelector(
  selectCurrentSession,
  (session) => session?.messages ?? null,
);

export const selectCurrentMessagesLength = createSelector(
  selectCurrentMessages,
  (messages) => messages?.length ?? 0,
);

export const selectLastMessageContent = createSelector(
  selectCurrentMessages,
  (messages) => {
    if (!messages || messages.length === 0) return undefined;
    return messages[messages.length - 1]?.content;
  },
);

export const selectFirstPendingPermission = createSelector(
  selectPendingPermissions,
  (permissions) => permissions[0] ?? null,
);
