import { app, BrowserWindow } from 'electron';
import { WakeInputIpcChannel } from '../../shared/wakeInput/constants';

type WakeDictationRequest = {
  submitCommand: string;
  cancelCommand: string;
  sessionTimeoutMs: number;
};

export interface VoiceFeatureWindowBridge {
  showMainWindow: (options?: { stealFocus?: boolean }) => void;
  focusCoworkInputInMainWindow: (options?: { clear?: boolean }) => void;
  dispatchWakeDictationRequest: (request: WakeDictationRequest) => void;
}

export interface CreateVoiceFeatureWindowBridgeDeps {
  getMainWindow: () => BrowserWindow | null;
}

export function createVoiceFeatureWindowBridge(
  deps: CreateVoiceFeatureWindowBridgeDeps,
): VoiceFeatureWindowBridge {
  const showMainWindow = (options?: { stealFocus?: boolean }): void => {
    const mainWindow = deps.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    if (process.platform === 'darwin') {
      if (app.isHidden()) {
        app.show();
      }
      app.focus({ steal: options?.stealFocus === true });
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.moveTop();
    if (!mainWindow.isFocused()) {
      mainWindow.focus();
    }
  };

  const focusCoworkInputInMainWindow = (options?: { clear?: boolean }): void => {
    const mainWindow = deps.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send('app:focusCoworkInput', { clear: options?.clear === true });
  };

  const dispatchWakeDictationRequest = (request: WakeDictationRequest): void => {
    const mainWindow = deps.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send(WakeInputIpcChannel.DictationRequested, request);
  };

  return {
    showMainWindow,
    focusCoworkInputInMainWindow,
    dispatchWakeDictationRequest,
  };
}
