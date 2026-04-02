import { EventEmitter } from 'events';
import type { SpeechStateEvent } from '../../shared/speech/constants';
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

const includesWakeWord = (text: string, wakeWord: string): boolean => {
  const normalizedText = (text ?? '').trim();
  const normalizedWakeWord = (wakeWord ?? '').trim();
  if (!normalizedText || !normalizedWakeWord) {
    return false;
  }
  return normalizedText.includes(normalizedWakeWord);
};

export class WakeInputService extends EventEmitter {
  private config: WakeInputConfig;

  private status: WakeInputStatus;

  private startListening: () => Promise<{ success: boolean; error?: string }>;

  private stopListening: () => Promise<{ success: boolean; error?: string }>;

  private speechListening = false;

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
    this.config = { ...options.config };
    this.startListening = options.startListening;
    this.stopListening = options.stopListening;
    this.status = {
      enabled: this.config.enabled,
      supported: false,
      platform: options.platform,
      status: WakeInputStatusType.Disabled,
      wakeWord: this.config.wakeWord,
      submitCommand: this.config.submitCommand,
      cancelCommand: this.config.cancelCommand,
      sessionTimeoutMs: this.config.sessionTimeoutMs,
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
      wakeWord: this.config.wakeWord,
      submitCommand: this.config.submitCommand,
      cancelCommand: this.config.cancelCommand,
      sessionTimeoutMs: this.config.sessionTimeoutMs,
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
    return { ...this.status };
  }

  isBackgroundModeActive(): boolean {
    return this.status.status === WakeInputStatusType.Listening
      || this.status.status === WakeInputStatusType.WakeTriggered;
  }

  updateConfig(partialConfig: Partial<WakeInputConfig>): WakeInputStatus {
    this.config = {
      ...this.config,
      ...partialConfig,
    };
    if (!this.config.enabled) {
      this.pendingDictation = false;
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
    if (!options.supported) {
      this.pendingDictation = false;
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
      return;
    }

    this.clearRetryTimer();
    this.clearCooldownTimer();
    this.speechListening = false;
    this.setStatus(WakeInputStatusType.Listening);

    const result = await this.startListening();
    if (!result.success) {
      this.speechListening = false;
      this.setStatus(WakeInputStatusType.Error, result.error);
      this.scheduleBackgroundResume(ERROR_RETRY_DELAY_MS);
      return;
    }

    this.speechListening = true;
    this.setStatus(WakeInputStatusType.Listening);
  }

  async stopBackgroundListening(): Promise<void> {
    this.clearRetryTimer();
    if (!this.speechListening) {
      if (this.config.enabled && this.supported && !this.pendingDictation) {
        this.setStatus(WakeInputStatusType.Idle);
      }
      return;
    }

    this.speechListening = false;
    this.setStatus(this.config.enabled ? WakeInputStatusType.Idle : WakeInputStatusType.Disabled);
    await this.stopListening();
  }

  async prepareForegroundSpeechStart(): Promise<ForegroundSpeechOrigin> {
    const origin: ForegroundSpeechOrigin = this.pendingDictation ? 'wake' : 'manual';
    this.clearRetryTimer();
    if (this.speechListening) {
      await this.stopBackgroundListening();
    }
    if (origin === 'wake') {
      this.clearHandshakeTimer();
      this.setStatus(WakeInputStatusType.Dictating);
    }
    return origin;
  }

  handleForegroundSpeechEnded(origin: ForegroundSpeechOrigin): void {
    this.speechListening = false;
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
    if (!this.speechListening) {
      return;
    }

    if (event.type === 'partial' || event.type === 'final') {
      if (!includesWakeWord(event.text ?? '', this.config.wakeWord)) {
        return;
      }

      this.pendingDictation = true;
      this.speechListening = false;
      this.setStatus(WakeInputStatusType.WakeTriggered);
      await this.stopListening();

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
      if (!this.pendingDictation) {
        this.setStatus(WakeInputStatusType.Idle);
        this.scheduleBackgroundResume(MANUAL_RESUME_DELAY_MS);
      }
      return;
    }

    if (event.type === 'error') {
      this.speechListening = false;
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
  }
}
