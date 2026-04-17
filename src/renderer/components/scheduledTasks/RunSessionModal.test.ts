import { describe, expect, test } from 'vitest';
import { getRunSessionLoadOrder } from './RunSessionModal';

describe('getRunSessionLoadOrder', () => {
  test('prefers transcript replay for run session keys', () => {
    expect(
      getRunSessionLoadOrder(
        'local-session-1',
        'agent:qingshu-managed:run:833a294e-8cb9-40a3-a9dd-7f0e65e49810',
      ),
    ).toEqual(['sessionKey', 'sessionId']);
  });

  test('keeps local session first for ordinary managed session keys', () => {
    expect(
      getRunSessionLoadOrder(
        'local-session-2',
        'agent:main:lobsterai:local-session-2',
      ),
    ).toEqual(['sessionId', 'sessionKey']);
  });

  test('falls back to whichever identifier is available', () => {
    expect(getRunSessionLoadOrder(null, 'agent:main:lobsterai:local-session-3')).toEqual(['sessionKey']);
    expect(getRunSessionLoadOrder('local-session-3', null)).toEqual(['sessionId']);
  });
});
