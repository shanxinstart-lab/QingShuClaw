import { describe, expect, test } from 'vitest';

import { QingShuManagedCapabilityErrorCode } from '../../shared/qingshuManaged/access';

import { getCoworkVisibleErrorMessage } from './coworkErrorMessage';
import { i18nService } from './i18n';

describe('getCoworkVisibleErrorMessage', () => {
  test('maps engine not ready to the localized engine hint', () => {
    expect(getCoworkVisibleErrorMessage('engine not ready', 'ENGINE_NOT_READY')).toBe(
      i18nService.t('coworkErrorEngineNotReady'),
    );
  });

  test('maps managed auth required to the managed unavailable hint', () => {
    expect(getCoworkVisibleErrorMessage('auth required', QingShuManagedCapabilityErrorCode.AuthRequired)).toBe(
      i18nService.t('managedUnavailableHint'),
    );
  });

  test('prefers the forbidden error detail for managed forbidden errors', () => {
    expect(getCoworkVisibleErrorMessage('当前账号无权限使用该能力', QingShuManagedCapabilityErrorCode.Forbidden)).toBe('当前账号无权限使用该能力');
  });

  test('falls back to the original error when no classifier matches', () => {
    expect(getCoworkVisibleErrorMessage('plain error')).toBe('plain error');
  });
});
