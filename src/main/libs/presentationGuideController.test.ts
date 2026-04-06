import { describe, expect, test } from 'vitest';
import { GuideSource, GuideStatus } from '../../shared/desktopAssistant/constants';
import { PresentationGuideController } from './presentationGuideController';

const createStartRequest = () => ({
  sessionId: 'session-1',
  messageId: 'message-1',
  source: GuideSource.Manual,
  previewTarget: 'https://example.com',
  scenes: [
    { id: 'scene-1', title: '概览', summary: '第一段' },
    { id: 'scene-2', title: '细节', summary: '第二段' },
  ],
});

describe('PresentationGuideController', () => {
  test('enforces single active guide session', () => {
    const controller = new PresentationGuideController();

    expect(controller.startGuide(createStartRequest()).success).toBe(true);
    expect(controller.startGuide(createStartRequest())).toEqual({
      success: false,
      error: 'A guide session is already active.',
    });
  });

  test('supports pause, resume, scene navigation, and stop', () => {
    const controller = new PresentationGuideController();
    controller.startGuide(createStartRequest());

    expect(controller.pauseGuide().guideSession?.status).toBe(GuideStatus.Paused);
    expect(controller.resumeGuide().guideSession?.status).toBe(GuideStatus.Active);
    expect(controller.nextScene().guideSession?.currentSceneIndex).toBe(1);
    expect(controller.nextScene().guideSession?.currentSceneIndex).toBe(1);
    expect(controller.previousScene().guideSession?.currentSceneIndex).toBe(0);
    expect(controller.goToScene(99).guideSession?.currentSceneIndex).toBe(1);
    expect(controller.goToScene(-4).guideSession?.currentSceneIndex).toBe(0);
    expect(controller.replayScene().guideSession?.sceneReplayNonce).toBe(1);
    expect(controller.stopGuide().guideSession?.status).toBe(GuideStatus.Stopped);
    expect(controller.getGuideSession()).toBeNull();
  });

  test('rejects unsupported preview targets', () => {
    const controller = new PresentationGuideController();
    const result = controller.startGuide({
      ...createStartRequest(),
      previewTarget: 'relative/path.md',
    });

    expect(result).toEqual({
      success: false,
      error: 'Invalid preview target.',
    });
  });
});
