import crypto from 'crypto';
import {
  GuideSource,
  GuideStatus,
  type GuideScene,
  type GuideSession,
  type StartGuideRequest,
} from '../../shared/desktopAssistant/constants';

export interface PresentationGuideControllerResult {
  success: boolean;
  guideSession?: GuideSession | null;
  error?: string;
}

type GuideSessionListener = (guideSession: GuideSession | null) => void;

const ARTIFACT_ANCHOR_PATTERN = /^#artifact-[A-Za-z0-9_-]+$/u;

const isValidPreviewTarget = (previewTarget?: string): boolean => {
  if (!previewTarget) {
    return false;
  }
  if (/^https?:\/\//u.test(previewTarget)) {
    return true;
  }
  if (/^localfile:\/\//u.test(previewTarget)) {
    return true;
  }
  if (previewTarget.startsWith('/')) {
    return true;
  }
  return ARTIFACT_ANCHOR_PATTERN.test(previewTarget);
};

export class PresentationGuideController {
  private guideSession: GuideSession | null = null;

  private readonly listeners = new Set<GuideSessionListener>();

  onGuideSessionChanged(listener: GuideSessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getGuideSession(): GuideSession | null {
    return this.guideSession;
  }

  startGuide(input: StartGuideRequest): PresentationGuideControllerResult {
    if (this.guideSession && this.guideSession.status !== GuideStatus.Stopped) {
      return { success: false, error: 'A guide session is already active.' };
    }
    if (!isValidPreviewTarget(input.previewTarget)) {
      return { success: false, error: 'Invalid preview target.' };
    }
    if (!input.sessionId.trim() || !input.messageId.trim()) {
      return { success: false, error: 'Guide session requires session and message identifiers.' };
    }
    if (!Array.isArray(input.scenes) || input.scenes.length === 0) {
      return { success: false, error: 'Guide session requires at least one scene.' };
    }

    const nextGuideSession: GuideSession = {
      id: crypto.randomUUID(),
      sessionId: input.sessionId.trim(),
      messageId: input.messageId.trim(),
      source: input.source === GuideSource.Auto ? GuideSource.Auto : GuideSource.Manual,
      status: GuideStatus.Active,
      previewTarget: input.previewTarget,
      scenes: input.scenes.map((scene: GuideScene) => ({ ...scene })),
      currentSceneIndex: 0,
      sceneReplayNonce: 0,
    };
    this.guideSession = nextGuideSession;
    this.emitChange();
    return { success: true, guideSession: nextGuideSession };
  }

  pauseGuide(): PresentationGuideControllerResult {
    if (!this.guideSession || this.guideSession.status !== GuideStatus.Active) {
      return { success: false, error: 'No active guide session to pause.' };
    }
    this.guideSession = {
      ...this.guideSession,
      status: GuideStatus.Paused,
    };
    this.emitChange();
    return { success: true, guideSession: this.guideSession };
  }

  resumeGuide(): PresentationGuideControllerResult {
    if (!this.guideSession || this.guideSession.status !== GuideStatus.Paused) {
      return { success: false, error: 'No paused guide session to resume.' };
    }
    this.guideSession = {
      ...this.guideSession,
      status: GuideStatus.Active,
    };
    this.emitChange();
    return { success: true, guideSession: this.guideSession };
  }

  stopGuide(): PresentationGuideControllerResult {
    if (!this.guideSession) {
      return { success: false, error: 'No guide session to stop.' };
    }
    const stoppedGuideSession: GuideSession = {
      ...this.guideSession,
      status: GuideStatus.Stopped,
    };
    this.guideSession = null;
    this.emitChange();
    return { success: true, guideSession: stoppedGuideSession };
  }

  nextScene(): PresentationGuideControllerResult {
    if (!this.guideSession) {
      return { success: false, error: 'No guide session is active.' };
    }
    const nextIndex = Math.min(
      this.guideSession.currentSceneIndex + 1,
      this.guideSession.scenes.length - 1,
    );
    this.guideSession = {
      ...this.guideSession,
      currentSceneIndex: nextIndex,
    };
    this.emitChange();
    return { success: true, guideSession: this.guideSession };
  }

  previousScene(): PresentationGuideControllerResult {
    if (!this.guideSession) {
      return { success: false, error: 'No guide session is active.' };
    }
    const nextIndex = Math.max(this.guideSession.currentSceneIndex - 1, 0);
    this.guideSession = {
      ...this.guideSession,
      currentSceneIndex: nextIndex,
    };
    this.emitChange();
    return { success: true, guideSession: this.guideSession };
  }

  goToScene(sceneIndex: number): PresentationGuideControllerResult {
    if (!this.guideSession) {
      return { success: false, error: 'No guide session is active.' };
    }

    const normalizedIndex = Math.min(
      Math.max(Math.trunc(sceneIndex), 0),
      this.guideSession.scenes.length - 1,
    );
    this.guideSession = {
      ...this.guideSession,
      currentSceneIndex: normalizedIndex,
    };
    this.emitChange();
    return { success: true, guideSession: this.guideSession };
  }

  replayScene(): PresentationGuideControllerResult {
    if (!this.guideSession) {
      return { success: false, error: 'No guide session is active.' };
    }

    this.guideSession = {
      ...this.guideSession,
      sceneReplayNonce: (this.guideSession.sceneReplayNonce ?? 0) + 1,
    };
    this.emitChange();
    return { success: true, guideSession: this.guideSession };
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener(this.guideSession ? { ...this.guideSession, scenes: this.guideSession.scenes.map((scene) => ({ ...scene })) } : null);
    }
  }
}
