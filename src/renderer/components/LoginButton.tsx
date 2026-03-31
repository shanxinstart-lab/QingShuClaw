import React, { useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { authService } from '../services/auth';
import { i18nService } from '../services/i18n';
import type { CreditItem } from '../store/slices/authSlice';
import {
  AuthBackend,
  FeishuScanSessionStatus,
  type AuthBackend as AuthBackendType,
} from '../../common/auth';

const FEISHU_LOGIN_WAIT_SECONDS = 60;
const FEISHU_LOGIN_POLL_INTERVAL_MS = 1500;

const getSubscriptionBadge = (label: string) => {
  // Determine badge style based on label
  const isStandard = /标准|Standard/i.test(label);
  const isAdvanced = /进阶|Advanced/i.test(label);
  const isPro = /专业|Pro/i.test(label);

  if (isPro) {
    return {
      bg: 'bg-gradient-to-r from-amber-500 to-yellow-400',
      text: 'text-white',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
          <path d="M2 4l3 12h14l3-12-5 4-5-6-5 6z" /><path d="M5 16l-1.5 4h17L19 16" />
        </svg>
      ),
    };
  }
  if (isAdvanced) {
    return {
      bg: 'bg-gradient-to-r from-purple-500 to-violet-400',
      text: 'text-white',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
    };
  }
  if (isStandard) {
    return {
      bg: 'bg-gradient-to-r from-blue-500 to-cyan-400',
      text: 'text-white',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    };
  }

  return null;
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '';
  // Format "2026-03-29" to "26.03.29"
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[0].slice(2)}.${parts[1]}.${parts[2]}`;
};

const formatCredits = (n: number): string => {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
};

const CreditItemRow: React.FC<{ item: CreditItem; isEn: boolean }> = ({ item, isEn }) => {
  const label = isEn ? item.labelEn : item.label;
  const badge = item.type === 'subscription' ? getSubscriptionBadge(label) : null;
  const expiresText = item.expiresAt
    ? `${i18nService.t('authExpiresAt')}${formatDate(item.expiresAt)}`
    : '';

  return (
    <div className="flex flex-col gap-0.5 py-1.5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-1.5">
        {badge ? (
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.bg} ${badge.text}`}>
            {badge.icon}
            {label}
          </span>
        ) : (
          <span className="text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary">
            {label}
          </span>
        )}
        <span className="text-xs font-medium dark:text-claude-darkText text-claude-text">
          {formatCredits(item.creditsRemaining)}{i18nService.t('authCreditsUnit')}
        </span>
      </div>
      {expiresText && (
        <span className="text-[10px] dark:text-claude-darkTextSecondary text-claude-textSecondary pl-0.5">
          {expiresText}
        </span>
      )}
    </div>
  );
};

const showToast = (message: string) => {
  window.dispatchEvent(new CustomEvent('app:showToast', { detail: message }));
};

const AVATAR_TONES = [
  'from-amber-500 to-orange-500',
  'from-cyan-500 to-sky-500',
  'from-emerald-500 to-teal-500',
  'from-fuchsia-500 to-pink-500',
  'from-indigo-500 to-blue-500',
  'from-rose-500 to-red-500',
] as const;

const getAvatarText = (value?: string | null): string => {
  const normalized = (value || '').trim();
  if (!normalized) {
    return '?';
  }

  const compact = normalized.replace(/\s+/g, '');
  return compact.slice(0, Math.min(2, compact.length)).toUpperCase();
};

const getAvatarTone = (seed: string): string => {
  if (!seed) {
    return AVATAR_TONES[0];
  }

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
};

