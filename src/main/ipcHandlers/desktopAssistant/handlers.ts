import { ipcMain } from 'electron';
import {
  DesktopAssistantIpcChannel,
  type DesktopAssistantConfig,
  type StartGuideRequest,
} from '../../../shared/desktopAssistant/constants';
import type { PresentationGuideController } from '../../libs/presentationGuideController';
import type { VoiceAssistantObserver } from '../../libs/voiceAssistantObserver';

export interface DesktopAssistantConfigStore {
  getConfig: () => DesktopAssistantConfig;
  updateConfig: (config?: Partial<DesktopAssistantConfig>) => Promise<{
    success: boolean;
    config?: DesktopAssistantConfig;
    error?: string;
  }>;
}

export interface DesktopAssistantHandlerDeps {
  configStore: DesktopAssistantConfigStore;
  observer: VoiceAssistantObserver;
  presentationGuideController: PresentationGuideController;
}

export function registerDesktopAssistantHandlers(deps: DesktopAssistantHandlerDeps): void {
  ipcMain.handle(DesktopAssistantIpcChannel.GetConfig, async () => {
    return deps.configStore.getConfig();
  });

  ipcMain.handle(DesktopAssistantIpcChannel.UpdateConfig, async (_event, config?: Partial<DesktopAssistantConfig>) => {
    return deps.configStore.updateConfig(config);
  });

  ipcMain.handle(DesktopAssistantIpcChannel.GetStatus, async () => {
    return deps.observer.getStatus();
  });

  ipcMain.handle(DesktopAssistantIpcChannel.StartGuide, async (_event, request: StartGuideRequest) => {
    return deps.presentationGuideController.startGuide(request);
  });

  ipcMain.handle(DesktopAssistantIpcChannel.PauseGuide, async () => {
    return deps.presentationGuideController.pauseGuide();
  });

  ipcMain.handle(DesktopAssistantIpcChannel.ResumeGuide, async () => {
    return deps.presentationGuideController.resumeGuide();
  });

  ipcMain.handle(DesktopAssistantIpcChannel.StopGuide, async () => {
    return deps.presentationGuideController.stopGuide();
  });

  ipcMain.handle(DesktopAssistantIpcChannel.NextScene, async () => {
    return deps.presentationGuideController.nextScene();
  });

  ipcMain.handle(DesktopAssistantIpcChannel.PreviousScene, async () => {
    return deps.presentationGuideController.previousScene();
  });

  ipcMain.handle(DesktopAssistantIpcChannel.GoToScene, async (_event, sceneIndex: number) => {
    return deps.presentationGuideController.goToScene(sceneIndex);
  });

  ipcMain.handle(DesktopAssistantIpcChannel.ReplayScene, async () => {
    return deps.presentationGuideController.replayScene();
  });
}
