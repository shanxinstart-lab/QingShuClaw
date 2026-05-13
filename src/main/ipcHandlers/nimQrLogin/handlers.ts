import { ipcMain } from 'electron';

import type { NimQrLoginPollResult, NimQrLoginStartResult } from '../../../shared/im/nimQrLogin';
import { NimQrLoginStatus } from '../../../shared/im/nimQrLogin';
import { NimQrLoginIpc } from './constants';

export interface NimQrLoginHandlerDeps {
  startNimQrLogin: () => Promise<NimQrLoginStartResult>;
  pollNimQrLogin: (uuid: string) => Promise<NimQrLoginPollResult>;
}

export function registerNimQrLoginHandlers(deps: NimQrLoginHandlerDeps): void {
  ipcMain.handle(NimQrLoginIpc.Start, async () => {
    try {
      return await deps.startNimQrLogin();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to start NIM QR login');
    }
  });

  ipcMain.handle(NimQrLoginIpc.Poll, async (_event, uuid: string) => {
    try {
      return await deps.pollNimQrLogin(uuid);
    } catch (error) {
      return {
        status: NimQrLoginStatus.Failed,
        error: error instanceof Error ? error.message : 'Failed to poll NIM QR login',
      };
    }
  });
}
