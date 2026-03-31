import { store } from '../store';
import {
  setAuthLoading,
  setLoggedIn,
  setLoggedOut,
  updateQuota,
  setProfileSummary,
  updateUserAvatar,
} from '../store/slices/authSlice';
import { setServerModels, clearServerModels } from '../store/slices/modelSlice';
import type { Model } from '../store/slices/modelSlice';
import {
  AuthBackend,
  BridgeTarget,
  type CreateBridgeTicketRequest,
  type AuthBackend as AuthBackendType,
  type FeishuScanSession,
  type FeishuScanSessionPollResult,
} from '../../common/auth';
import { i18nService } from './i18n';

class AuthService {
  private unsubCallback: (() => void) | null = null;
  private unsubBridgeCode: (() => void) | null = null;
  private unsubQuotaChanged: (() => void) | null = null;
  private unsubWindowState: (() => void) | null = null;
  private lastRefreshTime = 0;

  private showToast(message: string) {
    window.dispatchEvent(new CustomEvent('app:showToast', { detail: message }));
  }

  private async applyAuthenticatedUser(result: { user?: any; quota?: any }) {
    if (!result.user) {
      return false;
    }

    store.dispatch(setLoggedIn({ user: result.user, quota: result.quota }));
    await this.loadServerModels();
    void this.fetchProfileSummary();
    return true;
  }

  /**
   * Initialize: try to restore login state from persisted token.
   */
  async init() {
    // Clean up any existing listeners to prevent stacking on repeated init()
    this.destroy();

    store.dispatch(setAuthLoading(true));
    try {
      const result = await window.electron.auth.getUser();
      const restored = result.success && await this.applyAuthenticatedUser(result);
      if (!restored) {
        store.dispatch(setLoggedOut());
      }
    } catch {
      store.dispatch(setLoggedOut());
    }

    // Listen for OAuth callback from protocol handler
    this.unsubCallback = window.electron.auth.onCallback(async ({ code, state }) => {
      await this.handleCallback(code, state);
    });
    this.unsubBridgeCode = window.electron.auth.onBridgeCode(async ({ code }) => {
      await this.handleBridgeCode(code);
    });

    const pendingCallback = await window.electron.auth.getPendingCallback();
    if (pendingCallback?.code) {
      await this.handleCallback(pendingCallback.code, pendingCallback.state);
    }

    const pendingBridgeCode = await window.electron.auth.getPendingBridgeCode();
    if (pendingBridgeCode?.code) {
      await this.handleBridgeCode(pendingBridgeCode.code);
    }

    // Listen for quota changes (e.g. after cowork session using server model)
    this.unsubQuotaChanged = window.electron.auth.onQuotaChanged(() => {
      this.refreshQuota();
      this.loadServerModels();
    });

    // Refresh quota and models when Electron window gains focus — user may have purchased on portal
    this.unsubWindowState = window.electron.window.onStateChanged((state) => {
      if (state.isFocused && store.getState().auth.isLoggedIn) {
        const now = Date.now();
        if (now - this.lastRefreshTime > 30_000) {
          this.lastRefreshTime = now;
          this.refreshQuota();
          this.loadServerModels();
        }
      }
    });
  }

  /**
   * Initiate login (opens system browser).
   */
  async login() {
    const backend = await this.getBackend();
    const result = backend === AuthBackend.Qtb
      ? await window.electron.auth.login()
      : await window.electron.auth.login(await this.fetchLoginUrl());

    if (!result.success) {
      throw new Error(result.error || i18nService.t('authLoginFailed'));
    }
  }

  async createFeishuScanSession(): Promise<FeishuScanSession> {
    const result = await window.electron.auth.createFeishuScanSession();
    if (!result.success || !result.session) {
      throw new Error(result.error || i18nService.t('authLoginFailed'));
    }
    return result.session;
  }

  async pollFeishuScanSession(scanSessionId: string): Promise<FeishuScanSessionPollResult> {
    const result = await window.electron.auth.pollFeishuScanSession(scanSessionId);
    if (!result.success || !result.session) {
      throw new Error(result.error || i18nService.t('authLoginFailed'));
    }

    if (result.session.authenticated && result.session.user) {
      await this.applyAuthenticatedUser(result.session);
    }

    return result.session;
  }

  async loginWithPassword(username: string, password: string) {
    const result = await window.electron.auth.loginWithPassword({
      username,
      password,
    });

    if (!result.success || !result.user || !result.quota) {
      throw new Error(result.error || i18nService.t('authLoginFailed'));
    }

    await this.applyAuthenticatedUser(result);
  }

