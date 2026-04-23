import { QingShuManagedCapabilityErrorCode } from '../../shared/qingshuManaged/access';

import { classifyErrorKey } from '../../common/coworkErrorClassify';
import { i18nService } from './i18n';

const classifyError = (error: string): string => {
  const key = classifyErrorKey(error);
  return key ? i18nService.t(key) : error;
};

type CoworkErrorCode = string | undefined;

export const getCoworkVisibleErrorMessage = (
  error: string,
  code?: CoworkErrorCode,
): string => {
  if (code === 'ENGINE_NOT_READY') {
    return i18nService.t('coworkErrorEngineNotReady');
  }

  if (code === QingShuManagedCapabilityErrorCode.AuthRequired) {
    return i18nService.t('managedUnavailableHint');
  }

  if (code === QingShuManagedCapabilityErrorCode.Forbidden) {
    return error || i18nService.t('managedForbiddenHint');
  }

  return classifyError(error);
};
