import { app, BrowserWindow } from 'electron';
import {
  TtsEngine,
  TtsAssistantReplyPlaybackState,
  TtsIpcChannel,
  TtsStateType,
  type TtsAssistantReplyPlaybackReport,
  type TtsSpeakOptions,
  type TtsSpeakResult,
  type TtsStateEvent,
} from '../../shared/tts/constants';
import {
  SpeechErrorCode,
  SpeechIpcChannel,
  SpeechPermissionStatus,
  SpeechStartSource,
  SpeechStateType,
  SpeechStopReason,
  isRecoverableSpeechErrorCode,
  type SpeechAvailability,
  type SpeechStartOptions,
  type SpeechStateEvent,
  type SpeechStopOptions,
  type SpeechTranscribeAudioOptions,
  type SpeechTranscribeAudioResult,
} from '../../shared/speech/constants';
import {
  WakeInputIpcChannel,
  WakeInputProviderMode,
  type WakeInputConfig,
} from '../../shared/wakeInput/constants';
import {
  ASSISTANT_SPEECH_TRIGGER_GUARD_MS,
  getAssistantSpeechTriggerGuardDeadline,
  isAssistantSpeechTriggerSuppressed,
} from '../../shared/voice/triggerWordGuard';
import {
  VoiceCapability,
  VoiceCapabilityReason,
  VoiceIpcChannel,
  VoiceProvider,
  type VoiceConfig,
  type VoiceLocalModelLibrary,
  type VoiceLocalQwen3TtsStatus,
  type VoiceLocalSherpaOnnxStatus,
  type VoiceLocalWhisperCppStatus,
} from '../../shared/voice/constants';
import { MacSpeechService, broadcastSpeechState } from './macSpeechService';
import { broadcastTtsState } from './macTtsService';
import { LocalVoiceModelManager } from './localVoiceModelManager';
import { LocalWhisperCppSpeechService, ensureLocalWhisperCppDirectories } from './localWhisperCppSpeechService';
import { OpenAiSpeechService } from './openAiSpeechService';
import { OpenAiVoiceService } from './openAiVoiceService';
import { AliyunSpeechService } from './aliyunSpeechService';
import { AliyunVoiceService } from './aliyunVoiceService';
import { VolcengineSpeechService } from './volcengineSpeechService';
import { VolcengineVoiceService } from './volcengineVoiceService';
import { LocalQwen3TtsService } from './localQwen3TtsService';
import { AzureVoiceService } from './azureVoiceService';
import { SherpaOnnxSpeechService } from './sherpaOnnxSpeechService';
import { SherpaOnnxWakeService } from './sherpaOnnxWakeService';
import { WakeInputService } from './wakeInputService';
import { TtsRouterService } from './ttsRouterService';
import { SpeechRouterService } from './speechRouterService';
import { VoiceCapabilityRegistry } from './voiceCapabilityRegistry';
import {
  FOLLOW_UP_ASSISTANT_REPLY_SETTLE_GUARD_MS,
  FOREGROUND_SPEECH_ALREADY_LISTENING_RETRY_DELAY_MS,
  FOREGROUND_SPEECH_RECOVERY_DELAY_MS,
  SPEECH_DEBUG_BUILD_MARKER,
  getVoiceConfigFromAppConfig,
  getWakeInputConfigFromAppConfig,
  mergeVoiceConfigIntoAppConfig,
  mergeWakeInputConfig,
  type AppConfigSettings,
} from './voiceFeatureConfig';
import type { VoiceFeatureSignalBus } from './voiceFeatureSignalBus';

type WakeDictationRequest = {
  submitCommand: string;
  cancelCommand: string;
  sessionTimeoutMs: number;
};

export interface VoiceFeatureControllerDeps {
  macSpeechService: MacSpeechService;
  sherpaOnnxSpeechService: SherpaOnnxSpeechService;
  wakeInputService: WakeInputService;
  sherpaOnnxWakeService: SherpaOnnxWakeService;
  ttsRouterService: TtsRouterService;
  speechRouterService: SpeechRouterService;
  voiceCapabilityRegistry: VoiceCapabilityRegistry;
  localVoiceModelManager: LocalVoiceModelManager;
  localWhisperCppSpeechService: LocalWhisperCppSpeechService;
  localQwen3TtsService: LocalQwen3TtsService;
  openAiSpeechService: OpenAiSpeechService;
  openAiVoiceService: OpenAiVoiceService;
  aliyunSpeechService: AliyunSpeechService;
  aliyunVoiceService: AliyunVoiceService;
  volcengineSpeechService: VolcengineSpeechService;
  volcengineVoiceService: VolcengineVoiceService;
  azureVoiceService: AzureVoiceService;
  getAppConfig: () => AppConfigSettings | undefined;
  setAppConfig: (config: AppConfigSettings) => void;
  isMacSpeechInputEnabled: () => boolean;
  getSpeechAvailabilityForVoice: () => Promise<SpeechAvailability>;
  buildTtsAvailabilityForSettings: (
    selectedProvider: VoiceProvider,
    baseAvailability: Awaited<ReturnType<TtsRouterService['getAvailability']>>,
  ) => Promise<Awaited<ReturnType<TtsRouterService['getAvailability']>>>;
  buildLocalWhisperCppStatus: (voiceConfig: VoiceConfig) => VoiceLocalWhisperCppStatus;
  buildLocalSherpaOnnxStatus: (voiceConfig: VoiceConfig) => VoiceLocalSherpaOnnxStatus;
  buildLocalQwen3TtsStatus: (voiceConfig: VoiceConfig) => VoiceLocalQwen3TtsStatus;
  showMainWindow: (options?: { stealFocus?: boolean }) => void;
  focusCoworkInputInMainWindow: (options?: { clear?: boolean }) => void;
  dispatchWakeDictationRequest: (request: WakeDictationRequest) => void;
  signalBus?: VoiceFeatureSignalBus;
}

