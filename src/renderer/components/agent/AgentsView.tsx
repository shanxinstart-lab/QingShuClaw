import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { agentService } from '../../services/agent';
import { coworkService } from '../../services/cowork';
import { i18nService } from '../../services/i18n';
import { LockClosedIcon, PlusIcon } from '@heroicons/react/24/outline';
import type { PresetAgent } from '../../types/agent';
import AgentCreateModal from './AgentCreateModal';
import AgentSettingsPanel from './AgentSettingsPanel';
import SidebarToggleIcon from '../icons/SidebarToggleIcon';
import ComposeIcon from '../icons/ComposeIcon';
import WindowTitleBar from '../window/WindowTitleBar';

interface AgentsViewProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
  onShowCowork?: () => void;
  updateBadge?: React.ReactNode;
}

const AgentsView: React.FC<AgentsViewProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onNewChat,
  onShowCowork,
  updateBadge,
}) => {
  const isMac = window.electron.platform === 'darwin';
  const agents = useSelector((state: RootState) => state.agent.agents);
  const currentAgentId = useSelector((state: RootState) => state.agent.currentAgentId);
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const [presets, setPresets] = useState<PresetAgent[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [settingsAgentId, setSettingsAgentId] = useState<string | null>(null);
  const [addingPreset, setAddingPreset] = useState<string | null>(null);

  useEffect(() => {
    agentService.loadAgents();
    agentService.getPresets().then(setPresets);
  }, []);

  // Refresh presets when agents change (to update installed status)
  useEffect(() => {
    agentService.getPresets().then(setPresets);
  }, [agents]);

  const visibleAgents = agents.filter((a) => a.id !== 'main');
  const enabledAgents = visibleAgents.filter((a) => a.enabled);
  const presetAgents = enabledAgents.filter((a) => a.source === 'preset');
  const managedAgents = visibleAgents.filter((a) => a.source === 'managed');
  const customAgents = enabledAgents.filter((a) => a.source === 'custom');
  const managedAvailableAgents = managedAgents.filter((agent) => isLoggedIn && agent.allowed !== false);
  const managedLockedAgents = managedAgents.filter((agent) => !isLoggedIn || agent.allowed === false);
  const uninstalledPresets = presets.filter((p) => !p.installed);

  const handleAddPreset = async (presetId: string) => {
    setAddingPreset(presetId);
    try {
      await agentService.addPreset(presetId);
    } finally {
      setAddingPreset(null);
    }
  };

  const handleSwitchAgent = (agentId: string) => {
    const switched = agentService.switchAgent(agentId);
    if (!switched) {
      return;
    }
    coworkService.loadSessions(agentId);
    onShowCowork?.();
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full">
      {/* Header */}
      <div className="draggable flex h-12 items-center justify-between px-4 border-b border-border shrink-0">
        <div className="flex items-center space-x-3 h-8">
          {isSidebarCollapsed && (
            <div className={`non-draggable flex items-center gap-1 ${isMac ? 'pl-[68px]' : ''}`}>
              <button
                type="button"
                onClick={onToggleSidebar}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-secondary hover:bg-surface-raised transition-colors"
              >
                <SidebarToggleIcon className="h-4 w-4" isCollapsed={true} />
              </button>
              <button
                type="button"
                onClick={onNewChat}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-secondary hover:bg-surface-raised transition-colors"
              >
                <ComposeIcon className="h-4 w-4" />
              </button>
              {updateBadge}
            </div>
          )}
          <h1 className="text-lg font-semibold text-foreground">
            {i18nService.t('myAgents')}
          </h1>
        </div>
        <WindowTitleBar inline />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0 [scrollbar-gutter:stable]">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* Subtitle */}
          <p className="text-sm text-secondary mb-6">
            {i18nService.t('agentsSubtitle')}
          </p>

          {/* Preset Agents Section */}
          {(presetAgents.length > 0 || uninstalledPresets.length > 0) && (
            <div className="mb-8">
              <h2 className="text-sm font-medium text-secondary mb-3">
                {i18nService.t('presetAgents')}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Installed presets */}
                {presetAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    icon={agent.icon}
                    name={agent.name}
                    description={agent.description}
                    isActive={agent.id === currentAgentId}
                    onClick={() => setSettingsAgentId(agent.id)}
                  />
                ))}
                {/* Uninstalled presets */}
                {uninstalledPresets.map((preset) => {
                  const isEn = i18nService.getLanguage() === 'en';
                  return (
                    <UninstalledPresetCard
                      key={preset.id}
                      icon={preset.icon}
                      name={isEn && preset.nameEn ? preset.nameEn : preset.name}
                      description={isEn && preset.descriptionEn ? preset.descriptionEn : preset.description}
                      isAdding={addingPreset === preset.id}
                      onAdd={() => handleAddPreset(preset.id)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {managedAgents.length > 0 && (
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-secondary">
                  {i18nService.t('managedAgents')}
                </h2>
                <div className="flex items-center gap-2 text-[11px] text-secondary">
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 font-medium text-emerald-700 dark:text-emerald-300">
                    {i18nService.t('managedAvailableSection')} {managedAvailableAgents.length}
                  </span>
                  <span className="rounded-full border border-border bg-muted/40 px-2 py-1 font-medium">
                    {i18nService.t('managedLockedSection')} {managedLockedAgents.length}
                  </span>
                </div>
              </div>
              {managedAvailableAgents.length > 0 && (
                <div className="mb-4">
                  <div className="mb-2 text-xs font-medium text-secondary">
                    {i18nService.t('managedAvailableSection')}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {managedAvailableAgents.map((agent) => (
                      <AgentCard
                        key={agent.id}
                        icon={agent.icon}
                        name={agent.name}
                        description={agent.description}
                        isActive={agent.id === currentAgentId}
                        badgeLabel={i18nService.t('sourceTypeQingShuManaged')}
                        onClick={() => setSettingsAgentId(agent.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {managedLockedAgents.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-secondary">
                    {i18nService.t('managedLockedSection')}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {managedLockedAgents.map((agent) => {
                      const unavailableLabel = !isLoggedIn
                        ? i18nService.t('managedUnavailableTag')
                        : i18nService.t('managedForbiddenTag');
                      return (
                        <AgentCard
                          key={agent.id}
                          icon={agent.icon}
                          name={agent.name}
                          description={agent.description}
                          isActive={agent.id === currentAgentId}
                          badgeLabel={i18nService.t('sourceTypeQingShuManaged')}
                          unavailableLabel={unavailableLabel}
                          isUnavailable={true}
                          onClick={() => setSettingsAgentId(agent.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom Agents Section */}
          <div>
            <h2 className="text-sm font-medium text-secondary mb-3">
              {i18nService.t('myCustomAgents')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {customAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  icon={agent.icon}
                  name={agent.name}
                  description={agent.description}
                  isActive={agent.id === currentAgentId}
                  onClick={() => setSettingsAgentId(agent.id)}
                />
              ))}
              {/* Create new agent card */}
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors min-h-[140px] cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10">
                  <PlusIcon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-medium text-primary">
                  {i18nService.t('createNewAgent')}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AgentCreateModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <AgentSettingsPanel
        agentId={settingsAgentId}
        onClose={() => setSettingsAgentId(null)}
        onSwitchAgent={(id) => {
          setSettingsAgentId(null);
          handleSwitchAgent(id);
        }}
      />
    </div>
  );
};

/* ── Agent Card (installed) ─────────────────────────── */

const AgentCard: React.FC<{
  icon: string;
  name: string;
  description: string;
  isActive: boolean;
  badgeLabel?: string;
  unavailableLabel?: string;
  isUnavailable?: boolean;
  onClick: () => void;
}> = ({ icon, name, description, isActive, badgeLabel, unavailableLabel, isUnavailable, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all min-h-[140px] ${
      isUnavailable
        ? 'border-border/70 bg-muted/30 text-muted-foreground saturate-0'
        : 'hover:shadow-md hover:bg-surface-raised'
    } ${
      isActive
        ? 'border-primary bg-primary/5'
        : 'border-border'
    } ${isUnavailable ? 'opacity-85' : ''}`}
  >
    {isUnavailable && (
      <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-border bg-background/85 px-2 py-1 text-[10px] font-medium text-secondary shadow-sm">
        <LockClosedIcon className="h-3 w-3" />
        {unavailableLabel}
      </div>
    )}
    <span className="text-3xl">{icon || '🤖'}</span>
    <div className="min-w-0 w-full">
      <div className="flex items-center gap-2 min-w-0">
        <div className="text-sm font-semibold text-foreground truncate">
          {name}
        </div>
        {badgeLabel && (
          <span className="px-1.5 py-0.5 rounded bg-surface-raised text-[10px] text-secondary font-medium">
            {badgeLabel}
          </span>
        )}
      </div>
      {description && (
        <div className="text-xs text-secondary mt-0.5 line-clamp-2">
          {description}
        </div>
      )}
      {isUnavailable && (
        <div className="mt-2 rounded-lg border border-border bg-background/70 px-2 py-1.5 text-[11px] leading-4 text-secondary">
          {i18nService.t('managedUnavailableHint')}
        </div>
      )}
    </div>
  </button>
);

/* ── Uninstalled Preset Card ─────────────────────────── */

const UninstalledPresetCard: React.FC<{
  icon: string;
  name: string;
  description: string;
  isAdding: boolean;
  onAdd: () => void;
}> = ({ icon, name, description, isAdding, onAdd }) => (
  <div className="flex flex-col items-start gap-2 p-4 rounded-xl border-2 border-dashed border-border opacity-60 hover:opacity-80 transition-opacity min-h-[140px]">
    <span className="text-3xl">{icon || '🤖'}</span>
    <div className="min-w-0 w-full flex-1">
      <div className="text-sm font-semibold text-foreground truncate">
        {name}
      </div>
      {description && (
        <div className="text-xs text-secondary mt-0.5 line-clamp-2">
          {description}
        </div>
      )}
    </div>
    <button
      type="button"
      onClick={onAdd}
      disabled={isAdding}
      className="self-end px-3 py-1 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
    >
      {isAdding ? '...' : i18nService.t('addAgent')}
    </button>
  </div>
);

export default AgentsView;
