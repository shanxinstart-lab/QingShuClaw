import { XMarkIcon } from '@heroicons/react/24/outline';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { AppCustomEvent } from '../../constants/app';
import { agentService } from '../../services/agent';
import { coworkService } from '../../services/cowork';
import { i18nService } from '../../services/i18n';
import { imService } from '../../services/im';
import { loadQingShuAgentGovernanceSummary } from '../../services/qingshuGovernanceSummary';
import type { PresetAgent } from '../../types/agent';
import type { IMGatewayConfig,IMPlatform } from '../../types/im';
import { getVisibleIMPlatforms } from '../../utils/regionFilter';
import { resolveAgentBundleSaveFlow } from './agentBundleSaveFlow';
import {
  buildAgentBundleSaveWarningState,
} from './agentBundleSaveGuard';
import { buildPersistedCreateAgentRequest } from './agentPersistedDraft';
import AgentSkillSelector from './AgentSkillSelector';
import AgentToolBundleCompatibilityHint from './AgentToolBundleCompatibilityHint';
import AgentToolBundleDebugGuide from './AgentToolBundleDebugGuide';
import AgentToolBundleDebugSelector from './AgentToolBundleDebugSelector';
import AgentToolBundleReadOnlyPanel from './AgentToolBundleReadOnlyPanel';
import AgentToolBundleSelector from './AgentToolBundleSelector';
import EmojiPicker from './EmojiPicker';

type CreateTab = 'basic' | 'skills' | 'im';
type CreateMode = 'blank' | 'preset';

const IM_PLATFORMS: { key: IMPlatform; logo: string }[] = [
  { key: 'dingtalk', logo: 'dingding.png' },
  { key: 'feishu', logo: 'feishu.png' },
  { key: 'qq', logo: 'qq_bot.jpeg' },
  { key: 'telegram', logo: 'telegram.svg' },
  { key: 'discord', logo: 'discord.svg' },
  { key: 'nim', logo: 'nim.png' },
  { key: 'xiaomifeng', logo: 'xiaomifeng.png' },
  { key: 'weixin', logo: 'weixin.png' },
  { key: 'wecom', logo: 'wecom.png' },
  { key: 'popo', logo: 'popo.png' },
];

