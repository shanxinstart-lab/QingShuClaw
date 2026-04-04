import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { PaperAirplaneIcon, StopIcon, FolderIcon } from '@heroicons/react/24/solid';
import { PhotoIcon, ExclamationTriangleIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import PaperClipIcon from '../icons/PaperClipIcon';
import XMarkIcon from '../icons/XMarkIcon';
import ModelSelector from '../ModelSelector';
import FolderSelectorPopover from './FolderSelectorPopover';
import { SkillsButton, ActiveSkillBadge } from '../skills';
import { i18nService } from '../../services/i18n';
import { skillService } from '../../services/skill';
import { configService } from '../../services/config';
import { RootState } from '../../store';
import { setDraftPrompt, setDraftAttachments, clearDraftAttachments, type DraftAttachment } from '../../store/slices/coworkSlice';
import { setSkills, toggleActiveSkill } from '../../store/slices/skillSlice';
import { Skill } from '../../types/skill';
import { CoworkImageAttachment } from '../../types/cowork';
import { getCompactFolderName } from '../../utils/path';
import { buildSpeechDraftText, resolveSpeechVoiceCommand, SpeechVoiceCommandAction } from './coworkSpeechText';
import { isRecoverableSpeechErrorCode, SpeechErrorCode } from '../../../shared/speech/constants';
import { DEFAULT_SPEECH_INPUT_CONFIG, DEFAULT_TTS_CONFIG } from '../../config';
import { AppCustomEvent } from '../../constants/app';
import { VoiceProvider, type VoiceCapabilityMatrix } from '../../../shared/voice/constants';
import {
  getAssistantSpeechTriggerGuardDeadline,
  isAssistantSpeechTriggerSuppressed,
} from '../../../shared/voice/triggerWordGuard';
import { startCloudSpeechRecording, type CloudSpeechRecording } from './coworkCloudSpeechRecorder';
import { voiceTextPostProcessService } from '../../services/voiceTextPostProcess';
import { TtsAssistantReplyPlaybackState, TtsStateType } from '../../../shared/tts/constants';

// CoworkAttachment is aliased from the Redux-persisted DraftAttachment type
// so that attachment state survives view switches (cowork ↔ skills, etc.)
type CoworkAttachment = DraftAttachment;

const INPUT_FILE_LABEL = '输入文件';
const EMPTY_ATTACHMENTS: CoworkAttachment[] = [];

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']);

const isImagePath = (filePath: string): boolean => {
  const dotIndex = filePath.lastIndexOf('.');
  if (dotIndex === -1) return false;
  const ext = filePath.slice(dotIndex).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
};

const isImageMimeType = (mimeType: string): boolean => {
  return mimeType.startsWith('image/');
};

const extractBase64FromDataUrl = (dataUrl: string): { mimeType: string; base64Data: string } | null => {
  const match = /^data:(.+);base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], base64Data: match[2] };
};

const getFileNameFromPath = (path: string): string => {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
};

const getSkillDirectoryFromPath = (skillPath: string): string => {
  const normalized = skillPath.trim().replace(/\\/g, '/');
  return normalized.replace(/\/SKILL\.md$/i, '') || normalized;
};

const buildInlinedSkillPrompt = (skill: Skill): string => {
  const skillDirectory = getSkillDirectoryFromPath(skill.skillPath);
  return [
    `## Skill: ${skill.name}`,
    '<skill_context>',
    `  <location>${skill.skillPath}</location>`,
    `  <directory>${skillDirectory}</directory>`,
    '  <path_rules>',
    '    Resolve relative file references from this skill against <directory>.',
    '    Do not assume skills are under the current workspace directory.',
    '  </path_rules>',
    '</skill_context>',
    '',
    skill.prompt,
  ].join('\n');
};

export interface CoworkPromptInputRef {
  /** 设置输入框值 */
  setValue: (value: string) => void;
  /** 聚焦输入框 */
  focus: () => void;
}

interface CoworkPromptInputProps {
  onSubmit: (prompt: string, skillPrompt?: string, imageAttachments?: CoworkImageAttachment[]) => boolean | void | Promise<boolean | void>;
  onStop?: () => void;
  isStreaming?: boolean;
  placeholder?: string;
  disabled?: boolean;
  size?: 'normal' | 'large';
  workingDirectory?: string;
  onWorkingDirectoryChange?: (dir: string) => void;
  showFolderSelector?: boolean;
  showModelSelector?: boolean;
  onManageSkills?: () => void;
  sessionId?: string;
  /** When true, hides attachment/skill buttons but keeps the input box visible (disabled) */
  remoteManaged?: boolean;
}

type InputSpeechStatus = 'idle' | 'requesting_permission' | 'listening' | 'transcribing';
type PendingSpeechVoiceCommand = SpeechVoiceCommandAction | null;
type WakeDictationCommandConfig = {
  submitCommand: string;
  cancelCommand: string;
  sessionTimeoutMs: number;
  source?: 'wake' | 'follow_up';
};

type AssistantReplyPlaybackState =
  typeof TtsAssistantReplyPlaybackState[keyof typeof TtsAssistantReplyPlaybackState];
type AssistantReplyPlaybackDetail = {
  sessionId: string;
  state: AssistantReplyPlaybackState;
};

const FOLLOW_UP_ASSISTANT_REPLY_EXPECTATION_WINDOW_MS = 3_000;
const FOLLOW_UP_ASSISTANT_REPLY_SETTLE_GUARD_MS = 700;
const FOLLOW_UP_RETRY_CHECK_INTERVAL_MS = 1_000;

