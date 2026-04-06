import { EventEmitter } from 'events';
import {
  isRecoverableSpeechErrorCode,
  SpeechStartSource,
  type SpeechStateEvent,
  type SpeechStartSource as SpeechStartSourceValue,
} from '../../shared/speech/constants';
import {
  WakeInputProviderMode,
  WakeInputRuntimeProvider,
  WakeInputStatusType,
  type WakeInputConfig,
  type WakeInputDictationRequest,
  type WakeInputProviderMode as WakeInputProviderModeValue,
  type WakeInputRuntimeProvider as WakeInputRuntimeProviderValue,
  type WakeInputStatus,
} from '../../shared/wakeInput/constants';
import type { SherpaOnnxWakeService } from './sherpaOnnxWakeService';

type ForegroundSpeechOrigin = SpeechStartSourceValue;

const DICTATION_HANDSHAKE_TIMEOUT_MS = 10_000;
const MANUAL_RESUME_DELAY_MS = 600;
const WAKE_RESUME_DELAY_MS = 1_500;
const ERROR_RETRY_DELAY_MS = 2_000;

type WakeInputServiceEvents = {
  stateChanged: (status: WakeInputStatus) => void;
  dictationRequested: (request: WakeInputDictationRequest) => void;
};

const includesWakeWord = (text: string, wakeWords: string[]): { matched: boolean; matchedWakeWord?: string } => {
  const normalizedText = (text ?? '').trim();
  if (!normalizedText) {
    return { matched: false };
  }

  for (const wakeWord of wakeWords) {
    const normalizedWakeWord = (wakeWord ?? '').trim();
    if (!normalizedWakeWord) {
      continue;
    }
    if (normalizedText.includes(normalizedWakeWord)) {
      return { matched: true, matchedWakeWord: normalizedWakeWord };
    }
  }

  return { matched: false };
};

const isSilentSpeechTerminationCode = (code?: string): boolean => {
  return code === 'speech_request_cancelled' || code === 'speech_no_match';
};

const areStringArraysEqual = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item === right[index]);
};

const normalizeWakeWordText = (value: string): string => {
  return (value ?? '').trim().replace(/\s+/g, '');
};

const isChineseChar = (value: string): boolean => /[\u3400-\u9fff]/u.test(value);

const isRepeatedShortWakeWord = (chars: string[]): boolean => {
  if (chars.length < 2 || chars.length % 2 !== 0) {
    return false;
  }

  const half = chars.length / 2;
  if (half > 2) {
    return false;
  }

  const left = chars.slice(0, half).join('');
  const right = chars.slice(half).join('');
  return left === right;
};

const isHighRiskShortWakeWord = (wakeWord: string): boolean => {
  const normalized = normalizeWakeWordText(wakeWord);
  if (!normalized) {
    return false;
  }

  const chars = Array.from(normalized);
  if (chars.length === 0 || !chars.every(isChineseChar)) {
    return false;
  }

  if (chars.length <= 2) {
    return true;
  }

  return isRepeatedShortWakeWord(chars);
};

export class WakeInputService extends EventEmitter {
  private config: WakeInputConfig;

  private status: WakeInputStatus;

  private startTextMatchListening: () => Promise<{ success: boolean; error?: string }>;

  private stopTextMatchListening: () => Promise<{ success: boolean; error?: string }>;

  private sherpaOnnxWakeService: SherpaOnnxWakeService;

  private speechListening = false;

  private foregroundTransitionPending = false;

  private supported = false;

  private pendingDictation = false;

  private retryTimer: NodeJS.Timeout | null = null;

  private handshakeTimer: NodeJS.Timeout | null = null;

  private cooldownTimer: NodeJS.Timeout | null = null;

  private activeProvider: WakeInputRuntimeProviderValue = WakeInputRuntimeProvider.None;

  private fallbackActive = false;

  private backgroundResumeSuppressedUntilMs = 0;