const UserAvatar: React.FC<{
  avatarUrl?: string | null;
  displayName?: string | null;
  className?: string;
}> = ({ avatarUrl, displayName, className = 'h-4 w-4' }) => {
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={`${className} rounded-full object-cover`} />;
  }

  const initials = getAvatarText(displayName);
  const tone = getAvatarTone(displayName || initials);
  return (
    <span
      className={`${className} inline-flex items-center justify-center rounded-full bg-gradient-to-br ${tone} text-[9px] font-semibold uppercase tracking-[0.08em] text-white shadow-sm`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
};

const LobsterWaitingIndicator: React.FC = () => {
  return (
    <div className="qs-lobster-waiting-shell" aria-hidden="true">
      <div className="qs-lobster-grid" />
      <div className="qs-lobster-scan-ring">
        <div className="qs-lobster-scan-sweep" />
      </div>
      <div className="qs-lobster-ripple qs-lobster-ripple-1" />
      <div className="qs-lobster-ripple qs-lobster-ripple-2" />
      <div className="qs-lobster-ripple qs-lobster-ripple-3" />

      <div className="qs-lobster-trace qs-lobster-trace-a">
        <span className="qs-lobster-trace-tail" />
        <span className="qs-lobster-trace-head" />
      </div>
      <div className="qs-lobster-trace qs-lobster-trace-b">
        <span className="qs-lobster-trace-tail" />
        <span className="qs-lobster-trace-head" />
      </div>

      <div className="qs-lobster-core">
        <svg viewBox="0 0 96 96" className="qs-lobster-mark" fill="none">
          <path
            d="M48 20c4.9 0 8.8 3.9 8.8 8.8v10.4c5.8 2.2 9.9 7.8 9.9 14.4 0 5.6-2.9 10.6-7.3 13.5l4.5 10.9c0.9 2.1-0.1 4.5-2.2 5.4-2.1 0.9-4.5-0.1-5.4-2.2l-3.8-9.4h-8.9l-3.8 9.4c-0.9 2.1-3.3 3.1-5.4 2.2-2.1-0.9-3.1-3.3-2.2-5.4L36.6 67c-4.4-2.9-7.3-7.9-7.3-13.5 0-6.6 4.1-12.2 9.9-14.4V28.8c0-4.9 3.9-8.8 8.8-8.8Z"
            fill="currentColor"
            opacity="0.94"
          />
          <path
            d="M34.7 46.6 22.8 40c-3-1.7-6.7-0.6-8.4 2.4-1.7 3-0.6 6.7 2.4 8.4l10.8 6.1m33.7-10.3L73.2 40c3-1.7 6.7-0.6 8.4 2.4 1.7 3 0.6 6.7-2.4 8.4l-10.8 6.1"
            stroke="currentColor"
            strokeWidth="5.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M37 22 30 13m29 9 7-9M41.5 14.5 36 7m18.5 7.5L60 7"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="41" cy="47.5" r="2.8" fill="#F8FAFC" />
          <circle cx="55" cy="47.5" r="2.8" fill="#F8FAFC" />
          <path
            d="M43.5 58.5c2.2 1.8 6.8 1.8 9 0"
            stroke="#F8FAFC"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};

const QtbLoginPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isWaitingFeishuLogin, setIsWaitingFeishuLogin] = useState(false);
  const [feishuCountdown, setFeishuCountdown] = useState(FEISHU_LOGIN_WAIT_SECONDS);
  const [feishuScanSessionId, setFeishuScanSessionId] = useState('');
  const [submittingMode, setSubmittingMode] = useState<'password' | 'feishu' | null>(null);
  const inputsDisabled = submittingMode !== null || isWaitingFeishuLogin;

  const completeFeishuLogin = () => {
    setIsWaitingFeishuLogin(false);
    setNotice('');
    setFeishuCountdown(FEISHU_LOGIN_WAIT_SECONDS);
    setFeishuScanSessionId('');
    showToast(i18nService.t('authLoginSuccess'));
    onClose();
  };

  useEffect(() => {
    if (!isWaitingFeishuLogin || !isLoggedIn) {
      return;
    }

    completeFeishuLogin();
  }, [isLoggedIn, isWaitingFeishuLogin, onClose]);

  useEffect(() => {
    if (!isWaitingFeishuLogin) {
      return;
    }

    if (feishuCountdown <= 0) {
      setIsWaitingFeishuLogin(false);
      setNotice(i18nService.t('authFeishuLoginTimeout'));
      setFeishuScanSessionId('');
      return;
    }

    const timer = window.setTimeout(() => {
      setFeishuCountdown((current) => current - 1);
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [feishuCountdown, isWaitingFeishuLogin]);

  useEffect(() => {
    if (!isWaitingFeishuLogin || !feishuScanSessionId) {
      return;
    }

    let disposed = false;
    let timer: number | null = null;

    const pollLoginState = async () => {
      try {
        const session = await authService.pollFeishuScanSession(feishuScanSessionId);
        if (disposed || !isWaitingFeishuLogin) {
          return;
        }

        if (session.authenticated) {
          completeFeishuLogin();
          return;
        }

        if (session.status === FeishuScanSessionStatus.Scanned) {
          setNotice(i18nService.t('authFeishuLoginScannedTip'));
        } else if (session.status === FeishuScanSessionStatus.Bound) {
          setNotice(i18nService.t('authFeishuLoginBindingTip'));
        } else if (session.status === FeishuScanSessionStatus.Pending) {
          setNotice(i18nService.t('authFeishuLoginPendingTip'));
        } else if (session.status === FeishuScanSessionStatus.Failed) {
          setIsWaitingFeishuLogin(false);
          setFeishuScanSessionId('');
          setError(session.errorMessage || i18nService.t('authLoginFailed'));
          return;
        } else if (session.status === FeishuScanSessionStatus.Expired) {
          setIsWaitingFeishuLogin(false);
          setFeishuScanSessionId('');
          setNotice(i18nService.t('authFeishuLoginTimeout'));
          return;
        }
      } catch (pollError) {
        if (disposed) {
          return;
        }
        setIsWaitingFeishuLogin(false);
        setFeishuScanSessionId('');
        setError(
          pollError instanceof Error
            ? pollError.message
            : i18nService.t('authLoginFailed')
        );
        return;
      }

      timer = window.setTimeout(() => {
        void pollLoginState();
      }, FEISHU_LOGIN_POLL_INTERVAL_MS);
    };

    void pollLoginState();

    return () => {
      disposed = true;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [feishuScanSessionId, isWaitingFeishuLogin, onClose]);

  const handlePasswordLogin = async () => {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setError(i18nService.t('authEnterUsernameAndPassword'));
      return;
    }

    setSubmittingMode('password');
    setError('');
    setNotice('');
    setIsWaitingFeishuLogin(false);
    setFeishuScanSessionId('');
    try {
      await authService.loginWithPassword(normalizedUsername, password);
      onClose();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : i18nService.t('authLoginFailed')
      );
    } finally {
      setSubmittingMode(null);
    }
  };

  const handleFeishuLogin = async () => {
    setSubmittingMode('feishu');
    setError('');
    setNotice('');
    console.info('[Auth] Starting Feishu login from the sidebar panel');
    try {
      const session = await authService.createFeishuScanSession();
      if (!session.authorizeUrl) {
        throw new Error(i18nService.t('authLoginFailed'));
      }

      const openResult = await window.electron.auth.login(session.authorizeUrl);
      if (!openResult.success) {
        throw new Error(openResult.error || i18nService.t('authLoginFailed'));
      }
      console.info('[Auth] Feishu login request opened successfully');
      setNotice(i18nService.t('authFeishuLoginPendingTip'));
      setIsWaitingFeishuLogin(true);
      setFeishuCountdown(FEISHU_LOGIN_WAIT_SECONDS);
      setFeishuScanSessionId(session.scanSessionId);
      showToast(i18nService.t('authOpenFeishuLogin'));
    } catch (loginError) {
      console.error('[Auth] Feishu login request failed:', loginError);
      setError(
        loginError instanceof Error
          ? loginError.message
          : i18nService.t('authLoginFailed')
      );
    } finally {
      setSubmittingMode(null);
    }
  };

  const handleCancelFeishuWaiting = () => {
    setIsWaitingFeishuLogin(false);
    setFeishuCountdown(FEISHU_LOGIN_WAIT_SECONDS);
    setFeishuScanSessionId('');
    setNotice('');
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 w-[18rem] rounded-2xl border border-claude-border bg-claude-surface p-4 shadow-popover dark:border-claude-darkBorder dark:bg-claude-darkSurface z-[70] popover-enter">
      <div className="mb-3">
        <div className="text-sm font-semibold text-claude-text dark:text-claude-darkText">
          {i18nService.t('authLoginPanelTitle')}
        </div>
        <div className="mt-1 text-xs text-claude-textSecondary dark:text-claude-darkTextSecondary">
          {i18nService.t('authLoginPanelHint')}
        </div>
      </div>

      <div className="space-y-2.5">
        <label className="block">
          <div className="mb-1 text-xs text-claude-textSecondary dark:text-claude-darkTextSecondary">
            {i18nService.t('authUsername')}
          </div>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={inputsDisabled}
            placeholder={i18nService.t('authUsernamePlaceholder')}
            className="w-full rounded-xl border border-claude-border bg-white px-3 py-2 text-sm text-claude-text outline-none transition-colors focus:border-claude-accent disabled:cursor-not-allowed disabled:opacity-60 dark:border-claude-darkBorder dark:bg-claude-darkSurfaceHover dark:text-claude-darkText"
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs text-claude-textSecondary dark:text-claude-darkTextSecondary">
            {i18nService.t('password')}
          </div>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={inputsDisabled}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !inputsDisabled) {
                void handlePasswordLogin();
              }
            }}
            placeholder={i18nService.t('authPasswordPlaceholder')}
            className="w-full rounded-xl border border-claude-border bg-white px-3 py-2 text-sm text-claude-text outline-none transition-colors focus:border-claude-accent disabled:cursor-not-allowed disabled:opacity-60 dark:border-claude-darkBorder dark:bg-claude-darkSurfaceHover dark:text-claude-darkText"
          />
        </label>

        {error && (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        )}

        {isWaitingFeishuLogin ? (
          <div className="rounded-xl bg-emerald-50 px-3 py-3 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <div className="flex flex-col items-center text-center">
              <LobsterWaitingIndicator />
              <div className="mt-1 text-xs font-medium tracking-[0.08em] text-emerald-800/80 dark:text-emerald-200/80">
                QINGSHU CLAW LINK
              </div>
              <div className="mt-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {i18nService.t('authFeishuLoginWaitingTitle')}
              </div>
              <div className="mt-2 text-xs leading-5 opacity-90">
                {notice || i18nService.t('authFeishuLoginPendingTip')}
              </div>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[11px] font-medium text-emerald-700 shadow-sm ring-1 ring-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-400/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                {i18nService.t('authFeishuLoginCountdown').replace('{seconds}', String(feishuCountdown))}
              </div>
            </div>
          </div>
        ) : notice && !error ? (
          <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            {notice}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handlePasswordLogin()}
          disabled={inputsDisabled}
          className="w-full rounded-xl bg-claude-accent px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submittingMode === 'password'
            ? i18nService.t('authLoggingIn')
            : i18nService.t('authPasswordLogin')}
        </button>

        <button
          type="button"
          onClick={() => void handleFeishuLogin()}
          disabled={submittingMode !== null}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-claude-border px-3 py-2 text-sm font-medium text-claude-text transition-colors hover:bg-claude-surfaceHover disabled:cursor-not-allowed disabled:opacity-60 dark:border-claude-darkBorder dark:text-claude-darkText dark:hover:bg-claude-darkSurfaceHover"
        >
          <svg viewBox="0 0 1024 1024" width="16" height="16" aria-hidden="true">
            <path
              d="M512 0C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0z"
              fill="#3370FF"
            />
            <path
              d="M706.4 324.8L512 276.8l-194.4 48c-12.8 3.2-20.8 16-17.6 28.8l48 194.4c3.2 12.8 16 20.8 28.8 17.6l194.4-48 194.4 48c12.8 3.2 25.6-4.8 28.8-17.6l48-194.4c3.2-12.8-4.8-25.6-17.6-28.8z"
              fill="#fff"
            />
            <path
              d="M512 512L317.6 560c-12.8 3.2-20.8 16-17.6 28.8l48 194.4c3.2 12.8 16 20.8 28.8 17.6L512 752l135.2 48.8c12.8 3.2 25.6-4.8 28.8-17.6l48-194.4c3.2-12.8-4.8-25.6-17.6-28.8L512 512z"
              fill="#fff"
              opacity="0.6"
            />
          </svg>
          <span>
            {submittingMode === 'feishu'
              ? i18nService.t('authOpenFeishuLogin')
              : isWaitingFeishuLogin
                ? i18nService.t('authFeishuLoginRetry')
              : i18nService.t('authFeishuLogin')}
          </span>
        </button>

        {isWaitingFeishuLogin && (
          <button
            type="button"
            onClick={handleCancelFeishuWaiting}
            className="w-full rounded-xl px-3 py-2 text-sm font-medium text-claude-textSecondary transition-colors hover:bg-claude-surfaceHover dark:text-claude-darkTextSecondary dark:hover:bg-claude-darkSurfaceHover"
          >
            {i18nService.t('cancel')}
          </button>
        )}
      </div>
    </div>
  );
};

