import {
  SpeechPermissionStatus,
  SpeechStartSource,
  type SpeechAvailability,
  type SpeechStartOptions,
} from '../../shared/speech/constants';
import { VoiceProvider, type VoiceConfig } from '../../shared/voice/constants';
import { MacSpeechService } from './macSpeechService';
import { SherpaOnnxSpeechService } from './sherpaOnnxSpeechService';

export class SpeechRouterService {
  private activeProvider: typeof VoiceProvider[keyof typeof VoiceProvider] = VoiceProvider.None;

  private lastRequestedProvider: typeof VoiceProvider[keyof typeof VoiceProvider] = VoiceProvider.None;

  private lastResolvedProvider: typeof VoiceProvider[keyof typeof VoiceProvider] = VoiceProvider.None;

  private lastFallbackReason?: string;

  constructor(
    private readonly options: {
      getVoiceConfig: () => VoiceConfig;
      macosNativeService: MacSpeechService;
      sherpaOnnxService: SherpaOnnxSpeechService;
      isMacSpeechInputEnabled: () => boolean;
    },
  ) {}

  getActiveProvider(): typeof VoiceProvider[keyof typeof VoiceProvider] {
    return this.activeProvider;
  }

  private resolveRequestedProvider(source?: SpeechStartOptions['source']): typeof VoiceProvider[keyof typeof VoiceProvider] {
    const voiceConfig = this.options.getVoiceConfig();
    if (source === SpeechStartSource.FollowUp) {
      return voiceConfig.capabilities.followUpDictation.provider;
    }
    return voiceConfig.capabilities.manualStt.provider;
  }

  private buildAvailabilityResult(
    availability: SpeechAvailability,
    requestedProvider: typeof VoiceProvider[keyof typeof VoiceProvider],
    actualProvider: typeof VoiceProvider[keyof typeof VoiceProvider],
    fallbackReason?: string,
  ): SpeechAvailability & { provider: string } {
    return {
      ...availability,
      provider: actualProvider,
      requestedProvider,
      actualProvider,
      fallbackActive: requestedProvider !== actualProvider,
      fallbackReason,
    };
  }

  async getAvailability(source?: SpeechStartOptions['source']): Promise<SpeechAvailability & { provider: string }> {
    const requestedProvider = this.resolveRequestedProvider(source);
    if (requestedProvider === VoiceProvider.LocalSherpaOnnx) {
      const sherpaAvailability = await this.options.sherpaOnnxService.getAvailability(
        this.options.getVoiceConfig().providers.sherpaOnnx,
      );
      const preferredResolvedProvider = this.lastRequestedProvider === requestedProvider
        ? this.lastResolvedProvider
        : VoiceProvider.LocalSherpaOnnx;
      if (sherpaAvailability.supported || process.platform !== 'darwin') {
        return this.buildAvailabilityResult(
          sherpaAvailability,
          VoiceProvider.LocalSherpaOnnx,
          preferredResolvedProvider === VoiceProvider.MacosNative
            ? VoiceProvider.MacosNative
            : VoiceProvider.LocalSherpaOnnx,
          preferredResolvedProvider === VoiceProvider.MacosNative ? this.lastFallbackReason : undefined,
        );
      }
      if (!this.options.isMacSpeechInputEnabled()) {
        return this.buildAvailabilityResult(
          sherpaAvailability,
          VoiceProvider.LocalSherpaOnnx,
          VoiceProvider.LocalSherpaOnnx,
          sherpaAvailability.error,
        );
      }
      return this.buildAvailabilityResult(
        await this.options.macosNativeService.getAvailability(),
        VoiceProvider.LocalSherpaOnnx,
        VoiceProvider.MacosNative,
        this.lastFallbackReason ?? sherpaAvailability.error,
      );
    }

    if (!this.options.isMacSpeechInputEnabled()) {
      return this.buildAvailabilityResult({
        enabled: true,
        supported: false,
        platform: process.platform,
        permission: SpeechPermissionStatus.Unsupported,
        speechAuthorization: SpeechPermissionStatus.Unsupported,
        microphoneAuthorization: SpeechPermissionStatus.Unsupported,
        listening: false,
      }, VoiceProvider.MacosNative, VoiceProvider.MacosNative);
    }

    return this.buildAvailabilityResult(
      await this.options.macosNativeService.getAvailability(),
      VoiceProvider.MacosNative,
      VoiceProvider.MacosNative,
    );
  }

  async start(options?: SpeechStartOptions): Promise<{ success: boolean; error?: string; provider: string }> {
    const requestedProvider = this.resolveRequestedProvider(options?.source);
    this.lastRequestedProvider = requestedProvider;
    if (requestedProvider === VoiceProvider.LocalSherpaOnnx) {
      const sherpaResult = await this.options.sherpaOnnxService.start(
        this.options.getVoiceConfig().providers.sherpaOnnx,
        options,
      );
      if (sherpaResult.success) {
        this.activeProvider = VoiceProvider.LocalSherpaOnnx;
        this.lastResolvedProvider = VoiceProvider.LocalSherpaOnnx;
        this.lastFallbackReason = undefined;
        return { ...sherpaResult, provider: VoiceProvider.LocalSherpaOnnx };
      }

      if (process.platform === 'darwin' && this.options.isMacSpeechInputEnabled()) {
        const macResult = await this.options.macosNativeService.start(options);
        if (macResult.success) {
          this.activeProvider = VoiceProvider.MacosNative;
          this.lastResolvedProvider = VoiceProvider.MacosNative;
          this.lastFallbackReason = sherpaResult.error;
          return { ...macResult, provider: VoiceProvider.MacosNative };
        }
      }

      this.lastResolvedProvider = VoiceProvider.LocalSherpaOnnx;
      this.lastFallbackReason = sherpaResult.error;
      return { ...sherpaResult, provider: VoiceProvider.LocalSherpaOnnx };
    }

    const macResult = await this.options.macosNativeService.start(options);
    if (macResult.success) {
      this.activeProvider = VoiceProvider.MacosNative;
      this.lastResolvedProvider = VoiceProvider.MacosNative;
      this.lastFallbackReason = undefined;
    }
    this.lastRequestedProvider = VoiceProvider.MacosNative;
    return {
      ...macResult,
      provider: VoiceProvider.MacosNative,
    };
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    const activeProvider = this.activeProvider;
    this.activeProvider = VoiceProvider.None;
    if (activeProvider === VoiceProvider.LocalSherpaOnnx) {
      return this.options.sherpaOnnxService.stop();
    }
    return this.options.macosNativeService.stop();
  }
}