export class VoiceFeatureController {
  private foregroundSpeechOrigin: SpeechStartSource | null = null;

  private foregroundSpeechSource: SpeechStartSource | null = null;

  private foregroundSpeechLocale: string | undefined;

  private foregroundSpeechRecoveryAttempts = 0;

  private foregroundSpeechRecoveryTimer: NodeJS.Timeout | null = null;

  private foregroundSpeechStartPending = false;

  private ttsWakeInputSuppressed = false;

  private ttsWakeInputSuppressedUntilMs = 0;

  private ttsWakeInputResumeTimer: NodeJS.Timeout | null = null;

  private assistantReplyPlaybackActive = false;

  private assistantReplyPlaybackSettledGuardUntilMs = 0;

  private readonly unbinders: Array<() => void> = [];

  constructor(private readonly deps: VoiceFeatureControllerDeps) {
    this.bindServiceEvents();
  }

  dispose(): void {
    this.clearForegroundSpeechRecoveryTimer();
    this.clearTtsWakeInputResumeTimer();
    for (const unbind of this.unbinders.splice(0)) {
      unbind();
    }
  }

  getCurrentVoiceConfig(): VoiceConfig {
    return getVoiceConfigFromAppConfig(this.deps.getAppConfig());
  }

  async getCapabilityMatrix() {
    return this.deps.voiceCapabilityRegistry.getCapabilityMatrix();
  }

  handleLocalModelLibraryChanged(library?: VoiceLocalModelLibrary): void {
    this.broadcastLocalModelLibraryChanged(library);
    void this.broadcastVoiceCapabilityChanged();
  }

  async applyVoiceConfig(appConfig?: AppConfigSettings): Promise<void> {
    const voiceConfig = getVoiceConfigFromAppConfig(appConfig);
    await this.deps.localVoiceModelManager.ensureRoots();
    const wakeInputConfig = getWakeInputConfigFromAppConfig(appConfig);
    this.deps.wakeInputService.updateConfig(wakeInputConfig);
    await this.syncWakeInputAvailability({
      appConfig,
      startBackgroundListening: true,
      reason: 'apply-voice-config',
    });

    if (!voiceConfig.capabilities.tts.enabled) {
      await this.deps.ttsRouterService.stop();
      await this.deps.ttsRouterService.syncSelectedEngine(TtsEngine.MacosNative);
    } else if (voiceConfig.capabilities.tts.provider === VoiceProvider.MacosNative) {
      await this.deps.ttsRouterService.syncSelectedEngine(voiceConfig.capabilities.tts.engine);
      if (
        voiceConfig.capabilities.tts.engine === TtsEngine.EdgeTts
        && voiceConfig.commands.wakeActivationReplyEnabled
        && voiceConfig.commands.wakeActivationReplyText.trim()
      ) {
        void this.deps.ttsRouterService.prewarmSelectedEngine(voiceConfig.commands.wakeActivationReplyText).catch((error) => {
          console.warn('[TtsRouterService] Failed to prewarm edge-tts wake activation reply.', error);
        });
      }
    } else {
      await this.deps.ttsRouterService.syncSelectedEngine(TtsEngine.MacosNative);
    }

    await this.broadcastVoiceCapabilityChanged();
  }

  async getSpeechAvailability() {
    const voiceConfig = this.getCurrentVoiceConfig();
    const availability = await this.deps.speechRouterService.getAvailability(SpeechStartSource.Manual);
    return {
      ...availability,
      enabled: voiceConfig.capabilities.manualStt.enabled,
    };
  }

