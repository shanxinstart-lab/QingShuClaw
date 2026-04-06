import { EventEmitter } from 'events';
import { PvRecorder } from '@picovoice/pvrecorder-node';
import {
  SpeechErrorCode,
  SpeechPermissionStatus,
  SpeechStateType,
  type SpeechAvailability,
  type SpeechStartOptions,
  type SpeechStateEvent,
} from '../../shared/speech/constants';
import { SherpaOnnxAsrModelVariant, type VoiceSherpaOnnxProviderConfig } from '../../shared/voice/constants';
import { inspectSherpaOnnxAsrRuntime } from './sherpaOnnxResourceService';

type SherpaOnlineRecognizer = {
  createStream: () => SherpaOnlineStream;
  isReady: (stream: SherpaOnlineStream) => boolean;
  decode: (stream: SherpaOnlineStream) => void;
  isEndpoint: (stream: SherpaOnlineStream) => boolean;
  reset: (stream: SherpaOnlineStream) => void;
  getResult: (stream: SherpaOnlineStream) => {
    text?: string;
  };
};

type SherpaOnlineStream = {
  acceptWaveform: (input: { samples: Float32Array; sampleRate: number }) => void;
  inputFinished: () => void;
};

type SherpaOfflineRecognizer = {
  createStream: () => SherpaOfflineStream;
  decodeAsync: (stream: SherpaOfflineStream) => Promise<{ text?: string }>;
  getResult: (stream: SherpaOfflineStream) => { text?: string };
};

type SherpaOfflineStream = {
  acceptWaveform: (input: { samples: Float32Array; sampleRate: number }) => void;
};

const { OnlineRecognizer, OfflineRecognizer } = require('sherpa-onnx-node') as {
  OnlineRecognizer: new (config: unknown) => SherpaOnlineRecognizer;
  OfflineRecognizer: new (config: unknown) => SherpaOfflineRecognizer;
};

const SUPPORTED_PLATFORMS = new Set(['darwin', 'win32']);
const DEFAULT_RECORDER_FRAME_LENGTH = 512;
const OFFLINE_ENDPOINT_SILENCE_MS = 900;
const OFFLINE_MIN_UTTERANCE_MS = 350;
const OFFLINE_MAX_UTTERANCE_MS = 15_000;
const OFFLINE_SPEECH_RMS_THRESHOLD = 0.01;
const ONLINE_SPEECH_RMS_THRESHOLD = 0.015;
const MIN_CONSECUTIVE_VOICE_FRAMES = 10;
const ONLINE_INITIAL_NO_SPEECH_TIMEOUT_MS = 6_000;

export class SherpaOnnxSpeechService extends EventEmitter {
  private recorder: PvRecorder | null = null;

  private recorderLoop: Promise<void> | null = null;

  private listening = false;

  private stopping = false;

  private lastPartialText = '';

  private continuousDictation = false;

  override on(event: 'stateChanged', listener: (event: SpeechStateEvent) => void): this {
    return super.on(event, listener);
  }

  private emitStateChanged(event: SpeechStateEvent): void {
    this.emit('stateChanged', event);
  }

  private buildOfflineRecognizer(config: VoiceSherpaOnnxProviderConfig): SherpaOfflineRecognizer {
    const runtime = inspectSherpaOnnxAsrRuntime(config);
    return new OfflineRecognizer({
      featConfig: {
        sampleRate: runtime.sampleRate,
        featureDim: runtime.featureDim,
      },
      modelConfig: {
        fireRedAsrCtc: {
          model: runtime.resolvedModelPath!,
        },
        tokens: runtime.resolvedTokensPath!,
        numThreads: runtime.threads,
        provider: runtime.provider,
        debug: 0,
      },
      decodingMethod: 'greedy_search',
    });
  }

