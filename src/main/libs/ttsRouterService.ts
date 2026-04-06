import { EventEmitter } from 'events';
import {
  TtsEngine,
  TtsPlaybackMode,
  TtsPrepareStatus,
  TtsStateType,
  type TtsAvailability,
  type TtsSpeakOptions,
  type TtsSpeakResult,
  type TtsStateEvent,
  type TtsVoice,
} from '../../shared/tts/constants';
import type { VoiceConfig } from '../../shared/voice/constants';
import { EdgeTtsService } from './edgeTtsService';
import { MacTtsService } from './macTtsService';

const DEFAULT_WAKE_REPLY_TIMEOUT_MS = 2_500;

type RouteOptions = {
  engine?: typeof TtsEngine[keyof typeof TtsEngine];
  allowFallbackToMacosNative?: boolean;
};

export class TtsRouterService extends EventEmitter {
  private lastRequestedEngine?: typeof TtsEngine[keyof typeof TtsEngine];

  private lastResolvedEngine?: typeof TtsEngine[keyof typeof TtsEngine];

  private lastFallbackReason?: string;

  constructor(
    private readonly options: {
      getVoiceConfig: () => VoiceConfig;
      macosNativeService: MacTtsService;
      edgeTtsService: EdgeTtsService;
    },
  ) {
    super();

    this.options.macosNativeService.onStateChanged((event) => {
      if (event.type === TtsStateType.AvailabilityChanged) {
        void this.emitAvailabilityChanged();
        return;
      }
      this.emit('stateChanged', {
        ...event,
        engine: TtsEngine.MacosNative,
      });
    });
    this.options.edgeTtsService.onStateChanged((event) => {
      if (event.type === TtsStateType.AvailabilityChanged) {
        void this.emitAvailabilityChanged();
        return;
      }
      this.emit('stateChanged', {
        ...event,
        engine: TtsEngine.EdgeTts,
      });
    });
  }

  private async emitAvailabilityChanged(): Promise<void> {
    this.emit('stateChanged', {
      type: TtsStateType.AvailabilityChanged,
      availability: await this.buildAvailability(),
    } satisfies TtsStateEvent);
  }

  private resolveEngine(engine?: typeof TtsEngine[keyof typeof TtsEngine]): typeof TtsEngine[keyof typeof TtsEngine] {
    const selectedEngine = engine ?? this.options.getVoiceConfig().capabilities.tts.engine;
    return selectedEngine === TtsEngine.SherpaOnnx
      ? TtsEngine.MacosNative
      : selectedEngine;
  }

  private buildMacOptions(options: TtsSpeakOptions): TtsSpeakOptions {
    const voiceConfig = this.options.getVoiceConfig();
    return {
      text: options.text,
      voiceId: voiceConfig.providers.macosNative.ttsVoiceId,
      rate: voiceConfig.providers.macosNative.ttsRate,
      volume: voiceConfig.providers.macosNative.ttsVolume,
      playbackMode: options.playbackMode,
    };
  }

  private async buildAvailability(engine?: typeof TtsEngine[keyof typeof TtsEngine]): Promise<TtsAvailability> {
    const selectedEngine = this.resolveEngine(engine);
    const macAvailability = await this.options.macosNativeService.getAvailability();
    const edgeAvailability = await this.options.edgeTtsService.getAvailability();
    const availableEngines = [
      ...(macAvailability.supported ? [TtsEngine.MacosNative] : []),
      ...(edgeAvailability.supported ? [TtsEngine.EdgeTts] : []),
    ];
    const selectedAvailability = selectedEngine === TtsEngine.EdgeTts ? edgeAvailability : macAvailability;
    const routerSupported = selectedEngine === TtsEngine.EdgeTts
      ? edgeAvailability.supported || macAvailability.supported
      : macAvailability.supported;

    return {
      ...selectedAvailability,
      supported: routerSupported,
      currentEngine: selectedEngine,
      availableEngines,
      prepareStatus: selectedEngine === TtsEngine.EdgeTts
        ? edgeAvailability.prepareStatus
        : TtsPrepareStatus.Ready,
      workerStatus: edgeAvailability.workerStatus,
      recentError: selectedEngine === TtsEngine.EdgeTts
        ? edgeAvailability.recentError
        : undefined,
      lastRequestedEngine: this.lastRequestedEngine,
      lastResolvedEngine: this.lastResolvedEngine,
      lastFallbackReason: this.lastFallbackReason,
    };
  }

  async syncSelectedEngine(engine: typeof TtsEngine[keyof typeof TtsEngine]): Promise<TtsAvailability> {
    await this.options.edgeTtsService.setWorkerPersistent(engine === TtsEngine.EdgeTts);
    return this.buildAvailability(engine);
  }

  async prewarmSelectedEngine(text: string): Promise<void> {
    const selectedEngine = this.resolveEngine();
    if (selectedEngine !== TtsEngine.EdgeTts) {
      return;
    }
    const trimmedText = text.trim();
    if (!trimmedText) {
      return;
    }
    await this.options.edgeTtsService.prewarm(this.options.getVoiceConfig().providers.edgeTts, trimmedText);
  }

