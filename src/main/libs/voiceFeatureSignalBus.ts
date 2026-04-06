import { TtsAssistantReplyPlaybackState, type TtsStateEvent } from '../../shared/tts/constants';
import type { SpeechStateEvent } from '../../shared/speech/constants';
import type { WakeInputStatus } from '../../shared/wakeInput/constants';

export interface AssistantReplyPlaybackSignal {
  sessionId?: string;
  state: typeof TtsAssistantReplyPlaybackState[keyof typeof TtsAssistantReplyPlaybackState];
}

export interface VoiceFeatureSignalMap {
  wakeStateChanged: WakeInputStatus;
  speechStateChanged: SpeechStateEvent;
  ttsStateChanged: TtsStateEvent;
  assistantReplyPlaybackChanged: AssistantReplyPlaybackSignal;
}

type VoiceFeatureSignalListener<K extends keyof VoiceFeatureSignalMap> = (
  payload: VoiceFeatureSignalMap[K],
) => void;

export class VoiceFeatureSignalBus {
  private readonly listeners: {
    [K in keyof VoiceFeatureSignalMap]: Set<VoiceFeatureSignalListener<K>>;
  } = {
      wakeStateChanged: new Set(),
      speechStateChanged: new Set(),
      ttsStateChanged: new Set(),
      assistantReplyPlaybackChanged: new Set(),
    };

  on<K extends keyof VoiceFeatureSignalMap>(
    event: K,
    listener: VoiceFeatureSignalListener<K>,
  ): () => void {
    this.listeners[event].add(listener);
    return () => {
      this.listeners[event].delete(listener);
    };
  }

  emit<K extends keyof VoiceFeatureSignalMap>(
    event: K,
    payload: VoiceFeatureSignalMap[K],
  ): void {
    for (const listener of this.listeners[event]) {
      listener(payload);
    }
  }
}