  async startSpeech(options?: SpeechStartOptions) {
    const voiceConfig = this.getCurrentVoiceConfig();
    const source = options?.source ?? SpeechStartSource.Manual;
    console.log(
      '[BuildMarker] Foreground speech start request received.',
      JSON.stringify({
        marker: SPEECH_DEBUG_BUILD_MARKER,
        source,
        currentForegroundOrigin: this.foregroundSpeechOrigin,
        currentForegroundSource: this.foregroundSpeechSource,
      }),
    );
    const sourceEnabled = source === SpeechStartSource.Wake
      ? voiceConfig.capabilities.wakeInput.enabled
      : source === SpeechStartSource.FollowUp
        ? voiceConfig.capabilities.followUpDictation.enabled
        : voiceConfig.capabilities.manualStt.enabled;

    if (!sourceEnabled) {
      return { success: false, error: VoiceCapabilityReason.DisabledByConfig };
    }
    if (source === SpeechStartSource.FollowUp && this.isFollowUpSpeechBlockedByAssistantPlayback()) {
      console.log('[WakeInput] Delaying follow-up dictation until assistant playback settles.');
      return { success: false, error: SpeechErrorCode.AssistantReplyPlaybackPending };
    }

    const origin = await this.deps.wakeInputService.prepareForegroundSpeechStartForSource(source);
    let result: Awaited<ReturnType<SpeechRouterService['start']>>;
    try {
      this.foregroundSpeechStartPending = true;
      result = await this.deps.speechRouterService.start({ locale: options?.locale, source });
      if (result.error === SpeechErrorCode.AlreadyListening) {
        console.warn(
          '[MacSpeechService] Speech start collided with an existing listener. Retrying once after a short delay.',
          JSON.stringify({ source }),
        );
        await this.deps.speechRouterService.stop();
        await new Promise((resolve) => {
          setTimeout(resolve, FOREGROUND_SPEECH_ALREADY_LISTENING_RETRY_DELAY_MS);
        });
        result = await this.deps.speechRouterService.start({ locale: options?.locale, source });
      }
    } finally {
      this.foregroundSpeechStartPending = false;
    }

    const speechStartVoiceConfig = this.getCurrentVoiceConfig();
    const requestedProvider = source === SpeechStartSource.FollowUp
      ? speechStartVoiceConfig.capabilities.followUpDictation.provider
      : speechStartVoiceConfig.capabilities.manualStt.provider;
    console.log('[SpeechRouter] Foreground speech start finished.', JSON.stringify({
      source,
      origin,
      requestedProvider,
      resolvedProvider: result.provider,
      success: result.success,
      error: result.error,
    }));

    if (result.success) {
      this.ttsWakeInputSuppressed = false;
      this.ttsWakeInputSuppressedUntilMs = 0;
      this.clearTtsWakeInputResumeTimer();
      await this.syncWakeInputAvailability({
        appConfig: this.deps.getAppConfig(),
        startBackgroundListening: false,
        reason: 'speech-start-success',
      });
      this.foregroundSpeechOrigin = origin;
      this.foregroundSpeechSource = source;
      this.foregroundSpeechLocale = options?.locale?.trim() || undefined;
      this.foregroundSpeechRecoveryAttempts = 0;
      this.clearForegroundSpeechRecoveryTimer();
      void this.broadcastVoiceCapabilityChanged();
      return result;
    }

    await this.syncWakeInputAvailability({
      appConfig: this.deps.getAppConfig(),
      startBackgroundListening: false,
      reason: 'speech-start-failed',
    });
    this.deps.wakeInputService.handleForegroundSpeechEnded(origin);
    void this.broadcastVoiceCapabilityChanged();
    return result;
  }

  async stopSpeech(options?: SpeechStopOptions) {
    this.clearForegroundSpeechRecoveryTimer();
    console.log(
      '[BuildMarker] Foreground speech stop request received.',
      JSON.stringify({
        marker: SPEECH_DEBUG_BUILD_MARKER,
        reason: options?.reason,
        suppressWakeInputResumeMs: options?.suppressWakeInputResumeMs ?? 0,
        currentForegroundOrigin: this.foregroundSpeechOrigin,
        currentForegroundSource: this.foregroundSpeechSource,
      }),
    );
    if ((options?.suppressWakeInputResumeMs ?? 0) > 0) {
      this.deps.wakeInputService.suppressBackgroundResume(options?.suppressWakeInputResumeMs ?? 0);
    }
    if (options?.reason === SpeechStopReason.VoiceCommandStop) {
      console.log(
        '[WakeInput] Speech stop requested by a voice command.',
        JSON.stringify({ suppressWakeInputResumeMs: options?.suppressWakeInputResumeMs ?? 0 }),
      );
    }
    const result = await this.deps.speechRouterService.stop();
    const finishedOrigin = this.finishForegroundSpeechSession();
    if (finishedOrigin) {
      this.deps.wakeInputService.handleForegroundSpeechEnded(finishedOrigin);
    }
    void this.broadcastVoiceCapabilityChanged();
    return result;
  }

  async transcribeAudio(options?: SpeechTranscribeAudioOptions): Promise<SpeechTranscribeAudioResult> {
    const voiceConfig = this.getCurrentVoiceConfig();
    const source = options?.source ?? SpeechStartSource.Manual;
    if (source === SpeechStartSource.Wake) {
      return { success: false, error: VoiceCapabilityReason.RuntimeUnavailable };
    }

    const capabilityKey = source === SpeechStartSource.FollowUp
      ? VoiceCapability.FollowUpDictation
      : VoiceCapability.ManualStt;
    const capabilityEnabled = source === SpeechStartSource.FollowUp
      ? voiceConfig.capabilities.followUpDictation.enabled
      : voiceConfig.capabilities.manualStt.enabled;

    if (!capabilityEnabled) {
      return { success: false, error: VoiceCapabilityReason.DisabledByConfig };
    }

    const matrix = await this.deps.voiceCapabilityRegistry.getCapabilityMatrix();
    const capability = matrix.capabilities[capabilityKey];
    if (!capability?.runtimeAvailable) {
      return {
        success: false,
        error: capability?.reason ?? VoiceCapabilityReason.RuntimeUnavailable,
        provider: capability?.selectedProvider,
      };
    }

    if (capability.selectedProvider === VoiceProvider.LocalWhisperCpp) {
      return this.deps.localWhisperCppSpeechService.transcribeAudio(voiceConfig.providers.localWhisperCpp, options ?? {
        audioBase64: '',
        mimeType: 'audio/wav',
        source,
      });
    }

    if (capability.selectedProvider === VoiceProvider.CloudOpenAi) {
      return this.deps.openAiSpeechService.transcribeAudio(voiceConfig.providers.openai, options ?? {
        audioBase64: '',
        mimeType: 'audio/wav',
        source,
      });
    }

    if (capability.selectedProvider === VoiceProvider.CloudAliyun) {
      return this.deps.aliyunSpeechService.transcribeAudio(voiceConfig.providers.aliyun, options ?? {
        audioBase64: '',
        mimeType: 'audio/wav',
        source,
      });
    }

    if (capability.selectedProvider === VoiceProvider.CloudVolcengine) {
      return this.deps.volcengineSpeechService.transcribeAudio(voiceConfig.providers.volcengine, options ?? {
        audioBase64: '',
        mimeType: 'audio/wav',
        source,
      });
    }

    return {
      success: false,
      error: VoiceCapabilityReason.RuntimeUnavailable,
      provider: capability.selectedProvider,
    };
  }