  async prepare(engine?: typeof TtsEngine[keyof typeof TtsEngine]): Promise<TtsAvailability> {
    const selectedEngine = this.resolveEngine(engine);
    if (selectedEngine === TtsEngine.EdgeTts) {
      await this.options.edgeTtsService.prepare({ keepWorkerAlive: true });
    } else {
      await this.options.edgeTtsService.setWorkerPersistent(false);
    }
    return this.buildAvailability(selectedEngine);
  }

  async getAvailability(engine?: typeof TtsEngine[keyof typeof TtsEngine]): Promise<TtsAvailability> {
    return this.buildAvailability(engine);
  }

  async getVoices(engine?: typeof TtsEngine[keyof typeof TtsEngine]): Promise<TtsVoice[]> {
    const selectedEngine = this.resolveEngine(engine);
    if (selectedEngine === TtsEngine.EdgeTts) {
      try {
        return await this.options.edgeTtsService.getVoices();
      } catch (error) {
        console.warn('[TtsRouterService] Falling back to macOS voices after edge-tts voice lookup failed:', error);
        return this.options.macosNativeService.getVoices();
      }
    }
    return this.options.macosNativeService.getVoices();
  }

  async speak(options: TtsSpeakOptions, routeOptions?: RouteOptions): Promise<TtsSpeakResult> {
    const selectedEngine = this.resolveEngine(routeOptions?.engine);
    this.lastRequestedEngine = selectedEngine;
    if (selectedEngine === TtsEngine.EdgeTts) {
      const edgeResult = await this.options.edgeTtsService.speak(this.options.getVoiceConfig().providers.edgeTts, options);
      if (edgeResult.success) {
        this.lastResolvedEngine = TtsEngine.EdgeTts;
        this.lastFallbackReason = undefined;
        void this.emitAvailabilityChanged();
        return {
          ...edgeResult,
          engine: TtsEngine.EdgeTts,
        };
      }
      if (routeOptions?.allowFallbackToMacosNative !== false) {
        console.warn('[TtsRouterService] edge-tts playback failed, falling back to macOS native TTS.', edgeResult.error);
        const macResult = await this.options.macosNativeService.speak(this.buildMacOptions({
          ...options,
          playbackMode: TtsPlaybackMode.System,
        }));
        this.lastResolvedEngine = macResult.success ? TtsEngine.MacosNative : undefined;
        this.lastFallbackReason = edgeResult.error;
        void this.emitAvailabilityChanged();
        return {
          success: macResult.success,
          error: macResult.error,
          engine: TtsEngine.MacosNative,
        };
      }
      this.lastResolvedEngine = undefined;
      this.lastFallbackReason = edgeResult.error;
      void this.emitAvailabilityChanged();
      return {
        ...edgeResult,
        engine: TtsEngine.EdgeTts,
      };
    }

    const macResult = await this.options.macosNativeService.speak({
      ...this.buildMacOptions(options),
      ...options,
    });
    this.lastResolvedEngine = macResult.success ? TtsEngine.MacosNative : undefined;
    this.lastFallbackReason = undefined;
    void this.emitAvailabilityChanged();
    return {
      success: macResult.success,
      error: macResult.error,
      engine: TtsEngine.MacosNative,
    };
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    await this.options.edgeTtsService.stop();
    return this.options.macosNativeService.stop();
  }

  async playWakeActivationReply(text: string, timeoutMs = DEFAULT_WAKE_REPLY_TIMEOUT_MS): Promise<void> {
    const trimmedText = text.trim();
    if (!trimmedText) {
      return;
    }
    const result = await this.speak({
      text: trimmedText,
      playbackMode: TtsPlaybackMode.System,
    }, {
      allowFallbackToMacosNative: true,
    });
    if (!result.success) {
      throw new Error(result.error || 'wake_activation_reply_failed');
    }
    await this.waitForPlaybackToFinish(result.engine ?? TtsEngine.MacosNative, timeoutMs);
  }

  private async waitForPlaybackToFinish(
    engine: typeof TtsEngine[keyof typeof TtsEngine],
    timeoutMs: number,
  ): Promise<void> {
    const target = engine === TtsEngine.EdgeTts
      ? this.options.edgeTtsService
      : this.options.macosNativeService;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        resolve();
      }, timeoutMs);
      const listener = (event: TtsStateEvent): void => {
        if (event.type === TtsStateType.Stopped) {
          cleanup();
          resolve();
          return;
        }
        if (event.type === TtsStateType.Error) {
          cleanup();
          reject(new Error(event.message || event.code || 'tts_runtime_error'));
        }
      };
      const cleanup = (): void => {
        clearTimeout(timer);
        unsubscribe();
      };
      const unsubscribe = target.onStateChanged(listener);
    });
  }

  onStateChanged(listener: (event: TtsStateEvent) => void): () => void {
    this.on('stateChanged', listener);
    return () => {
      this.off('stateChanged', listener);
    };
  }
}
