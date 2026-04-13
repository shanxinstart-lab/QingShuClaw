import { EventEmitter } from 'events';
import { MacTtsService } from './macTtsService';
import { EdgeTtsService, stripEdgeVoiceIdentifier } from './edgeTtsService';
import {
  TtsEngine,
  TtsPrepareStatus,
  TtsStateType,
  type TtsAvailability,
  type TtsPrepareOptions,
  type TtsQueryOptions,
  type TtsSpeakOptions,
  type TtsStateEvent,
  type TtsVoice,
} from '../../shared/tts/constants';

type TtsRouterConfig = {
  enabled?: boolean;
  engine?: TtsEngine;
  voiceId?: string;
  rate?: number;
  volume?: number;
};

type TtsRouterEvents = {
  stateChanged: (event: TtsStateEvent) => void;
};

type SpeakExecutionOptions = {
  allowPrepare?: boolean;
};

export class TtsRouterService extends EventEmitter {
  constructor(
    private readonly macTtsService: MacTtsService,
    private readonly edgeTtsService: EdgeTtsService,
    private readonly getConfig: () => TtsRouterConfig,
  ) {
    super();

    this.macTtsService.on('stateChanged', (event: TtsStateEvent) => {
      this.emit('stateChanged', event);
    });
    this.edgeTtsService.on('stateChanged', (event: TtsStateEvent) => {
      this.emit('stateChanged', event);
    });
    this.edgeTtsService.on('availabilityChanged', () => {
      void this.emitAvailabilityChanged();
    });
  }

  override on<U extends keyof TtsRouterEvents>(event: U, listener: TtsRouterEvents[U]): this {
    return super.on(event, listener);
  }

  private resolveConfiguredEngine(): TtsEngine {
    return this.getConfig().engine ?? TtsEngine.MacOsNative;
  }

  private resolveEngineOverride(options?: TtsQueryOptions): TtsEngine {
    return options?.engine ?? this.resolveConfiguredEngine();
  }

  private async emitAvailabilityChanged(): Promise<void> {
    try {
      const availability = await this.getAvailability();
      this.emit('stateChanged', {
        type: TtsStateType.AvailabilityChanged,
        availability,
      } satisfies TtsStateEvent);
    } catch (error) {
      console.error('[TtsRouterService] Failed to emit TTS availability change:', error);
    }
  }

  async getAvailability(options?: TtsQueryOptions): Promise<TtsAvailability> {
    const configuredEngine = this.resolveEngineOverride(options);
    const macAvailability = await this.macTtsService.getAvailability();
    const edgeAvailability = await this.edgeTtsService.getAvailability();
    return {
      enabled: this.getConfig().enabled,
      supported: macAvailability.supported || edgeAvailability.supported,
      platform: process.platform,
      speaking: configuredEngine === TtsEngine.EdgeTts
        ? edgeAvailability.speaking
        : macAvailability.speaking,
      currentEngine: configuredEngine,
      availableEngines: process.platform === 'darwin'
        ? [TtsEngine.MacOsNative, TtsEngine.EdgeTts]
        : [TtsEngine.MacOsNative],
      prepareStatus: configuredEngine === TtsEngine.EdgeTts
        ? edgeAvailability.prepareStatus
        : TtsPrepareStatus.Ready,
      error: configuredEngine === TtsEngine.EdgeTts
        ? edgeAvailability.error
        : macAvailability.error,
    };
  }

  async prepare(options?: TtsPrepareOptions): Promise<{ success: boolean; error?: string }> {
    const engine = options?.engine ?? this.resolveConfiguredEngine();
    if (engine === TtsEngine.EdgeTts) {
      const result = await this.edgeTtsService.prepare(options);
      await this.emitAvailabilityChanged();
      return result;
    }
    await this.edgeTtsService.shutdownWorker();
    await this.emitAvailabilityChanged();
    return { success: true };
  }

  async getVoices(options?: TtsQueryOptions): Promise<TtsVoice[]> {
    if (this.resolveEngineOverride(options) === TtsEngine.EdgeTts) {
      return this.edgeTtsService.getVoices();
    }
    return this.macTtsService.getVoices();
  }

  async speak(
    options: TtsSpeakOptions,
    executionOptions?: SpeakExecutionOptions,
  ): Promise<{ success: boolean; error?: string }> {
    const configuredEngine = this.resolveConfiguredEngine();
    if (configuredEngine === TtsEngine.EdgeTts) {
      const edgeResult = await this.edgeTtsService.speak(options, executionOptions);
      if (edgeResult.success) {
        return edgeResult;
      }
      console.warn(
        '[TtsRouterService] edge-tts playback failed, falling back to macOS TTS.',
        JSON.stringify({ error: edgeResult.error }),
      );
      return this.macTtsService.speak({
        ...options,
        voiceId: stripEdgeVoiceIdentifier(options.voiceId) ? undefined : options.voiceId,
      });
    }
    return this.macTtsService.speak(options);
  }

  async speakAndAwaitCompletion(
    options: TtsSpeakOptions,
    executionOptions?: SpeakExecutionOptions & { timeoutMs?: number },
  ): Promise<{ success: boolean; error?: string }> {
    const result = await this.speak(options, executionOptions);
    if (!result.success) {
      return result;
    }

    const timeoutMs = executionOptions?.timeoutMs ?? 4_000;
    return await new Promise((resolve) => {
      let settled = false;
      const cleanup = () => {
        if (!settled) {
          settled = true;
        }
        clearTimeout(timer);
        this.removeListener('stateChanged', handleStateChanged);
      };
      const handleStateChanged = (event: TtsStateEvent) => {
        if (event.type === TtsStateType.Error) {
          cleanup();
          resolve({ success: false, error: event.message || event.code || 'TTS playback failed.' });
          return;
        }
        if (event.type === TtsStateType.Stopped) {
          cleanup();
          resolve({ success: true });
        }
      };
      const timer = setTimeout(() => {
        cleanup();
        resolve({ success: true });
      }, timeoutMs);

      this.on('stateChanged', handleStateChanged);
    });
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    await this.edgeTtsService.stop();
    return this.macTtsService.stop();
  }

  dispose(): void {
    this.edgeTtsService.dispose();
    this.macTtsService.dispose();
  }
}
