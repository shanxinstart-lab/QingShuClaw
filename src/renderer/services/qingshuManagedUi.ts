import {
  QingShuManagedAccessState,
  resolveQingShuManagedAccessState,
} from '../../shared/qingshuManaged/access';
import { QingShuObjectSourceType } from '../../shared/qingshuManaged/constants';

export type QingShuSourceLabelKey =
  | 'sourceTypeQingShuManaged'
  | 'sourceTypePreset'
  | 'sourceTypeLocalCustom';

export interface QingShuManagedAccessPresentationInput {
  sourceType?: string;
  allowed?: boolean;
  isLoggedIn: boolean;
  policyNote?: string;
}

export interface QingShuManagedAccessPresentation {
  accessState: QingShuManagedAccessState;
  isLocked: boolean;
  lockTagKey: 'managedUnavailableTag' | 'managedForbiddenTag' | null;
  lockHintKey: 'managedUnavailableHint' | 'managedForbiddenHint' | null;
  lockHintOverride?: string;
}

export const resolveQingShuSourceLabelKey = (sourceType?: string): QingShuSourceLabelKey => {
  if (sourceType === QingShuObjectSourceType.QingShuManaged) {
    return 'sourceTypeQingShuManaged';
  }
  if (sourceType === QingShuObjectSourceType.Preset) {
    return 'sourceTypePreset';
  }
  return 'sourceTypeLocalCustom';
};

export const resolveQingShuManagedAccessPresentation = (
  input: QingShuManagedAccessPresentationInput,
): QingShuManagedAccessPresentation => {
  const accessState = resolveQingShuManagedAccessState(input);

  if (accessState === QingShuManagedAccessState.LoginRequired) {
    return {
      accessState,
      isLocked: true,
      lockTagKey: 'managedUnavailableTag',
      lockHintKey: 'managedUnavailableHint',
    };
  }

  if (accessState === QingShuManagedAccessState.Forbidden) {
    return {
      accessState,
      isLocked: true,
      lockTagKey: 'managedForbiddenTag',
      lockHintKey: 'managedForbiddenHint',
      lockHintOverride: input.policyNote?.trim() || undefined,
    };
  }

  return {
    accessState,
    isLocked: false,
    lockTagKey: null,
    lockHintKey: null,
  };
};
