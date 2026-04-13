import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, store } from './store';
import Settings, { type SettingsOpenOptions } from './components/Settings';
import Sidebar from './components/Sidebar';
import LoginWelcomeOverlay from './components/LoginWelcomeOverlay';
import Toast from './components/Toast';
import WakeActivationOverlay from './components/WakeActivationOverlay';
import WindowTitleBar from './components/window/WindowTitleBar';
import { CoworkView } from './components/cowork';
import { SkillsView } from './components/skills';
import { ScheduledTasksView } from './components/scheduledTasks';
import { McpView } from './components/mcp';
import AgentsView from './components/agent/AgentsView';
import CoworkPermissionModal from './components/cowork/CoworkPermissionModal';
import CoworkQuestionWizard from './components/cowork/CoworkQuestionWizard';
import EngineStartupOverlay from './components/cowork/EngineStartupOverlay';
import { configService } from './services/config';
import { apiService } from './services/api';
import { themeService } from './services/theme';
import { coworkService } from './services/cowork';
import { authService } from './services/auth';
import { scheduledTaskService } from './services/scheduledTask';
import {
  checkForAppUpdate,
  clearStoredAppUpdateInfo,
  getStoredAppUpdateInfo,
  getStoredUpdateLastCheckedAt,
  setStoredAppUpdateInfo,
  setStoredUpdateLastCheckedAt,
  type AppUpdateInfo,
  type AppUpdateDownloadProgress,
} from './services/appUpdate';
import { defaultConfig, getProviderDisplayName } from './config';
import { setAvailableModels, setSelectedModel } from './store/slices/modelSlice';
import { clearSelection } from './store/slices/quickActionSlice';
import type { ApiConfig } from './services/api';
import type { CoworkPermissionResult } from './types/cowork';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { i18nService } from './services/i18n';
import { matchesShortcut } from './services/shortcuts';
import AppUpdateBadge from './components/update/AppUpdateBadge';
import AppUpdateModal from './components/update/AppUpdateModal';
import PrivacyDialog from './components/PrivacyDialog';
import { AppCustomEvent } from './constants/app';
import {
  nextWakeActivationOverlaySequence,
  shouldShowWakeActivationOverlay,
} from './components/wakeActivationOverlayHelpers';
import {
  getCachedBrandRuntimeConfig,
  getDefaultBrandRuntimeConfig,
  getPrivacyAgreementAcceptance,
  refreshBrandRuntimeConfig,
  savePrivacyAgreementAcceptance,
  type BrandRuntimeConfig,
} from './services/brandRuntime';

