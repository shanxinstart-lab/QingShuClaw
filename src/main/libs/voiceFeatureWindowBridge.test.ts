import { beforeEach, describe, expect, test, vi } from 'vitest';
import { WakeInputIpcChannel } from '../../shared/wakeInput/constants';

const electronState = vi.hoisted(() => ({
  isHidden: vi.fn(() => false),
  show: vi.fn(),
  focus: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    isHidden: electronState.isHidden,
    show: electronState.show,
    focus: electronState.focus,
  },
}));

import { createVoiceFeatureWindowBridge } from './voiceFeatureWindowBridge';

describe('voiceFeatureWindowBridge', () => {
  beforeEach(() => {
    electronState.isHidden.mockReset();
    electronState.isHidden.mockReturnValue(false);
    electronState.show.mockReset();
    electronState.focus.mockReset();
  });

  test('ignores window actions when main window is unavailable', () => {
    const bridge = createVoiceFeatureWindowBridge({
      getMainWindow: () => null,
    });

    bridge.showMainWindow({ stealFocus: true });
    bridge.focusCoworkInputInMainWindow({ clear: true });
    bridge.dispatchWakeDictationRequest({
      submitCommand: '发送',
      cancelCommand: '取消',
      sessionTimeoutMs: 5000,
    });

    expect(electronState.show).not.toHaveBeenCalled();
    expect(electronState.focus).not.toHaveBeenCalled();
  });

  test('forwards window operations and renderer events to the current main window', () => {
    const restore = vi.fn();
    const show = vi.fn();
    const moveTop = vi.fn();
    const focus = vi.fn();
    const send = vi.fn();
    const mainWindow = {
      isDestroyed: () => false,
      isMinimized: () => true,
      restore,
      isVisible: () => false,
      show,
      moveTop,
      isFocused: () => false,
      focus,
      webContents: {
        send,
      },
    };

    electronState.isHidden.mockReturnValue(true);

    const bridge = createVoiceFeatureWindowBridge({
      getMainWindow: () => mainWindow as any,
    });

    bridge.showMainWindow({ stealFocus: true });
    bridge.focusCoworkInputInMainWindow({ clear: true });
    bridge.dispatchWakeDictationRequest({
      submitCommand: '发送',
      cancelCommand: '取消',
      sessionTimeoutMs: 8000,
    });

    if (process.platform === 'darwin') {
      expect(electronState.show).toHaveBeenCalledTimes(1);
      expect(electronState.focus).toHaveBeenCalledWith({ steal: true });
    }
    expect(restore).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledTimes(1);
    expect(moveTop).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenNthCalledWith(1, 'app:focusCoworkInput', { clear: true });
    expect(send).toHaveBeenNthCalledWith(2, WakeInputIpcChannel.DictationRequested, {
      submitCommand: '发送',
      cancelCommand: '取消',
      sessionTimeoutMs: 8000,
    });
  });
});
