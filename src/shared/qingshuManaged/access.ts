import { QingShuObjectSourceType } from './constants';

export const QingShuManagedAccessState = {
  Available: 'available',
  LoginRequired: 'login_required',
  Forbidden: 'forbidden',
} as const;

export type QingShuManagedAccessState =
  typeof QingShuManagedAccessState[keyof typeof QingShuManagedAccessState];

export const QingShuManagedCapabilityErrorCode = {
  AuthRequired: 'QINGSHU_MANAGED_AUTH_REQUIRED',
  Forbidden: 'QINGSHU_MANAGED_FORBIDDEN',
} as const;

export type QingShuManagedCapabilityErrorCode =
  typeof QingShuManagedCapabilityErrorCode[keyof typeof QingShuManagedCapabilityErrorCode];

export type QingShuManagedAccessInput = {
  sourceType?: string;
  allowed?: boolean;
  isLoggedIn: boolean;
};

export const isQingShuManagedSource = (sourceType?: string): boolean =>
  sourceType === QingShuObjectSourceType.QingShuManaged;

export const resolveQingShuManagedAccessState = (
  input: QingShuManagedAccessInput,
): QingShuManagedAccessState => {
  if (!isQingShuManagedSource(input.sourceType)) {
    return QingShuManagedAccessState.Available;
  }
  if (!input.isLoggedIn) {
    return QingShuManagedAccessState.LoginRequired;
  }
  if (input.allowed === false) {
    return QingShuManagedAccessState.Forbidden;
  }
  return QingShuManagedAccessState.Available;
};

export const getQingShuManagedCapabilityErrorCode = (
  state: QingShuManagedAccessState,
): QingShuManagedCapabilityErrorCode | null => {
  if (state === QingShuManagedAccessState.LoginRequired) {
    return QingShuManagedCapabilityErrorCode.AuthRequired;
  }
  if (state === QingShuManagedAccessState.Forbidden) {
    return QingShuManagedCapabilityErrorCode.Forbidden;
  }
  return null;
};