  private static computeRms(samples: Float32Array): number {
    if (samples.length === 0) {
      return 0;
    }

    let sum = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index] ?? 0;
      sum += sample * sample;
    }
    return Math.sqrt(sum / samples.length);
  }

  private static concatFloat32Arrays(chunks: Float32Array[]): Float32Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }

  private buildRecognizer(config: VoiceSherpaOnnxProviderConfig): SherpaOnlineRecognizer {
    const runtime = inspectSherpaOnnxAsrRuntime(config);
    return new OnlineRecognizer({
      featConfig: {
        sampleRate: runtime.sampleRate,
        featureDim: runtime.featureDim,
      },
      modelConfig: {
        zipformer2Ctc: {
          model: runtime.resolvedModelPath!,
        },
        tokens: runtime.resolvedTokensPath!,
        numThreads: runtime.threads,
        provider: runtime.provider,
        modelingUnit: 'bpe',
        bpeVocab: runtime.resolvedBpeVocabPath!,
      },
      decodingMethod: 'greedy_search',
      enableEndpoint: 1,
      rule1MinTrailingSilence: 1.2,
      rule2MinTrailingSilence: 2.0,
      rule3MinUtteranceLength: 20,
    });
  }

  async getAvailability(config: VoiceSherpaOnnxProviderConfig): Promise<SpeechAvailability> {
    const runtime = inspectSherpaOnnxAsrRuntime(config);
    const supported = SUPPORTED_PLATFORMS.has(process.platform) && runtime.ready;
    return {
      enabled: config.enabled,
      supported,
      platform: process.platform,
      permission: supported ? SpeechPermissionStatus.Granted : SpeechPermissionStatus.Unsupported,
      speechAuthorization: supported ? SpeechPermissionStatus.Granted : SpeechPermissionStatus.Unsupported,
      microphoneAuthorization: supported ? SpeechPermissionStatus.Granted : SpeechPermissionStatus.Unsupported,
      locale: 'zh-CN',
      listening: this.listening,
      error: supported
        ? undefined
        : (!SUPPORTED_PLATFORMS.has(process.platform)
          ? SpeechErrorCode.UnsupportedPlatform
          : 'missing_local_model'),
    };
  }

  async start(config: VoiceSherpaOnnxProviderConfig, _options?: SpeechStartOptions): Promise<{ success: boolean; error?: string }> {
    if (!SUPPORTED_PLATFORMS.has(process.platform)) {
      return { success: false, error: SpeechErrorCode.UnsupportedPlatform };
    }
    if (this.listening || this.recorder) {
      return { success: false, error: SpeechErrorCode.AlreadyListening };
    }

    const runtime = inspectSherpaOnnxAsrRuntime(config);
    if (!runtime.ready) {
      return {
        success: false,
        error: runtime.modelExists && runtime.tokensExists
          ? 'missing_local_runtime'
          : 'missing_local_model',
      };
    }

    try {
      const recorder = new PvRecorder(DEFAULT_RECORDER_FRAME_LENGTH, -1);
      recorder.start();

      this.recorder = recorder;
      this.listening = true;
      this.stopping = false;
      this.lastPartialText = '';
      this.continuousDictation = true;
      this.emitStateChanged({ type: SpeechStateType.Listening });

      if (runtime.variant === SherpaOnnxAsrModelVariant.OfflineFireRedAsrCtc) {
        const recognizer = this.buildOfflineRecognizer(config);
        this.recorderLoop = this.runOfflineRecorderLoop(recognizer, recorder, runtime.sampleRate);
      } else {
        const recognizer = this.buildRecognizer(config);
        const stream = recognizer.createStream();
        this.recorderLoop = this.runRecorderLoop(recognizer, stream, recorder, runtime.sampleRate);
      }
      return { success: true };
    } catch (error) {
      await this.stopInternal({ emitStopped: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : SpeechErrorCode.StartFailed,
      };
    }
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    await this.stopInternal({ emitStopped: true });
    return { success: true };
  }

  private async runOfflineRecorderLoop(
    recognizer: SherpaOfflineRecognizer,
    recorder: PvRecorder,
    sampleRate: number,
  ): Promise<void> {
    const samples: Float32Array[] = [];
    let speechStarted = false;
    let lastSpeechAt = 0;
    let accumulatedSamples = 0;
    let consecutiveVoiceFrames = 0;

    try {
      while (!this.stopping && this.recorder === recorder) {
        const pcm = await recorder.read();
        if (this.stopping || this.recorder !== recorder) {
          break;
        }

        const normalizedSamples = Float32Array.from(pcm, (value) => value / 32768);
        const now = Date.now();
        const rms = SherpaOnnxSpeechService.computeRms(normalizedSamples);

        if (rms >= OFFLINE_SPEECH_RMS_THRESHOLD) {
          consecutiveVoiceFrames += 1;
          if (consecutiveVoiceFrames >= MIN_CONSECUTIVE_VOICE_FRAMES) {
            speechStarted = true;
            lastSpeechAt = now;
          }
        } else {
          consecutiveVoiceFrames = 0;
        }

        if (!speechStarted) {
          continue;
        }

        samples.push(normalizedSamples);
        accumulatedSamples += normalizedSamples.length;

        const utteranceMs = (accumulatedSamples / sampleRate) * 1000;
        const silenceMs = lastSpeechAt > 0 ? (now - lastSpeechAt) : 0;
        const shouldFinalize = utteranceMs >= OFFLINE_MAX_UTTERANCE_MS
          || (utteranceMs >= OFFLINE_MIN_UTTERANCE_MS && silenceMs >= OFFLINE_ENDPOINT_SILENCE_MS);

        if (!shouldFinalize) {
          continue;
        }

        const stream = recognizer.createStream();
        stream.acceptWaveform({
          samples: SherpaOnnxSpeechService.concatFloat32Arrays(samples),
          sampleRate,
        });
        const result = await recognizer.decodeAsync(stream);
        const finalText = (result?.text || recognizer.getResult(stream)?.text || '').trim();
        if (finalText) {
          this.emitStateChanged({
            type: SpeechStateType.Final,
            text: finalText,
          });
          if (!this.continuousDictation) {
            await this.stopInternal({ emitStopped: true });
            return;
          }

          samples.length = 0;
          speechStarted = false;
          lastSpeechAt = 0;
          accumulatedSamples = 0;
          consecutiveVoiceFrames = 0;
          continue;
        }

        // Keep the dictation session alive after a no-match so the user can
        // continue speaking instead of losing the whole interaction.
        samples.length = 0;
        speechStarted = false;
        lastSpeechAt = 0;
        accumulatedSamples = 0;
        consecutiveVoiceFrames = 0;
      }
    } catch (error) {
      this.emitStateChanged({
        type: SpeechStateType.Error,
        code: SpeechErrorCode.RuntimeError,
        message: error instanceof Error ? error.message : 'Sherpa-ONNX offline speech runtime failed.',
      });
      await this.stopInternal({ emitStopped: true });
    }
  }

  private async runRecorderLoop(
    recognizer: SherpaOnlineRecognizer,
    stream: SherpaOnlineStream,
    recorder: PvRecorder,
    sampleRate: number,
  ): Promise<void> {
    let speechDetected = false;
    let consecutiveVoiceFrames = 0;
    const startedAt = Date.now();

    try {
      while (!this.stopping && this.recorder === recorder) {
        const pcm = await recorder.read();
        if (this.stopping || this.recorder !== recorder) {
          break;
        }

        const normalizedSamples = Float32Array.from(pcm, (value) => value / 32768);
        const rms = SherpaOnnxSpeechService.computeRms(normalizedSamples);
        if (rms >= ONLINE_SPEECH_RMS_THRESHOLD) {
          consecutiveVoiceFrames += 1;
          if (consecutiveVoiceFrames >= MIN_CONSECUTIVE_VOICE_FRAMES) {
            speechDetected = true;
          }
        } else {
          consecutiveVoiceFrames = 0;
        }

        stream.acceptWaveform({
          samples: normalizedSamples,
          sampleRate,
        });

        while (recognizer.isReady(stream)) {
          recognizer.decode(stream);
        }

        const result = recognizer.getResult(stream);
        const partialText = (result?.text || '').trim();
        if (partialText && partialText !== this.lastPartialText) {
          speechDetected = true;
          this.lastPartialText = partialText;
          this.emitStateChanged({
            type: SpeechStateType.Partial,
            text: partialText,
          });
        }

        // Do not allow startup silence or short ambient noise to immediately
        // close the session before the user has actually started speaking.
        if (!recognizer.isEndpoint(stream)) {
          continue;
        }

        if (!speechDetected) {
          if (this.continuousDictation || (Date.now() - startedAt) < ONLINE_INITIAL_NO_SPEECH_TIMEOUT_MS) {
            recognizer.reset(stream);
            this.lastPartialText = '';
            consecutiveVoiceFrames = 0;
            continue;
          }

          this.emitStateChanged({
            type: SpeechStateType.Error,
            code: SpeechErrorCode.SpeechNoMatch,
            message: 'No speech match was produced by Sherpa-ONNX.',
          });
          recognizer.reset(stream);
          await this.stopInternal({ emitStopped: true });
          return;
        }

        const finalText = (recognizer.getResult(stream)?.text || partialText || '').trim();
        if (finalText) {
          this.emitStateChanged({
            type: SpeechStateType.Final,
            text: finalText,
          });
          recognizer.reset(stream);
          this.lastPartialText = '';
          speechDetected = false;
          consecutiveVoiceFrames = 0;
          if (!this.continuousDictation) {
            await this.stopInternal({ emitStopped: true });
            return;
          }
          continue;
        }

        // Ignore transient no-match endpoints and keep listening. This makes
        // wake/manual dictation resilient to startup silence and noise.
        recognizer.reset(stream);
        this.lastPartialText = '';
        speechDetected = false;
        consecutiveVoiceFrames = 0;
      }
    } catch (error) {
      this.emitStateChanged({
        type: SpeechStateType.Error,
        code: SpeechErrorCode.RuntimeError,
        message: error instanceof Error ? error.message : 'Sherpa-ONNX speech runtime failed.',
      });
      await this.stopInternal({ emitStopped: true });
    }
  }

  private async stopInternal(options: { emitStopped: boolean }): Promise<void> {
    const recorder = this.recorder;
    this.stopping = true;
    this.recorder = null;
    this.listening = false;
    this.lastPartialText = '';
    this.continuousDictation = false;

    if (recorder) {
      try {
        recorder.stop();
      } catch {
        // ignore recorder stop failures
      }
      try {
        recorder.release();
      } catch {
        // ignore recorder release failures
      }
    }

    if (options.emitStopped) {
      this.emitStateChanged({ type: SpeechStateType.Stopped });
    }

    this.recorderLoop = null;
    this.stopping = false;
  }
}
