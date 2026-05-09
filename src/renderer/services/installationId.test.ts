import { afterEach, expect, test, vi } from 'vitest';

import { store } from '../store';
import { setLoggedIn, setLoggedOut } from '../store/slices/authSlice';

const mockStore = vi.hoisted(() => ({
  installationId: 'test-installation-id',
}));

vi.mock('./store', () => ({
  localStore: {
    getItem: vi.fn(async (key: string) => (
      key === 'installation_uuid' ? mockStore.installationId : null
    )),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

afterEach(async () => {
  mockStore.installationId = 'test-installation-id';
  store.dispatch(setLoggedOut());
});

test('getUpdateQueryString includes installation id and current version', async () => {
  const { getUpdateQueryString } = await import('./installationId');

  expect(await getUpdateQueryString('2026.5.7')).toBe('uuid=test-installation-id&version=2026.5.7');
});

test('getUpdateQueryString includes logged in user id when available', async () => {
  store.dispatch(setLoggedIn({
    user: {
      userId: 'user-123',
      phone: '',
      nickname: 'tester',
      avatarUrl: '',
    },
    quota: {
      planName: '',
      subscriptionStatus: 'free',
      creditsLimit: 0,
      creditsUsed: 0,
      creditsRemaining: 0,
    },
  }));

  const { getUpdateQueryString } = await import('./installationId');

  expect(await getUpdateQueryString('2026.5.7')).toBe('uuid=test-installation-id&userId=user-123&version=2026.5.7');
});