  async getBackend(): Promise<AuthBackendType> {
    try {
      const result = await window.electron.auth.getBackend();
      return result.backend || AuthBackend.LegacyLobster;
    } catch {
      return AuthBackend.LegacyLobster;
    }
  }

  /**
   * Fetch login URL from overmind, fallback to server base + /login.
   */
  private async fetchLoginUrl(): Promise<string> {
    const { getLoginOvermindUrl } = await import('./endpoints');
    const url = getLoginOvermindUrl();
    try {
      const response = await window.electron.api.fetch({
        url,
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (response.ok && typeof response.data === 'object' && response.data !== null) {
        const value = (response.data as any)?.data?.value;
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
    } catch (e) {
      console.error('[Auth] Failed to fetch login URL from overmind:', e);
    }
    // Fallback: let main process use its server base URL
    return '';
  }

  /**
   * Handle OAuth callback with auth code.
   */
  async handleCallback(code: string, state?: string) {
    try {
      const result = await window.electron.auth.exchange(code, state);
      if (result.success) {
        await this.applyAuthenticatedUser(result);
      }
    } catch (e) {
      console.error('Auth callback failed:', e);
    }
  }

  async createBridgeTicket(input: CreateBridgeTicketRequest) {
    const result = await window.electron.auth.createBridgeTicket(input);
    if (!result.success || !result.data) {
      throw new Error(result.error || i18nService.t('authLoginFailed'));
    }
    return result.data;
  }

  async handleBridgeCode(code: string) {
    try {
      const result = await window.electron.auth.exchangeBridgeCode({
        code,
        target: BridgeTarget.Desktop,
      });
      if (result.success) {
        await this.applyAuthenticatedUser(result);
      } else {
        this.showToast(result.error || i18nService.t('authLoginFailed'));
      }
    } catch (e) {
      console.error('Bridge auth failed:', e);
      this.showToast(e instanceof Error ? e.message : i18nService.t('authLoginFailed'));
    }
  }

  async openQtbWebPortal(redirectPath = '/') {
    const bridgeTicket = await this.createBridgeTicket({
      target: BridgeTarget.Web,
      redirectPath,
    });
    if (!bridgeTicket.launchUrl) {
      throw new Error(i18nService.t('authLoginFailed'));
    }
    await window.electron.shell.openExternal(bridgeTicket.launchUrl);
  }

  async syncLoginState(): Promise<boolean> {
    try {
      const result = await window.electron.auth.getUser();
      if (!result.success || !result.user) {
        return false;
      }

      await this.applyAuthenticatedUser(result);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Logout.
   */
  async logout() {
    await window.electron.auth.logout();
    store.dispatch(setLoggedOut());
    store.dispatch(clearServerModels());
  }

  /**
   * Refresh quota information.
   */
  async refreshQuota() {
    try {
      const result = await window.electron.auth.getQuota();
      if (result.success) {
        store.dispatch(updateQuota(result.quota));
        void this.fetchProfileSummary();
      }
    } catch {
      // ignore
    }
  }

  /**
   * Fetch profile summary (credits breakdown).
   */
  async fetchProfileSummary() {
    try {
      const result = await window.electron.auth.getProfileSummary();
      if (result.success && result.data) {
        store.dispatch(setProfileSummary(result.data));
        if (result.data.avatarUrl) {
          store.dispatch(updateUserAvatar(result.data.avatarUrl));
        }
      }
    } catch {
      // ignore
    }
  }

  /**
   * Get current access token (for proxy API calls).
   */
  async getAccessToken(): Promise<string | null> {
    try {
      return await window.electron.auth.getAccessToken();
    } catch {
      return null;
    }
  }

  destroy() {
    this.unsubCallback?.();
    this.unsubCallback = null;
    this.unsubBridgeCode?.();
    this.unsubBridgeCode = null;
    this.unsubQuotaChanged?.();
    this.unsubQuotaChanged = null;
    this.unsubWindowState?.();
    this.unsubWindowState = null;
  }

  /**
   * Load available models from server and dispatch to store.
   */
  private async loadServerModels() {
    try {
      const modelsResult = await window.electron.auth.getModels();
      if (modelsResult.success && modelsResult.models) {
        const serverModels: Model[] = modelsResult.models.map((m: { modelId: string; modelName: string; provider: string; apiFormat: string; supportsImage?: boolean }) => ({
          id: m.modelId,
          name: m.modelName,
          provider: m.provider,
          providerKey: 'lobsterai-server',
          isServerModel: true,
          serverApiFormat: m.apiFormat,
          supportsImage: m.supportsImage ?? false,
        }));
        store.dispatch(setServerModels(serverModels));
      } else {
        store.dispatch(clearServerModels());
      }
    } catch {
      store.dispatch(clearServerModels());
    }
  }
}

export const authService = new AuthService();
