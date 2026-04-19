import { store } from '../store';
import { localStore } from './store';

const INSTALLATION_UUID_KEY = 'installation_uuid';

let cachedId: string | null = null;

export const getInstallationId = async (): Promise<string | null> => {
  try {
    if (cachedId) {
      return cachedId;
    }

    const existing = await localStore.getItem<string>(INSTALLATION_UUID_KEY);
    if (existing) {
      cachedId = existing;
      console.log(`[InstallationId] loaded from store: ${cachedId}`);
      return cachedId;
    }

    const newId = crypto.randomUUID();

    try {
      await localStore.setItem(INSTALLATION_UUID_KEY, newId);
      console.log(`[InstallationId] generated and persisted new id: ${newId}`);
    } catch (writeError) {
      console.warn('[InstallationId] generated new id but failed to persist:', writeError);
    }

    cachedId = newId;
    return cachedId;
  } catch (error) {
    console.warn('[InstallationId] failed to get installation uuid:', error);
    return null;
  }
};

const getAuthUserId = (): string | null => {
  const authUser = store.getState().auth.user as Record<string, unknown> | null;
  const userId = authUser?.userId ?? authUser?.yid;
  return typeof userId === 'string' && userId.trim() ? userId.trim() : null;
};

export const getUpdateQueryString = async (): Promise<string> => {
  try {
    const params = new URLSearchParams();

    const installationId = await getInstallationId();
    if (installationId) {
      params.append('uuid', installationId);
    }

    const userId = getAuthUserId();
    if (userId) {
      params.append('userId', userId);
    }

    return params.toString();
  } catch (error) {
    console.warn('[InstallationId] failed to build update query string:', error);
    return '';
  }
};
