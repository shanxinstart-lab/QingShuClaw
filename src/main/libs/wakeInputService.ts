import { EventEmitter } from 'events';
import { isRecoverableSpeechErrorCode, type SpeechStateEvent } from '../../shared/speech/constants';
import {
  WakeInputStatusType,
  type WakeInputConfig,
  type WakeInputDictationRequest,
  type WakeInputStatus,
} from '../../shared/wakeInput/constants';

type ForegroundSpeechOrigin = 'manual' | 'wake';

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

export class WakeInputService extends EventEmitter {
  private config: WakeInputConfig;

  private status: WakeInputStatus;

  private startListening: () => Promise<{ success: boolean; error?: string }>;

  private stopListening: () => Promise<{ success: boolean; error?: string }>;

  private speechListening = false;

  private foregroundTransitionPending = false;

  private supported = false;

  private pendingDictation = false;

  private retryTimer: NodeJS.Timeout | null = null;

  private handshakeTimer: NodeJS.Timeout | null = null;

  private cooldownTimer: NodeJS.Timeout | null = null;

  constructor(options: {
    config: WakeInputConfig;
    platform: string;
    startListening: () => Promise<{ success: boolean; error?: string }>;
    stopListening: () => Promise<{ success: boolean; error?: string }>;
  }) {
    super();
    this.config = { ...options.config, wakeWords: [...options.config.wakeWords] };
    this.startListening = options.startListening;
    this.stopListening = options.stopListening;
    this.status = {
      enabled: this.config.enabled,
      supported: false,
      platform: options.platform,
      status: WakeInputStatusType.Disabled,
      wakeWords: [...this.config.wakeWords],
      wakeWord: this.config.wakeWord,
      submitCommand: this.config.submitCommand,
      cancelCommand: this.config.cancelCommand,
      sessionTimeoutMs: this.config.sessionTimeoutMs,
      activationReplyEnabled: this.config.activationReplyEnabled,
      activationReplyText: this.config.activationReplyText,
      listening: false,
    };
  }

  override on<U extends keyof WakeInputServiceEvents>(event: U, listener: WakeInputServiceEvents[U]): this {
    return super.on(event, listener);
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

  private emitStateChanged(): void {
    this.emit('stateChanged', this.getStatus());
  }

  private setStatus(status: WakeInputStatusType, error?: string): void {
    this.status = {
      ...this.status,
      enabled: this.config.enabled,
      supported: this.supported,
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
    this.retryTimer = setTimeout(() => {
      void this.startBackgroundListening();
    }, delayMs);
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
        wakeWords: this.config.wakeWords,
        submitCommand: this.config.submitCommand,
        cancelCommand: this.config.cancelCommand,
        sessionTimeoutMs: this.config.sessionTimeoutMs,
        activationReplyEnabled: this.config.activationReplyEnabled,
        activationReplyText: this.config.activationReplyText,
      }),
    );
    if (!this.config.enabled) {
      this.pendingDictation = false;
      this.foregroundTransitionPending = false;
      this.clearHandshakeTimer();
      this.clearCooldownTimer();
      this.clearRetryTimer();
      this.speechListening = false;
      this.setStatus(WakeInputStatusType.Disabled);
    } else if (!this.supported) {
      this.setStatus(WakeInputStatusType.Disabled, this.status.error);
    } else if (!this.speechListening && !this.pendingDictation) {
      this.setStatus(WakeInputStatusType.Idle);
      this.scheduleBackgroundResume(0);
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
        speechListening: this.speechListening,
        pendingDictation: this.pendingDictation,
        error: options.error,
      }),
    );
    if (!options.supported) {
      this.pendingDictation = false;
      this.foregroundTransitionPending = false;
      this.speechListening = false;
      this.clearRetryTimer();
      this.clearHandshakeTimer();
      this.clearCooldownTimer();
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

    this.clearRetryTimer();
    this.clearCooldownTimer();
    this.speechListening = false;
    this.setStatus(WakeInputStatusType.Listening);
    console.log('[WakeInput] Starting background listening.');

    const result = await this.startListening();
    if (!result.success) {
      this.speechListening = false;
      this.setStatus(WakeInputStatusType.Error, result.error);
      console.warn(
        '[WakeInput] Failed to start background listening.',
        JSON.stringify({ error: result.error }),
      );
      this.scheduleBackgroundResume(ERROR_RETRY_DELAY_MS);
      return;
    }

    this.speechListening = true;
    this.setStatus(WakeInputStatusType.Listening);
    console.log('[WakeInput] Background listening started.');
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

    this.speechListening = false;
    if (options?.forForegroundTransition) {
      this.foregroundTransitionPending = true;
    } else {
      this.foregroundTransitionPending = false;
      this.setStatus(this.config.enabled ? WakeInputStatusType.Idle : WakeInputStatusType.Disabled);
    }
    console.log('[WakeInput] Stopping background listening.');
    await this.stopListening();
  }

  async prepareForegroundSpeechStart(): Promise<ForegroundSpeechOrigin> {
    const origin: ForegroundSpeechOrigin = this.pendingDictation ? 'wake' : 'manual';
    this.clearRetryTimer();
    console.log('[WakeInput] Preparing foreground speech start.', JSON.stringify({ origin }));
    if (this.speechListening) {
      await this.stopBackgroundListening({ forForegroundTransition: true });
    } else {
      this.foregroundTransitionPending = false;
    }
    if (origin === 'wake') {
      this.clearHandshakeTimer();
      this.setStatus(WakeInputStatusType.Dictating);
    }
    return origin;
  }

  handleForegroundSpeechEnded(origin: ForegroundSpeechOrigin): void {
    this.speechListening = false;
    this.foregroundTransitionPending = false;
    console.log('[WakeInput] Foreground speech ended.', JSON.stringify({ origin, supported: this.supported, enabled: this.config.enabled }));
    if (!this.config.enabled || !this.supported) {
      this.setStatus(WakeInputStatusType.Disabled);
      return;
    }

    if (origin === 'wake') {
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

    this.setStatus(WakeInputStatusType.Idle);
    this.scheduleBackgroundResume(MANUAL_RESUME_DELAY_MS);
  }

  async handleSpeechState(event: SpeechStateEvent): Promise<void> {
    if (!this.speechListening && !this.foregroundTransitionPending) {
      console.debug('[WakeInput] Ignored speech event because background listening is inactive.', JSON.stringify({ type: event.type }));
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

      this.pendingDictation = true;
      this.speechListening = false;
      this.setStatus(WakeInputStatusType.WakeTriggered);
      await this.stopListening();
      console.log(
        '[WakeInput] Wake phrase matched, requesting dictation.',
        JSON.stringify({ wakeWord: matchedWakeWord.matchedWakeWord }),
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
      return;
    }

    if (event.type === 'stopped') {
      this.speechListening = false;
      const wasForegroundTransitionPending = this.foregroundTransitionPending;
      this.foregroundTransitionPending = false;
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
    this.foregroundTransitionPending = false;
  }
}
