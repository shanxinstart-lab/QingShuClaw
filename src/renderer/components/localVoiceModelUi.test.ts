import { describe, expect, test } from 'vitest';
import { canOpenLocalModelPath, isLocalModelInstallBusy } from './localVoiceModelUi';

describe('localVoiceModelUi', () => {
  test('only allows open-path action for installed models with a resolved path', () => {
    expect(canOpenLocalModelPath(null)).toBe(false);
    expect(canOpenLocalModelPath({ installed: false, resolvedPath: '/tmp/model' })).toBe(false);
    expect(canOpenLocalModelPath({ installed: true, resolvedPath: '' })).toBe(false);
    expect(canOpenLocalModelPath({ installed: true, resolvedPath: '/tmp/model' })).toBe(true);
  });

  test('treats pending installs as busy before download status is broadcast', () => {
    expect(isLocalModelInstallBusy({ pending: false, status: null })).toBe(false);
    expect(isLocalModelInstallBusy({ pending: true, status: null })).toBe(true);
    expect(isLocalModelInstallBusy({ pending: false, status: { downloading: true } })).toBe(true);
  });
});
