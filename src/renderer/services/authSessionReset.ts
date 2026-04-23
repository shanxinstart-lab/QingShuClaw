import { QingShuObjectSourceType } from '../../shared/qingshuManaged/constants';

type ToggleableManagedItem = {
  enabled: boolean;
  sourceType?: string;
};

export const disableQingShuManagedItems = <T extends ToggleableManagedItem>(items: T[]): T[] => (
  items.map((item) => (
    item.sourceType === QingShuObjectSourceType.QingShuManaged
      ? {
        ...item,
        enabled: false,
      }
      : item
  ))
);