  constructor(options: {
    config: WakeInputConfig;
    platform: string;
    startTextMatchListening: () => Promise<{ success: boolean; error?: string }>;
    stopTextMatchListening: () => Promise<{ success: boolean; error?: string }>;
    sherpaOnnxWakeService: SherpaOnnxWakeService;
  }) {
    super();
    this.config = { ...options.config, wakeWords: [...options.config.wakeWords] };
    this.startTextMatchListening = options.startTextMatchListening;
    this.stopTextMatchListening = options.stopTextMatchListening;
    this.sherpaOnnxWakeService = options.sherpaOnnxWakeService;
    this.status = {
      enabled: this.config.enabled,
      supported: false,
      platform: options.platform,
      status: WakeInputStatusType.Disabled,
      requestedProvider: this.getRequestedProviderMode(),
      provider: this.activeProvider,
      fallbackActive: this.fallbackActive,
      wakeWords: [...this.config.wakeWords],
      wakeWord: this.config.wakeWord,
      submitCommand: this.config.submitCommand,
      cancelCommand: this.config.cancelCommand,
      sessionTimeoutMs: this.config.sessionTimeoutMs,
      activationReplyEnabled: this.config.activationReplyEnabled,
      activationReplyText: this.config.activationReplyText,
      listening: false,
    };

    this.sherpaOnnxWakeService.on('wake', (event) => {
      void this.handleSherpaWakeWordDetected(event.wakeWord);
    });
    this.sherpaOnnxWakeService.on('error', (event) => {
      void this.handleSherpaRuntimeError(event.message);
    });
  }

  override on<U extends keyof WakeInputServiceEvents>(event: U, listener: WakeInputServiceEvents[U]): this {
    return super.on(event, listener);
  }

