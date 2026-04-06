import { ipcMain } from 'electron';
import {
  SpeechIpcChannel,
  type SpeechStartOptions,
  type SpeechStopOptions,
  type SpeechTranscribeAudioOptions,
  type SpeechTranscribeAudioResult,
} from '../../../shared/speech/constants';
import {
  TtsEngine,
  TtsIpcChannel,
  type TtsAssistantReplyPlaybackReport,
  type TtsSpeakOptions,
  type TtsSpeakResult,
} from '../../../shared/tts/constants';
import {
  VoiceIpcChannel,
  type VoiceConfig,
  type VoiceLocalModelLibrary,
  type VoiceLocalQwen3TtsStatus,
  type VoiceLocalSherpaOnnxStatus,
  type VoiceLocalWhisperCppStatus,
} from '../../../shared/voice/constants';
import {
  WakeInputIpcChannel,
  type WakeInputConfig,
} from '../../../shared/wakeInput/constants';
import type { VoiceFeatureController } from '../../libs/voiceFeatureController';

export interface VoiceHandlerDeps {
  controller: VoiceFeatureController;
}

export function registerVoiceHandlers(deps: VoiceHandlerDeps): void {
  const { controller } = deps;

  ipcMain.handle(VoiceIpcChannel.GetCapabilityMatrix, async () => {
    return controller.getCapabilityMatrix();
  });

  ipcMain.handle(VoiceIpcChannel.GetConfig, async () => {
    return controller.getVoiceConfig();
  });

  ipcMain.handle(VoiceIpcChannel.GetLocalSherpaOnnxStatus, async (): Promise<VoiceLocalSherpaOnnxStatus> => {
    return controller.getLocalSherpaOnnxStatus();
  });

  ipcMain.handle(VoiceIpcChannel.GetLocalWhisperCppStatus, async (): Promise<VoiceLocalWhisperCppStatus> => {
    return controller.getLocalWhisperCppStatus();
  });

  ipcMain.handle(VoiceIpcChannel.GetLocalQwen3TtsStatus, async (): Promise<VoiceLocalQwen3TtsStatus> => {
    return controller.getLocalQwen3TtsStatus();
  });

  ipcMain.handle(VoiceIpcChannel.EnsureLocalWhisperCppDirectories, async () => {
    return controller.ensureLocalWhisperCppDirectories();
  });

  ipcMain.handle(VoiceIpcChannel.GetLocalModelLibrary, async (): Promise<VoiceLocalModelLibrary> => {
    return controller.getLocalModelLibrary();
  });

  ipcMain.handle(VoiceIpcChannel.InstallLocalModel, async (_event, modelId: string) => {
    return controller.installLocalModel(modelId);
  });

  ipcMain.handle(VoiceIpcChannel.CancelLocalModelInstall, async (_event, modelId: string) => {
    return controller.cancelLocalModelInstall(modelId);
  });

  ipcMain.handle(VoiceIpcChannel.UpdateConfig, async (_event, partialConfig?: Partial<VoiceConfig>) => {
    return controller.updateVoiceConfig(partialConfig);
  });

  ipcMain.handle(SpeechIpcChannel.GetAvailability, async () => {
    return controller.getSpeechAvailability();
  });

  ipcMain.handle(SpeechIpcChannel.Start, async (_event, options?: SpeechStartOptions) => {
    return controller.startSpeech(options);
  });

  ipcMain.handle(SpeechIpcChannel.Stop, async (_event, options?: SpeechStopOptions) => {
    return controller.stopSpeech(options);
  });

  ipcMain.handle(
    SpeechIpcChannel.TranscribeAudio,
    async (_event, options?: SpeechTranscribeAudioOptions): Promise<SpeechTranscribeAudioResult> => {
      return controller.transcribeAudio(options);
    },
  );

  ipcMain.handle(WakeInputIpcChannel.GetStatus, async () => {
    return controller.getWakeInputStatus();
  });

  ipcMain.handle(WakeInputIpcChannel.UpdateConfig, async (_event, partialConfig?: Partial<WakeInputConfig>) => {
    return controller.updateWakeInputConfig(partialConfig);
  });

  ipcMain.handle(TtsIpcChannel.GetAvailability, async () => {
    return controller.getTtsAvailability();
  });

  ipcMain.handle(TtsIpcChannel.GetVoices, async (_event, options?: { engine?: TtsEngine }) => {
    return controller.getTtsVoices(options);
  });

  ipcMain.handle(TtsIpcChannel.Prepare, async (_event, options?: { engine?: TtsEngine }) => {
    return controller.prepareTts(options);
  });

  ipcMain.handle(TtsIpcChannel.Speak, async (_event, options?: TtsSpeakOptions): Promise<TtsSpeakResult> => {
    return controller.speakTts(options);
  });

  ipcMain.handle(TtsIpcChannel.ReportAssistantReplyPlayback, async (_event, report?: TtsAssistantReplyPlaybackReport) => {
    return controller.reportAssistantReplyPlayback(report);
  });

  ipcMain.handle(TtsIpcChannel.Stop, async () => {
    return controller.stopTts();
  });
}