const UserMenu: React.FC<{ onClose: () => void; authBackend: AuthBackendType }> = ({ onClose, authBackend }) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const profileSummary = useSelector((state: RootState) => state.auth.profileSummary);
  const [creditsExpanded, setCreditsExpanded] = useState(false);
  const isEn = i18nService.getLanguage() === 'en';
  const isLegacyBackend = authBackend === AuthBackend.LegacyLobster;
  const showCreditsSection = profileSummary !== null;

  useEffect(() => {
    authService.fetchProfileSummary();
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    onClose();
  };

  const handleSubscribe = async () => {
    const { getPortalPricingUrl } = await import('../services/endpoints');
    await window.electron.shell.openExternal(getPortalPricingUrl());
  };

  const handleLearnMore = async () => {
    const { getPortalProfileUrl } = await import('../services/endpoints');
    await window.electron.shell.openExternal(getPortalProfileUrl());
  };

  const handleOpenQtbWeb = async () => {
    try {
      await authService.openQtbWebPortal('/');
      onClose();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : i18nService.t('authOpenQtbWebFailed')
      );
    }
  };

  const phoneSuffix = user?.phone ? user.phone.slice(-4) : '';
  const secondaryIdentity = user?.email || (phoneSuffix ? `****${phoneSuffix}` : '');

  const totalCredits = profileSummary?.totalCreditsRemaining ?? 0;
  const creditItems = profileSummary?.creditItems ?? [];
  const hasCredits = creditItems.length > 0;

  return (
    <div className="absolute bottom-full left-[-0.5rem] mb-1 w-[14.5rem] dark:bg-claude-darkSurface bg-claude-surface rounded-xl shadow-popover border dark:border-claude-darkBorder border-claude-border overflow-hidden z-[70] popover-enter">
      {/* Account info */}
      {authBackend === AuthBackend.Qtb ? (
        <button
          type="button"
          onClick={() => void handleOpenQtbWeb()}
          className="w-full px-4 py-3 border-b dark:border-claude-darkBorder border-claude-border text-left hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover transition-colors"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium dark:text-claude-darkText text-claude-text truncate">
                {user?.nickname || phoneSuffix}
              </div>
              {secondaryIdentity && (
                <div className="text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary mt-0.5 truncate">
                  {secondaryIdentity}
                </div>
              )}
            </div>
            <div className="shrink-0 text-[11px] text-claude-accent dark:text-emerald-300">
              {i18nService.t('authOpenQtbWeb')}
            </div>
          </div>
        </button>
      ) : (
        <div className="px-4 py-3 border-b dark:border-claude-darkBorder border-claude-border">
          <div className="text-sm font-medium dark:text-claude-darkText text-claude-text truncate">
            {user?.nickname || phoneSuffix}
          </div>
          {secondaryIdentity && (
            <div className="text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary mt-0.5">
              {secondaryIdentity}
            </div>
          )}
        </div>
      )}

      {showCreditsSection && (
        <div className="border-b dark:border-claude-darkBorder border-claude-border">
          <button
            type="button"
            onClick={() => setCreditsExpanded(!creditsExpanded)}
            className="w-full px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover transition-colors"
          >
            <span className="text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary">
              {i18nService.t('authCreditsRemaining')}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium dark:text-claude-darkText text-claude-text">
                {formatCredits(totalCredits)}{i18nService.t('authCreditsUnit')}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`dark:text-claude-darkTextSecondary text-claude-textSecondary transition-transform duration-200 ${creditsExpanded ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {creditsExpanded && (
            <div className="px-4 pb-3">
              {hasCredits ? (
                <div className="divide-y dark:divide-claude-darkBorder divide-claude-border">
                  {creditItems.map((item, idx) => (
                    <CreditItemRow key={idx} item={item} isEn={isEn} />
                  ))}
                </div>
              ) : (
                <div className="text-xs dark:text-claude-darkTextSecondary text-claude-textSecondary py-1">
                  {i18nService.t('authZeroCredits')}
                </div>
              )}
              {isLegacyBackend && (
                <button
                  type="button"
                  onClick={handleLearnMore}
                  className="mt-2 text-xs text-claude-accent hover:underline cursor-pointer"
                >
                  {i18nService.t('authLearnMore')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="py-1">
        {isLegacyBackend && (
          <button
            type="button"
            onClick={handleSubscribe}
            className="w-full px-4 py-2 text-left text-sm dark:text-claude-darkText text-claude-text dark:hover:bg-claude-darkSurfaceHover hover:bg-claude-surfaceHover transition-colors cursor-pointer"
          >
            {i18nService.t('authValueAddedServices')}
          </button>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full px-4 py-2 text-left text-sm text-red-500 dark:hover:bg-claude-darkSurfaceHover hover:bg-claude-surfaceHover transition-colors cursor-pointer flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {i18nService.t('authLogout')}
        </button>
      </div>
    </div>
  );
};

const LoginButton: React.FC = () => {
  const { isLoggedIn, isLoading, user } = useSelector((state: RootState) => state.auth);
  const [showMenu, setShowMenu] = useState(false);
  const [authBackend, setAuthBackend] = useState<AuthBackendType>(AuthBackend.LegacyLobster);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  useEffect(() => {
    let mounted = true;

    authService.getBackend().then((backend) => {
      if (mounted) {
        setAuthBackend(backend);
      }
    }).catch(() => {
      if (mounted) {
        setAuthBackend(AuthBackend.LegacyLobster);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading) {
    return null;
  }

  const handleClick = async () => {
    if (isLoggedIn) {
      setShowMenu(!showMenu);
    } else if (authBackend === AuthBackend.Qtb) {
      setShowMenu(!showMenu);
    } else {
      await authService.login();
    }
  };

  const phoneSuffix = user?.phone ? user.phone.slice(-4) : '';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium dark:text-claude-darkTextSecondary text-claude-textSecondary hover:text-claude-text dark:hover:text-claude-darkText hover:bg-claude-surfaceHover dark:hover:bg-claude-darkSurfaceHover transition-colors cursor-pointer"
      >
        {isLoggedIn ? (
          <>
            <UserAvatar
              avatarUrl={user?.avatarUrl}
              displayName={user?.nickname || user?.displayName || user?.name || user?.email}
            />
            <span className="truncate max-w-[80px]">{user?.nickname || `****${phoneSuffix}`}</span>
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></svg>
            {i18nService.t('login')}
          </>
        )}
      </button>
      {showMenu && isLoggedIn && (
        <UserMenu authBackend={authBackend} onClose={() => setShowMenu(false)} />
      )}
      {showMenu && !isLoggedIn && authBackend === AuthBackend.Qtb && (
        <QtbLoginPanel onClose={() => setShowMenu(false)} />
      )}
    </div>
  );
};

export default LoginButton;