  private getRequestedProviderMode(): WakeInputProviderModeValue {
    return this.config.provider ?? WakeInputProviderMode.Auto;
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private clearHandshakeTimer(): void {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
  }

  private clearCooldownTimer(): void {
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  private async stopActiveProviderSilently(): Promise<void> {
    const activeProvider = this.activeProvider;
    this.speechListening = false;
    this.foregroundTransitionPending = false;
    this.activeProvider = WakeInputRuntimeProvider.None;

    if (activeProvider === WakeInputRuntimeProvider.SherpaOnnx) {
      await this.sherpaOnnxWakeService.stop();
      return;
    }

    if (activeProvider === WakeInputRuntimeProvider.TextMatch) {
      await this.stopTextMatchListening();
    }
  }

  private emitStateChanged(): void {
    this.emit('stateChanged', this.getStatus());
  }

  private setStatus(status: WakeInputStatusType, error?: string): void {
    this.status = {
      ...this.status,
      enabled: this.config.enabled,
      supported: this.supported,
      requestedProvider: this.getRequestedProviderMode(),
      provider: this.activeProvider,
      fallbackActive: this.fallbackActive,
      wakeWords: [...this.config.wakeWords],
      wakeWord: this.config.wakeWord,
      submitCommand: this.config.submitCommand,
      cancelCommand: this.config.cancelCommand,
      sessionTimeoutMs: this.config.sessionTimeoutMs,
      activationReplyEnabled: this.config.activationReplyEnabled,
      activationReplyText: this.config.activationReplyText,
      status,
      listening: this.speechListening,
      ...(error ? { error } : { error: undefined }),
    };
    this.emitStateChanged();
  }

  private scheduleBackgroundResume(delayMs: number): void {
    this.clearRetryTimer();
    if (!this.config.enabled || !this.supported || this.pendingDictation) {
      return;
    }
    const suppressionDelayMs = Math.max(0, this.backgroundResumeSuppressedUntilMs - Date.now());
    const effectiveDelayMs = Math.max(delayMs, suppressionDelayMs);
    this.retryTimer = setTimeout(() => {
      void this.startBackgroundListening();
    }, effectiveDelayMs);
  }

  suppressBackgroundResume(durationMs: number): void {
    if (durationMs <= 0) {
      return;
    }
    const nextSuppressedUntilMs = Date.now() + durationMs;
    if (nextSuppressedUntilMs <= this.backgroundResumeSuppressedUntilMs) {
      return;
    }
    this.backgroundResumeSuppressedUntilMs = nextSuppressedUntilMs;
    console.log(
      '[WakeInput] Suppressing background resume after foreground speech stop.',
      JSON.stringify({ durationMs, suppressedUntilMs: this.backgroundResumeSuppressedUntilMs }),
    );
  }

  private async startTextMatchProvider(options?: { fallback?: boolean; fallbackReason?: string }): Promise<boolean> {
    const result = await this.startTextMatchListening();
    if (!result.success) {
      this.speechListening = false;
      this.activeProvider = WakeInputRuntimeProvider.None;
      this.fallbackActive = options?.fallback ?? false;
      this.setStatus(WakeInputStatusType.Error, result.error);
      console.warn(
        '[WakeInput] Failed to start text-match wake listener.',
        JSON.stringify({ error: result.error, fallback: options?.fallback ?? false }),
      );
      this.scheduleBackgroundResume(ERROR_RETRY_DELAY_MS);
      return false;
    }

    this.speechListening = true;
    this.activeProvider = WakeInputRuntimeProvider.TextMatch;
    this.fallbackActive = options?.fallback ?? false;
    this.setStatus(WakeInputStatusType.Listening);
    console.log(
      '[WakeInput] Started text-match wake listener.',
      JSON.stringify({
        fallback: options?.fallback ?? false,
        fallbackReason: options?.fallbackReason,
      }),
    );
    return true;
  }

  private shouldPreferTextMatchForAutoMode(): boolean {
    return this.config.wakeWords.some((wakeWord) => isHighRiskShortWakeWord(wakeWord));
  }

  private async startSherpaProvider(): Promise<{ success: boolean; error?: string }> {
    const result = await this.sherpaOnnxWakeService.start(this.config.wakeWords);
    if (!result.success) {
      this.speechListening = false;
      this.activeProvider = WakeInputRuntimeProvider.None;
      return result;
    }

    this.speechListening = true;
    this.activeProvider = WakeInputRuntimeProvider.SherpaOnnx;
    this.fallbackActive = false;
    this.setStatus(WakeInputStatusType.Listening);
    console.log(
      '[WakeInput] Started Sherpa wake listener.',
      JSON.stringify({ wakeWords: result.configuredWakeWords ?? [] }),
    );
    return result;
  }

  private async triggerWakeDictation(wakeWord: string, provider: WakeInputRuntimeProviderValue): Promise<void> {
    if ((!this.speechListening && !this.foregroundTransitionPending) || this.pendingDictation) {
      console.debug(
        '[WakeInput] Ignored wake word because background listening is inactive.',
        JSON.stringify({ wakeWord, provider }),
      );
      return;
    }

    this.pendingDictation = true;
    this.foregroundTransitionPending = false;
    this.speechListening = false;

    if (provider === WakeInputRuntimeProvider.SherpaOnnx) {
      await this.sherpaOnnxWakeService.stop();
    } else if (provider === WakeInputRuntimeProvider.TextMatch) {
      await this.stopTextMatchListening();
    }

    this.activeProvider = WakeInputRuntimeProvider.None;
    this.setStatus(WakeInputStatusType.WakeTriggered);
    console.log(
      '[WakeInput] Wake phrase matched, requesting dictation.',
      JSON.stringify({ wakeWord, provider }),
    );

    const request: WakeInputDictationRequest = {
      submitCommand: this.config.submitCommand,
      cancelCommand: this.config.cancelCommand,
      sessionTimeoutMs: this.config.sessionTimeoutMs,
    };
    this.emit('dictationRequested', request);

    this.clearHandshakeTimer();
    this.handshakeTimer = setTimeout(() => {
      if (!this.pendingDictation) {
        return;
      }
      this.pendingDictation = false;
      this.setStatus(WakeInputStatusType.Cooldown);
      this.scheduleBackgroundResume(WAKE_RESUME_DELAY_MS);
    }, DICTATION_HANDSHAKE_TIMEOUT_MS);
  }

  private async handleSherpaWakeWordDetected(wakeWord: string): Promise<void> {
    if (this.activeProvider !== WakeInputRuntimeProvider.SherpaOnnx) {
      console.debug(
        '[WakeInput] Ignored Sherpa wake event because Sherpa is not the active provider.',
        JSON.stringify({ wakeWord }),
      );
      return;
    }
    await this.triggerWakeDictation(wakeWord, WakeInputRuntimeProvider.SherpaOnnx);
  }

  private async fallbackToTextMatch(reason: string): Promise<void> {
    console.warn(
      '[WakeInput] Falling back to text-match wake listener because Sherpa is unavailable.',
      JSON.stringify({ reason }),
    );
    await this.startTextMatchProvider({ fallback: true, fallbackReason: reason });
  }

  private async handleSherpaRuntimeError(message: string): Promise<void> {
    if (this.activeProvider !== WakeInputRuntimeProvider.SherpaOnnx) {
      console.debug(
        '[WakeInput] Ignored Sherpa runtime error because Sherpa is not active.',
        JSON.stringify({ message }),
      );
      return;
    }

    this.speechListening = false;
    this.activeProvider = WakeInputRuntimeProvider.None;
    this.foregroundTransitionPending = false;

    if (this.getRequestedProviderMode() === WakeInputProviderMode.Auto && !this.pendingDictation) {
      await this.fallbackToTextMatch(message);
      return;
    }

    if (!this.pendingDictation) {
      this.setStatus(WakeInputStatusType.Error, message);
      this.scheduleBackgroundResume(ERROR_RETRY_DELAY_MS);
    }
  }

  getStatus(): WakeInputStatus {
    return {
      ...this.status,
      wakeWords: [...this.status.wakeWords],
    };
  }

  isBackgroundModeActive(): boolean {
    return this.status.status === WakeInputStatusType.Listening
      || this.status.status === WakeInputStatusType.WakeTriggered
      || this.foregroundTransitionPending;
  }

  updateConfig(partialConfig: Partial<WakeInputConfig>): WakeInputStatus {
    const previousConfig = this.config;
    this.config = {
      ...this.config,
      ...partialConfig,
      wakeWords: Array.isArray(partialConfig.wakeWords) && partialConfig.wakeWords.length > 0
        ? [...partialConfig.wakeWords]
        : [...this.config.wakeWords],
    };
    console.log(
      '[WakeInput] Updated configuration.',
      JSON.stringify({
        enabled: this.config.enabled,
        provider: this.getRequestedProviderMode(),
        wakeWords: this.config.wakeWords,
        submitCommand: this.config.submitCommand,
        cancelCommand: this.config.cancelCommand,
        sessionTimeoutMs: this.config.sessionTimeoutMs,
        activationReplyEnabled: this.config.activationReplyEnabled,
        activationReplyText: this.config.activationReplyText,
      }),
    );
    const shouldRestartBackgroundListening = this.speechListening
      && !this.pendingDictation
      && (
        previousConfig.enabled !== this.config.enabled
        || previousConfig.provider !== this.config.provider
        || !areStringArraysEqual(previousConfig.wakeWords, this.config.wakeWords)
      );
    if (!this.config.enabled) {
      this.pendingDictation = false;
      this.foregroundTransitionPending = false;
      this.clearHandshakeTimer();
      this.clearCooldownTimer();
      this.clearRetryTimer();
      this.fallbackActive = false;
      void this.stopActiveProviderSilently();
      this.setStatus(WakeInputStatusType.Disabled);
    } else if (!this.supported) {
      this.setStatus(WakeInputStatusType.Disabled, this.status.error);
    } else if (!this.speechListening && !this.pendingDictation) {
      this.activeProvider = WakeInputRuntimeProvider.None;
      this.fallbackActive = false;
      this.setStatus(WakeInputStatusType.Idle);
      this.scheduleBackgroundResume(0);
    } else if (shouldRestartBackgroundListening) {
      console.log(
        '[WakeInput] Restarting background listener after configuration update.',
        JSON.stringify({
          provider: this.activeProvider,
          wakeWords: this.config.wakeWords,
        }),
      );
      void (async () => {
        await this.stopActiveProviderSilently();
        this.fallbackActive = false;
        this.setStatus(WakeInputStatusType.Idle);
        this.scheduleBackgroundResume(0);
      })();
    } else {
      this.emitStateChanged();
    }
    return this.getStatus();
  }

  async syncAvailability(options: { supported: boolean; error?: string }): Promise<void> {
    this.supported = options.supported;
    console.log(
      '[WakeInput] Synced availability.',
      JSON.stringify({
        enabled: this.config.enabled,
        supported: options.supported,
        provider: this.getRequestedProviderMode(),
        speechListening: this.speechListening,
        pendingDictation: this.pendingDictation,
        error: options.error,
      }),
    );
    if (!options.supported) {
      this.pendingDictation = false;
      this.fallbackActive = false;
      this.clearRetryTimer();
      this.clearHandshakeTimer();
      this.clearCooldownTimer();
      await this.stopActiveProviderSilently();
      this.setStatus(WakeInputStatusType.Disabled, options.error);
      return;
    }
    if (!this.config.enabled) {
      this.setStatus(WakeInputStatusType.Disabled);
      return;
    }
    if (!this.speechListening && !this.pendingDictation) {
      this.setStatus(WakeInputStatusType.Idle);
    } else {
      this.emitStateChanged();
    }
  }

  async startBackgroundListening(): Promise<void> {
    if (!this.config.enabled || !this.supported || this.speechListening || this.pendingDictation) {
      console.debug(
        '[WakeInput] Skipped background listening start.',
        JSON.stringify({
          enabled: this.config.enabled,
          supported: this.supported,
          speechListening: this.speechListening,
          pendingDictation: this.pendingDictation,
        }),
      );
      return;
    }

    if (this.backgroundResumeSuppressedUntilMs > Date.now()) {
      console.log(
        '[WakeInput] Delaying background listening because resume is temporarily suppressed.',
        JSON.stringify({ remainingMs: this.backgroundResumeSuppressedUntilMs - Date.now() }),
      );
      this.scheduleBackgroundResume(0);
      return;
    }

    this.clearRetryTimer();
    this.clearCooldownTimer();
    this.speechListening = false;
    this.activeProvider = WakeInputRuntimeProvider.None;
    this.fallbackActive = false;
    this.setStatus(WakeInputStatusType.Listening);
    console.log(
      '[WakeInput] Starting background listening.',
      JSON.stringify({ requestedProvider: this.getRequestedProviderMode() }),
    );

    const requestedProvider = this.getRequestedProviderMode();
    if (requestedProvider === WakeInputProviderMode.Auto && this.shouldPreferTextMatchForAutoMode()) {
      console.log(
        '[WakeInput] Using text-match wake listener because high-risk short wake words are configured.',
        JSON.stringify({ wakeWords: this.config.wakeWords }),
      );
      await this.startTextMatchProvider({ fallbackReason: 'short_wake_word_preferred_text_match' });
      return;
    }

    if (requestedProvider === WakeInputProviderMode.SherpaOnnx || requestedProvider === WakeInputProviderMode.Auto) {
      const sherpaResult = await this.startSherpaProvider();
      if (sherpaResult.success) {
        return;
      }

      if (requestedProvider === WakeInputProviderMode.SherpaOnnx) {
        this.setStatus(WakeInputStatusType.Error, sherpaResult.error);
        console.warn(
          '[WakeInput] Failed to start Sherpa wake listener.',
          JSON.stringify({ error: sherpaResult.error }),
        );
        this.scheduleBackgroundResume(ERROR_RETRY_DELAY_MS);
        return;
      }

      await this.fallbackToTextMatch(sherpaResult.error ?? 'sherpa_start_failed');
      return;
    }

    await this.startTextMatchProvider();
  }

  async stopBackgroundListening(options?: { forForegroundTransition?: boolean }): Promise<void> {
    this.clearRetryTimer();
    if (!this.speechListening) {
      if (options?.forForegroundTransition) {
        this.foregroundTransitionPending = false;
      }
      if (this.config.enabled && this.supported && !this.pendingDictation) {
        this.setStatus(WakeInputStatusType.Idle);
      }
      return;
    }

    const activeProvider = this.activeProvider;
    this.speechListening = false;

    if (options?.forForegroundTransition && activeProvider === WakeInputRuntimeProvider.TextMatch) {
      this.foregroundTransitionPending = true;
    } else {
      this.foregroundTransitionPending = false;
    }

    if (!options?.forForegroundTransition) {
      this.activeProvider = WakeInputRuntimeProvider.None;
      this.setStatus(this.config.enabled ? WakeInputStatusType.Idle : WakeInputStatusType.Disabled);
    }

    console.log(
      '[WakeInput] Stopping background listening.',
      JSON.stringify({ provider: activeProvider, forForegroundTransition: options?.forForegroundTransition ?? false }),
    );

    if (activeProvider === WakeInputRuntimeProvider.SherpaOnnx) {
      this.activeProvider = WakeInputRuntimeProvider.None;
      this.foregroundTransitionPending = false;
      await this.sherpaOnnxWakeService.stop();
      return;
    }

    await this.stopTextMatchListening();
  }

  async prepareForegroundSpeechStart(): Promise<ForegroundSpeechOrigin> {
    return this.prepareForegroundSpeechStartForSource();
  }

  async prepareForegroundSpeechStartForSource(source?: SpeechStartSourceValue): Promise<ForegroundSpeechOrigin> {
    const origin: ForegroundSpeechOrigin = this.pendingDictation
      ? SpeechStartSource.Wake
      : source === SpeechStartSource.FollowUp
        ? SpeechStartSource.FollowUp
        : SpeechStartSource.Manual;
    this.clearRetryTimer();
    console.log('[WakeInput] Preparing foreground speech start.', JSON.stringify({ origin }));
    if (this.speechListening) {
      await this.stopBackgroundListening({ forForegroundTransition: true });
    } else {
      this.foregroundTransitionPending = false;
    }
    if (origin === SpeechStartSource.Wake) {
      this.clearHandshakeTimer();
      this.setStatus(WakeInputStatusType.Dictating);
    }
    return origin;
  }

  handleForegroundSpeechEnded(origin: ForegroundSpeechOrigin): void {
    this.speechListening = false;
    this.foregroundTransitionPending = false;
    this.activeProvider = WakeInputRuntimeProvider.None;
    console.log('[WakeInput] Foreground speech ended.', JSON.stringify({ origin, supported: this.supported, enabled: this.config.enabled }));
    if (!this.config.enabled || !this.supported) {
      this.setStatus(WakeInputStatusType.Disabled);
      return;
    }

    if (origin === SpeechStartSource.Wake) {
      this.pendingDictation = false;
      this.clearHandshakeTimer();
      this.setStatus(WakeInputStatusType.Cooldown);
      this.clearCooldownTimer();
      this.cooldownTimer = setTimeout(() => {
        this.cooldownTimer = null;
        this.setStatus(WakeInputStatusType.Idle);
        this.scheduleBackgroundResume(0);
      }, WAKE_RESUME_DELAY_MS);
      return;
    }

    if (origin === SpeechStartSource.FollowUp) {
      this.setStatus(WakeInputStatusType.Cooldown);
      this.clearCooldownTimer();
      this.cooldownTimer = setTimeout(() => {
        this.cooldownTimer = null;
        this.setStatus(WakeInputStatusType.Idle);
        this.scheduleBackgroundResume(0);
      }, WAKE_RESUME_DELAY_MS);
      return;
    }

    this.setStatus(WakeInputStatusType.Idle);
    this.scheduleBackgroundResume(MANUAL_RESUME_DELAY_MS);
  }

  async handleSpeechState(event: SpeechStateEvent): Promise<void> {
    if (this.activeProvider !== WakeInputRuntimeProvider.TextMatch && !this.foregroundTransitionPending) {
      console.debug(
        '[WakeInput] Ignored speech event because text-match wake listener is not active.',
        JSON.stringify({ type: event.type }),
      );
      return;
    }

    if (event.type === 'partial' || event.type === 'final') {
      const matchedWakeWord = includesWakeWord(event.text ?? '', this.config.wakeWords);
      console.debug(
        '[WakeInput] Background speech received.',
        JSON.stringify({
          type: event.type,
          text: event.text ?? '',
          normalizedText: (event.text ?? '').trim(),
          matched: matchedWakeWord.matched,
          matchedWakeWord: matchedWakeWord.matchedWakeWord,
        }),
      );
      if (!matchedWakeWord.matched) {
        return;
      }

      await this.triggerWakeDictation(
        matchedWakeWord.matchedWakeWord ?? this.config.wakeWord,
        WakeInputRuntimeProvider.TextMatch,
      );
      return;
    }

    if (event.type === 'stopped') {
      this.speechListening = false;
      const wasForegroundTransitionPending = this.foregroundTransitionPending;
      this.foregroundTransitionPending = false;
      this.activeProvider = WakeInputRuntimeProvider.None;
      if (wasForegroundTransitionPending) {
        console.log('[WakeInput] Background listening stopped for foreground speech handoff.');
        return;
      }
      console.log('[WakeInput] Background listening stopped by speech service.');
      if (!this.pendingDictation) {
        this.setStatus(WakeInputStatusType.Idle);
        this.scheduleBackgroundResume(MANUAL_RESUME_DELAY_MS);
      }
      return;
    }

    if (event.type === 'error') {
      this.speechListening = false;
      const wasForegroundTransitionPending = this.foregroundTransitionPending;
      this.foregroundTransitionPending = false;
      this.activeProvider = WakeInputRuntimeProvider.None;
      if (wasForegroundTransitionPending) {
        console.warn(
          '[WakeInput] Background listening ended with an error during foreground speech handoff.',
          JSON.stringify({ code: event.code, message: event.message }),
        );
        return;
      }
      if (isRecoverableSpeechErrorCode(event.code)) {
        console.warn(
          '[WakeInput] Background listening was interrupted by the speech service. Scheduling recovery.',
          JSON.stringify({ code: event.code, message: event.message }),
        );
        if (!this.pendingDictation) {
          this.setStatus(WakeInputStatusType.Idle);
          this.scheduleBackgroundResume(ERROR_RETRY_DELAY_MS);
        }
        return;
      }
      if (isSilentSpeechTerminationCode(event.code)) {
        console.log(
          '[WakeInput] Background listening ended without a usable transcript. Resuming listener.',
          JSON.stringify({ code: event.code, message: event.message }),
        );
        if (!this.pendingDictation) {
          this.setStatus(WakeInputStatusType.Idle);
          this.scheduleBackgroundResume(MANUAL_RESUME_DELAY_MS);
        }
        return;
      }
      console.warn(
        '[WakeInput] Background listening received an error.',
        JSON.stringify({ code: event.code, message: event.message }),
      );
      if (!this.pendingDictation) {
        this.setStatus(WakeInputStatusType.Error, event.message ?? event.code);
        this.scheduleBackgroundResume(ERROR_RETRY_DELAY_MS);
      }
    }
  }

  dispose(): void {
    this.clearRetryTimer();
    this.clearHandshakeTimer();
    this.clearCooldownTimer();
    void this.stopActiveProviderSilently();
  }
}