  getWakeInputStatus() {
    return this.deps.wakeInputService.getStatus();
  }

  async updateWakeInputConfig(partialConfig?: Partial<WakeInputConfig>) {
    const config = this.deps.wakeInputService.updateConfig(mergeWakeInputConfig(partialConfig));
    void this.broadcastVoiceCapabilityChanged();
    return { success: true, status: config };
  }

  async getTtsAvailability() {
    const voiceConfig = this.getCurrentVoiceConfig();
    const matrix = await this.deps.voiceCapabilityRegistry.getCapabilityMatrix();
    const ttsCapability = matrix.capabilities[VoiceCapability.Tts];
    const selectedProvider = ttsCapability?.selectedProvider;
    const rawAvailability = await this.deps.ttsRouterService.getAvailability();
    const localAvailability = await this.deps.buildTtsAvailabilityForSettings(
      selectedProvider ?? voiceConfig.capabilities.tts.provider,
      rawAvailability,
    );

    const availability = selectedProvider === VoiceProvider.MacosNative
      ? localAvailability
      : {
          ...localAvailability,
          supported: Boolean(ttsCapability?.runtimeAvailable),
          platform: process.platform,
          speaking: false,
          error: ttsCapability?.reason !== VoiceCapabilityReason.Available
            ? ttsCapability?.reason
            : undefined,
        };

    return {
      ...availability,
      enabled: voiceConfig.capabilities.tts.enabled,
    };
  }

  async getTtsVoices(options?: { engine?: TtsEngine }) {
    try {
      const voices = await this.deps.ttsRouterService.getVoices(options?.engine);
      return { success: true, voices };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list TTS voices.' };
    }
  }

