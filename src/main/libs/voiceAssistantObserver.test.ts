import { beforeEach, describe, expect, test, vi } from 'vitest';
import { DesktopAssistantState, GuideSource } from '../../shared/desktopAssistant/constants';
import { SpeechStateType } from '../../shared/speech/constants';
import { TtsAssistantReplyPlaybackState, TtsStateType } from '../../shared/tts/constants';
import { WakeInputStatusType } from '../../shared/wakeInput/constants';
import { PresentationGuideController } from './presentationGuideController';
import { VoiceAssistantObserver } from './voiceAssistantObserver';
import { VoiceFeatureSignalBus } from './voiceFeatureSignalBus';

const electronState = vi.hoisted(() => ({
  getAllWindows: vi.fn(() => []),
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: electronState.getAllWindows,
  },
}));

describe('VoiceAssistantObserver', () => {
  beforeEach(() => {
    electronState.getAllWindows.mockReset();
    electronState.getAllWindows.mockReturnValue([]);
  });

  test('applies the documented state priority order', () => {
    const signalBus = new VoiceFeatureSignalBus();
    const controller = new PresentationGuideController();
    const observer = new VoiceAssistantObserver({
      signalBus,
      presentationGuideController: controller,
      getAppConfig: () => ({
        desktopAssistant: {
          masterEnabled: true,
        },
      }),
    });

    signalBus.emit('wakeStateChanged', {
      enabled: true,
      supported: true,
      platform: 'darwin',
      status: WakeInputStatusType.Listening,
      requestedProvider: 'auto',
      provider: 'text_match',
      fallbackActive: false,
      wakeWords: [],
      wakeWord: '',
      submitCommand: '发送',
      cancelCommand: '取消',
      sessionTimeoutMs: 8000,
      activationReplyEnabled: false,
      activationReplyText: '',
      listening: true,
    });
    expect(observer.getStatus().state).toBe(DesktopAssistantState.WakeListening);

    signalBus.emit('speechStateChanged', { type: SpeechStateType.Listening });
    expect(observer.getStatus().state).toBe(DesktopAssistantState.Dictating);

    observer.handleCoworkRunStarted();
    expect(observer.getStatus().state).toBe(DesktopAssistantState.AssistantReplying);

    signalBus.emit('assistantReplyPlaybackChanged', {
      state: TtsAssistantReplyPlaybackState.Pending,
    });
    expect(observer.getStatus().state).toBe(DesktopAssistantState.AssistantSpeaking);

    controller.startGuide({
      sessionId: 'session-1',
      messageId: 'message-1',
      source: GuideSource.Manual,
      previewTarget: 'https://example.com',
      scenes: [{ id: 'scene-1', title: '概览', summary: 'hello' }],
    });
    expect(observer.getStatus().state).toBe(DesktopAssistantState.GuideActive);

    controller.pauseGuide();
    expect(observer.getStatus().state).toBe(DesktopAssistantState.Paused);

    observer.handleCoworkRunError('boom');
    expect(observer.getStatus().state).toBe(DesktopAssistantState.Error);
    expect(observer.getStatus().lastError).toBe('boom');
  });

  test('folds cooldown back to idle and wake triggered to dictating', () => {
    const signalBus = new VoiceFeatureSignalBus();
    const observer = new VoiceAssistantObserver({
      signalBus,
      presentationGuideController: new PresentationGuideController(),
      getAppConfig: () => ({
        desktopAssistant: { masterEnabled: true },
      }),
    });

    signalBus.emit('wakeStateChanged', {
      enabled: true,
      supported: true,
      platform: 'darwin',
      status: WakeInputStatusType.WakeTriggered,
      requestedProvider: 'auto',
      provider: 'text_match',
      fallbackActive: false,
      wakeWords: [],
      wakeWord: '',
      submitCommand: '发送',
      cancelCommand: '取消',
      sessionTimeoutMs: 8000,
      activationReplyEnabled: false,
      activationReplyText: '',
      listening: false,
    });
    expect(observer.getStatus().state).toBe(DesktopAssistantState.Dictating);

    signalBus.emit('wakeStateChanged', {
      enabled: true,
      supported: true,
      platform: 'darwin',
      status: WakeInputStatusType.Cooldown,
      requestedProvider: 'auto',
      provider: 'none',
      fallbackActive: false,
      wakeWords: [],
      wakeWord: '',
      submitCommand: '发送',
      cancelCommand: '取消',
      sessionTimeoutMs: 8000,
      activationReplyEnabled: false,
      activationReplyText: '',
      listening: false,
    });
    signalBus.emit('speechStateChanged', { type: SpeechStateType.Stopped });
    signalBus.emit('ttsStateChanged', { type: TtsStateType.Stopped });

    expect(observer.getStatus().state).toBe(DesktopAssistantState.Idle);
  });
});
