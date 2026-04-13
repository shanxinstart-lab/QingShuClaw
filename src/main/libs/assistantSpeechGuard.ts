import type { WakeInputDictationRequest } from '../../shared/wakeInput/constants';
import { TtsPlaybackSource } from '../../shared/tts/constants';

const ASSISTANT_REPLY_GRACE_MS = 400;
const ASSISTANT_REPLY_COOLDOWN_MS = 800;

export class AssistantSpeechGuard {
  private ttsPlaying = false;

  private ttsSource: string | null = null;

  private guardUntil = 0;

  private pendingFollowUpRequest: WakeInputDictationRequest | null = null;

  private graceTimer: NodeJS.Timeout | null = null;

  private cooldownTimer: NodeJS.Timeout | null = null;

  constructor(private readonly dispatchFollowUp: (request: WakeInputDictationRequest) => void) {}

  isAssistantReplyActive(now = Date.now()): boolean {
    return (
      (this.ttsPlaying && this.ttsSource === TtsPlaybackSource.AssistantReply)
      || now < this.guardUntil
    );
  }

  scheduleFollowUp(request: WakeInputDictationRequest): void {
    this.pendingFollowUpRequest = request;
    this.clearGraceTimer();

    if (this.isAssistantReplyActive()) {
      return;
    }

    this.graceTimer = setTimeout(() => {
      this.graceTimer = null;
      this.flushPendingFollowUpIfAllowed();
    }, ASSISTANT_REPLY_GRACE_MS);
  }

  clearPendingFollowUp(): void {
    this.pendingFollowUpRequest = null;
    this.clearGraceTimer();
  }

  handleTtsStarted(source?: string): void {
    this.ttsPlaying = true;
    this.ttsSource = source ?? null;
    if (source === TtsPlaybackSource.AssistantReply) {
      this.clearGraceTimer();
      this.clearCooldownTimer();
      this.guardUntil = 0;
    }
  }

  handleTtsStopped(source?: string): void {
    const normalizedSource = source ?? this.ttsSource;
    this.ttsPlaying = false;
    this.ttsSource = normalizedSource ?? null;

    if (normalizedSource !== TtsPlaybackSource.AssistantReply) {
      return;
    }

    this.clearGraceTimer();
    this.clearCooldownTimer();
    this.guardUntil = Date.now() + ASSISTANT_REPLY_COOLDOWN_MS;
    this.cooldownTimer = setTimeout(() => {
      this.cooldownTimer = null;
      this.flushPendingFollowUpIfAllowed();
    }, ASSISTANT_REPLY_COOLDOWN_MS);
  }

  dispose(): void {
    this.clearGraceTimer();
    this.clearCooldownTimer();
    this.pendingFollowUpRequest = null;
  }

  private clearGraceTimer(): void {
    if (!this.graceTimer) {
      return;
    }
    clearTimeout(this.graceTimer);
    this.graceTimer = null;
  }

  private clearCooldownTimer(): void {
    if (!this.cooldownTimer) {
      return;
    }
    clearTimeout(this.cooldownTimer);
    this.cooldownTimer = null;
  }

  private flushPendingFollowUpIfAllowed(now = Date.now()): void {
    if (!this.pendingFollowUpRequest) {
      return;
    }
    if (this.isAssistantReplyActive(now)) {
      return;
    }

    const request = this.pendingFollowUpRequest;
    this.pendingFollowUpRequest = null;
    this.dispatchFollowUp(request);
  }
}