  async prepareTts(options?: { engine?: TtsEngine }) {
    try {
      const voiceConfig = this.getCurrentVoiceConfig();
      const rawAvailability = await this.deps.ttsRouterService.prepare(options?.engine);
      const selectedProvider = voiceConfig.capabilities.tts.provider;
      const availability = await this.deps.buildTtsAvailabilityForSettings(selectedProvider, rawAvailability);
      return {
        success: true,
        availability,
      };
    } catch (error) {
      const voiceConfig = this.getCurrentVoiceConfig();
      const rawAvailability = await this.deps.ttsRouterService.getAvailability(options?.engine);
      const selectedProvider = voiceConfig.capabilities.tts.provider;
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare TTS runtime.',
        availability: await this.deps.buildTtsAvailabilityForSettings(selectedProvider, rawAvailability),
      };
    }
  }

  async speakTts(options?: TtsSpeakOptions): Promise<TtsSpeakResult> {
    const voiceConfig = this.getCurrentVoiceConfig();
    if (!voiceConfig.capabilities.tts.enabled) {
      return { success: false, error: VoiceCapabilityReason.DisabledByConfig };
    }

    const matrix = await this.deps.voiceCapabilityRegistry.getCapabilityMatrix();
    const ttsCapability = matrix.capabilities[VoiceCapability.Tts];
    if (!ttsCapability?.runtimeAvailable) {
      return {
        success: false,
        error: ttsCapability?.reason ?? VoiceCapabilityReason.RuntimeUnavailable,
        provider: ttsCapability?.selectedProvider,
      };
    }

    if (ttsCapability.selectedProvider === VoiceProvider.MacosNative) {
      const result = await this.deps.ttsRouterService.speak(options ?? { text: '' });
      return {
        success: result.success,
        error: result.error,
        audioDataUrl: result.audioDataUrl,
        audioUrl: result.audioUrl,
        provider: VoiceProvider.MacosNative,
        engine: result.engine,
      };
    }

    if (ttsCapability.selectedProvider === VoiceProvider.CloudOpenAi) {
      return this.deps.openAiVoiceService.synthesizeSpeech(voiceConfig.providers.openai, options ?? { text: '' });
    }

    if (ttsCapability.selectedProvider === VoiceProvider.CloudAliyun) {
      return this.deps.aliyunVoiceService.synthesizeSpeech(voiceConfig.providers.aliyun, options ?? { text: '' });
    }

    if (ttsCapability.selectedProvider === VoiceProvider.CloudVolcengine) {
      return this.deps.volcengineVoiceService.synthesizeSpeech(voiceConfig.providers.volcengine, options ?? { text: '' });
    }

    if (ttsCapability.selectedProvider === VoiceProvider.CloudAzure) {
      return this.deps.azureVoiceService.synthesizeSpeech(voiceConfig.providers.azure, options ?? { text: '' });
    }

    if (ttsCapability.selectedProvider === VoiceProvider.LocalQwen3Tts) {
      return this.deps.localQwen3TtsService.synthesizeSpeech(voiceConfig.providers.localQwen3Tts, options ?? { text: '' });
    }

    return {
      success: false,
      error: VoiceCapabilityReason.RuntimeUnavailable,
      provider: ttsCapability.selectedProvider,
    };
  }

  async reportAssistantReplyPlayback(report?: TtsAssistantReplyPlaybackReport) {
    const state = report?.state;
    if (state === TtsAssistantReplyPlaybackState.Pending) {
      this.assistantReplyPlaybackActive = true;
      this.assistantReplyPlaybackSettledGuardUntilMs = 0;
      this.clearTtsWakeInputResumeTimer();
      console.log(
        '[WakeInput] Assistant reply playback reported as active.',
        JSON.stringify({ sessionId: report?.sessionId }),
      );
      await this.deps.wakeInputService.stopBackgroundListening().catch((error) => {
        console.warn('[WakeInput] Failed to pause background listening for assistant reply playback.', error);
      });
      this.deps.signalBus?.emit('assistantReplyPlaybackChanged', {
        sessionId: report?.sessionId,
        state,
      });
      return { success: true };
    }

    this.assistantReplyPlaybackActive = false;
    this.assistantReplyPlaybackSettledGuardUntilMs = getAssistantSpeechTriggerGuardDeadline(
      Date.now(),
      FOLLOW_UP_ASSISTANT_REPLY_SETTLE_GUARD_MS,
    );
    console.log(
      '[WakeInput] Assistant reply playback reported as settled.',
      JSON.stringify({ sessionId: report?.sessionId }),
    );
    this.scheduleWakeInputResumeAfterAssistantPlayback();
    this.deps.signalBus?.emit('assistantReplyPlaybackChanged', {
      sessionId: report?.sessionId,
      state: TtsAssistantReplyPlaybackState.Settled,
    });
    return { success: true };
  }

  async stopTts() {
    const voiceConfig = this.getCurrentVoiceConfig();
    const matrix = await this.deps.voiceCapabilityRegistry.getCapabilityMatrix();
    const ttsCapability = matrix.capabilities[VoiceCapability.Tts];

    if (ttsCapability?.selectedProvider === VoiceProvider.LocalQwen3Tts) {
      return this.deps.localQwen3TtsService.stop();
    }
    if (voiceConfig.capabilities.tts.provider === VoiceProvider.LocalQwen3Tts) {
      return this.deps.localQwen3TtsService.stop();
    }
    return this.deps.ttsRouterService.stop();
  }

  getVoiceConfig() {
    return this.getCurrentVoiceConfig();
  }

  getLocalSherpaOnnxStatus(): VoiceLocalSherpaOnnxStatus {
    return this.deps.buildLocalSherpaOnnxStatus(this.getCurrentVoiceConfig());
  }

  getLocalWhisperCppStatus(): VoiceLocalWhisperCppStatus {
    return this.deps.buildLocalWhisperCppStatus(this.getCurrentVoiceConfig());
  }

  getLocalQwen3TtsStatus(): VoiceLocalQwen3TtsStatus {
    return this.deps.buildLocalQwen3TtsStatus(this.getCurrentVoiceConfig());
  }

  async ensureLocalWhisperCppDirectories() {
    try {
      await ensureLocalWhisperCppDirectories();
      return {
        success: true,
        status: this.getLocalWhisperCppStatus(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare local whisper.cpp directories.',
      };
    }
  }

  async getLocalModelLibrary(): Promise<VoiceLocalModelLibrary> {
    await this.deps.localVoiceModelManager.ensureRoots();
    return this.deps.localVoiceModelManager.getLibrary();
  }

  async installLocalModel(modelId: string) {
    try {
      const library = await this.deps.localVoiceModelManager.installModel(modelId);
      return { success: true, library };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to install local voice model.',
        library: this.deps.localVoiceModelManager.getLibrary(),
      };
    }
  }

  cancelLocalModelInstall(modelId: string) {
    return {
      success: true,
      library: this.deps.localVoiceModelManager.cancelInstall(modelId),
    };
  }

  async updateVoiceConfig(partialConfig?: Partial<VoiceConfig>) {
    const { nextAppConfig, nextVoiceConfig } = mergeVoiceConfigIntoAppConfig(this.deps.getAppConfig(), partialConfig);
    this.deps.setAppConfig(nextAppConfig);
    await this.applyVoiceConfig(nextAppConfig);
    return {
      success: true,
      config: nextVoiceConfig,
      matrix: await this.deps.voiceCapabilityRegistry.getCapabilityMatrix(),
    };
  }

  private bindServiceEvents(): void {
    const wakeInputStateListener = (status: ReturnType<WakeInputService['getStatus']>) => {
      console.log(
        '[WakeInput] State changed.',
        JSON.stringify({
          status: status.status,
          enabled: status.enabled,
          supported: status.supported,
          requestedProvider: status.requestedProvider,
          provider: status.provider,
          fallbackActive: status.fallbackActive,
          listening: status.listening,
          error: status.error,
        }),
      );
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send(WakeInputIpcChannel.StateChanged, status);
        }
      }
      this.deps.signalBus?.emit('wakeStateChanged', status);
      void this.broadcastVoiceCapabilityChanged();
    };

    const wakeInputDictationListener = (request: WakeDictationRequest) => {
      console.log('[WakeInput] Dictation requested from wake input.');
      void this.handleWakeDictationRequest(request);
    };

    this.deps.wakeInputService.on('stateChanged', wakeInputStateListener);
    this.deps.wakeInputService.on('dictationRequested', wakeInputDictationListener);
    this.unbinders.push(() => {
      this.deps.wakeInputService.off('stateChanged', wakeInputStateListener);
      this.deps.wakeInputService.off('dictationRequested', wakeInputDictationListener);
    });

    this.unbinders.push(this.deps.macSpeechService.onStateChanged((event) => {
      if (this.deps.wakeInputService.isBackgroundModeActive()) {
        if (
          (event.type === SpeechStateType.Partial || event.type === SpeechStateType.Final)
          && this.isFollowUpSpeechBlockedByAssistantPlayback()
        ) {
          console.debug(
            '[WakeInput] Ignored background speech because assistant playback is still within the trigger guard window.',
            JSON.stringify({ type: event.type }),
          );
          return;
        }
        void this.deps.wakeInputService.handleSpeechState(event);
        if (event.type === SpeechStateType.Listening || event.type === SpeechStateType.Stopped || event.type === SpeechStateType.Error) {
          void this.broadcastVoiceCapabilityChanged();
        }
        return;
      }

      if (this.foregroundSpeechOrigin && this.deps.speechRouterService.getActiveProvider() === VoiceProvider.MacosNative) {
        this.handleForegroundSpeechStateEvent(event);
        return;
      }

      if (event.type === SpeechStateType.Listening || event.type === SpeechStateType.Stopped || event.type === SpeechStateType.Error) {
        void this.broadcastVoiceCapabilityChanged();
      }

      broadcastSpeechState(BrowserWindow.getAllWindows(), SpeechIpcChannel.StateChanged, event);
      this.deps.signalBus?.emit('speechStateChanged', event);
    }));

    const sherpaSpeechListener = (event: SpeechStateEvent) => {
      console.debug('[SherpaSpeech] Foreground event received.', JSON.stringify({
        type: event.type,
        code: event.code,
        text: event.text,
        pending: this.foregroundSpeechStartPending,
        origin: this.foregroundSpeechOrigin,
        activeProvider: this.deps.speechRouterService.getActiveProvider(),
      }));

      if (this.foregroundSpeechOrigin && this.deps.speechRouterService.getActiveProvider() === VoiceProvider.LocalSherpaOnnx) {
        this.handleForegroundSpeechStateEvent(event);
        return;
      }

      if (this.foregroundSpeechStartPending) {
        if (event.type === SpeechStateType.Listening || event.type === SpeechStateType.Stopped || event.type === SpeechStateType.Error) {
          void this.broadcastVoiceCapabilityChanged();
        }
        broadcastSpeechState(BrowserWindow.getAllWindows(), SpeechIpcChannel.StateChanged, event);
        this.deps.signalBus?.emit('speechStateChanged', event);
        return;
      }

      if (event.type === SpeechStateType.Listening || event.type === SpeechStateType.Stopped || event.type === SpeechStateType.Error) {
        void this.broadcastVoiceCapabilityChanged();
      }
    };

    this.deps.sherpaOnnxSpeechService.on('stateChanged', sherpaSpeechListener);
    this.unbinders.push(() => {
      this.deps.sherpaOnnxSpeechService.off('stateChanged', sherpaSpeechListener);
    });

    this.unbinders.push(this.deps.ttsRouterService.onStateChanged((event) => {
      this.handleTtsStateChanged(event);
    }));
  }

  private clearForegroundSpeechRecoveryTimer(): boolean {
    if (!this.foregroundSpeechRecoveryTimer) {
      return false;
    }
    clearTimeout(this.foregroundSpeechRecoveryTimer);
    this.foregroundSpeechRecoveryTimer = null;
    return true;
  }

  private resetForegroundSpeechSessionState(): void {
    this.clearForegroundSpeechRecoveryTimer();
    this.foregroundSpeechOrigin = null;
    this.foregroundSpeechSource = null;
    this.foregroundSpeechLocale = undefined;
    this.foregroundSpeechRecoveryAttempts = 0;
    this.foregroundSpeechStartPending = false;
  }

  private clearTtsWakeInputResumeTimer(): void {
    if (this.ttsWakeInputResumeTimer) {
      clearTimeout(this.ttsWakeInputResumeTimer);
      this.ttsWakeInputResumeTimer = null;
    }
  }

  private isAssistantReplyPlaybackBlocked(): boolean {
    return this.assistantReplyPlaybackActive || this.assistantReplyPlaybackSettledGuardUntilMs > Date.now();
  }

  private isWakeInputTriggerSuppressed(): boolean {
    return isAssistantSpeechTriggerSuppressed({
      isAssistantSpeaking: this.ttsWakeInputSuppressed,
      suppressedUntilMs: this.ttsWakeInputSuppressedUntilMs,
    });
  }

  private isFollowUpSpeechBlockedByAssistantPlayback(): boolean {
    return this.isWakeInputTriggerSuppressed() || this.isAssistantReplyPlaybackBlocked();
  }

  private scheduleWakeInputResumeAfterAssistantPlayback(): void {
    this.clearTtsWakeInputResumeTimer();
    if (this.foregroundSpeechOrigin) {
      return;
    }
    this.ttsWakeInputResumeTimer = setTimeout(() => {
      this.ttsWakeInputResumeTimer = null;
      if (this.foregroundSpeechOrigin || this.isFollowUpSpeechBlockedByAssistantPlayback()) {
        return;
      }
      void this.deps.wakeInputService.startBackgroundListening().catch((error) => {
        console.warn('[WakeInput] Failed to resume background listening after assistant playback.', error);
      });
    }, ASSISTANT_SPEECH_TRIGGER_GUARD_MS);
  }

  private shouldPlayWakeActivationReply(): boolean {
    const voiceConfig = this.getCurrentVoiceConfig();
    return voiceConfig.capabilities.tts.enabled
      && voiceConfig.commands.wakeActivationReplyEnabled
      && Boolean(voiceConfig.commands.wakeActivationReplyText.trim());
  }

  private async handleWakeDictationRequest(request: WakeDictationRequest): Promise<void> {
    this.deps.showMainWindow({ stealFocus: true });
    this.deps.focusCoworkInputInMainWindow({ clear: false });

    if (!this.shouldPlayWakeActivationReply()) {
      this.deps.dispatchWakeDictationRequest(request);
      return;
    }

    const activationReplyText = this.getCurrentVoiceConfig().commands.wakeActivationReplyText.trim();
    try {
      await this.deps.ttsRouterService.stop();
      await this.deps.ttsRouterService.playWakeActivationReply(activationReplyText);
    } catch (error) {
      console.warn('[WakeInput] Failed to play wake activation reply. Continuing with dictation.', error);
    }

    this.deps.dispatchWakeDictationRequest(request);
  }

  private finishForegroundSpeechSession(): SpeechStartSource | null {
    const origin = this.foregroundSpeechOrigin;
    this.resetForegroundSpeechSessionState();
    return origin;
  }

  private scheduleForegroundSpeechRecovery(event: { code?: string; message?: string }): boolean {
    if (!this.foregroundSpeechOrigin || !this.foregroundSpeechSource) {
      return false;
    }
    if (!isRecoverableSpeechErrorCode(event.code) || this.foregroundSpeechRecoveryAttempts >= 1) {
      return false;
    }

    this.foregroundSpeechRecoveryAttempts += 1;
    this.clearForegroundSpeechRecoveryTimer();
    console.warn(
      '[MacSpeechService] Recoverable foreground speech interruption detected. Retrying once.',
      JSON.stringify({
        source: this.foregroundSpeechSource,
        origin: this.foregroundSpeechOrigin,
        code: event.code,
        message: event.message,
        attempt: this.foregroundSpeechRecoveryAttempts,
      }),
    );

    this.foregroundSpeechRecoveryTimer = setTimeout(() => {
      this.foregroundSpeechRecoveryTimer = null;
      const source = this.foregroundSpeechSource;
      if (!this.foregroundSpeechOrigin || !source) {
        return;
      }

      void this.deps.speechRouterService.start({ locale: this.foregroundSpeechLocale, source }).then(async (result) => {
        if (result.success) {
          await this.syncWakeInputAvailability({
            appConfig: this.deps.getAppConfig(),
            startBackgroundListening: false,
            reason: 'speech-recovery-success',
          });
          void this.broadcastVoiceCapabilityChanged();
          return;
        }

        console.warn(
          '[MacSpeechService] Foreground speech recovery failed.',
          JSON.stringify({ source, error: result.error }),
        );
        const finishedOrigin = this.finishForegroundSpeechSession();
        if (finishedOrigin) {
          this.deps.wakeInputService.handleForegroundSpeechEnded(finishedOrigin);
        }
        broadcastSpeechState(BrowserWindow.getAllWindows(), SpeechIpcChannel.StateChanged, {
          type: SpeechStateType.Error,
          code: event.code ?? SpeechErrorCode.RuntimeError,
          message: event.message ?? result.error,
        });
        this.deps.signalBus?.emit('speechStateChanged', {
          type: SpeechStateType.Error,
          code: event.code ?? SpeechErrorCode.RuntimeError,
          message: event.message ?? result.error,
        });
        void this.syncWakeInputAvailability({
          appConfig: this.deps.getAppConfig(),
          startBackgroundListening: false,
          reason: 'speech-recovery-failed',
        });
        void this.broadcastVoiceCapabilityChanged();
      }).catch((error) => {
        console.error('[MacSpeechService] Foreground speech recovery crashed:', error);
        const finishedOrigin = this.finishForegroundSpeechSession();
        if (finishedOrigin) {
          this.deps.wakeInputService.handleForegroundSpeechEnded(finishedOrigin);
        }
        broadcastSpeechState(BrowserWindow.getAllWindows(), SpeechIpcChannel.StateChanged, {
          type: SpeechStateType.Error,
          code: event.code ?? SpeechErrorCode.RuntimeError,
          message: error instanceof Error ? error.message : event.message,
        });
        this.deps.signalBus?.emit('speechStateChanged', {
          type: SpeechStateType.Error,
          code: event.code ?? SpeechErrorCode.RuntimeError,
          message: error instanceof Error ? error.message : event.message,
        });
        void this.syncWakeInputAvailability({
          appConfig: this.deps.getAppConfig(),
          startBackgroundListening: false,
          reason: 'speech-recovery-crashed',
        });
        void this.broadcastVoiceCapabilityChanged();
      });
    }, FOREGROUND_SPEECH_RECOVERY_DELAY_MS);

    return true;
  }

  private handleForegroundSpeechStateEvent(event: SpeechStateEvent): void {
    if (this.foregroundSpeechOrigin) {
      if (event.type === SpeechStateType.Error && this.scheduleForegroundSpeechRecovery(event)) {
        return;
      }
      broadcastSpeechState(BrowserWindow.getAllWindows(), SpeechIpcChannel.StateChanged, event);
      this.deps.signalBus?.emit('speechStateChanged', event);
      if (event.type === SpeechStateType.Stopped || event.type === SpeechStateType.Error) {
        const finishedOrigin = this.finishForegroundSpeechSession();
        if (finishedOrigin) {
          this.deps.wakeInputService.handleForegroundSpeechEnded(finishedOrigin);
        }
      }
      if (event.type === SpeechStateType.Listening) {
        this.foregroundSpeechRecoveryAttempts = 0;
      }
      if (event.type === SpeechStateType.Listening || event.type === SpeechStateType.Stopped || event.type === SpeechStateType.Error) {
        void this.broadcastVoiceCapabilityChanged();
      }
      return;
    }

    if (event.type === SpeechStateType.Listening || event.type === SpeechStateType.Stopped || event.type === SpeechStateType.Error) {
      void this.broadcastVoiceCapabilityChanged();
    }

    broadcastSpeechState(BrowserWindow.getAllWindows(), SpeechIpcChannel.StateChanged, event);
    this.deps.signalBus?.emit('speechStateChanged', event);
  }

  private handleTtsStateChanged(event: TtsStateEvent): void {
    if (event.type === TtsStateType.Speaking) {
      this.ttsWakeInputSuppressed = true;
      this.ttsWakeInputSuppressedUntilMs = Number.MAX_SAFE_INTEGER;
      this.clearTtsWakeInputResumeTimer();
      void this.deps.wakeInputService.stopBackgroundListening().catch((error) => {
        console.warn('[WakeInput] Failed to pause background listening during TTS playback.', error);
      });
    } else if (event.type === TtsStateType.Stopped || event.type === TtsStateType.Error) {
      this.ttsWakeInputSuppressed = false;
      this.ttsWakeInputSuppressedUntilMs = getAssistantSpeechTriggerGuardDeadline(Date.now());
      this.clearTtsWakeInputResumeTimer();
      if (!this.foregroundSpeechOrigin) {
        this.ttsWakeInputResumeTimer = setTimeout(() => {
          this.ttsWakeInputResumeTimer = null;
          if (this.foregroundSpeechOrigin || this.isAssistantReplyPlaybackBlocked()) {
            return;
          }
          void this.deps.wakeInputService.startBackgroundListening().catch((error) => {
            console.warn('[WakeInput] Failed to resume background listening after TTS playback.', error);
          });
        }, ASSISTANT_SPEECH_TRIGGER_GUARD_MS);
      }
    }

    broadcastTtsState(BrowserWindow.getAllWindows(), TtsIpcChannel.StateChanged, event);
    this.deps.signalBus?.emit('ttsStateChanged', event);
    void this.broadcastVoiceCapabilityChanged();
  }

  private async broadcastVoiceCapabilityChanged(): Promise<void> {
    try {
      const matrix = await this.deps.voiceCapabilityRegistry.getCapabilityMatrix();
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          window.webContents.send(VoiceIpcChannel.CapabilityChanged, matrix);
        }
      }
    } catch (error) {
      console.error('[Voice] Failed to broadcast capability matrix:', error);
    }
  }

  private broadcastLocalModelLibraryChanged(library?: VoiceLocalModelLibrary): void {
    const payload = library ?? this.deps.localVoiceModelManager.getLibrary();
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(VoiceIpcChannel.LocalModelLibraryChanged, payload);
      }
    }
  }

  private async syncWakeInputAvailability(
    options?: {
      appConfig?: AppConfigSettings;
      startBackgroundListening?: boolean;
      reason?: string;
    },
  ): Promise<void> {
    const voiceConfig = getVoiceConfigFromAppConfig(options?.appConfig);
    const wakeInputConfig = getWakeInputConfigFromAppConfig(options?.appConfig);
    const requestedProvider = wakeInputConfig.provider ?? WakeInputProviderMode.Auto;
    let speechAvailability = await this.deps.getSpeechAvailabilityForVoice();
    if (
      voiceConfig.capabilities.wakeInput.enabled
      && process.platform === 'darwin'
      && app.isPackaged
      && speechAvailability.supported
      && (
        speechAvailability.speechAuthorization === SpeechPermissionStatus.NotDetermined
        || speechAvailability.microphoneAuthorization === SpeechPermissionStatus.NotDetermined
      )
    ) {
      console.log('[WakeInput] Requesting speech permissions because wake input is enabled and authorization is not determined.');
      speechAvailability = await this.deps.macSpeechService.requestPermissionsIfNeeded();
    }
    const sherpaAvailability = this.deps.sherpaOnnxWakeService.getAvailability({
      wakeWords: wakeInputConfig.wakeWords,
      modelId: voiceConfig.providers.sherpaOnnx.wakeModelId,
    });
    const textMatchSupported = speechAvailability.supported
      && speechAvailability.permission === SpeechPermissionStatus.Granted;
    const wakeSupported = voiceConfig.capabilities.wakeInput.enabled && (() => {
      if (requestedProvider === WakeInputProviderMode.SherpaOnnx) {
        return sherpaAvailability.supported;
      }
      if (requestedProvider === WakeInputProviderMode.TextMatch) {
        return textMatchSupported;
      }
      return sherpaAvailability.supported || textMatchSupported;
    })();

    console.log(
      '[WakeInput] Evaluated runtime availability.',
      JSON.stringify({
        reason: options?.reason ?? 'unknown',
        enabled: voiceConfig.capabilities.wakeInput.enabled,
        requestedProvider,
        sherpaWakeModelId: voiceConfig.providers.sherpaOnnx.wakeModelId,
        sherpaSupported: sherpaAvailability.supported,
        sherpaWakeWords: sherpaAvailability.configuredWakeWords,
        sherpaError: sherpaAvailability.error,
        speechSupported: speechAvailability.supported,
        permission: speechAvailability.permission,
        speechAuthorization: speechAvailability.speechAuthorization,
        microphoneAuthorization: speechAvailability.microphoneAuthorization,
        textMatchSupported,
        wakeSupported,
        speechError: speechAvailability.error,
      }),
    );

    await this.deps.wakeInputService.syncAvailability({
      supported: wakeSupported,
      error: wakeSupported
        ? undefined
        : (requestedProvider === WakeInputProviderMode.SherpaOnnx
          ? sherpaAvailability.error
          : (requestedProvider === WakeInputProviderMode.TextMatch
            ? speechAvailability.error
            : (sherpaAvailability.error ?? speechAvailability.error))),
    });

    if (options?.startBackgroundListening !== false) {
      await this.deps.wakeInputService.startBackgroundListening();
    }
  }
}