interface AgentCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AgentCreateModal: React.FC<AgentCreateModalProps> = ({ isOpen, onClose }) => {
  const showGovernanceDebug = import.meta.env.DEV;
  const isEn = i18nService.getLanguage() === 'en';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [identity, setIdentity] = useState('');
  const [icon, setIcon] = useState('');
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [toolBundleIds, setToolBundleIds] = useState<string[]>([]);
  const [debugToolBundleIds, setDebugToolBundleIds] = useState<string[]>([]);
  const [saveWarningSignature, setSaveWarningSignature] = useState<string | null>(null);
  const [saveWarningMissingBundles, setSaveWarningMissingBundles] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<CreateTab>('basic');
  const [createMode, setCreateMode] = useState<CreateMode>('blank');
  const [presetAgents, setPresetAgents] = useState<PresetAgent[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  // IM binding state
  const [imConfig, setImConfig] = useState<IMGatewayConfig | null>(null);
  const [boundPlatforms, setBoundPlatforms] = useState<Set<IMPlatform>>(new Set());

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
    setSystemPrompt('');
    setIdentity('');
    setIcon('');
    setSkillIds([]);
    setToolBundleIds([]);
    setDebugToolBundleIds([]);
    setSaveWarningSignature(null);
    setSaveWarningMissingBundles([]);
    setActiveTab('basic');
    setCreateMode('blank');
    setSelectedPresetId(null);
    setBoundPlatforms(new Set());
    setShowUnsavedConfirm(false);
  }, []);

  const isDirty = useMemo(() => (
    Boolean(name.trim())
    || Boolean(description.trim())
    || Boolean(systemPrompt.trim())
    || Boolean(identity.trim())
    || Boolean(icon.trim())
    || skillIds.length > 0
    || toolBundleIds.length > 0
    || debugToolBundleIds.length > 0
    || boundPlatforms.size > 0
  ), [
    boundPlatforms,
    debugToolBundleIds,
    description,
    icon,
    identity,
    name,
    skillIds,
    systemPrompt,
    toolBundleIds,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    let active = true;
    resetForm();
    imService.loadConfig().then((cfg) => {
      if (active && cfg) {
        setImConfig(cfg);
      }
    }).catch(() => {
      if (active) {
        setImConfig(null);
      }
    });
    agentService.getPresets().then((presets) => {
      if (active) {
        setPresetAgents(Array.isArray(presets) ? presets : []);
      }
    }).catch(() => {
      if (active) {
        setPresetAgents([]);
      }
    });

    return () => {
      active = false;
    };
  }, [isOpen, resetForm]);

  useEffect(() => {
    setSaveWarningSignature(null);
    setSaveWarningMissingBundles([]);
  }, [skillIds, toolBundleIds]);

  const saveWarningState = useMemo(
    () => buildAgentBundleSaveWarningState(saveWarningMissingBundles),
    [saveWarningMissingBundles],
  );
  const saveWarningMoreText = saveWarningState && saveWarningState.hiddenBundleCount > 0
    ? i18nService.t('agentToolBundlesSaveWarningMore')
      .replace('{count}', String(saveWarningState.hiddenBundleCount))
    : '';
  const saveButtonLabel = creating
    ? (i18nService.t('creating') || 'Creating...')
    : saveWarningState
      ? (i18nService.t('agentToolBundlesConfirmSave') || 'Save Again')
      : (i18nService.t('create') || 'Create');

  const handleRequestClose = useCallback(() => {
    if (creating) {
      return;
    }
    if (isDirty) {
      setShowUnsavedConfirm(true);
      return;
    }
    resetForm();
    onClose();
  }, [creating, isDirty, onClose, resetForm]);

  const handleConfirmDiscard = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  if (!isOpen) return null;

  const applyPresetTemplate = (preset: PresetAgent) => {
    setCreateMode('preset');
    setSelectedPresetId(preset.id);
    setName(isEn && preset.nameEn ? preset.nameEn : preset.name);
    setDescription(isEn && preset.descriptionEn ? preset.descriptionEn : preset.description);
    setSystemPrompt(isEn && preset.systemPromptEn ? preset.systemPromptEn : preset.systemPrompt);
    setIdentity('');
    setIcon(preset.icon);
    setSkillIds([...preset.skillIds]);
    setToolBundleIds([]);
    setDebugToolBundleIds([]);
    setSaveWarningSignature(null);
    setSaveWarningMissingBundles([]);
    setActiveTab('basic');
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const summary = await loadQingShuAgentGovernanceSummary(skillIds, toolBundleIds);
      const saveFlow = resolveAgentBundleSaveFlow({
        skillIds,
        toolBundleIds,
        missingBundles: summary.missingBundles,
        acknowledgedSignature: saveWarningSignature,
      });
      setSaveWarningSignature(saveFlow.nextAcknowledgedSignature);
      setSaveWarningMissingBundles(saveFlow.nextMissingBundles);
      if (!saveFlow.allowSave) {
        setActiveTab('skills');
        return;
      }

      const agent = await agentService.createAgent(buildPersistedCreateAgentRequest({
        name,
        description,
        systemPrompt,
        identity,
        icon,
        skillIds,
        toolBundleIds,
        debugToolBundleIds,
      }));
      if (agent) {
        // Save IM bindings after agent is created
        if (boundPlatforms.size > 0 && imConfig) {
          const currentBindings = { ...(imConfig.settings?.platformAgentBindings || {}) };
          for (const platform of boundPlatforms) {
            currentBindings[platform] = agent.id;
          }
          await imService.persistConfig({
            settings: { ...imConfig.settings, platformAgentBindings: currentBindings },
          });
          await imService.saveAndSyncConfig();
        }
        const switched = agentService.switchAgent(agent.id);
        if (switched) {
          await coworkService.loadSessions(agent.id);
        }
        resetForm();
        onClose();
      } else {
        window.dispatchEvent(new CustomEvent(AppCustomEvent.ShowToast, {
          detail: i18nService.t('agentCreateFailed'),
        }));
      }
    } catch {
      window.dispatchEvent(new CustomEvent(AppCustomEvent.ShowToast, {
        detail: i18nService.t('agentCreateFailed'),
      }));
    } finally {
      setCreating(false);
    }
  };

  const handleToggleIMBinding = (platform: IMPlatform) => {
    const next = new Set(boundPlatforms);
    if (next.has(platform)) {
      next.delete(platform);
    } else {
      next.add(platform);
    }
    setBoundPlatforms(next);
  };

  const isPlatformConfigured = (platform: IMPlatform): boolean => {
    if (!imConfig) return false;
    return (imConfig as unknown as Record<string, { enabled?: boolean }>)[platform]?.enabled === true;
  };

  const tabs: { key: CreateTab; label: string }[] = [
    { key: 'basic', label: i18nService.t('agentTabBasic') || 'Basic Info' },
    { key: 'skills', label: i18nService.t('agentTabSkills') || 'Skills' },
    { key: 'im', label: i18nService.t('agentTabIM') || 'IM Channels' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop" onClick={handleRequestClose}>
      <div
        className="w-full max-w-2xl mx-4 rounded-2xl shadow-2xl bg-white border border-border max-h-[80vh] flex flex-col modal-content overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-border">
          {/* Top gradient light */}
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/10">
              <span className="text-xl">{icon || '🤖'}</span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {name || (i18nService.t('createAgent') || 'Create Agent')}
              </h3>
              <p className="text-[11px] text-muted mt-0.5">{i18nService.t('agentCreateModeHint')}</p>
            </div>
          </div>
          <button type="button" onClick={handleRequestClose} className="rounded-xl p-2 text-secondary hover:bg-surface-raised hover:text-foreground transition-colors">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Tab bar — pill style */}
        <div className="flex gap-1 px-6 py-2 border-b border-border bg-surface-raised/30">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/15 shadow-sm'
                  : 'text-secondary hover:text-foreground hover:bg-surface-raised'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-[300px]">
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-background/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {i18nService.t('agentCreateModeTitle')}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-secondary">
                      {i18nService.t('agentCreateModeHint')}
                    </p>
                  </div>
                  <div className="inline-flex rounded-xl bg-surface-raised p-1">
                    <button
                      type="button"
                      onClick={() => setCreateMode('blank')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        createMode === 'blank'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-secondary hover:text-foreground'
                      }`}
                    >
                      {i18nService.t('agentCreateModeBlank')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateMode('preset')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        createMode === 'preset'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-secondary hover:text-foreground'
                      }`}
                    >
                      {i18nService.t('agentCreateModePreset')}
                    </button>
                  </div>
                </div>

                {createMode === 'preset' && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-medium text-secondary">
                      {i18nService.t('agentPresetTemplateTitle')}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {presetAgents.map((preset) => {
                        const presetName = isEn && preset.nameEn ? preset.nameEn : preset.name;
                        const presetDescription = isEn && preset.descriptionEn ? preset.descriptionEn : preset.description;
                        const isSelected = selectedPresetId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => applyPresetTemplate(preset)}
                            className={`rounded-xl border px-3 py-3 text-left transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/8 shadow-sm'
                                : 'border-border bg-surface hover:border-primary/30 hover:bg-surface-raised'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-background text-xl">
                                {preset.icon}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="truncate text-sm font-semibold text-foreground">
                                    {presetName}
                                  </div>
                                  {preset.installed && (
                                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                      {i18nService.t('agentPresetTemplateInstalled')}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-secondary">
                                  {presetDescription}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  {i18nService.t('agentName') || 'Name'} *
                </label>
                <div className="flex gap-2">
                  <EmojiPicker value={icon} onChange={setIcon} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={i18nService.t('agentNamePlaceholder') || 'Agent name'}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  {i18nService.t('agentDescription') || 'Description'}
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={i18nService.t('agentDescriptionPlaceholder') || 'Brief description'}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  {i18nService.t('systemPrompt') || 'System Prompt'}
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder={i18nService.t('systemPromptPlaceholder') || 'Describe the agent\'s role and behavior...'}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-sm resize-none transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  {i18nService.t('agentIdentity') || 'Identity'}
                </label>
                <textarea
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  rows={3}
                  placeholder={i18nService.t('agentIdentityPlaceholder') || 'Identity description (IDENTITY.md)...'}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-foreground text-sm resize-none transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                />
              </div>
            </div>
          )}

          {activeTab === 'skills' && (
            <>
              <AgentToolBundleSelector
                selectedBundleIds={toolBundleIds}
                onChange={(nextBundleIds) => {
                  setToolBundleIds(nextBundleIds);
                  if (showGovernanceDebug) {
                    setDebugToolBundleIds(nextBundleIds);
                  }
                }}
              />
              <AgentToolBundleCompatibilityHint
                skillIds={skillIds}
                toolBundleIds={toolBundleIds}
                usesAllEnabledSkills={skillIds.length === 0}
              />
              {showGovernanceDebug ? (
                <>
                  <AgentToolBundleDebugGuide />
                  <AgentToolBundleReadOnlyPanel toolBundleIds={[]} />
                  <AgentToolBundleDebugSelector
                    selectedBundleIds={debugToolBundleIds}
                    baselineBundleIds={toolBundleIds}
                    onChange={setDebugToolBundleIds}
                  />
                </>
              ) : null}
              <AgentSkillSelector
                selectedSkillIds={skillIds}
                toolBundleIds={showGovernanceDebug ? debugToolBundleIds : toolBundleIds}
                onChange={setSkillIds}
              />
            </>
          )}

          {activeTab === 'im' && (
            <div>
              <p className="text-xs text-secondary/60 mb-4">
                {i18nService.t('agentIMBindHint') || 'Select IM channels this Agent responds to'}
              </p>
              <div className="space-y-1">
                {IM_PLATFORMS
                  .filter(({ key }) => (getVisibleIMPlatforms(i18nService.getLanguage()) as readonly string[]).includes(key))
                  .map(({ key: platform, logo }) => {
                  const configured = isPlatformConfigured(platform);
                  const bound = boundPlatforms.has(platform);
                  return (
                    <div
                      key={platform}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                        configured
                          ? 'hover:bg-surface-raised cursor-pointer'
                          : 'opacity-50'
                      }`}
                      onClick={() => configured && handleToggleIMBinding(platform)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center">
                          <img src={logo} alt={i18nService.t(platform)} className="w-6 h-6 object-contain rounded" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {i18nService.t(platform)}
                          </div>
                          {!configured && (
                            <div className="text-xs text-secondary/50">
                              {i18nService.t('agentIMNotConfiguredHint') || 'Please configure in Settings > IM Bots first'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {configured ? (
                          <div
                            className={`relative w-9 h-5 rounded-full transition-colors ${
                              bound ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          >
                            <div
                              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                bound ? 'translate-x-4' : 'translate-x-0.5'
                              }`}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-secondary/50">
                            {i18nService.t('agentIMNotConfigured') || 'Not configured'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border">
          <div className="min-h-[1rem] flex-1">
            {saveWarningState ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2">
                <div className="text-xs font-medium text-amber-800 dark:text-amber-200">
                  {i18nService.t('agentToolBundlesSaveWarningTitle')}
                </div>
                <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  {i18nService.t('agentToolBundlesSaveWarningBody')
                    .replace('{count}', String(saveWarningState.missingBundles.length))
                    .replace('{bundles}', saveWarningState.previewBundles.join(', '))
                    .replace('{moreText}', saveWarningMoreText)}
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={handleRequestClose}
              className="px-4 py-2.5 text-sm font-medium rounded-xl text-secondary hover:bg-surface-raised transition-colors"
            >
              {i18nService.t('cancel') || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!name.trim() || creating}
              className="px-5 py-2.5 text-sm font-medium rounded-xl bg-primary text-white shadow-sm hover:bg-primary-hover hover:shadow-md hover:-translate-y-[1px] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm transition-all duration-200"
            >
              {saveButtonLabel}
            </button>
          </div>
        </div>
      </div>
      {showUnsavedConfirm && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/40"
          onClick={(event) => {
            event.stopPropagation();
            setShowUnsavedConfirm(false);
          }}
        >
          <div
            className="w-full max-w-sm mx-4 rounded-2xl border border-border bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">
                {i18nService.t('agentCreateDiscardTitle')}
              </h3>
              <p className="mt-1 text-sm text-secondary">
                {i18nService.t('agentCreateDiscardMessage')}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowUnsavedConfirm(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg text-secondary hover:bg-surface-raised transition-colors"
              >
                {i18nService.t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                {i18nService.t('agentCreateDiscardConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentCreateModal;