const App: React.FC = () => {
  const electronApi = typeof window !== 'undefined' ? window.electron : undefined;
  const platform = electronApi?.platform ?? 'unknown';
  const [showSettings, setShowSettings] = useState(false);
  const [settingsOptions, setSettingsOptions] = useState<SettingsOpenOptions>({});
  const [mainView, setMainView] = useState<'cowork' | 'skills' | 'scheduledTasks' | 'mcp' | 'agents'>('cowork');
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showLoginWelcome, setShowLoginWelcome] = useState(false);
  const [showWakeActivationOverlay, setShowWakeActivationOverlay] = useState(false);
  const [wakeActivationOverlaySequence, setWakeActivationOverlaySequence] = useState(0);
  const [, forceLanguageRefresh] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateModalState, setUpdateModalState] = useState<'info' | 'downloading' | 'installing' | 'error'>('info');
  const [downloadProgress, setDownloadProgress] = useState<AppUpdateDownloadProgress | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [privacyAgreed, setPrivacyAgreed] = useState<boolean | null>(null);
  const [brandRuntimeConfig, setBrandRuntimeConfig] = useState<BrandRuntimeConfig>(getDefaultBrandRuntimeConfig());
  const [enterpriseConfig, setEnterpriseConfig] = useState<{
    ui?: Record<string, 'hide' | 'disable' | 'readonly'>;
    disableUpdate?: boolean;
    autoAcceptPrivacy?: boolean;
  } | null>(null);
  const selectedModel = useSelector((state: RootState) => state.model.selectedModel);
  const currentSessionId = useSelector((state: RootState) => state.cowork.currentSessionId);
  const pendingPermissions = useSelector((state: RootState) => state.cowork.pendingPermissions);
  const pendingPermission = pendingPermissions[0] ?? null;
  const toastTimerRef = useRef<number | null>(null);
  const loginWelcomeTimerRef = useRef<number | null>(null);
  const hasInitialized = useRef(false);
  const dispatch = useDispatch();
  const isWindows = platform === 'win32';

  const waitWithTimeout = useCallback(
    async <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
      return await new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        promise.then(
          (value) => {
            window.clearTimeout(timer);
            resolve(value);
          },
          (error) => {
            window.clearTimeout(timer);
            reject(error);
          }
        );
      });
    },
    []
  );

  const disarmWakeFollowUp = useCallback(() => {
    if (!electronApi) {
      return;
    }
    void electronApi.speechFollowUp.disarm().catch((error) => {
      console.error('[WakeFollowUp] Failed to disarm speech follow-up:', error);
    });
  }, [electronApi]);

  const syncPrivacyAgreementState = useCallback(
    async (
      runtimeConfig: BrandRuntimeConfig,
      options?: { autoAccept?: boolean }
    ) => {
      if (!runtimeConfig.agreement.required) {
        setPrivacyAgreed(true);
        return true;
      }

      if (options?.autoAccept) {
        await savePrivacyAgreementAcceptance(runtimeConfig.agreement.version);
        setPrivacyAgreed(true);
        return true;
      }

      const acceptance = await getPrivacyAgreementAcceptance();
      const agreed = acceptance?.version === runtimeConfig.agreement.version;
      setPrivacyAgreed(agreed);
      return agreed;
    },
    []
  );

  // 初始化应用
  useEffect(() => {
    if (!electronApi) {
      return;
    }
    void electronApi.speechFollowUp.setActiveSession({ sessionId: currentSessionId ?? null }).catch((error) => {
      console.error('[WakeFollowUp] Failed to sync active session:', error);
    });
  }, [currentSessionId, electronApi]);

  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    const initializeApp = async () => {
      try {
        console.info('[App] initializeApp: start');
        if (!electronApi) {
          throw new Error(i18nService.t('initializationElectronUnavailable'));
        }
        // 标记平台，用于 CSS 条件样式（如 Windows 标题栏按钮区域留白）
        document.documentElement.classList.add(`platform-${platform}`);

        // 初始化配置
        console.info('[App] initializeApp: configService.init');
        await waitWithTimeout(configService.init(), 5000, 'configService.init');

        // Load enterprise config if present
        const entConfig = await electronApi.enterprise.getConfig();
        setEnterpriseConfig(entConfig);

        const cachedBrandConfig = await getCachedBrandRuntimeConfig();
        setBrandRuntimeConfig(cachedBrandConfig);

        // 初始化主题
        console.info('[App] initializeApp: themeService.initialize');
        themeService.initialize();

        // 初始化语言
        console.info('[App] initializeApp: i18nService.initialize');
        await waitWithTimeout(i18nService.initialize(), 5000, 'i18nService.initialize');

        // 初始化认证服务（恢复登录状态）
        console.info('[App] initializeApp: authService.init');
        await authService.init();

        console.info('[App] initializeApp: configService.getConfig');
        const config = await configService.getConfig();
        
        const apiConfig: ApiConfig = {
          apiKey: config.api.key,
          baseUrl: config.api.baseUrl,
        };
        apiService.setConfig(apiConfig);

        // 从 providers 配置中加载可用模型列表到 Redux
        const providerModels: { id: string; name: string; provider?: string; providerKey?: string; supportsImage?: boolean }[] = [];
        if (config.providers) {
          Object.entries(config.providers).forEach(([providerName, providerConfig]) => {
            if (providerConfig.enabled && providerConfig.models) {
              providerConfig.models.forEach((model: { id: string; name: string; supportsImage?: boolean }) => {
                providerModels.push({
                  id: model.id,
                  name: model.name,
                  provider: getProviderDisplayName(providerName, providerConfig),
                  providerKey: providerName,
                  supportsImage: model.supportsImage ?? false,
                });
              });
            }
          });
        }
        const fallbackModels = config.model.availableModels.map(model => ({
          id: model.id,
          name: model.name,
          providerKey: undefined,
          supportsImage: model.supportsImage ?? false,
        }));
        const resolvedModels = providerModels.length > 0 ? providerModels : fallbackModels;
        if (resolvedModels.length > 0) {
          dispatch(setAvailableModels(resolvedModels));
          // Search all available models (including server models loaded by authService)
          // so that a previously selected server model is correctly restored.
          const allModels = store.getState().model.availableModels;
          const preferredModel = allModels.find(
            model => model.id === config.model.defaultModel
              && (!config.model.defaultModelProvider || model.providerKey === config.model.defaultModelProvider)
          ) ?? allModels[0];
          dispatch(setSelectedModel(preferredModel));
        }

        if (entConfig?.disableUpdate || !cachedBrandConfig.update.enabled) {
          setUpdateInfo(null);
          await clearStoredAppUpdateInfo();
        } else {
          const cachedUpdateInfo = await getStoredAppUpdateInfo();
          setUpdateInfo(cachedUpdateInfo);
          if (cachedUpdateInfo?.forceUpdate) {
            setShowUpdateModal(true);
            setUpdateModalState('info');
            setUpdateError(null);
            setDownloadProgress(null);
          }
        }

        await syncPrivacyAgreementState(cachedBrandConfig, {
          autoAccept: entConfig?.autoAcceptPrivacy === true,
        });

        setIsInitialized(true);
        console.info('[App] initializeApp: shell ready');

        // 初始化定时任务服务，但不阻塞首屏
        void waitWithTimeout(scheduledTaskService.init(), 5000, 'scheduledTaskService.init').catch((error) => {
          console.error('[App] initializeApp: scheduledTaskService.init failed:', error);
        });

      } catch (error) {
        console.error('Failed to initialize app:', error);
        setInitError(error instanceof Error && error.message ? error.message : i18nService.t('initializationError'));
        setIsInitialized(true);
      }
    };

    void initializeApp();
  }, [dispatch, electronApi, platform, syncPrivacyAgreementState, waitWithTimeout]);

  useEffect(() => {
    const unsubscribe = i18nService.subscribe(() => {
      forceLanguageRefresh((prev) => prev + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    let cancelled = false;

    const refreshRuntimeConfig = async () => {
      try {
        const latestRuntimeConfig = await refreshBrandRuntimeConfig();
        if (cancelled) {
          return;
        }

        setBrandRuntimeConfig(latestRuntimeConfig);

        if (enterpriseConfig?.disableUpdate || !latestRuntimeConfig.update.enabled) {
          setUpdateInfo(null);
          setShowUpdateModal(false);
          await clearStoredAppUpdateInfo();
        } else {
          const cachedUpdateInfo = await getStoredAppUpdateInfo();
          setUpdateInfo(cachedUpdateInfo);
          if (cachedUpdateInfo?.forceUpdate) {
            setShowUpdateModal(true);
            setUpdateModalState('info');
            setUpdateError(null);
            setDownloadProgress(null);
          }
        }

        await syncPrivacyAgreementState(latestRuntimeConfig, {
          autoAccept: enterpriseConfig?.autoAcceptPrivacy === true,
        });
      } catch (error) {
        console.warn('[BrandRuntime] Failed to refresh runtime config:', error);
      }
    };

    void refreshRuntimeConfig();

    return () => {
      cancelled = true;
    };
  }, [
    enterpriseConfig?.autoAcceptPrivacy,
    enterpriseConfig?.disableUpdate,
    isInitialized,
    syncPrivacyAgreementState,
  ]);

  // Network status monitoring
  useEffect(() => {
    if (!electronApi) {
      return;
    }
    const handleOnline = () => {
      console.log('[Renderer] Network online');
      electronApi.networkStatus.send('online');
    };

    const handleOffline = () => {
      console.log('[Renderer] Network offline');
      electronApi.networkStatus.send('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [electronApi]);

  useEffect(() => {
    if (!isInitialized || !selectedModel?.id) return;
    const config = configService.getConfig();
    if (
      config.model.defaultModel === selectedModel.id
      && (config.model.defaultModelProvider ?? '') === (selectedModel.providerKey ?? '')
    ) {
      return;
    }
    void configService.updateConfig({
      model: {
        ...config.model,
        defaultModel: selectedModel.id,
        defaultModelProvider: selectedModel.providerKey,
      },
    });
  }, [isInitialized, selectedModel?.id, selectedModel?.providerKey]);

  const handleShowSettings = useCallback((options?: SettingsOpenOptions) => {
    setSettingsOptions({
      initialTab: options?.initialTab,
      notice: options?.notice,
    });
    setShowSettings(true);
  }, []);

  const handleShowSkills = useCallback(() => {
    setMainView('skills');
  }, []);

  const handleShowCowork = useCallback(() => {
    setMainView('cowork');
  }, []);

  const handleShowScheduledTasks = useCallback(() => {
    setMainView('scheduledTasks');
  }, []);

  const handleShowMcp = useCallback(() => {
    setMainView('mcp');
  }, []);

  const handleShowAgents = useCallback(() => {
    setMainView('agents');
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const handleNewChat = useCallback(() => {
    disarmWakeFollowUp();
    const shouldClearInput = mainView === 'cowork' || !!currentSessionId;
    coworkService.clearSession();
    dispatch(clearSelection());
    setMainView('cowork');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cowork:focus-input', {
        detail: { clear: shouldClearInput },
      }));
    }, 0);
  }, [currentSessionId, disarmWakeFollowUp, dispatch, mainView]);

  const handleFocusCoworkInput = useCallback((clear = false) => {
    setMainView('cowork');
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(AppCustomEvent.FocusCoworkInput, {
        detail: { clear },
      }));
    }, 0);
  }, []);

  const triggerWakeActivationOverlay = useCallback(() => {
    setShowWakeActivationOverlay(true);
    setWakeActivationOverlaySequence((current) => nextWakeActivationOverlaySequence(current));
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2200);
  }, []);

  const handleShowLogin = useCallback(() => {
    showToast(i18nService.t('featureInDevelopment'));
  }, [showToast]);

  const runUpdateCheck = useCallback(
    async (options?: { manual?: boolean }) => {
      if (!electronApi) {
        return null;
      }

      if (enterpriseConfig?.disableUpdate || !brandRuntimeConfig.update.enabled) {
        setUpdateInfo(null);
        setShowUpdateModal(false);
        await clearStoredAppUpdateInfo();
        return null;
      }

      const currentVersion = await electronApi.appInfo.getVersion();
      const requestedAt = Date.now();
      await setStoredUpdateLastCheckedAt(requestedAt);
      const nextUpdate = await checkForAppUpdate(currentVersion, {
        manual: options?.manual,
        updateConfig: brandRuntimeConfig.update,
      });

      setUpdateInfo(nextUpdate);

      if (nextUpdate) {
        await setStoredAppUpdateInfo(nextUpdate);
        if (nextUpdate.forceUpdate) {
          setShowUpdateModal(true);
          setUpdateModalState('info');
          setUpdateError(null);
          setDownloadProgress(null);
        }
      } else {
        await clearStoredAppUpdateInfo();
        if (!options?.manual && !updateInfo?.forceUpdate) {
          setShowUpdateModal(false);
        }
      }

      return nextUpdate;
    },
    [brandRuntimeConfig.update, electronApi, enterpriseConfig?.disableUpdate, updateInfo?.forceUpdate]
  );

  const handleOpenUpdateModal = useCallback(() => {
    if (!updateInfo) return;
    setUpdateModalState('info');
    setUpdateError(null);
    setDownloadProgress(null);
    setShowUpdateModal(true);
  }, [updateInfo]);

  const handleUpdateFound = useCallback((info: AppUpdateInfo) => {
    setUpdateInfo(info);
    setUpdateModalState('info');
    setUpdateError(null);
    setDownloadProgress(null);
    setShowUpdateModal(true);
  }, []);

  const handleManualCheckUpdate = useCallback(async (): Promise<'available' | 'upToDate' | 'error'> => {
    try {
      const nextUpdate = await runUpdateCheck({ manual: true });
      if (nextUpdate) {
        handleUpdateFound(nextUpdate);
        return 'available';
      }
      return 'upToDate';
    } catch (error) {
      console.error('Failed to manually check app update:', error);
      return 'error';
    }
  }, [handleUpdateFound, runUpdateCheck]);

  const handleConfirmUpdate = useCallback(async () => {
    if (!updateInfo) return;

    // If the URL is a fallback page (not a direct file download), open in browser
    if (updateInfo.url.includes('#') || updateInfo.url.endsWith('/download-list')) {
      if (!updateInfo.forceUpdate) {
        setShowUpdateModal(false);
      }
      if (!electronApi) {
        showToast(i18nService.t('updateOpenFailed'));
        return;
      }
      try {
        const result = await electronApi.shell.openExternal(updateInfo.url);
        if (!result.success) {
          showToast(i18nService.t('updateOpenFailed'));
        }
      } catch (error) {
        console.error('Failed to open update url:', error);
        showToast(i18nService.t('updateOpenFailed'));
      }
      return;
    }

    setUpdateModalState('downloading');
    setDownloadProgress(null);
    setUpdateError(null);

    if (!electronApi) {
      setUpdateModalState('error');
      setUpdateError(i18nService.t('initializationElectronUnavailable'));
      return;
    }

    const unsubscribe = electronApi.appUpdate.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
    });

    try {
      const downloadResult = await electronApi.appUpdate.download(updateInfo.url);
      unsubscribe();

      if (!downloadResult.success) {
        // If user cancelled, handleCancelDownload already set the state — don't overwrite
        if (downloadResult.error === 'Download cancelled') {
          return;
        }
        setUpdateModalState('error');
        setUpdateError(downloadResult.error || i18nService.t('updateDownloadFailed'));
        return;
      }

      setUpdateModalState('installing');
      const installResult = await electronApi.appUpdate.install(downloadResult.filePath!);

      if (!installResult.success) {
        setUpdateModalState('error');
        setUpdateError(installResult.error || i18nService.t('updateInstallFailed'));
      }
      // If successful, app will quit and relaunch
    } catch (error) {
      unsubscribe();
      const msg = error instanceof Error ? error.message : '';
      // If user cancelled, handleCancelDownload already set the state — don't overwrite
      if (msg === 'Download cancelled') {
        return;
      }
      setUpdateModalState('error');
      setUpdateError(msg || i18nService.t('updateDownloadFailed'));
    }
  }, [electronApi, updateInfo, showToast]);

  const handleCancelDownload = useCallback(async () => {
    if (!electronApi) {
      return;
    }
    if (updateInfo?.forceUpdate) {
      return;
    }
    await electronApi.appUpdate.cancelDownload();
    setUpdateModalState('info');
    setDownloadProgress(null);
  }, [electronApi, updateInfo?.forceUpdate]);

  const handleRetryUpdate = useCallback(() => {
    setUpdateModalState('info');
    setUpdateError(null);
    setDownloadProgress(null);
  }, []);

  useEffect(() => {
    if (!updateInfo?.forceUpdate) {
      return;
    }

    setShowUpdateModal(true);
    setUpdateModalState('info');
    setUpdateError(null);
    setDownloadProgress(null);
  }, [updateInfo?.forceUpdate, updateInfo?.latestVersion]);

  const handlePrivacyAccept = useCallback(async () => {
    await savePrivacyAgreementAcceptance(brandRuntimeConfig.agreement.version);
    setPrivacyAgreed(true);
  }, [brandRuntimeConfig.agreement.version]);

  const handlePrivacyReject = useCallback(() => {
    // 立刻隐藏窗口，让用户感觉立即关闭
    electronApi?.window.close();
  }, [electronApi]);

  const handleExitApp = useCallback(() => {
    electronApi?.window.close();
  }, [electronApi]);

  const handlePermissionResponse = useCallback(async (result: CoworkPermissionResult) => {
    if (!pendingPermission) return;
    await coworkService.respondToPermission(pendingPermission.requestId, result);
  }, [pendingPermission]);

  const handleCloseSettings = () => {
    setShowSettings(false);
    const config = configService.getConfig();
    apiService.setConfig({
      apiKey: config.api.key,
      baseUrl: config.api.baseUrl,
    });

    if (config.providers) {
      const allModels: { id: string; name: string; provider?: string; providerKey?: string; supportsImage?: boolean }[] = [];
      Object.entries(config.providers).forEach(([providerName, providerConfig]) => {
        if (providerConfig.enabled && providerConfig.models) {
          providerConfig.models.forEach((model: { id: string; name: string; supportsImage?: boolean }) => {
            allModels.push({
              id: model.id,
              name: model.name,
              provider: getProviderDisplayName(providerName, providerConfig),
              providerKey: providerName,
              supportsImage: model.supportsImage ?? false,
            });
          });
        }
      });
      if (allModels.length > 0) {
        dispatch(setAvailableModels(allModels));
      }
    }
  };

  const isShortcutInputActive = () => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) return false;
    return activeElement.dataset.shortcutInput === 'true';
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isShortcutInputActive()) return;

      const { shortcuts } = configService.getConfig();
      const activeShortcuts = {
        ...defaultConfig.shortcuts,
        ...(shortcuts ?? {}),
      };

      if (matchesShortcut(event, activeShortcuts.newChat)) {
        event.preventDefault();
        handleNewChat();
        return;
      }

      if (matchesShortcut(event, activeShortcuts.search)) {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('cowork:shortcut:search'));
        return;
      }

      if (matchesShortcut(event, activeShortcuts.settings)) {
        event.preventDefault();
        handleShowSettings();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleShowSettings, handleNewChat]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (loginWelcomeTimerRef.current) {
        window.clearTimeout(loginWelcomeTimerRef.current);
      }
    };
  }, []);

  // Listen for toast events from child components
  useEffect(() => {
    const handler = (e: Event) => {
      const message = (e as CustomEvent<string>).detail;
      if (message) showToast(message);
    };
    window.addEventListener(AppCustomEvent.ShowToast, handler);
    return () => window.removeEventListener(AppCustomEvent.ShowToast, handler);
  }, [showToast]);

  useEffect(() => {
    const handler = () => {
      if (showLoginWelcome) {
        return;
      }

      setShowLoginWelcome(true);
      if (loginWelcomeTimerRef.current) {
        window.clearTimeout(loginWelcomeTimerRef.current);
      }
      loginWelcomeTimerRef.current = window.setTimeout(() => {
        setShowLoginWelcome(false);
        loginWelcomeTimerRef.current = null;
      }, 2400);
    };

    window.addEventListener(AppCustomEvent.ShowLoginWelcome, handler);
    return () => {
      window.removeEventListener(AppCustomEvent.ShowLoginWelcome, handler);
    };
  }, [showLoginWelcome]);

  // 监听托盘菜单打开设置的 IPC 事件
  useEffect(() => {
    if (!electronApi) {
      return;
    }
    const unsubscribe = electronApi.ipcRenderer.on('app:openSettings', () => {
      handleShowSettings();
    });
    return unsubscribe;
  }, [electronApi, handleShowSettings]);

  // 监听托盘菜单新建任务的 IPC 事件
  useEffect(() => {
    if (!electronApi) {
      return;
    }
    const unsubscribe = electronApi.ipcRenderer.on('app:newTask', () => {
      handleNewChat();
    });
    return unsubscribe;
  }, [electronApi, handleNewChat]);

  useEffect(() => {
    if (!electronApi) {
      return;
    }
    const unsubscribe = electronApi.ipcRenderer.on('app:focusCoworkInput', (_payload?: { clear?: boolean }) => {
      handleFocusCoworkInput(Boolean(_payload?.clear));
    });
    return unsubscribe;
  }, [electronApi, handleFocusCoworkInput]);

  useEffect(() => {
    if (!electronApi) {
      return;
    }
    const unsubscribe = electronApi.wakeInput.onDictationRequested((request) => {
      disarmWakeFollowUp();
      handleFocusCoworkInput(false);
      if (shouldShowWakeActivationOverlay(request.source)) {
        triggerWakeActivationOverlay();
      }
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent(AppCustomEvent.StartWakeDictation, {
          detail: request,
        }));
      }, 0);
    });
    return unsubscribe;
  }, [disarmWakeFollowUp, electronApi, handleFocusCoworkInput, triggerWakeActivationOverlay]);

  useEffect(() => {
    if (!isInitialized) return;

    // Enterprise mode: completely skip update detection
    if (enterpriseConfig?.disableUpdate || !brandRuntimeConfig.update.enabled) return;

    let cancelled = false;

    const maybeCheck = async () => {
      if (cancelled) return;
      const now = Date.now();
      const lastCheckTime = await getStoredUpdateLastCheckedAt();
      if (lastCheckTime > 0 && now - lastCheckTime < brandRuntimeConfig.update.pollIntervalMs) {
        return;
      }

      try {
        await runUpdateCheck();
      } catch (error) {
        console.error('Failed to check app update:', error);
      }
    };

    // 启动时立即检查
    void maybeCheck();

    // 心跳：每 30 分钟检测是否距上次检查已超过 12 小时
    const timer = window.setInterval(() => {
      void maybeCheck();
    }, brandRuntimeConfig.update.heartbeatIntervalMs);

    // 窗口恢复可见时检测（覆盖休眠唤醒场景）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void maybeCheck();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    brandRuntimeConfig.update.enabled,
    brandRuntimeConfig.update.heartbeatIntervalMs,
    brandRuntimeConfig.update.pollIntervalMs,
    enterpriseConfig?.disableUpdate,
    isInitialized,
    runUpdateCheck,
  ]);

  // 根据场景选择使用哪个权限组件
  const permissionModal = useMemo(() => {
    if (!pendingPermission) return null;

    // 检查是否为 AskUserQuestion 且有多个问题 -> 使用向导式组件
    const isQuestionTool = pendingPermission.toolName === 'AskUserQuestion';
    if (isQuestionTool && pendingPermission.toolInput) {
      const rawQuestions = (pendingPermission.toolInput as Record<string, unknown>).questions;
      const hasMultipleQuestions = Array.isArray(rawQuestions) && rawQuestions.length > 1;

      if (hasMultipleQuestions) {
        return (
          <CoworkQuestionWizard
            permission={pendingPermission}
            onRespond={handlePermissionResponse}
          />
        );
      }
    }

    // 其他情况使用原有的权限模态框
    return (
      <CoworkPermissionModal
        permission={pendingPermission}
        onRespond={handlePermissionResponse}
      />
    );
  }, [pendingPermission, handlePermissionResponse]);

  const isOverlayActive = showSettings || showUpdateModal || pendingPermissions.length > 0;
  const updateChecksManaged = Boolean(enterpriseConfig?.disableUpdate) || !brandRuntimeConfig.update.enabled;
  const updateBadge = !updateChecksManaged && updateInfo ? (
    <AppUpdateBadge
      latestVersion={updateInfo.latestVersion}
      onClick={handleOpenUpdateModal}
    />
  ) : null;
  const windowsStandaloneTitleBar = isWindows ? (
    <div className="draggable relative h-9 shrink-0 bg-surface-raised">
      <WindowTitleBar isOverlayActive={isOverlayActive} />
    </div>
  ) : null;

  if (!isInitialized) {
    return (
      <div className="h-screen overflow-hidden flex flex-col">
        {windowsStandaloneTitleBar}
        <div className="flex-1 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-glow-accent animate-pulse">
              <ChatBubbleLeftRightIcon className="h-8 w-8 text-white" />
            </div>
            <div className="w-24 h-1 rounded-full bg-primary/20 overflow-hidden">
              <div className="h-full w-1/2 rounded-full bg-primary animate-shimmer" />
            </div>
            <div className="text-foreground text-xl font-medium">{i18nService.t('loading')}</div>
          </div>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="h-screen overflow-hidden flex flex-col">
        {windowsStandaloneTitleBar}
        <div className="flex-1 flex flex-col items-center justify-center bg-background">
          <div className="flex flex-col items-center space-y-6 max-w-md px-6">
            <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
              <ChatBubbleLeftRightIcon className="h-8 w-8 text-white" />
            </div>
            <div className="text-foreground text-xl font-medium text-center">{initError}</div>
            <button
              onClick={() => handleShowSettings()}
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md transition-colors text-sm font-medium"
            >
              {i18nService.t('openSettings')}
            </button>
          </div>
          {showSettings && (
            <Settings
              onClose={handleCloseSettings}
              initialTab={settingsOptions.initialTab}
              notice={settingsOptions.notice}
              onManualCheckUpdate={handleManualCheckUpdate}
              updateCheckManaged={updateChecksManaged}
              enterpriseConfig={enterpriseConfig}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-surface-raised">
      {showLoginWelcome && (
        <LoginWelcomeOverlay onClose={() => setShowLoginWelcome(false)} />
      )}
      {showWakeActivationOverlay && (
        <WakeActivationOverlay
          key={wakeActivationOverlaySequence}
          onClose={() => setShowWakeActivationOverlay(false)}
        />
      )}
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          onShowLogin={handleShowLogin}
          onShowSettings={handleShowSettings}
          activeView={mainView}
          onShowSkills={handleShowSkills}
          onShowCowork={handleShowCowork}
          onShowScheduledTasks={handleShowScheduledTasks}
          onShowMcp={handleShowMcp}
          onShowAgents={handleShowAgents}
          onNewChat={handleNewChat}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          updateBadge={!isSidebarCollapsed ? updateBadge : null}
          hideLogin={enterpriseConfig?.ui?.login === 'hide'}
        />
        <div className={`flex-1 min-w-0 py-1.5 pr-1.5 ${isSidebarCollapsed ? 'pl-1.5' : ''}`}>
          <div className="relative h-full min-h-0 rounded-xl bg-background overflow-hidden">
            <EngineStartupOverlay />
            {mainView === 'skills' ? (
              <SkillsView
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onNewChat={handleNewChat}
                updateBadge={isSidebarCollapsed ? updateBadge : null}
                readOnly={enterpriseConfig?.ui?.skills === 'readonly'}
              />
            ) : mainView === 'scheduledTasks' ? (
              <ScheduledTasksView
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onNewChat={handleNewChat}
                updateBadge={isSidebarCollapsed ? updateBadge : null}
              />
            ) : mainView === 'mcp' ? (
              <McpView
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onNewChat={handleNewChat}
                updateBadge={isSidebarCollapsed ? updateBadge : null}
              />
            ) : mainView === 'agents' ? (
              <AgentsView
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onNewChat={handleNewChat}
                onShowCowork={handleShowCowork}
                updateBadge={isSidebarCollapsed ? updateBadge : null}
              />
            ) : (
              <CoworkView
                onRequestAppSettings={handleShowSettings}
                onShowSkills={handleShowSkills}
                isSidebarCollapsed={isSidebarCollapsed}
                onToggleSidebar={handleToggleSidebar}
                onNewChat={handleNewChat}
                updateBadge={isSidebarCollapsed ? updateBadge : null}
              />
            )}
          </div>
        </div>
      </div>

      {/* 设置窗口显示在所有主内容之上，但不影响主界面的交互 */}
      {showSettings && (
        <Settings
          onClose={handleCloseSettings}
          initialTab={settingsOptions.initialTab}
          notice={settingsOptions.notice}
          onManualCheckUpdate={handleManualCheckUpdate}
          updateCheckManaged={updateChecksManaged}
          enterpriseConfig={enterpriseConfig}
        />
      )}
      {showUpdateModal && updateInfo && (
        <AppUpdateModal
          updateInfo={updateInfo}
          onCancel={() => {
            if (!updateInfo.forceUpdate && (updateModalState === 'info' || updateModalState === 'error')) {
              setShowUpdateModal(false);
              setUpdateModalState('info');
              setUpdateError(null);
              setDownloadProgress(null);
            }
          }}
          onConfirm={handleConfirmUpdate}
          modalState={updateModalState}
          downloadProgress={downloadProgress}
          errorMessage={updateError}
          onCancelDownload={handleCancelDownload}
          onRetry={handleRetryUpdate}
          onExitApp={handleExitApp}
        />
      )}
      {permissionModal}
      {privacyAgreed === false && (
        <PrivacyDialog
          agreement={brandRuntimeConfig.agreement}
          onAccept={handlePrivacyAccept}
          onReject={handlePrivacyReject}
        />
      )}
    </div>
  );
};

export default App; 
