import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { agentService } from '../../services/agent';
import { coworkService } from '../../services/cowork';
import { i18nService } from '../../services/i18n';
import { RootState } from '../../store';
import { isDefaultAgentId } from '../../utils/agentDisplay';
import AgentCreateModal from '../agent/AgentCreateModal';
import AgentSettingsPanel from '../agent/AgentSettingsPanel';
import AgentTreeNode from './AgentTreeNode';
import MyAgentSidebarHeader from './MyAgentSidebarHeader';
import type { AgentSidebarAgentNode, AgentSidebarTaskNode } from './types';
import { useAgentSidebarState } from './useAgentSidebarState';

interface MyAgentSidebarTreeProps {
  isBatchMode: boolean;
  selectedIds: Set<string>;
  onShowCowork: () => void;
  onToggleSelection: (sessionId: string) => void;
  onEnterBatchMode: (sessionId: string) => void;
}

const MyAgentSidebarTree: React.FC<MyAgentSidebarTreeProps> = ({
  isBatchMode,
  selectedIds,
  onShowCowork,
  onToggleSelection,
  onEnterBatchMode,
}) => {
  const currentAgentId = useSelector((state: RootState) => state.agent.currentAgentId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [settingsAgentId, setSettingsAgentId] = useState<string | null>(null);
  const {
    agentNodes,
    patchTaskPreview,
    removeTaskPreview,
    retryLoadTasks,
    loadMoreTasks,
    collapseTasks,
    toggleAgentExpanded,
  } = useAgentSidebarState();

  useEffect(() => {
    void agentService.loadAgents();
  }, []);

  const handleSelectTask = async (task: AgentSidebarTaskNode) => {
    if (task.agentId !== currentAgentId) {
      agentService.switchAgent(task.agentId);
      await coworkService.loadSessions(task.agentId);
    }
    onShowCowork();
    await coworkService.loadSession(task.id);
  };

  const handleDeleteTask = async (task: AgentSidebarTaskNode) => {
    const deleted = await coworkService.deleteSession(task.id);
    if (deleted) {
      removeTaskPreview(task.id);
    }
  };

  const handleToggleTaskPin = async (task: AgentSidebarTaskNode, pinned: boolean) => {
    const result = await coworkService.setSessionPinned(task.id, pinned);
    if (result.success) {
      patchTaskPreview(task.id, { pinned, pinOrder: result.pinOrder }, { preserveUpdatedAt: true });
    }
  };

  const handleRenameTask = async (task: AgentSidebarTaskNode, title: string) => {
    const renamed = await coworkService.renameSession(task.id, title);
    if (renamed) {
      patchTaskPreview(task.id, { title });
    }
  };

  const handleEnterBatchMode = (task: AgentSidebarTaskNode) => {
    if (task.agentId !== currentAgentId) {
      agentService.switchAgent(task.agentId);
      void coworkService.loadSessions(task.agentId);
    }
    onEnterBatchMode(task.id);
  };

  const handleCreateTask = async (agent: AgentSidebarAgentNode) => {
    if (agent.id !== currentAgentId) {
      agentService.switchAgent(agent.id);
      await coworkService.loadSessions(agent.id);
    }
    coworkService.clearSession();
    onShowCowork();
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cowork:focus-input', {
        detail: { clear: false },
      }));
    }, 0);
  };

  const handleDeleteAgent = async (agent: AgentSidebarAgentNode) => {
    if (isDefaultAgentId(agent.id)) return;
    const deleted = await agentService.deleteAgent(agent.id);
    if (deleted && settingsAgentId === agent.id) {
      setSettingsAgentId(null);
    }
    if (!deleted) {
      window.dispatchEvent(new CustomEvent('app:showToast', { detail: i18nService.t('agentDeleteFailed') }));
    }
  };

  return (
    <div className="pb-3" role="tree" aria-label={i18nService.t('myAgents')}>
      <MyAgentSidebarHeader
        onCreateAgent={() => setIsCreateOpen(true)}
      />

      {agentNodes.length === 0 ? (
        <div className="px-3 py-6 text-center">
          <p className="text-xs font-medium text-secondary">
            {i18nService.t('myAgentSidebarNoAgents')}
          </p>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover"
          >
            {i18nService.t('createNewAgent')}
          </button>
        </div>
      ) : (
        <div className="space-y-1 px-0">
          {agentNodes.map((agent) => (
            <AgentTreeNode
              key={agent.id}
              agent={agent}
              isBatchMode={isBatchMode}
              selectedIds={selectedIds}
              showBatchOption
              onToggleExpanded={toggleAgentExpanded}
              onEditAgent={(agent) => setSettingsAgentId(agent.id)}
              onCreateTask={(agent) => void handleCreateTask(agent)}
              onDeleteAgent={handleDeleteAgent}
              onRetryLoadTasks={(agentId) => void retryLoadTasks(agentId)}
              onLoadMoreTasks={(agentId) => void loadMoreTasks(agentId)}
              onCollapseTasks={collapseTasks}
              onSelectTask={(task) => void handleSelectTask(task)}
              onDeleteTask={handleDeleteTask}
              onToggleTaskPin={handleToggleTaskPin}
              onRenameTask={handleRenameTask}
              onToggleSelection={onToggleSelection}
              onEnterBatchMode={handleEnterBatchMode}
            />
          ))}
        </div>
      )}

      <AgentCreateModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <AgentSettingsPanel
        agentId={settingsAgentId}
        onClose={() => setSettingsAgentId(null)}
      />
    </div>
  );
};

export default MyAgentSidebarTree;
