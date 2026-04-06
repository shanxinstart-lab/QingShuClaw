import { describe, expect, test } from 'vitest';
import {
  PresentationBridgeCommandType,
  PresentationBridgeEventType,
  PresentationBridgeMessageSource,
  PresentationBridgeVersion,
} from './presentationBridge';

describe('presentationBridge constants', () => {
  test('exports the fixed bridge version and message sources', () => {
    expect(PresentationBridgeVersion.V1).toBe('v1');
    expect(PresentationBridgeMessageSource.Host).toBe('qingshu-host');
    expect(PresentationBridgeMessageSource.Runtime).toBe('qingshu-runtime');
  });

  test('exports stable command and event names', () => {
    expect(PresentationBridgeCommandType.GoToScene).toBe('goToScene');
    expect(PresentationBridgeCommandType.SetPlaybackStatus).toBe('setPlaybackStatus');
    expect(PresentationBridgeEventType.Ready).toBe('ready');
    expect(PresentationBridgeEventType.StateChanged).toBe('stateChanged');
  });
});
