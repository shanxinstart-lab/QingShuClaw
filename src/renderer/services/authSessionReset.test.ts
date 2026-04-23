import { describe, expect, test } from 'vitest';

import { QingShuObjectSourceType } from '../../shared/qingshuManaged/constants';
import { disableQingShuManagedItems } from './authSessionReset';

describe('disableQingShuManagedItems', () => {
  test('disables qingshu-managed items only', () => {
    const items = [
      { id: 'agent-main', enabled: true, sourceType: QingShuObjectSourceType.Preset },
      { id: 'agent-managed', enabled: true, sourceType: QingShuObjectSourceType.QingShuManaged },
      { id: 'agent-local', enabled: true, sourceType: QingShuObjectSourceType.LocalCustom },
    ];

    expect(disableQingShuManagedItems(items)).toEqual([
      { id: 'agent-main', enabled: true, sourceType: QingShuObjectSourceType.Preset },
      { id: 'agent-managed', enabled: false, sourceType: QingShuObjectSourceType.QingShuManaged },
      { id: 'agent-local', enabled: true, sourceType: QingShuObjectSourceType.LocalCustom },
    ]);
  });

  test('keeps already disabled items unchanged', () => {
    const items = [
      { id: 'skill-managed', enabled: false, sourceType: QingShuObjectSourceType.QingShuManaged },
    ];

    expect(disableQingShuManagedItems(items)).toEqual(items);
  });
});