const CoworkPromptInput = React.forwardRef<CoworkPromptInputRef, CoworkPromptInputProps>(
  (props, ref) => {
    const {
      onSubmit,
      onStop,
      isStreaming = false,
      placeholder = 'Enter your task...',
      disabled = false,
      size = 'normal',
      workingDirectory = '',
      onWorkingDirectoryChange,
      showFolderSelector = false,
      showModelSelector = false,
      onManageSkills,
      sessionId,
      remoteManaged = false,
    } = props;
    const dispatch = useDispatch();
    const draftKey = sessionId || '__home__';
    const draftPrompt = useSelector((state: RootState) => state.cowork.draftPrompts[draftKey] || '');
    const attachments = useSelector(
      (state: RootState) => state.cowork.draftAttachments[draftKey] || EMPTY_ATTACHMENTS
    );
    const [value, setValue] = useState(draftPrompt);
    const [showFolderMenu, setShowFolderMenu] = useState(false);
    const [showFolderRequiredWarning, setShowFolderRequiredWarning] = useState(false);
    const [isDraggingFiles, setIsDraggingFiles] = useState(false);
    const [isAddingFile, setIsAddingFile] = useState(false);
    const [imageVisionHint, setImageVisionHint] = useState(false);
    const [speechStatus, setSpeechStatus] = useState<InputSpeechStatus>('idle');
    const [speechVisible, setSpeechVisible] = useState(window.electron.platform === 'darwin');
    const currentSessionStatus = useSelector((state: RootState) => state.cowork.currentSession?.status ?? null);
    const currentSessionId = useSelector((state: RootState) => state.cowork.currentSession?.id ?? null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const folderButtonRef = useRef<HTMLButtonElement>(null);
    const dragDepthRef = useRef(0);
    const valueRef = useRef(value);
    const speechBaseValueRef = useRef('');
    const pendingSpeechVoiceCommandRef = useRef<PendingSpeechVoiceCommand>(null);
    const wakeDictationConfigRef = useRef<WakeDictationCommandConfig | null>(null);
    const wakeDictationTimerRef = useRef<number | null>(null);
    const previousSessionStatusRef = useRef<string | null>(null);
    const manualSttProviderRef = useRef<string>(VoiceProvider.MacosNative);
    const cloudSpeechRecordingRef = useRef<CloudSpeechRecording | null>(null);
    const speechFinalizingRef = useRef(false);
    const ttsSpeakingRef = useRef(false);
    const ttsTriggerSuppressedUntilRef = useRef(0);
    const pendingFollowUpDictationRef = useRef<WakeDictationCommandConfig | null>(null);
    const pendingFollowUpTimerRef = useRef<number | null>(null);
    const pendingFollowUpStartRetryTimerRef = useRef<number | null>(null);
    const pendingFollowUpDeadlineRef = useRef<number | null>(null);
    const assistantReplyPlaybackPendingRef = useRef(false);
    const assistantReplyPlaybackExpectationUntilRef = useRef(0);
    const assistantReplyPlaybackSettledGuardUntilRef = useRef(0);

  // 暴露方法给父组件
  React.useImperativeHandle(ref, () => ({
    setValue: (newValue: string) => {
      setValue(newValue);
      // 触发自动调整高度
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
        }
      });
    },
    focus: () => {
      textareaRef.current?.focus();
    },
  }));

  const activeSkillIds = useSelector((state: RootState) => state.skill.activeSkillIds);
  const skills = useSelector((state: RootState) => state.skill.skills);
  const isMac = window.electron.platform === 'darwin';
  const isSpeechActive = speechStatus !== 'idle';

  const isLarge = size === 'large';
  const minHeight = isLarge ? 60 : 24;
  const maxHeight = isLarge ? 200 : 200;

  const getSpeechVoiceCommandConfig = useCallback(() => ({
    ...DEFAULT_SPEECH_INPUT_CONFIG,
    ...(configService.getConfig().speechInput ?? {}),
  }), []);

  const getActiveSpeechCommandConfig = useCallback(() => {
    return wakeDictationConfigRef.current
      ? {
          stopCommand: wakeDictationConfigRef.current.cancelCommand,
          submitCommand: wakeDictationConfigRef.current.submitCommand,
        }
      : getSpeechVoiceCommandConfig();
  }, [getSpeechVoiceCommandConfig]);

  const getFollowUpCommandConfig = useCallback((): WakeDictationCommandConfig => {
    const voiceConfig = configService.getConfig().voice;
    const useWakeCommands = voiceConfig?.capabilities.wakeInput.enabled ?? false;
    return {
      submitCommand: useWakeCommands
        ? (voiceConfig?.commands.wakeSubmitCommand ?? DEFAULT_SPEECH_INPUT_CONFIG.submitCommand)
        : (voiceConfig?.commands.manualSubmitCommand ?? DEFAULT_SPEECH_INPUT_CONFIG.submitCommand),
      cancelCommand: useWakeCommands
        ? (voiceConfig?.commands.wakeCancelCommand ?? DEFAULT_SPEECH_INPUT_CONFIG.stopCommand)
        : (voiceConfig?.commands.manualStopCommand ?? DEFAULT_SPEECH_INPUT_CONFIG.stopCommand),
      sessionTimeoutMs: voiceConfig?.commands.wakeSessionTimeoutMs ?? 20_000,
      source: 'follow_up',
    };
  }, []);

  const shouldCorrectSttText = useCallback((): boolean => {
    return configService.getConfig().voice?.postProcess?.sttLlmCorrectionEnabled === true;
  }, []);

  const correctSpeechTextIfNeeded = useCallback(async (rawText: string): Promise<string> => {
    const normalizedText = rawText.trim();
    if (!normalizedText || !shouldCorrectSttText()) {
      return normalizedText;
    }
    try {
      const correctedText = await voiceTextPostProcessService.correctSttText(normalizedText);
      return correctedText.trim() || normalizedText;
    } catch (error) {
      console.warn('Failed to correct STT text with the current model:', error);
      return normalizedText;
    }
  }, [shouldCorrectSttText]);

  const shouldSuppressSpeechTriggerMatch = useCallback((): boolean => {
    return isAssistantSpeechTriggerSuppressed({
      isAssistantSpeaking: ttsSpeakingRef.current,
      suppressedUntilMs: ttsTriggerSuppressedUntilRef.current,
    });
  }, []);

  const resolveSpeechVoiceCommandForCurrentContext = useCallback((speechText: string) => {
    const activeConfig = getActiveSpeechCommandConfig();
    const primaryResult = resolveSpeechVoiceCommand(speechText, activeConfig);
    if (primaryResult.action || wakeDictationConfigRef.current?.source !== 'follow_up') {
      return primaryResult;
    }

    const manualStopCommand = configService.getConfig().voice?.commands?.manualStopCommand?.trim() ?? '';
    const activeStopCommand = activeConfig.stopCommand.trim();
    if (!manualStopCommand || manualStopCommand === activeStopCommand) {
      return primaryResult;
    }

    return resolveSpeechVoiceCommand(speechText, {
      ...activeConfig,
      stopCommand: manualStopCommand,
    });
  }, [getActiveSpeechCommandConfig]);

  const applyFinalSpeechText = useCallback(async (rawText: string) => {
    const correctedText = await correctSpeechTextIfNeeded(rawText);
    const shouldSuppressCommandMatch = !wakeDictationConfigRef.current
      && shouldSuppressSpeechTriggerMatch();
    const commandResult = shouldSuppressCommandMatch
        ? {
          action: null,
          cleanedSpeechText: correctedText,
        }
      : resolveSpeechVoiceCommandForCurrentContext(correctedText);
    const nextValue = buildSpeechDraftText(speechBaseValueRef.current, commandResult.cleanedSpeechText);
    speechBaseValueRef.current = nextValue;
    setValue(nextValue);
    if (commandResult.action) {
      pendingSpeechVoiceCommandRef.current = commandResult.action;
    }
  }, [correctSpeechTextIfNeeded, resolveSpeechVoiceCommandForCurrentContext, shouldSuppressSpeechTriggerMatch]);

  const clearPendingFollowUpDictation = useCallback(() => {
    pendingFollowUpDictationRef.current = null;
    pendingFollowUpDeadlineRef.current = null;
    assistantReplyPlaybackPendingRef.current = false;
    assistantReplyPlaybackExpectationUntilRef.current = 0;
    assistantReplyPlaybackSettledGuardUntilRef.current = 0;
    if (pendingFollowUpTimerRef.current) {
      window.clearTimeout(pendingFollowUpTimerRef.current);
      pendingFollowUpTimerRef.current = null;
    }
    if (pendingFollowUpStartRetryTimerRef.current) {
      window.clearTimeout(pendingFollowUpStartRetryTimerRef.current);
      pendingFollowUpStartRetryTimerRef.current = null;
    }
  }, []);

  const dispatchWakeDictationStart = useCallback((detail: WakeDictationCommandConfig) => {
    clearPendingFollowUpDictation();
    window.dispatchEvent(new CustomEvent(AppCustomEvent.StartWakeDictation, {
      detail,
    }));
  }, [clearPendingFollowUpDictation]);

  const shouldBlockFollowUpDictationStart = useCallback((): boolean => {
    const now = Date.now();
    return ttsSpeakingRef.current
      || assistantReplyPlaybackPendingRef.current
      || assistantReplyPlaybackExpectationUntilRef.current > now
      || assistantReplyPlaybackSettledGuardUntilRef.current > now;
  }, []);

  const tryStartPendingFollowUpDictation = useCallback((): boolean => {
    const pendingDetail = pendingFollowUpDictationRef.current;
    if (!pendingDetail) {
      return false;
    }
    const deadline = pendingFollowUpDeadlineRef.current;
    const now = Date.now();
    const deadlineExpired = typeof deadline === 'number' && Date.now() >= deadline;
    if (ttsSpeakingRef.current) {
      return false;
    }
    if (
      !deadlineExpired
      && (
        assistantReplyPlaybackPendingRef.current
        || assistantReplyPlaybackExpectationUntilRef.current > now
        || assistantReplyPlaybackSettledGuardUntilRef.current > now
      )
    ) {
      return false;
    }
    dispatchWakeDictationStart(pendingDetail);
    return true;
  }, [dispatchWakeDictationStart]);

  const schedulePendingFollowUpCheck = useCallback((delayMs: number) => {
    if (pendingFollowUpTimerRef.current) {
      window.clearTimeout(pendingFollowUpTimerRef.current);
    }
    pendingFollowUpTimerRef.current = window.setTimeout(() => {
      pendingFollowUpTimerRef.current = null;
      if (!pendingFollowUpDictationRef.current) {
        return;
      }
      if (tryStartPendingFollowUpDictation()) {
        return;
      }
      schedulePendingFollowUpCheck(FOLLOW_UP_RETRY_CHECK_INTERVAL_MS);
    }, delayMs);
  }, [tryStartPendingFollowUpDictation]);

  const scheduleFollowUpStartRetry = useCallback((detail: WakeDictationCommandConfig, delayMs: number) => {
    if (pendingFollowUpStartRetryTimerRef.current) {
      window.clearTimeout(pendingFollowUpStartRetryTimerRef.current);
    }
    pendingFollowUpStartRetryTimerRef.current = window.setTimeout(() => {
      pendingFollowUpStartRetryTimerRef.current = null;
      if (
        detail.source !== 'follow_up'
        || disabled
        || isStreaming
        || speechStatus !== 'idle'
      ) {
        return;
      }
      window.dispatchEvent(new CustomEvent(AppCustomEvent.StartWakeDictation, {
        detail,
      }));
    }, delayMs);
  }, [disabled, isStreaming, speechStatus]);

  const scheduleFollowUpDictation = useCallback((
    detail: WakeDictationCommandConfig,
    options?: { waitForAssistantReplyPlayback?: boolean }
  ) => {
    const waitForAssistantReplyPlayback = options?.waitForAssistantReplyPlayback === true;
    pendingFollowUpDictationRef.current = detail;
    assistantReplyPlaybackPendingRef.current = false;
    assistantReplyPlaybackExpectationUntilRef.current = waitForAssistantReplyPlayback
      ? Date.now() + FOLLOW_UP_ASSISTANT_REPLY_EXPECTATION_WINDOW_MS
      : 0;
    assistantReplyPlaybackSettledGuardUntilRef.current = 0;
    pendingFollowUpDeadlineRef.current = Date.now() + (waitForAssistantReplyPlayback ? 90_000 : 20_000);
    if (!waitForAssistantReplyPlayback && !shouldBlockFollowUpDictationStart()) {
      dispatchWakeDictationStart(detail);
      return;
    }
    schedulePendingFollowUpCheck(waitForAssistantReplyPlayback ? 1_500 : 600);
  }, [dispatchWakeDictationStart, schedulePendingFollowUpCheck, shouldBlockFollowUpDictationStart]);

  const isCloudRecordedSpeechProvider = useCallback((provider: string): boolean => {
    return provider === VoiceProvider.LocalWhisperCpp
      || provider === VoiceProvider.CloudOpenAi
      || provider === VoiceProvider.CloudVolcengine
      || provider === VoiceProvider.CloudAliyun;
  }, []);

  const startCloudSpeechRecordingForCurrentProvider = useCallback(async (): Promise<void> => {
    setSpeechStatus('requesting_permission');
    cloudSpeechRecordingRef.current = await startCloudSpeechRecording();
    setSpeechStatus('listening');
  }, []);

  const finishCloudSpeechRecording = useCallback(async (source: 'manual' | 'follow_up') => {
    const recording = cloudSpeechRecordingRef.current;
    if (!recording) {
      setSpeechStatus('idle');
      return;
    }

    cloudSpeechRecordingRef.current = null;
    setSpeechStatus('transcribing');
    const audio = await recording.stop();
    const result = await window.electron.speech.transcribeAudio({
      ...audio,
      source,
    });

    if (!result.success) {
      setSpeechStatus('idle');
      window.dispatchEvent(new CustomEvent('app:showToast', {
        detail: resolveSpeechErrorMessage(result.error, result.error),
      }));
      return;
    }

    await applyFinalSpeechText(result.text || '');
    setSpeechStatus('idle');
  }, [applyFinalSpeechText]);

  // Load skills on mount
  useEffect(() => {
    const loadSkills = async () => {
      const loadedSkills = await skillService.loadSkills();
      dispatch(setSkills(loadedSkills));
    };
    loadSkills();
  }, [dispatch]);

  useEffect(() => {
    const unsubscribe = skillService.onSkillsChanged(async () => {
      const loadedSkills = await skillService.loadSkills();
      dispatch(setSkills(loadedSkills));
    });
    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
    }
  }, [value, minHeight, maxHeight]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    const handleFocusInput = (event: Event) => {
      const detail = (event as CustomEvent<{ clear?: boolean }>).detail;
      const shouldClear = detail?.clear ?? true;
      if (shouldClear) {
        setValue('');
        dispatch(clearDraftAttachments(draftKey));
      }
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    };
    window.addEventListener('cowork:focus-input', handleFocusInput);
    window.addEventListener(AppCustomEvent.FocusCoworkInput, handleFocusInput);
    return () => {
      window.removeEventListener('cowork:focus-input', handleFocusInput);
      window.removeEventListener(AppCustomEvent.FocusCoworkInput, handleFocusInput);
    };
  }, []);

  useEffect(() => {
    if (workingDirectory?.trim()) {
      setShowFolderRequiredWarning(false);
    }
  }, [workingDirectory]);

  useEffect(() => {
    let active = true;
    const syncVoiceCapability = (matrix: VoiceCapabilityMatrix) => {
      const manualStt = matrix.capabilities['manual_stt'];
      manualSttProviderRef.current = manualStt?.selectedProvider ?? VoiceProvider.None;
      const shouldShowSpeechButton = Boolean(
        manualStt?.enabled
        && manualStt.platformSupported
        && manualStt.packaged
        && (
          manualStt.selectedProvider === VoiceProvider.MacosNative
          || manualStt.runtimeAvailable
        )
      );
      setSpeechVisible(Boolean(
        shouldShowSpeechButton
      ));
    };

    void window.electron.voice.getCapabilityMatrix()
      .then((matrix) => {
        if (active) {
          syncVoiceCapability(matrix);
        }
      })
      .catch((error) => {
        console.error('Failed to inspect voice capability matrix:', error);
        if (active) {
          setSpeechVisible(true);
        }
      });

    const unsubscribeVoice = window.electron.voice.onCapabilityChanged((matrix) => {
      if (active) {
        syncVoiceCapability(matrix);
      }
    });

    const unsubscribe = window.electron.speech.onStateChanged((event) => {
      switch (event.type) {
        case 'listening':
          speechFinalizingRef.current = false;
          setSpeechStatus('listening');
          break;
        case 'partial': {
          const shouldSuppressCommandMatch = !wakeDictationConfigRef.current
            && shouldSuppressSpeechTriggerMatch();
          const commandResult = shouldSuppressCommandMatch
            ? {
                action: null,
                cleanedSpeechText: event.text || '',
              }
            : resolveSpeechVoiceCommandForCurrentContext(event.text || '');
          const nextValue = buildSpeechDraftText(speechBaseValueRef.current, commandResult.cleanedSpeechText);
          setValue(nextValue);
          if (commandResult.action) {
            speechBaseValueRef.current = nextValue;
            pendingSpeechVoiceCommandRef.current = commandResult.action;
            void window.electron.speech.stop().catch(() => undefined);
          }
          break;
        }
        case 'final': {
          speechFinalizingRef.current = true;
          setSpeechStatus('transcribing');
          void applyFinalSpeechText(event.text || '').finally(() => {
            speechFinalizingRef.current = false;
            setSpeechStatus('idle');
          });
          break;
        }
        case 'stopped':
          if (speechFinalizingRef.current) {
            return;
          }
          setSpeechStatus('idle');
          break;
        case 'error':
          speechFinalizingRef.current = false;
          setSpeechStatus('idle');
          pendingSpeechVoiceCommandRef.current = null;
          if (event.code === SpeechErrorCode.SpeechRequestCancelled) {
            return;
          }
          if (
            event.code === SpeechErrorCode.SpeechNoMatch
            && wakeDictationConfigRef.current?.source
          ) {
            return;
          }
          if (isRecoverableSpeechErrorCode(event.code)) {
            return;
          }
          window.dispatchEvent(new CustomEvent('app:showToast', { detail: resolveSpeechErrorMessage(event.code, event.message) }));
          break;
      }
    });

    const unsubscribeTts = window.electron.tts.onStateChanged((event) => {
      if (event.type === TtsStateType.Speaking) {
        ttsSpeakingRef.current = true;
        ttsTriggerSuppressedUntilRef.current = Number.MAX_SAFE_INTEGER;
        return;
      }
      if (event.type !== TtsStateType.Stopped && event.type !== TtsStateType.Error) {
        return;
      }
      ttsSpeakingRef.current = false;
      ttsTriggerSuppressedUntilRef.current = getAssistantSpeechTriggerGuardDeadline(Date.now());
      tryStartPendingFollowUpDictation();
    });

    const handleAssistantReplyPlaybackStateChanged = (event: Event) => {
      const detail = (event as CustomEvent<AssistantReplyPlaybackDetail>).detail;
      if (!detail || detail.sessionId !== currentSessionId) {
        return;
      }
      if (detail.state === TtsAssistantReplyPlaybackState.Pending) {
        assistantReplyPlaybackPendingRef.current = true;
        assistantReplyPlaybackExpectationUntilRef.current = 0;
        assistantReplyPlaybackSettledGuardUntilRef.current = 0;
        return;
      }

      assistantReplyPlaybackPendingRef.current = false;
      assistantReplyPlaybackExpectationUntilRef.current = 0;
      assistantReplyPlaybackSettledGuardUntilRef.current = Date.now() + FOLLOW_UP_ASSISTANT_REPLY_SETTLE_GUARD_MS;
      if (
        detail.state === TtsAssistantReplyPlaybackState.Settled
        && pendingFollowUpDictationRef.current
        && !ttsSpeakingRef.current
      ) {
        schedulePendingFollowUpCheck(FOLLOW_UP_ASSISTANT_REPLY_SETTLE_GUARD_MS);
      }
    };
    window.addEventListener(
      AppCustomEvent.AssistantReplyPlaybackStateChanged,
      handleAssistantReplyPlaybackStateChanged
    );

    return () => {
      active = false;
      unsubscribeVoice();
      unsubscribe();
      unsubscribeTts();
      window.removeEventListener(
        AppCustomEvent.AssistantReplyPlaybackStateChanged,
        handleAssistantReplyPlaybackStateChanged
      );
      clearPendingFollowUpDictation();
      if (cloudSpeechRecordingRef.current) {
        void cloudSpeechRecordingRef.current.cancel().catch(() => undefined);
        cloudSpeechRecordingRef.current = null;
      }
      void window.electron.speech.stop().catch(() => undefined);
    };
  }, [
    applyFinalSpeechText,
    clearPendingFollowUpDictation,
    currentSessionId,
    resolveSpeechVoiceCommandForCurrentContext,
    shouldSuppressSpeechTriggerMatch,
    tryStartPendingFollowUpDictation,
    schedulePendingFollowUpCheck,
  ]);

  // Sync value from draft when sessionId changes
  useEffect(() => {
    setValue(draftPrompt);
    speechBaseValueRef.current = draftPrompt;
  }, [draftKey]); // intentionally omit draftPrompt to only trigger on session switch

  useEffect(() => {
    if (!isSpeechActive) {
      return;
    }
    pendingSpeechVoiceCommandRef.current = null;
    speechFinalizingRef.current = false;
    if (cloudSpeechRecordingRef.current) {
      void cloudSpeechRecordingRef.current.cancel().catch(() => undefined);
      cloudSpeechRecordingRef.current = null;
      setSpeechStatus('idle');
      return;
    }
    void window.electron.speech.stop().catch(() => undefined);
  }, [draftKey]);

  useEffect(() => {
    if (!isStreaming || !isSpeechActive) {
      return;
    }
    pendingSpeechVoiceCommandRef.current = null;
    speechFinalizingRef.current = false;
    if (cloudSpeechRecordingRef.current) {
      void cloudSpeechRecordingRef.current.cancel().catch(() => undefined);
      cloudSpeechRecordingRef.current = null;
      setSpeechStatus('idle');
      return;
    }
    void window.electron.speech.stop().catch(() => undefined);
  }, [isStreaming, isSpeechActive]);

  useEffect(() => {
    if (value !== draftPrompt) {
      const timer = setTimeout(() => {
        dispatch(setDraftPrompt({ sessionId: draftKey, draft: value }));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [value, draftPrompt, dispatch, draftKey]);

  const handleSubmit = useCallback(async () => {
    if (showFolderSelector && !workingDirectory?.trim()) {
      setShowFolderRequiredWarning(true);
      return;
    }

    const trimmedValue = value.trim();
    if ((!trimmedValue && attachments.length === 0) || isStreaming || disabled || isSpeechActive) return;
    setShowFolderRequiredWarning(false);

    // Get active skills prompts and combine them
    const activeSkills = activeSkillIds
      .map(id => skills.find(s => s.id === id))
      .filter((s): s is Skill => s !== undefined);
    const skillPrompt = activeSkills.length > 0
      ? activeSkills.map(buildInlinedSkillPrompt).join('\n\n')
      : undefined;

    // Extract image attachments (with base64 data) for vision-capable models
    const imageAtts: CoworkImageAttachment[] = [];
    for (const attachment of attachments) {
      if (attachment.isImage && attachment.dataUrl) {
        const extracted = extractBase64FromDataUrl(attachment.dataUrl);
        if (extracted) {
          imageAtts.push({
            name: attachment.name,
            mimeType: extracted.mimeType,
            base64Data: extracted.base64Data,
          });
        }
      }
    }

    // Build prompt with ALL attachments that have real file paths (both regular files and images).
    // Image attachments also need their file paths in the prompt so the model knows
    // where the original files are located (e.g., for skills like seedream that need --image <path>).
    // Note: inline/clipboard images have pseudo-paths starting with 'inline:' and are excluded.
    const attachmentLines = attachments
      .filter((a) => !a.path.startsWith('inline:'))
      .map((attachment) => `${INPUT_FILE_LABEL}: ${attachment.path}`)
      .join('\n');
    const finalPrompt = trimmedValue
      ? (attachmentLines ? `${trimmedValue}\n\n${attachmentLines}` : trimmedValue)
      : attachmentLines;

    if (imageAtts.length > 0) {
      console.log('[CoworkPromptInput] handleSubmit: passing imageAtts to onSubmit', {
        count: imageAtts.length,
        names: imageAtts.map(a => a.name),
        base64Lengths: imageAtts.map(a => a.base64Data.length),
      });
    }
    const result = await onSubmit(finalPrompt, skillPrompt, imageAtts.length > 0 ? imageAtts : undefined);
    if (result === false) return;
    setValue('');
    speechBaseValueRef.current = '';
    pendingSpeechVoiceCommandRef.current = null;
    dispatch(setDraftPrompt({ sessionId: draftKey, draft: '' }));
    dispatch(clearDraftAttachments(draftKey));
    setImageVisionHint(false);
  }, [value, isStreaming, disabled, isSpeechActive, onSubmit, activeSkillIds, skills, attachments, showFolderSelector, workingDirectory, dispatch]);

  useEffect(() => {
    if (speechStatus !== 'idle') {
      return;
    }

    if (pendingSpeechVoiceCommandRef.current !== SpeechVoiceCommandAction.Submit) {
      pendingSpeechVoiceCommandRef.current = null;
      wakeDictationConfigRef.current = null;
      if (wakeDictationTimerRef.current) {
        window.clearTimeout(wakeDictationTimerRef.current);
        wakeDictationTimerRef.current = null;
      }
      return;
    }

    pendingSpeechVoiceCommandRef.current = null;
    wakeDictationConfigRef.current = null;
    if (wakeDictationTimerRef.current) {
      window.clearTimeout(wakeDictationTimerRef.current);
      wakeDictationTimerRef.current = null;
    }
    void handleSubmit();
  }, [handleSubmit, speechStatus]);

  useEffect(() => {
    const previousStatus = previousSessionStatusRef.current;
    previousSessionStatusRef.current = currentSessionStatus;

    if (
      previousStatus !== 'running'
      || currentSessionStatus !== 'completed'
      || !sessionId
      || currentSessionId !== sessionId
      || disabled
      || remoteManaged
      || isStreaming
      || isSpeechActive
    ) {
      return;
    }

    let active = true;
    void window.electron.voice.getCapabilityMatrix().then((matrix) => {
      if (!active) {
        return;
      }
      const followUpCapability = matrix.capabilities['follow_up_dictation'];
      if (
        !followUpCapability?.enabled
        || !followUpCapability.platformSupported
        || !followUpCapability.packaged
        || !followUpCapability.runtimeAvailable
      ) {
        return;
      }
      const detail = getFollowUpCommandConfig();
      const ttsConfig = {
        ...DEFAULT_TTS_CONFIG,
        ...(configService.getConfig().tts ?? {}),
      };
      const waitForAssistantReplyPlayback = Boolean(
        ttsConfig.enabled
        && ttsConfig.autoPlayAssistantReply
      );
      scheduleFollowUpDictation(detail, { waitForAssistantReplyPlayback });
    }).catch((error) => {
      console.error('Failed to inspect follow-up voice capability:', error);
    });

    return () => {
      active = false;
    };
  }, [
    currentSessionId,
    currentSessionStatus,
    disabled,
    getFollowUpCommandConfig,
    isSpeechActive,
    isStreaming,
    remoteManaged,
    scheduleFollowUpDictation,
    sessionId,
  ]);

  useEffect(() => {
    const handleWakeDictationStart = (event: Event) => {
      const detail = (event as CustomEvent<WakeDictationCommandConfig>).detail;
      if (!detail || disabled || isStreaming || !isMac || !speechVisible) {
        return;
      }
      const manualProvider = manualSttProviderRef.current;
      if (manualProvider !== VoiceProvider.MacosNative && !isCloudRecordedSpeechProvider(manualProvider)) {
        return;
      }
      if (detail.source === 'follow_up' && shouldBlockFollowUpDictationStart()) {
        scheduleFollowUpStartRetry(detail, FOLLOW_UP_RETRY_CHECK_INTERVAL_MS);
        return;
      }

      speechBaseValueRef.current = valueRef.current;
      pendingSpeechVoiceCommandRef.current = null;
      wakeDictationConfigRef.current = detail;
      if (wakeDictationTimerRef.current) {
        window.clearTimeout(wakeDictationTimerRef.current);
      }
      wakeDictationTimerRef.current = window.setTimeout(() => {
        if (speechStatus !== 'idle') {
          pendingSpeechVoiceCommandRef.current = null;
          wakeDictationConfigRef.current = null;
          if (cloudSpeechRecordingRef.current) {
            const recording = cloudSpeechRecordingRef.current;
            cloudSpeechRecordingRef.current = null;
            void recording.cancel().catch(() => undefined);
            setSpeechStatus('idle');
          } else {
            void window.electron.speech.stop().catch(() => undefined);
          }
        }
        wakeDictationTimerRef.current = null;
      }, detail.sessionTimeoutMs);
      if (isCloudRecordedSpeechProvider(manualProvider)) {
        void startCloudSpeechRecordingForCurrentProvider().catch((error) => {
          cloudSpeechRecordingRef.current = null;
          setSpeechStatus('idle');
          wakeDictationConfigRef.current = null;
          if (wakeDictationTimerRef.current) {
            window.clearTimeout(wakeDictationTimerRef.current);
            wakeDictationTimerRef.current = null;
          }
          window.dispatchEvent(new CustomEvent(AppCustomEvent.ShowToast, {
            detail: error instanceof Error ? error.message : i18nService.t('coworkSpeechStartFailed'),
          }));
        });
        return;
      }

      setSpeechStatus('requesting_permission');
      void window.electron.speech.start({ source: detail.source ?? 'wake' }).then((result) => {
        if (!result.success) {
          setSpeechStatus('idle');
          wakeDictationConfigRef.current = null;
          if (wakeDictationTimerRef.current) {
            window.clearTimeout(wakeDictationTimerRef.current);
            wakeDictationTimerRef.current = null;
          }
          if (result.error === SpeechErrorCode.AssistantReplyPlaybackPending && detail.source === 'follow_up') {
            scheduleFollowUpStartRetry(detail, FOLLOW_UP_RETRY_CHECK_INTERVAL_MS);
            return;
          }
          if (result.error === SpeechErrorCode.AssistantReplyPlaybackTimeout && detail.source === 'follow_up') {
            console.warn('Skipped follow-up dictation because assistant reply playback did not settle before timeout.');
            return;
          }
          window.dispatchEvent(new CustomEvent(AppCustomEvent.ShowToast, {
            detail: resolveSpeechErrorMessage(result.error, result.error),
          }));
        }
      });
    };

    window.addEventListener(AppCustomEvent.StartWakeDictation, handleWakeDictationStart);
    return () => {
      window.removeEventListener(AppCustomEvent.StartWakeDictation, handleWakeDictationStart);
    };
  }, [
    disabled,
    isCloudRecordedSpeechProvider,
    isMac,
    isStreaming,
    scheduleFollowUpStartRetry,
    shouldBlockFollowUpDictationStart,
    speechStatus,
    speechVisible,
    startCloudSpeechRecordingForCurrentProvider,
  ]);

  const handleSelectSkill = useCallback((skill: Skill) => {
    dispatch(toggleActiveSkill(skill.id));
  }, [dispatch]);

  const handleManageSkills = useCallback(() => {
    if (onManageSkills) {
      onManageSkills();
    }
  }, [onManageSkills]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to submit, any modifier+Enter (Shift/Ctrl/Cmd/Alt) for new line
    const isComposing = event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
    if (event.key === 'Enter' && !isComposing) {
      const hasModifier = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey;
      if (!hasModifier && !isStreaming && !disabled && !isSpeechActive) {
        event.preventDefault();
        handleSubmit();
      } else if (hasModifier && !event.shiftKey) {
        // Shift+Enter already inserts newline natively; for Ctrl/Cmd/Alt+Enter, insert via execCommand to preserve undo history
        event.preventDefault();
        document.execCommand('insertText', false, '\n');
      }
    }
  };

  const handleStopClick = () => {
    if (onStop) {
      onStop();
    }
  };

  const containerClass = isLarge
    ? 'relative rounded-2xl border border-border bg-surface shadow-card focus-within:shadow-elevated focus-within:ring-1 focus-within:ring-primary/40 focus-within:border-primary'
    : 'relative flex items-end gap-2 p-3 rounded-xl border border-border bg-surface';

  const textareaClass = isLarge
    ? `w-full resize-none bg-transparent px-4 pt-2.5 pb-2 text-foreground placeholder:dark:text-foregroundSecondary/60 placeholder:text-secondary/60 focus:outline-none text-[15px] leading-6 min-h-[${minHeight}px] max-h-[${maxHeight}px]`
    : 'flex-1 resize-none bg-transparent text-foreground placeholder:placeholder:text-secondary focus:outline-none text-sm leading-relaxed min-h-[24px] max-h-[200px]';

  const truncatePath = (path: string, maxLength = 30): string => {
    if (!path) return i18nService.t('noFolderSelected');
    return getCompactFolderName(path, maxLength) || i18nService.t('noFolderSelected');
  };

  const handleFolderSelect = (path: string) => {
    if (onWorkingDirectoryChange) {
      onWorkingDirectoryChange(path);
    }
  };

  const selectedModel = useSelector((state: RootState) => state.model.selectedModel);
  const modelSupportsImage = !!selectedModel?.supportsImage;

  function extractSpeechErrorReason(message?: string): string | null {
    const normalized = message?.trim();
    if (!normalized) {
      return null;
    }
    if (
      normalized === SpeechErrorCode.RuntimeError
      || normalized === SpeechErrorCode.StartFailed
      || normalized === SpeechErrorCode.HelperUnavailable
      || normalized === SpeechErrorCode.InvalidResponse
    ) {
      return null;
    }
    return normalized;
  }

  function resolveSpeechErrorMessage(code?: string, message?: string): string {
    const normalizedCode = code?.trim().toLowerCase();
    const normalizedMessage = message?.trim().toLowerCase();
    const reason = extractSpeechErrorReason(message);
    if (
      normalizedCode === SpeechErrorCode.SpeechPermissionDenied
      || normalizedCode === SpeechErrorCode.PermissionDenied
      || normalizedMessage?.includes('speech recognition permission was denied')
      || normalizedMessage?.includes('speech permission')
    ) {
      return i18nService.t('coworkSpeechPermissionDenied');
    }
    if (
      normalizedCode === SpeechErrorCode.MicrophonePermissionDenied
      || normalizedMessage?.includes('microphone permission was denied')
      || normalizedMessage?.includes('microphone permission')
    ) {
      return i18nService.t('coworkSpeechMicrophonePermissionDenied');
    }

    switch (code) {
      case SpeechErrorCode.SpeechProcessInterrupted:
      case SpeechErrorCode.SpeechProcessInvalidated:
        return i18nService.t('coworkSpeechInterrupted');
      case SpeechErrorCode.SpeechNoMatch:
        return i18nService.t('coworkSpeechNoMatch');
      case SpeechErrorCode.RecognizerUnavailable:
        return i18nService.t('coworkSpeechRecognizerUnavailable');
      case SpeechErrorCode.AlreadyListening:
        return i18nService.t('coworkSpeechStartFailed');
      case SpeechErrorCode.DevPermissionPromptUnsupported:
        return i18nService.t('coworkSpeechDevPermissionPromptUnsupported');
      case SpeechErrorCode.HelperUnavailable:
      case SpeechErrorCode.UnsupportedPlatform:
        return i18nService.t('coworkSpeechUnavailable');
      case SpeechErrorCode.StartFailed:
        return reason
          ? i18nService.t('coworkSpeechStartFailedWithReason').replace('{reason}', reason)
          : i18nService.t('coworkSpeechStartFailed');
      case SpeechErrorCode.RuntimeError:
      default:
        return reason
          ? i18nService.t('coworkSpeechRuntimeErrorWithReason').replace('{reason}', reason)
          : i18nService.t('coworkSpeechRuntimeError');
    }
  }

  const handleSpeechToggle = useCallback(async () => {
    if (!speechVisible || disabled || isStreaming) {
      if (!speechVisible) {
        window.dispatchEvent(new CustomEvent('app:showToast', { detail: i18nService.t('coworkSpeechUnavailable') }));
      }
      return;
    }

    const manualProvider = manualSttProviderRef.current;
    const speechSource = wakeDictationConfigRef.current?.source ?? 'manual';

    if (isSpeechActive) {
      pendingSpeechVoiceCommandRef.current = null;
      if (isCloudRecordedSpeechProvider(manualProvider) && cloudSpeechRecordingRef.current) {
        try {
          await finishCloudSpeechRecording(speechSource === 'follow_up' ? 'follow_up' : 'manual');
          return;
        } catch (error) {
          cloudSpeechRecordingRef.current = null;
          setSpeechStatus('idle');
          window.dispatchEvent(new CustomEvent('app:showToast', {
            detail: error instanceof Error ? error.message : i18nService.t('coworkSpeechRuntimeError'),
          }));
          return;
        }
      }

      const result = await window.electron.speech.stop();
      if (!result.success) {
        window.dispatchEvent(new CustomEvent('app:showToast', { detail: resolveSpeechErrorMessage(result.error, result.error) }));
      }
      return;
    }

    speechBaseValueRef.current = valueRef.current;
    pendingSpeechVoiceCommandRef.current = null;
    if (pendingFollowUpDictationRef.current?.source === 'follow_up') {
      clearPendingFollowUpDictation();
    }

    if (isCloudRecordedSpeechProvider(manualProvider)) {
      try {
        await startCloudSpeechRecordingForCurrentProvider();
      } catch (error) {
        cloudSpeechRecordingRef.current = null;
        setSpeechStatus('idle');
        window.dispatchEvent(new CustomEvent('app:showToast', {
          detail: error instanceof Error ? error.message : i18nService.t('coworkSpeechStartFailed'),
        }));
      }
      return;
    }

    if (!isMac || manualProvider !== VoiceProvider.MacosNative) {
      setSpeechStatus('idle');
      window.dispatchEvent(new CustomEvent('app:showToast', { detail: i18nService.t('coworkSpeechUnavailable') }));
      return;
    }

    setSpeechStatus('requesting_permission');
    const result = await window.electron.speech.start({ source: 'manual' });
    if (!result.success) {
      setSpeechStatus('idle');
      window.dispatchEvent(new CustomEvent('app:showToast', { detail: resolveSpeechErrorMessage(result.error, result.error) }));
    }
  }, [
    clearPendingFollowUpDictation,
    disabled,
    finishCloudSpeechRecording,
    isCloudRecordedSpeechProvider,
    isMac,
    isSpeechActive,
    isStreaming,
    speechVisible,
    startCloudSpeechRecordingForCurrentProvider,
  ]);

  const addAttachment = useCallback((filePath: string, imageInfo?: { isImage: boolean; dataUrl?: string }) => {
    if (!filePath) return;
    const current = attachments;
    if (current.some((attachment) => attachment.path === filePath)) return;
    dispatch(setDraftAttachments({
      draftKey,
      attachments: [...current, {
        path: filePath,
        name: getFileNameFromPath(filePath),
        isImage: imageInfo?.isImage,
        dataUrl: imageInfo?.dataUrl,
      }],
    }));
  }, [attachments, dispatch, draftKey]);

  const addImageAttachmentFromDataUrl = useCallback((name: string, dataUrl: string) => {
    // Use the dataUrl as the unique key (no file path for inline images)
    const pseudoPath = `inline:${name}:${Date.now()}`;
    dispatch(setDraftAttachments({
      draftKey,
      attachments: [...attachments, {
        path: pseudoPath,
        name,
        isImage: true,
        dataUrl,
      }],
    }));
  }, [attachments, dispatch, draftKey]);

  const fileToDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Failed to read file'));
          return;
        }
        resolve(result);
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Failed to read file'));
          return;
        }
        const commaIndex = result.indexOf(',');
        resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  const getNativeFilePath = useCallback((file: File): string | null => {
    const maybePath = (file as File & { path?: string }).path;
    if (typeof maybePath === 'string' && maybePath.trim()) {
      return maybePath;
    }
    return null;
  }, []);

  const saveInlineFile = useCallback(async (file: File): Promise<string | null> => {
    try {
      const dataBase64 = await fileToBase64(file);
      if (!dataBase64) {
        return null;
      }
      const result = await window.electron.dialog.saveInlineFile({
        dataBase64,
        fileName: file.name,
        mimeType: file.type,
        cwd: workingDirectory,
      });
      if (result.success && result.path) {
        return result.path;
      }
      return null;
    } catch (error) {
      console.error('Failed to save inline file:', error);
      return null;
    }
  }, [fileToBase64, workingDirectory]);

  const handleIncomingFiles = useCallback(async (fileList: FileList | File[]) => {
    if (disabled || isStreaming || isSpeechActive) return;
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    let hasImageWithoutVision = false;
    for (const file of files) {
      const nativePath = getNativeFilePath(file);

      // Check if this is an image file and model supports images
      const fileIsImage = nativePath
        ? isImagePath(nativePath)
        : isImageMimeType(file.type);

      if (fileIsImage) {
        if (modelSupportsImage) {
          // For images on vision-capable models, read as data URL
          if (nativePath) {
            try {
              const result = await window.electron.dialog.readFileAsDataUrl(nativePath);
              if (result.success && result.dataUrl) {
                addAttachment(nativePath, { isImage: true, dataUrl: result.dataUrl });
                continue;
              }
            } catch (error) {
              console.error('Failed to read image as data URL:', error);
            }
            // Fallback: add as regular file attachment
            addAttachment(nativePath);
          } else {
            // No native path (clipboard/drag from browser) - read via FileReader
            try {
              const dataUrl = await fileToDataUrl(file);
              addImageAttachmentFromDataUrl(file.name, dataUrl);
            } catch (error) {
              console.error('Failed to read image from clipboard:', error);
              const stagedPath = await saveInlineFile(file);
              if (stagedPath) {
                addAttachment(stagedPath);
              }
            }
          }
          continue;
        }
        // Model doesn't support image input — add as file path and show hint
        hasImageWithoutVision = true;
      }

      // Non-image file or model doesn't support images: use original flow
      if (nativePath) {
        addAttachment(nativePath);
        continue;
      }

      const stagedPath = await saveInlineFile(file);
      if (stagedPath) {
        addAttachment(stagedPath);
      }
    }
    if (hasImageWithoutVision) {
      setImageVisionHint(true);
    }
  }, [addAttachment, addImageAttachmentFromDataUrl, disabled, fileToDataUrl, getNativeFilePath, isSpeechActive, isStreaming, modelSupportsImage, saveInlineFile]);

  const handleAddFile = useCallback(async () => {
    if (isAddingFile || disabled || isStreaming || isSpeechActive) return;
    setIsAddingFile(true);
    try {
      const result = await window.electron.dialog.selectFiles({
        title: i18nService.t('coworkAddFile'),
      });
      if (!result.success || result.paths.length === 0) return;
      let hasImageWithoutVision = false;
      for (const filePath of result.paths) {
        if (isImagePath(filePath)) {
          if (modelSupportsImage) {
            try {
              const readResult = await window.electron.dialog.readFileAsDataUrl(filePath);
              if (readResult.success && readResult.dataUrl) {
                addAttachment(filePath, { isImage: true, dataUrl: readResult.dataUrl });
                continue;
              }
            } catch (error) {
              console.error('Failed to read image as data URL:', error);

            }
          } else {
            hasImageWithoutVision = true;
          }
        }
        addAttachment(filePath);
      }
      if (hasImageWithoutVision) {
        setImageVisionHint(true);

      }
    } catch (error) {
      console.error('Failed to select file:', error);
    } finally {
      setIsAddingFile(false);
    }
  }, [addAttachment, isAddingFile, disabled, isSpeechActive, isStreaming, modelSupportsImage]);

  const handleRemoveAttachment = useCallback((path: string) => {
    dispatch(setDraftAttachments({
      draftKey,
      attachments: attachments.filter((attachment) => attachment.path !== path),
    }));
  }, [attachments, dispatch, draftKey]);

  const hasFileTransfer = (dataTransfer: DataTransfer | null): boolean => {
    if (!dataTransfer) return false;
    if (dataTransfer.files.length > 0) return true;
    return Array.from(dataTransfer.types).includes('Files');
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    if (!disabled && !isStreaming && !isSpeechActive) {
      setIsDraggingFiles(true);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = disabled || isStreaming || isSpeechActive ? 'none' : 'copy';
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingFiles(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    if (disabled || isStreaming || isSpeechActive) return;
    void handleIncomingFiles(event.dataTransfer.files);
  };

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (disabled || isStreaming || isSpeechActive) return;
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length === 0) return;
    event.preventDefault();
    void handleIncomingFiles(files);
  }, [disabled, handleIncomingFiles, isSpeechActive, isStreaming]);

  const canSubmit = !disabled && !isSpeechActive && (!!value.trim() || attachments.length > 0);
  const enhancedContainerClass = isDraggingFiles
    ? `${containerClass} ring-2 ring-primary/50 border-primary/60`
    : containerClass;
  const speechButtonTitle = speechStatus === 'idle'
    ? i18nService.t('coworkSpeechStart')
    : i18nService.t('coworkSpeechStop');

  return (
    <div className="relative">
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
              <div
                key={attachment.path}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground max-w-full"
                title={attachment.path}
              >
                {attachment.isImage ? (
                  <PhotoIcon className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                ) : (
                  <PaperClipIcon className="h-3.5 w-3.5 flex-shrink-0" />
                )}
                <span className="truncate max-w-[180px]">{attachment.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(attachment.path)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-surface-raised"
                  aria-label={i18nService.t('coworkAttachmentRemove')}
                  title={i18nService.t('coworkAttachmentRemove')}
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </div>
          ))}
        </div>
      )}
      {imageVisionHint && (
        <div className="mb-2 flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
          <ExclamationTriangleIcon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>
            {i18nService.getLanguage() === 'zh'
              ? '当前模型未启用图片输入，图片将以文件路径形式发送。若该模型本身支持图片理解，可在模型配置中开启图片输入选项。'
              : 'Image input is not enabled for the current model. Images will be sent as file paths. If the model supports vision, you can enable image input in the model configuration.'}
          </span>
          <button
            type="button"
            onClick={() => setImageVisionHint(false)}
            className="ml-auto flex-shrink-0 rounded-full p-0.5 hover:bg-amber-200/50 dark:hover:bg-amber-800/50"
          >
            <XMarkIcon className="h-3 w-3" />
          </button>
        </div>
      )}
      {speechVisible && speechStatus !== 'idle' && (
        <div className="mb-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs text-primary">
          {speechStatus === 'requesting_permission'
            ? i18nService.t('coworkSpeechRequestingPermission')
            : speechStatus === 'transcribing'
              ? i18nService.t('coworkSpeechTranscribing')
              : i18nService.t('coworkSpeechListening')}
        </div>
      )}
      <div
        className={enhancedContainerClass}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDraggingFiles && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-primary/10 text-xs font-medium text-primary">
            {i18nService.t('coworkDropFileHint')}
          </div>
        )}
        {isLarge ? (
          <>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              disabled={disabled || isSpeechActive}
              rows={isLarge ? 2 : 1}
              className={textareaClass}
              style={{ minHeight: `${minHeight}px` }}
            />
            <div className="flex items-center justify-between px-4 pb-2 pt-1.5">
              <div className="flex items-center gap-2 relative">
                {showFolderSelector && (
                  <>
                    <div className="relative group">
                      <button
                        ref={folderButtonRef as React.RefObject<HTMLButtonElement>}
                        type="button"
                        onClick={() => setShowFolderMenu(!showFolderMenu)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-secondary hover:bg-surface-raised hover:text-foreground transition-colors"
                      >
                        <FolderIcon className="h-4 w-4" />
                        <span className="max-w-[150px] truncate text-xs">
                          {truncatePath(workingDirectory)}
                        </span>
                      </button>
                      {/* Tooltip - hidden when folder menu is open */}
                      {!showFolderMenu && (
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3.5 py-2.5 text-[13px] leading-relaxed rounded-xl shadow-xl bg-background text-foreground border-border border opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 max-w-[400px] break-all whitespace-nowrap">
                          {truncatePath(workingDirectory, 120)}
                        </div>
                      )}
                    </div>
                    <FolderSelectorPopover
                      isOpen={showFolderMenu}
                      onClose={() => setShowFolderMenu(false)}
                      onSelectFolder={handleFolderSelect}
                      anchorRef={folderButtonRef as React.RefObject<HTMLElement>}
                    />
                  </>
                )}
                {showModelSelector && !remoteManaged && <ModelSelector dropdownDirection="up" />}
                {isMac && speechVisible && !remoteManaged && (
                  <button
                    type="button"
                    onClick={handleSpeechToggle}
                    className={`flex items-center justify-center p-1.5 rounded-lg text-sm transition-colors ${
                      isSpeechActive
                        ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
                        : 'text-secondary hover:bg-surface-raised hover:text-foreground'
                    }`}
                    title={speechButtonTitle}
                    aria-label={speechButtonTitle}
                    disabled={disabled || isStreaming}
                  >
                    {isSpeechActive ? <StopIcon className="h-4 w-4" /> : <MicrophoneIcon className="h-4 w-4" />}
                  </button>
                )}
                {!remoteManaged && (
                  <button
                    type="button"
                    onClick={handleAddFile}
                    className="flex items-center justify-center p-1.5 rounded-lg text-sm text-secondary hover:bg-surface-raised hover:text-foreground transition-colors"
                    title={i18nService.t('coworkAddFile')}
                    aria-label={i18nService.t('coworkAddFile')}
                    disabled={disabled || isStreaming || isAddingFile || isSpeechActive}
                  >
                    <PaperClipIcon className="h-4 w-4" />
                  </button>
                )}
                {!remoteManaged && (
                  <>
                    <SkillsButton
                      onSelectSkill={handleSelectSkill}
                      onManageSkills={handleManageSkills}
                    />
                    <ActiveSkillBadge />
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStopClick}
                    className="p-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-all shadow-subtle hover:shadow-card active:scale-95"
                    aria-label="Stop"
                  >
                    <StopIcon className="h-5 w-5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="p-2 rounded-xl bg-primary hover:bg-primary-hover text-white transition-all shadow-subtle hover:shadow-card active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Send"
                  >
                    <PaperAirplaneIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={placeholder}
              disabled={disabled || isSpeechActive}
              rows={1}
              className={textareaClass}
            />

            {!remoteManaged && (
              <div className="flex items-center gap-1">
                {isMac && speechVisible && (
                  <button
                    type="button"
                    onClick={handleSpeechToggle}
                    className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                      isSpeechActive
                        ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
                        : 'text-secondary hover:bg-surface-raised hover:text-foreground'
                    }`}
                    title={speechButtonTitle}
                    aria-label={speechButtonTitle}
                    disabled={disabled || isStreaming}
                  >
                    {isSpeechActive ? <StopIcon className="h-4 w-4" /> : <MicrophoneIcon className="h-4 w-4" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddFile}
                  className="flex-shrink-0 p-1.5 rounded-lg text-secondary hover:bg-surface-raised hover:text-foreground transition-colors"
                  title={i18nService.t('coworkAddFile')}
                  aria-label={i18nService.t('coworkAddFile')}
                  disabled={disabled || isStreaming || isAddingFile || isSpeechActive}
                >
                  <PaperClipIcon className="h-4 w-4" />
                </button>
              </div>
            )}

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStopClick}
                className="flex-shrink-0 p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all shadow-subtle hover:shadow-card active:scale-95"
                aria-label="Stop"
              >
                <StopIcon className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-shrink-0 p-2 rounded-lg bg-primary hover:bg-primary-hover text-white transition-all shadow-subtle hover:shadow-card active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>
      {showFolderRequiredWarning && (
        <div className="mt-2 text-xs text-red-500 dark:text-red-400">
          {i18nService.t('coworkSelectFolderFirst')}
        </div>
      )}
    </div>
  );
  }
);

CoworkPromptInput.displayName = 'CoworkPromptInput';

export default CoworkPromptInput;
