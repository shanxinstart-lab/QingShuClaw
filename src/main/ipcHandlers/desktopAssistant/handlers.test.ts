import { beforeEach, describe, expect, test, vi } from 'vitest';

const electronState = vi.hoisted(() => ({
  handle: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: electronState.handle,
  },
}));

import { DesktopAssistantIpcChannel } from '../../../shared/desktopAssistant/constants';
import { registerDesktopAssistantHandlers } from './handlers';

describe('registerDesktopAssistantHandlers', () => {
  beforeEach(() => {
    electronState.handle.mockReset();
  });

  test('registers desktop assistant handlers without storing local state', () => {
    const configStore = {
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
    };
    const observer = {
      getStatus: vi.fn(),
    };
    const presentationGuideController = {
      startGuide: vi.fn(),
      pauseGuide: vi.fn(),
      resumeGuide: vi.fn(),
      stopGuide: vi.fn(),
      nextScene: vi.fn(),
      previousScene: vi.fn(),
      goToScene: vi.fn(),
      replayScene: vi.fn(),
    };

    registerDesktopAssistantHandlers({
      configStore,
      observer: observer as any,
      presentationGuideController: presentationGuideController as any,
    });

    const channels = electronState.handle.mock.calls.map((call) => call[0]);
    expect(channels).toEqual([
      DesktopAssistantIpcChannel.GetConfig,
      DesktopAssistantIpcChannel.UpdateConfig,
      DesktopAssistantIpcChannel.GetStatus,
      DesktopAssistantIpcChannel.StartGuide,
      DesktopAssistantIpcChannel.PauseGuide,
      DesktopAssistantIpcChannel.ResumeGuide,
      DesktopAssistantIpcChannel.StopGuide,
      DesktopAssistantIpcChannel.NextScene,
      DesktopAssistantIpcChannel.PreviousScene,
      DesktopAssistantIpcChannel.GoToScene,
      DesktopAssistantIpcChannel.ReplayScene,
    ]);
  });
});
