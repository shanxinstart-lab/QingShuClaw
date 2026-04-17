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
import { SpeechErrorCode } from '../../../shared/speech/constants';
import { DEFAULT_SPEECH_INPUT_CONFIG, DEFAULT_VOICE_POST_PROCESS_CONFIG, DEFAULT_WAKE_INPUT_CONFIG } from '../../config';
import { AppCustomEvent } from '../../constants/app';
import { voiceTextPostProcessService } from '../../services/voiceTextPostProcess';
import {
  WakeActivationOverlayPhase,
  type WakeActivationOverlayStateChange,
} from '../wakeActivationOverlayHelpers';

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

type InputSpeechStatus = 'idle' | 'requesting_permission' | 'listening';
type PendingSpeechVoiceCommand = SpeechVoiceCommandAction | null;
type WakeDictationCommandConfig = {
  submitCommand: string;
  cancelCommand: string;
  sessionTimeoutMs: number;
  autoRestartAfterReply: boolean;
  source?: 'wake' | 'follow_up';
};

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
    const [speechCommandNonce, setSpeechCommandNonce] = useState(0);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const folderButtonRef = useRef<HTMLButtonElement>(null);
    const dragDepthRef = useRef(0);
    const valueRef = useRef(value);
    const speechStatusRef = useRef<InputSpeechStatus>('idle');
    const speechBaseValueRef = useRef('');
    const pendingSpeechVoiceCommandRef = useRef<PendingSpeechVoiceCommand>(null);
    const wakeDictationConfigRef = useRef<WakeDictationCommandConfig | null>(null);
    const wakeDictationTimerRef = useRef<number | null>(null);
    const pendingWakeDictationStartRef = useRef<WakeDictationCommandConfig | null>(null);
    const activeWakeOverlayRef = useRef(false);

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

  const markPendingSpeechVoiceCommand = useCallback((action: PendingSpeechVoiceCommand) => {
    pendingSpeechVoiceCommandRef.current = action;
    setSpeechCommandNonce((current) => current + 1);
  }, []);

  const maybeCorrectFinalSpeechText = useCallback(async (rawText: string): Promise<string> => {
    const normalized = rawText.trim();
    if (!normalized) {
      return '';
    }

    const postProcessConfig = configService.getConfig().voice?.postProcess ?? DEFAULT_VOICE_POST_PROCESS_CONFIG;
    if (!postProcessConfig.sttLlmCorrectionEnabled) {
      return normalized;
    }

    return voiceTextPostProcessService.correctSttText(normalized);
  }, []);

  const getFollowUpDictationConfig = useCallback((
    wakeConfigOverride?: WakeDictationCommandConfig | null,
  ): WakeDictationCommandConfig | null => {
    const speechInputConfig = {
      ...DEFAULT_SPEECH_INPUT_CONFIG,
      ...(configService.getConfig().speechInput ?? {}),
    };
    if (!speechInputConfig.autoRestartAfterReply) {
      return null;
    }

    const wakeInputConfig = {
      ...DEFAULT_WAKE_INPUT_CONFIG,
      ...(configService.getConfig().wakeInput ?? {}),
    };

    if (wakeConfigOverride) {
      return {
        ...wakeConfigOverride,
        autoRestartAfterReply: true,
        source: 'follow_up',
      };
    }

    return {
      submitCommand: speechInputConfig.submitCommand,
      cancelCommand: speechInputConfig.stopCommand,
      sessionTimeoutMs: wakeInputConfig.sessionTimeoutMs,
      autoRestartAfterReply: true,
      source: 'follow_up',
    };
  }, []);

  const armWakeFollowUpDictation = useCallback((config: WakeDictationCommandConfig | null) => {
    if (!config?.autoRestartAfterReply) {
      console.log('[WakeFollowUp] Disarmed follow-up dictation because auto restart is disabled.');
      void window.electron.speechFollowUp.disarm().catch((error) => {
        console.error('[WakeFollowUp] Failed to disarm speech follow-up:', error);
      });
      return;
    }
    console.log('[WakeFollowUp] Emitting arm request from prompt input.', {
      sessionId: sessionId ?? null,
      config,
    });
    void window.electron.speechFollowUp.arm({
      sessionId: sessionId ?? null,
      config,
    }).catch((error) => {
      console.error('[WakeFollowUp] Failed to arm speech follow-up:', error);
    });
  }, [sessionId]);

  const disarmWakeFollowUpDictation = useCallback(() => {
    console.log('[WakeFollowUp] Emitting disarm request from prompt input.');
    void window.electron.speechFollowUp.disarm().catch((error) => {
      console.error('[WakeFollowUp] Failed to disarm speech follow-up:', error);
    });
  }, []);

  const syncWakeActivationOverlay = useCallback((detail: WakeActivationOverlayStateChange) => {
    window.dispatchEvent(new CustomEvent(AppCustomEvent.UpdateWakeActivationOverlay, { detail }));
  }, []);

  const updateWakeActivationOverlay = useCallback((detail: Omit<WakeActivationOverlayStateChange, 'visible'>) => {
    if (!activeWakeOverlayRef.current) {
      return;
    }
    syncWakeActivationOverlay({ visible: true, ...detail });
  }, [syncWakeActivationOverlay]);

  const hideWakeActivationOverlay = useCallback(() => {
    activeWakeOverlayRef.current = false;
    syncWakeActivationOverlay({ visible: false });
  }, [syncWakeActivationOverlay]);

  const startWakeDictation = useCallback((detail: WakeDictationCommandConfig) => {
    console.log('[WakeFollowUp] Starting wake dictation.', {
      detail,
      isStreaming,
      isSpeechActive,
      speechVisible,
    });
    speechBaseValueRef.current = valueRef.current;
    pendingSpeechVoiceCommandRef.current = null;
    wakeDictationConfigRef.current = detail;
    activeWakeOverlayRef.current = detail.source === 'wake';
    if (activeWakeOverlayRef.current) {
      syncWakeActivationOverlay({
        visible: true,
        phase: WakeActivationOverlayPhase.Preparing,
        transcript: '',
      });
    }
    if (wakeDictationTimerRef.current) {
      window.clearTimeout(wakeDictationTimerRef.current);
    }
    wakeDictationTimerRef.current = window.setTimeout(() => {
      if (speechStatus !== 'idle') {
        markPendingSpeechVoiceCommand(null);
        wakeDictationConfigRef.current = null;
        hideWakeActivationOverlay();
        void window.electron.speech.stop().catch(() => undefined);
      }
      wakeDictationTimerRef.current = null;
    }, detail.sessionTimeoutMs);
    setSpeechStatus('requesting_permission');
    void window.electron.speech.start({ source: detail.source ?? 'wake' }).then((result) => {
      if (!result.success) {
        setSpeechStatus('idle');
        wakeDictationConfigRef.current = null;
        if (wakeDictationTimerRef.current) {
          window.clearTimeout(wakeDictationTimerRef.current);
          wakeDictationTimerRef.current = null;
        }
        hideWakeActivationOverlay();
        disarmWakeFollowUpDictation();
        window.dispatchEvent(new CustomEvent(AppCustomEvent.ShowToast, {
          detail: resolveSpeechErrorMessage(result.error, result.error),
        }));
      }
    });
  }, [disarmWakeFollowUpDictation, hideWakeActivationOverlay, markPendingSpeechVoiceCommand, speechStatus, syncWakeActivationOverlay]);

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
    speechStatusRef.current = speechStatus;
  }, [speechStatus]);

  useEffect(() => {
    const handleFocusInput = (event: Event) => {
      const detail = (event as CustomEvent<{ clear?: boolean }>).detail;
      const shouldClear = detail?.clear ?? true;
      if (shouldClear) {
        hideWakeActivationOverlay();
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
  }, [dispatch, draftKey, hideWakeActivationOverlay]);

  useEffect(() => {
    if (workingDirectory?.trim()) {
      setShowFolderRequiredWarning(false);
    }
  }, [workingDirectory]);

  useEffect(() => {
    if (!isMac) {
      return;
    }

    let active = true;
    window.electron.speech.getAvailability()
      .then((availability) => {
        if (!active) {
          return;
        }
        setSpeechVisible(availability.enabled ?? true);
      })
      .catch((error) => {
        console.error('Failed to inspect speech availability:', error);
        if (active) {
          setSpeechVisible(true);
        }
      });

    const unsubscribe = window.electron.speech.onStateChanged((event) => {
      switch (event.type) {
        case 'listening':
          setSpeechStatus('listening');
          updateWakeActivationOverlay({ phase: WakeActivationOverlayPhase.Dictating });
          break;
        case 'partial': {
          const currentCommandConfig = wakeDictationConfigRef.current
            ? {
                stopCommand: wakeDictationConfigRef.current.cancelCommand,
                submitCommand: wakeDictationConfigRef.current.submitCommand,
              }
            : getSpeechVoiceCommandConfig();
          const commandResult = resolveSpeechVoiceCommand(event.text || '', currentCommandConfig);
          const nextValue = buildSpeechDraftText(speechBaseValueRef.current, commandResult.cleanedSpeechText);
          setValue(nextValue);
          updateWakeActivationOverlay({
            phase: WakeActivationOverlayPhase.Dictating,
            transcript: nextValue,
          });
          if (commandResult.action) {
            speechBaseValueRef.current = nextValue;
            markPendingSpeechVoiceCommand(commandResult.action);
            void window.electron.speech.stop().catch(() => undefined);
          }
          break;
        }
        case 'final': {
          const currentCommandConfig = wakeDictationConfigRef.current
            ? {
                stopCommand: wakeDictationConfigRef.current.cancelCommand,
                submitCommand: wakeDictationConfigRef.current.submitCommand,
              }
            : getSpeechVoiceCommandConfig();
          void maybeCorrectFinalSpeechText(event.text || '').then((finalText) => {
            const commandResult = resolveSpeechVoiceCommand(finalText, currentCommandConfig);
            const nextValue = buildSpeechDraftText(speechBaseValueRef.current, commandResult.cleanedSpeechText);
            speechBaseValueRef.current = nextValue;
            setValue(nextValue);
            updateWakeActivationOverlay({
              phase: WakeActivationOverlayPhase.Dictating,
              transcript: nextValue,
            });
            if (commandResult.action) {
              markPendingSpeechVoiceCommand(commandResult.action);
              if (speechStatusRef.current !== 'idle') {
                void window.electron.speech.stop().catch(() => undefined);
              }
            }
          }).catch((error) => {
            console.warn('[CoworkPromptInput] Failed to post-process final speech text:', error);
            const commandResult = resolveSpeechVoiceCommand(event.text || '', currentCommandConfig);
            const nextValue = buildSpeechDraftText(speechBaseValueRef.current, commandResult.cleanedSpeechText);
            speechBaseValueRef.current = nextValue;
            setValue(nextValue);
            updateWakeActivationOverlay({
              phase: WakeActivationOverlayPhase.Dictating,
              transcript: nextValue,
            });
            if (commandResult.action) {
              markPendingSpeechVoiceCommand(commandResult.action);
              if (speechStatusRef.current !== 'idle') {
                void window.electron.speech.stop().catch(() => undefined);
              }
            }
          });
          break;
        }
        case 'stopped':
          setSpeechStatus('idle');
          break;
        case 'error':
          setSpeechStatus('idle');
          markPendingSpeechVoiceCommand(null);
          hideWakeActivationOverlay();
          disarmWakeFollowUpDictation();
          window.dispatchEvent(new CustomEvent('app:showToast', { detail: resolveSpeechErrorMessage(event.code, event.message) }));
          break;
      }
    });

    return () => {
      active = false;
      unsubscribe();
      hideWakeActivationOverlay();
      void window.electron.speech.stop().catch(() => undefined);
    };
  }, [
    disarmWakeFollowUpDictation,
    getSpeechVoiceCommandConfig,
    hideWakeActivationOverlay,
    isMac,
    markPendingSpeechVoiceCommand,
    maybeCorrectFinalSpeechText,
    updateWakeActivationOverlay,
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
    hideWakeActivationOverlay();
    void window.electron.speech.stop().catch(() => undefined);
  }, [draftKey, hideWakeActivationOverlay]);

  useEffect(() => {
    if (!isStreaming || !isSpeechActive) {
      return;
    }
    pendingSpeechVoiceCommandRef.current = null;
    hideWakeActivationOverlay();
    void window.electron.speech.stop().catch(() => undefined);
  }, [hideWakeActivationOverlay, isSpeechActive, isStreaming]);

  useEffect(() => {
    const pendingWakeDictation = pendingWakeDictationStartRef.current;
    if (!pendingWakeDictation) {
      return;
    }
    if (disabled || isStreaming || !isMac || !speechVisible || isSpeechActive) {
      console.log('[WakeFollowUp] Pending dictation is still waiting for prompt input readiness.', {
        disabled,
        isStreaming,
        isMac,
        speechVisible,
        isSpeechActive,
      });
      return;
    }
    console.log('[WakeFollowUp] Replaying pending dictation start.');
    pendingWakeDictationStartRef.current = null;
    startWakeDictation(pendingWakeDictation);
  }, [disabled, isMac, isSpeechActive, isStreaming, speechVisible, startWakeDictation]);

  useEffect(() => {
    if (value !== draftPrompt) {
      const timer = setTimeout(() => {
        dispatch(setDraftPrompt({ sessionId: draftKey, draft: value }));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [value, draftPrompt, dispatch, draftKey]);

  const handleSubmit = useCallback(async (wakeConfigOverride?: WakeDictationCommandConfig | null) => {
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
    updateWakeActivationOverlay({
      phase: WakeActivationOverlayPhase.Submitting,
      transcript: finalPrompt,
    });

    let result: boolean | void;
    try {
      result = await onSubmit(finalPrompt, skillPrompt, imageAtts.length > 0 ? imageAtts : undefined);
    } catch (error) {
      console.error('[CoworkPromptInput] Failed to submit wake dictation prompt:', error);
      hideWakeActivationOverlay();
      disarmWakeFollowUpDictation();
      return false;
    }

    if (result === false) {
      hideWakeActivationOverlay();
      disarmWakeFollowUpDictation();
      return false;
    }
    armWakeFollowUpDictation(getFollowUpDictationConfig(wakeConfigOverride ?? wakeDictationConfigRef.current));
    hideWakeActivationOverlay();
    setValue('');
    speechBaseValueRef.current = '';
    pendingSpeechVoiceCommandRef.current = null;
    dispatch(setDraftPrompt({ sessionId: draftKey, draft: '' }));
    dispatch(clearDraftAttachments(draftKey));
    setImageVisionHint(false);
  }, [
    value,
    isStreaming,
    disabled,
    isSpeechActive,
    onSubmit,
    activeSkillIds,
    skills,
    attachments,
    showFolderSelector,
    workingDirectory,
    dispatch,
    armWakeFollowUpDictation,
    disarmWakeFollowUpDictation,
    getFollowUpDictationConfig,
    hideWakeActivationOverlay,
    updateWakeActivationOverlay,
  ]);

  useEffect(() => {
    if (speechStatus !== 'idle') {
      return;
    }

    const pendingSpeechVoiceCommand = pendingSpeechVoiceCommandRef.current;
    if (pendingSpeechVoiceCommand !== SpeechVoiceCommandAction.Submit) {
      pendingSpeechVoiceCommandRef.current = null;
      wakeDictationConfigRef.current = null;
      if (wakeDictationTimerRef.current) {
        window.clearTimeout(wakeDictationTimerRef.current);
        wakeDictationTimerRef.current = null;
      }
      if (pendingSpeechVoiceCommand === SpeechVoiceCommandAction.Stop) {
        hideWakeActivationOverlay();
      }
      disarmWakeFollowUpDictation();
      return;
    }

    const submittedWakeConfig = wakeDictationConfigRef.current;
    pendingSpeechVoiceCommandRef.current = null;
    wakeDictationConfigRef.current = null;
    if (wakeDictationTimerRef.current) {
      window.clearTimeout(wakeDictationTimerRef.current);
      wakeDictationTimerRef.current = null;
    }
    void handleSubmit(submittedWakeConfig);
  }, [disarmWakeFollowUpDictation, handleSubmit, hideWakeActivationOverlay, speechCommandNonce, speechStatus]);

  useEffect(() => {
    const handleWakeDictationStart = (event: Event) => {
      const detail = (event as CustomEvent<WakeDictationCommandConfig>).detail;
      if (!detail || !isMac) {
        hideWakeActivationOverlay();
        return;
      }
      if (disabled) {
        pendingWakeDictationStartRef.current = null;
        hideWakeActivationOverlay();
        console.log('[WakeFollowUp] Ignored wake dictation start because prompt input is disabled.');
        return;
      }
      if (isStreaming || isSpeechActive || !speechVisible) {
        console.log('[WakeFollowUp] Queued wake dictation start until prompt input is ready.', {
          isStreaming,
          isSpeechActive,
          speechVisible,
          detail,
        });
        pendingWakeDictationStartRef.current = detail;
        return;
      }
      pendingWakeDictationStartRef.current = null;
      startWakeDictation(detail);
    };

    window.addEventListener(AppCustomEvent.StartWakeDictation, handleWakeDictationStart);
    return () => {
      window.removeEventListener(AppCustomEvent.StartWakeDictation, handleWakeDictationStart);
    };
  }, [disabled, hideWakeActivationOverlay, isMac, isSpeechActive, isStreaming, speechVisible, startWakeDictation]);

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
    disarmWakeFollowUpDictation();
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
      case SpeechErrorCode.RecognizerUnavailable:
        return i18nService.t('coworkSpeechRecognizerUnavailable');
      case SpeechErrorCode.AlreadyListening:
        return i18nService.t('coworkSpeechStartFailed');
      case SpeechErrorCode.DevPermissionPromptUnsupported:
        return i18nService.t('coworkSpeechDevPermissionPromptUnsupported');
      case SpeechErrorCode.HelperUnavailable:
      case SpeechErrorCode.UnsupportedPlatform:
        return i18nService.t('coworkSpeechUnavailable');
      case SpeechErrorCode.SpeechNoMatch:
        return i18nService.t('coworkSpeechNoMatch');
      case SpeechErrorCode.SpeechProcessInterrupted:
      case SpeechErrorCode.SpeechProcessInvalidated:
        return reason
          ? i18nService.t('coworkSpeechInterruptedWithReason').replace('{reason}', reason)
          : i18nService.t('coworkSpeechInterrupted');
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
    if (!isMac || !speechVisible || disabled || isStreaming) {
      if (isMac && !speechVisible) {
        window.dispatchEvent(new CustomEvent('app:showToast', { detail: i18nService.t('coworkSpeechUnavailable') }));
      }
      return;
    }

    if (isSpeechActive) {
      pendingSpeechVoiceCommandRef.current = null;
      wakeDictationConfigRef.current = null;
      hideWakeActivationOverlay();
      disarmWakeFollowUpDictation();
      const result = await window.electron.speech.stop();
      if (!result.success) {
        window.dispatchEvent(new CustomEvent('app:showToast', { detail: resolveSpeechErrorMessage(result.error, result.error) }));
      }
      return;
    }

    speechBaseValueRef.current = valueRef.current;
    pendingSpeechVoiceCommandRef.current = null;
    wakeDictationConfigRef.current = null;
    disarmWakeFollowUpDictation();
    setSpeechStatus('requesting_permission');
    const result = await window.electron.speech.start({ source: 'manual' });
    if (!result.success) {
      setSpeechStatus('idle');
      window.dispatchEvent(new CustomEvent('app:showToast', { detail: resolveSpeechErrorMessage(result.error, result.error) }));
    }
  }, [disabled, disarmWakeFollowUpDictation, hideWakeActivationOverlay, isMac, isSpeechActive, isStreaming, speechVisible]);

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
      {isMac && speechVisible && speechStatus !== 'idle' && (
        <div className="mb-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs text-primary">
          {speechStatus === 'requesting_permission'
            ? i18nService.t('coworkSpeechRequestingPermission')
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
                    onClick={() => {
                      void handleSubmit();
                    }}
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
                onClick={() => {
                  void handleSubmit();
                }}
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
