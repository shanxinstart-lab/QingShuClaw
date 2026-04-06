import { BrowserWindow } from 'electron';
import {
  DesktopAssistantIpcChannel,
  DesktopAssistantState,
  GuideStatus,
  type DesktopAssistantStatus,
  type GuideSession,
} from '../../shared/desktopAssistant/constants';
import { SpeechStateType, type SpeechStateEvent } from '../../shared/speech/constants';
import { TtsAssistantReplyPlaybackState, TtsStateType, type TtsStateEvent } from '../../shared/tts/constants';
import { WakeInputStatusType, type WakeInputStatus } from '../../shared/wakeInput/constants';
import { getDesktopAssistantConfigFromAppConfig } from './desktopAssistantConfig';
import type { AppConfigSettings } from './voiceFeatureConfig';
import type { PresentationGuideController } from './presentationGuideController';
import type { VoiceFeatureSignalBus } from './voiceFeatureSignalBus';

export interface VoiceAssistantObserverDeps {
  signalBus: VoiceFeatureSignalBus;
  presentationGuideController: PresentationGuideController;
  getAppConfig: () => AppConfigSettings | undefined;
  getWindows?: () => BrowserWindow[];
}

export class VoiceAssistantObserver {
  private wakeState: WakeInputStatus | null = null;

  private speechState: SpeechStateEvent | null = null;

  private ttsState: TtsStateEvent | null = null;

  private assistantReplyPlaybackActive = false;

  private coworkRunActive = false;

  private guideSession: GuideSession | null = null;

  private lastError: string | undefined;

  private lastBroadcastJson = '';

  private readonly unbinders: Array<() => void> = [];

  constructor(private readonly deps: VoiceAssistantObserverDeps) {
    this.unbinders.push(
      this.deps.signalBus.on('wakeStateChanged', (status) => {
        this.wakeState = status;
        if (status.error) {
          this.lastError = status.error;
        } else if (status.status !== WakeInputStatusType.Error) {
          this.lastError = undefined;
        }
        this.broadcastIfChanged();
      }),
      this.deps.signalBus.on('speechStateChanged', (event) => {
        this.handleSpeechState(event);
      }),
      this.deps.signalBus.on('ttsStateChanged', (event) => {
        this.handleTtsState(event);
      }),
      this.deps.signalBus.on('assistantReplyPlaybackChanged', (signal) => {
        this.assistantReplyPlaybackActive = signal.state === TtsAssistantReplyPlaybackState.Pending;
        this.broadcastIfChanged();
      }),
      this.deps.presentationGuideController.onGuideSessionChanged((guideSession) => {
        this.guideSession = guideSession;
        this.broadcastIfChanged();
      }),
    );
  }

  dispose(): void {
    for (const unbind of this.unbinders.splice(0)) {
      unbind();
    }
  }

  refreshConfig(): void {
    this.broadcastIfChanged();
  }

  handleCoworkRunStarted(): void {
    this.coworkRunActive = true;
    this.lastError = undefined;
    this.broadcastIfChanged();
  }

  handleCoworkRunCompleted(): void {
    this.coworkRunActive = false;
    this.lastError = undefined;
    this.broadcastIfChanged();
  }

  handleCoworkRunError(error?: string): void {
    this.coworkRunActive = false;
    this.lastError = typeof error === 'string' && error.trim() ? error.trim() : 'Unknown desktop assistant error.';
    this.broadcastIfChanged();
  }

  getStatus(): DesktopAssistantStatus {
    const config = getDesktopAssistantConfigFromAppConfig(this.deps.getAppConfig());
    const state = this.resolveState();
    return {
      masterEnabled: config.masterEnabled,
      state,
      guideSession: this.guideSession,
      ...(this.lastError ? { lastError: this.lastError } : {}),
    };
  }

  private handleSpeechState(event: SpeechStateEvent): void {
    this.speechState = event;
    if (event.type === SpeechStateType.Error) {
      this.lastError = event.message || event.code || 'Speech runtime error.';
    } else if (event.type === SpeechStateType.Stopped) {
      this.lastError = undefined;
    }
    this.broadcastIfChanged();
  }

  private handleTtsState(event: TtsStateEvent): void {
    this.ttsState = event;
    if (event.type === TtsStateType.Error) {
      this.lastError = event.message || event.code || 'TTS runtime error.';
    } else if (event.type === TtsStateType.Stopped) {
      this.lastError = undefined;
    }
    this.broadcastIfChanged();
  }

  private resolveState(): typeof DesktopAssistantState[keyof typeof DesktopAssistantState] {
    if (this.lastError) {
      return DesktopAssistantState.Error;
    }

    if (this.guideSession?.status === GuideStatus.Active) {
      return DesktopAssistantState.GuideActive;
    }
    if (this.guideSession?.status === GuideStatus.Paused) {
      return DesktopAssistantState.Paused;
    }

    if (this.isAssistantSpeaking()) {
      return DesktopAssistantState.AssistantSpeaking;
    }

    if (this.coworkRunActive) {
      return DesktopAssistantState.AssistantReplying;
    }

    if (this.isDictating()) {
      return DesktopAssistantState.Dictating;
    }

    if (this.isWakeListening()) {
      return DesktopAssistantState.WakeListening;
    }

    return DesktopAssistantState.Idle;
  }

  private isAssistantSpeaking(): boolean {
    return this.assistantReplyPlaybackActive || this.ttsState?.type === TtsStateType.Speaking;
  }

  private isDictating(): boolean {
    const wakeStatus = this.wakeState?.status;
    if (wakeStatus === WakeInputStatusType.WakeTriggered || wakeStatus === WakeInputStatusType.Dictating) {
      return true;
    }
    const speechType = this.speechState?.type;
    return speechType === SpeechStateType.Listening
      || speechType === SpeechStateType.Partial
      || speechType === SpeechStateType.Final;
  }

  private isWakeListening(): boolean {
    return this.wakeState?.status === WakeInputStatusType.Listening;
  }

  private broadcastIfChanged(): void {
    const status = this.getStatus();
    const nextJson = JSON.stringify(status);
    if (nextJson === this.lastBroadcastJson) {
      return;
    }
    this.lastBroadcastJson = nextJson;
    for (const window of (this.deps.getWindows ?? BrowserWindow.getAllWindows)()) {
      if (!window.isDestroyed()) {
        window.webContents.send(DesktopAssistantIpcChannel.StateChanged, status);
      }
    }
    console.debug('[DesktopAssistant] Broadcasted state update.', nextJson);
  }
}
