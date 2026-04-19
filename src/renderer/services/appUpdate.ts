import type { LocalizedText, UpdateConfig } from './brandRuntime';
import { getUpdateQueryString } from './installationId';
import { localStore } from './store';

export const APP_UPDATE_LAST_CHECKED_AT_KEY = 'app_update_last_checked_at';
export const APP_UPDATE_CACHED_INFO_KEY = 'app_update_cached_info';

type ChangeLogLang = {
  title?: string;
  content?: string[];
};

type PlatformDownload = {
  url?: string;
};

type UpdateApiResponse = {
  code?: number;
  data?: {
    value?: {
      version?: string;
      date?: string;
      changeLog?: {
        ch?: ChangeLogLang;
        en?: ChangeLogLang;
      };
      macIntel?: PlatformDownload;
      macArm?: PlatformDownload;
      windowsX64?: PlatformDownload;
    };
  };
};

export type ChangeLogEntry = { title: string; content: string[] };

export interface AppUpdateDownloadProgress {
  received: number;
  total: number | undefined;
  percent: number | undefined;
  speed: number | undefined;
}

export interface AppUpdateInfo {
  latestVersion: string;
  date: string;
  changeLog: { zh: ChangeLogEntry; en: ChangeLogEntry };
  url: string;
  forceUpdate: boolean;
  minimumSupportedVersion: string;
  forceReason: LocalizedText | null;
}

const toVersionParts = (version: string): number[] => (
  version
    .split('.')
    .map((part) => {
      const match = part.trim().match(/^\d+/);
      return match ? Number.parseInt(match[0], 10) : 0;
    })
);

const compareVersions = (a: string, b: string): number => {
  const aParts = toVersionParts(a);
  const bParts = toVersionParts(b);
  const maxLength = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLength; i += 1) {
    const left = aParts[i] ?? 0;
    const right = bParts[i] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }

  return 0;
};

const isNewerVersion = (latestVersion: string, currentVersion: string): boolean => (
  compareVersions(latestVersion, currentVersion) > 0
);

const shouldForceUpdate = (currentVersion: string, updateConfig: UpdateConfig): boolean => {
  if (updateConfig.forceUpdate) {
    return true;
  }

  if (!updateConfig.minimumSupportedVersion) {
    return false;
  }

  return compareVersions(currentVersion, updateConfig.minimumSupportedVersion) < 0;
};

type UpdateValue = NonNullable<NonNullable<UpdateApiResponse['data']>['value']>;

const getPlatformDownloadUrl = (value: UpdateValue | undefined, fallbackDownloadUrl: string): string => {
  const { platform, arch } = window.electron;

  if (platform === 'darwin') {
    const download = arch === 'arm64' ? value?.macArm : value?.macIntel;
    return download?.url?.trim() || fallbackDownloadUrl;
  }

  if (platform === 'win32') {
    return value?.windowsX64?.url?.trim() || fallbackDownloadUrl;
  }

  return fallbackDownloadUrl;
};

const appendQueryString = (baseUrl: string, queryString: string): string => {
  if (!queryString) {
    return baseUrl;
  }
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${queryString}`;
};

export const checkForAppUpdate = async (
  currentVersion: string,
  options: {
    manual?: boolean;
    updateConfig: UpdateConfig;
  }
): Promise<AppUpdateInfo | null> => {
  const baseUrl = options.manual ? options.updateConfig.manualCheckUrl : options.updateConfig.autoCheckUrl;
  const queryString = await getUpdateQueryString();
  const url = appendQueryString(baseUrl, queryString);
  console.log(`[AppUpdate] checking update, currentVersion=${currentVersion}, url=${url}`);

  const response = await window.electron.api.fetch({
    url,
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok || typeof response.data !== 'object' || response.data === null) {
    console.log(`[AppUpdate] request failed: status=${response.status}, statusText=${response.statusText}`);
    return null;
  }

  const payload = response.data as UpdateApiResponse;
  if (payload.code !== 0) {
    console.log(`[AppUpdate] server returned error code: ${payload.code}`);
    return null;
  }

  const value = payload.data?.value;
  const latestVersion = value?.version?.trim();
  if (!latestVersion || !isNewerVersion(latestVersion, currentVersion)) {
    console.log(`[AppUpdate] no update available, latestVersion=${latestVersion || 'N/A'}, currentVersion=${currentVersion}`);
    return null;
  }

  const forceUpdate = shouldForceUpdate(currentVersion, options.updateConfig);

  const toEntry = (log?: ChangeLogLang): ChangeLogEntry => ({
    title: typeof log?.title === 'string' ? log.title : '',
    content: Array.isArray(log?.content) ? log.content : [],
  });

  const result: AppUpdateInfo = {
    latestVersion,
    date: value?.date?.trim() || '',
    changeLog: {
      zh: toEntry(value?.changeLog?.ch),
      en: toEntry(value?.changeLog?.en),
    },
    url: getPlatformDownloadUrl(value, options.updateConfig.fallbackDownloadUrl),
    forceUpdate,
    minimumSupportedVersion: options.updateConfig.minimumSupportedVersion,
    forceReason: forceUpdate ? options.updateConfig.forceReason : null,
  };
  console.log(
    `[AppUpdate] update available: ${currentVersion} -> ${latestVersion}, forceUpdate=${forceUpdate}, downloadUrl=${result.url}`
  );
  return result;
};

export const getStoredUpdateLastCheckedAt = async (): Promise<number> => {
  const lastCheckedAt = await localStore.getItem<number>(APP_UPDATE_LAST_CHECKED_AT_KEY);
  return typeof lastCheckedAt === 'number' && Number.isFinite(lastCheckedAt) ? lastCheckedAt : 0;
};

export const setStoredUpdateLastCheckedAt = async (timestamp: number): Promise<void> => {
  await localStore.setItem(APP_UPDATE_LAST_CHECKED_AT_KEY, timestamp);
};

export const getStoredAppUpdateInfo = async (): Promise<AppUpdateInfo | null> => {
  return await localStore.getItem<AppUpdateInfo>(APP_UPDATE_CACHED_INFO_KEY);
};

export const setStoredAppUpdateInfo = async (updateInfo: AppUpdateInfo): Promise<void> => {
  await localStore.setItem(APP_UPDATE_CACHED_INFO_KEY, updateInfo);
};

export const clearStoredAppUpdateInfo = async (): Promise<void> => {
  await localStore.removeItem(APP_UPDATE_CACHED_INFO_KEY);
};
