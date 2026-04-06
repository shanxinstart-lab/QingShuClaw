import type {
  DesktopAssistantConfig,
  DesktopAssistantStatus,
  StartGuideRequest,
} from '../../../shared/desktopAssistant/constants';

class DesktopAssistantService {
  getConfig(): Promise<DesktopAssistantConfig> {
    return window.electron.desktopAssistant.getConfig();
  }

  updateConfig(config?: Partial<DesktopAssistantConfig>) {
    return window.electron.desktopAssistant.updateConfig(config);
  }

  getStatus(): Promise<DesktopAssistantStatus> {
    return window.electron.desktopAssistant.getStatus();
  }

  startGuide(request: StartGuideRequest) {
    return window.electron.desktopAssistant.startGuide(request);
  }

  pauseGuide() {
    return window.electron.desktopAssistant.pauseGuide();
  }

  resumeGuide() {
    return window.electron.desktopAssistant.resumeGuide();
  }

  stopGuide() {
    return window.electron.desktopAssistant.stopGuide();
  }

  nextScene() {
    return window.electron.desktopAssistant.nextScene();
  }

  previousScene() {
    return window.electron.desktopAssistant.previousScene();
  }

  goToScene(sceneIndex: number) {
    return window.electron.desktopAssistant.goToScene(sceneIndex);
  }

  replayScene() {
    return window.electron.desktopAssistant.replayScene();
  }

  onStateChanged(callback: (status: DesktopAssistantStatus) => void): () => void {
    return window.electron.desktopAssistant.onStateChanged(callback);
  }
}

export const desktopAssistantService = new DesktopAssistantService();
