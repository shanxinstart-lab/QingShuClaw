import { BrowserWindow } from 'electron';

import { getCopilotToken } from './githubCopilotAuth';

const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const MIN_REFRESH_DELAY_MS = 10 * 1000;
const RETRY_DELAY_MS = 60 * 1000;

interface TokenState {
  copilotToken: string;
  baseUrl: string;
  expiresAt: number;
  githubToken: string;
}

let tokenState: TokenState | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let refreshInFlight: Promise<void> | undefined;
let getStoreFn: (() => { get: (key: string) => unknown; set: (key: string, value: unknown) => void }) | null = null;
let onTokenRefreshCallbacks: Array<(state: TokenState) => void> = [];

export function initCopilotTokenManager(
  getStore: () => { get: (key: string) => unknown; set: (key: string, value: unknown) => void },
): void {
  getStoreFn = getStore;
}

export function setCopilotTokenState(params: {
  copilotToken: string;
  baseUrl: string;
  expiresAt: number;
  githubToken: string;
}): void {
  tokenState = {
    copilotToken: params.copilotToken,
    baseUrl: params.baseUrl,
    expiresAt: params.expiresAt,
    githubToken: params.githubToken,
  };
  scheduleRefresh();
}

export function clearCopilotTokenState(): void {
  tokenState = null;
  clearRefreshTimer();
}

export function getCurrentCopilotToken(): TokenState | null {
  return tokenState;
}

export function isCopilotTokenExpired(): boolean {
  if (!tokenState) {
    return true;
  }
  return tokenState.expiresAt - Date.now() < MIN_REFRESH_DELAY_MS;
}

export async function refreshCopilotTokenNow(): Promise<TokenState> {
  if (!tokenState?.githubToken) {
    const stored = getStoreFn?.()?.get('github_copilot_github_token') as string | undefined;
    if (!stored) {
      throw new Error('No GitHub token available for Copilot token refresh');
    }

    if (!tokenState) {
      tokenState = {
        copilotToken: '',
        baseUrl: '',
        expiresAt: 0,
        githubToken: stored,
      };
    } else {
      tokenState.githubToken = stored;
    }
  }

  if (refreshInFlight) {
    await refreshInFlight;
    if (!tokenState) {
      throw new Error('Token refresh completed but state was cleared');
    }
    return tokenState;
  }

  refreshInFlight = (async () => {
    const githubToken = tokenState!.githubToken;
    console.log('[CopilotTokenManager] refreshing Copilot API token...');
    try {
      const { token, expiresAt, baseUrl } = await getCopilotToken(githubToken);
      tokenState = {
        copilotToken: token,
        baseUrl,
        expiresAt,
        githubToken,
      };

      console.log(`[CopilotTokenManager] token refreshed, expires in ${Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))}s`);
      broadcastTokenUpdate(token, baseUrl);

      for (const callback of onTokenRefreshCallbacks) {
        try {
          callback(tokenState);
        } catch (error) {
          console.warn('[CopilotTokenManager] onTokenRefresh callback error:', error);
        }
      }

      scheduleRefresh();
    } finally {
      refreshInFlight = undefined;
    }
  })();

  await refreshInFlight;
  return tokenState!;
}

export function isCopilotAuthError(errorText: string): boolean {
  if (!errorText) return false;
  const lower = errorText.toLowerCase();
  return (
    lower.includes('401')
    || lower.includes('unauthorized')
    || lower.includes('token expired')
    || lower.includes('invalid token')
    || lower.includes('authentication')
    || lower.includes('auth')
    || lower.includes('editor-version')
    || lower.includes('ide auth')
  );
}

export function onCopilotTokenRefreshed(
  callback: (state: { copilotToken: string; baseUrl: string; expiresAt: number; githubToken: string }) => void,
): () => void {
  onTokenRefreshCallbacks.push(callback);
  return () => {
    onTokenRefreshCallbacks = onTokenRefreshCallbacks.filter((entry) => entry !== callback);
  };
}

function clearRefreshTimer(): void {
  if (refreshTimer !== undefined) {
    clearTimeout(refreshTimer);
    refreshTimer = undefined;
  }
}

function scheduleRefresh(): void {
  clearRefreshTimer();

  if (!tokenState?.expiresAt || !tokenState.githubToken) {
    return;
  }

  const refreshAt = tokenState.expiresAt - REFRESH_MARGIN_MS;
  const delayMs = Math.max(MIN_REFRESH_DELAY_MS, refreshAt - Date.now());

  console.log(`[CopilotTokenManager] scheduling token refresh in ${Math.round(delayMs / 1000)}s`);

  refreshTimer = setTimeout(async () => {
    try {
      await refreshCopilotTokenNow();
    } catch (error) {
      console.warn('[CopilotTokenManager] scheduled refresh failed, retrying in 60s:', error);
      refreshTimer = setTimeout(async () => {
        try {
          await refreshCopilotTokenNow();
        } catch (retryError) {
          console.error('[CopilotTokenManager] retry refresh also failed:', retryError);
        }
      }, RETRY_DELAY_MS);
    }
  }, delayMs);
}

function broadcastTokenUpdate(newToken: string, newBaseUrl: string): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('github-copilot:token-updated', { token: newToken, baseUrl: newBaseUrl });
    }
  }
}
