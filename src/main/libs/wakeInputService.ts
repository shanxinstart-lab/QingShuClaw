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

const WAKE_TEXT_NORMALIZE_PATTERN = /[\s,.!?;:，。！？；：、"'“”‘’`~\-_[\](){}<>/\\|]+/gu;

const normalizeWakePhrase = (value: string): string => {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase('zh-CN')
    .replace(WAKE_TEXT_NORMALIZE_PATTERN, '');
};

const levenshteinDistance = (left: string, right: string): number => {
  if (left === right) {
    return 0;
  }
  if (!left) {
    return right.length;
  }
  if (!right) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1).fill(0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }
    for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
      previous[rightIndex] = current[rightIndex];
    }
  }

  return previous[right.length];
};

const buildWakeTextCandidates = (normalizedText: string, wakeWordLength: number): string[] => {
  if (normalizedText.length <= wakeWordLength + 1) {
    return [normalizedText];
  }

  const candidates = new Set<string>([normalizedText]);
  const minLength = Math.max(1, wakeWordLength - 1);
  const maxLength = Math.min(normalizedText.length, wakeWordLength + 1);

  for (let candidateLength = minLength; candidateLength <= maxLength; candidateLength += 1) {
    for (let start = 0; start <= normalizedText.length - candidateLength; start += 1) {
      candidates.add(normalizedText.slice(start, start + candidateLength));
    }
  }

  return [...candidates];
};

const isCloseWakeWord = (normalizedText: string, normalizedWakeWord: string): boolean => {
  if (normalizedText.includes(normalizedWakeWord)) {
    return true;
  }
  if (normalizedWakeWord.length < 3) {
    return false;
  }

  const maxDistance = normalizedWakeWord.length >= 5 ? 1 : 0;
  if (maxDistance === 0) {
    return false;
  }

  return buildWakeTextCandidates(normalizedText, normalizedWakeWord.length)
    .some((candidate) => levenshteinDistance(candidate, normalizedWakeWord) <= maxDistance);
};

const matchWakeWord = (
  text: string,
  wakeWords: string[],
): { matched: boolean; matchedWakeWord?: string; normalizedText: string } => {
  const normalizedText = normalizeWakePhrase(text);
  if (!normalizedText) {
    return { matched: false, normalizedText };
  }

  return wakeWords.some((wakeWord) => {
    const normalizedWakeWord = normalizeWakePhrase(wakeWord);
    if (!normalizedWakeWord) {
      return false;
    }
    return isCloseWakeWord(normalizedText, normalizedWakeWord);
  })
    ? {
        matched: true,
        matchedWakeWord: wakeWords.find((wakeWord) => {
          const normalizedWakeWord = normalizeWakePhrase(wakeWord);
          return Boolean(normalizedWakeWord) && isCloseWakeWord(normalizedText, normalizedWakeWord);
        }),
        normalizedText,
      }
    : { matched: false, normalizedText };
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
      wakeWords: [...this.config.wakeWords],
      submitCommand: this.config.submitCommand,
      cancelCommand: this.config.cancelCommand,
      sessionTimeoutMs: this.config.sessionTimeoutMs,
      autoRestartAfterReply: this.config.autoRestartAfterReply,
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
      submitCommand: this.config.submitCommand,
      cancelCommand: this.config.cancelCommand,
      sessionTimeoutMs: this.config.sessionTimeoutMs,
      autoRestartAfterReply: this.config.autoRestartAfterReply,
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
      const wakeMatch = matchWakeWord(event.text ?? '', this.config.wakeWords);
      console.debug(
        '[WakeInput] Background speech received.',
        JSON.stringify({
          type: event.type,
          text: event.text ?? '',
          normalizedText: wakeMatch.normalizedText,
          matched: wakeMatch.matched,
          matchedWakeWord: wakeMatch.matchedWakeWord,
        }),
      );

      if (!wakeMatch.matched) {
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
        autoRestartAfterReply: this.config.autoRestartAfterReply,
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
