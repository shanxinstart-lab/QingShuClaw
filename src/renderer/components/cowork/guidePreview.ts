import type { CoworkMessage } from '../../types/cowork';
import { extractInlineGuideHtmlContent } from './guideContent';
import {
  GuidePreviewMode,
  buildGuideScenesFromLinkedPresentationManifest,
  isArtifactGuidePreviewTarget,
  isLocalGuidePreviewTarget,
  loadGuidePreviewDescriptor,
  resolveGuidePreviewMode as resolveGuidePreviewModeBase,
  toGuidePreviewFileUrl,
  toLocalGuidePreviewPath,
} from './guidePresentationBridge';

export const GuidePreviewEvent = {
  OpenArtifactAnchor: 'desktopAssistant:openArtifactAnchor',
} as const;

const isHttpUrl = (target: string): boolean => /^https?:\/\//u.test(target);
const isLocalFileProtocol = (target: string): boolean => /^localfile:\/\//u.test(target);
const isHtmlAnchor = (target: string): boolean => /^#[A-Za-z0-9_-]+$/u.test(target);

const INVALID_FILE_NAME_PATTERN = /[<>:"/\\|?*\u0000-\u001F]/gu;

const sanitizeGuideFileName = (value: string): string => {
  const sanitized = value.replace(INVALID_FILE_NAME_PATTERN, ' ').replace(/\s+/gu, ' ').trim();
  return sanitized || 'presentation-guide';
};

const getInlineGuideFileName = (
  message: Pick<CoworkMessage, 'id' | 'content'>,
  htmlContent: string,
): string => {
  const titleMatch = htmlContent.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu);
  const headingMatch = htmlContent.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu);
  const rawTitle = (titleMatch?.[1] || headingMatch?.[1] || '').replace(/<[^>]+>/gu, ' ').trim();
  const safeTitle = sanitizeGuideFileName(rawTitle);
  return `${safeTitle || `presentation-${message.id}`}.html`;
};

const encodeTextAsBase64 = (value: string): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64');
  }

  const encoder = new TextEncoder();
  const bytes = encoder.encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

export const resolveGuideScenePreviewTarget = (
  previewTarget: string,
  sceneAnchor?: string,
): string => {
  const normalizedAnchor = sceneAnchor?.trim();
  if (!normalizedAnchor || !isHtmlAnchor(normalizedAnchor) || isArtifactGuidePreviewTarget(normalizedAnchor)) {
    return previewTarget;
  }

  if (isHttpUrl(previewTarget)) {
    return `${previewTarget.replace(/#.*$/u, '')}${normalizedAnchor}`;
  }
  if (isLocalFileProtocol(previewTarget)) {
    return `${previewTarget.replace(/#.*$/u, '')}${normalizedAnchor}`;
  }
  if (isLocalGuidePreviewTarget(previewTarget)) {
    const fileUrl = toGuidePreviewFileUrl(previewTarget);
    return fileUrl ? `${fileUrl}${normalizedAnchor}` : previewTarget;
  }

  return previewTarget;
};

export const openGuidePreview = async (previewTarget: string): Promise<{ success: boolean; error?: string }> => {
  if (isHttpUrl(previewTarget)) {
    return window.electron.shell.openExternal(previewTarget);
  }

  if (isLocalFileProtocol(previewTarget)) {
    return window.electron.shell.openPath(toLocalGuidePreviewPath(previewTarget));
  }

  if (isLocalGuidePreviewTarget(previewTarget)) {
    return window.electron.shell.openPath(previewTarget);
  }

  if (isArtifactGuidePreviewTarget(previewTarget)) {
    window.dispatchEvent(new CustomEvent(GuidePreviewEvent.OpenArtifactAnchor, {
      detail: { anchor: previewTarget },
    }));
    return { success: true };
  }

  return { success: false, error: 'Unsupported guide preview target.' };
};

export const materializeInlineGuidePreviewTarget = async (input: {
  message: Pick<CoworkMessage, 'id' | 'type' | 'content' | 'metadata'>;
  previewTarget: string;
  cwd?: string;
}): Promise<{ success: boolean; previewTarget: string; materialized: boolean; error?: string }> => {
  if (!isArtifactGuidePreviewTarget(input.previewTarget)) {
    return {
      success: true,
      previewTarget: input.previewTarget,
      materialized: false,
    };
  }

  const htmlContent = extractInlineGuideHtmlContent(input.message);
  if (!htmlContent) {
    return {
      success: true,
      previewTarget: input.previewTarget,
      materialized: false,
    };
  }

  const result = await window.electron.dialog.saveInlineFile({
    dataBase64: encodeTextAsBase64(htmlContent),
    fileName: getInlineGuideFileName(input.message, htmlContent),
    mimeType: 'text/html',
    cwd: input.cwd,
  });

  if (!result.success || !result.path) {
    return {
      success: false,
      previewTarget: input.previewTarget,
      materialized: false,
      error: result.error || 'Failed to save inline guide html.',
    };
  }

  return {
    success: true,
    previewTarget: result.path,
    materialized: true,
  };
};

export const openGuideScenePreview = async (
  previewTarget: string,
  sceneAnchor?: string,
): Promise<{ success: boolean; error?: string }> => {
  if (sceneAnchor && isArtifactGuidePreviewTarget(sceneAnchor)) {
    return openGuidePreview(sceneAnchor);
  }

  const resolvedTarget = resolveGuideScenePreviewTarget(previewTarget, sceneAnchor);
  if (resolvedTarget !== previewTarget && /^(https?:\/\/|localfile:\/\/|file:\/\/)/u.test(resolvedTarget)) {
    return window.electron.shell.openExternal(resolvedTarget);
  }

  return openGuidePreview(resolvedTarget);
};

export const prepareGuideStartContext = async (input: {
  message: Pick<CoworkMessage, 'id' | 'type' | 'content' | 'metadata'>;
  previewTarget: string;
  scenes: import('../../../shared/desktopAssistant/constants').GuideScene[];
  cwd?: string;
}): Promise<{
  success: boolean;
  previewTarget: string | null;
  scenes: import('../../../shared/desktopAssistant/constants').GuideScene[];
  previewDescriptor: Awaited<ReturnType<typeof loadGuidePreviewDescriptor>> | null;
  error?: string;
}> => {
  const materializedPreview = await materializeInlineGuidePreviewTarget({
    message: input.message,
    previewTarget: input.previewTarget,
    cwd: input.cwd,
  });
  if (!materializedPreview.success) {
    return {
      success: false,
      previewTarget: null,
      scenes: input.scenes,
      previewDescriptor: null,
      error: materializedPreview.error,
    };
  }

  const previewDescriptor = await loadGuidePreviewDescriptor({
    previewTarget: materializedPreview.previewTarget,
  });
  return {
    success: true,
    previewTarget: materializedPreview.previewTarget,
    scenes: previewDescriptor.linkedManifest
      ? buildGuideScenesFromLinkedPresentationManifest(previewDescriptor.linkedManifest)
      : input.scenes,
    previewDescriptor,
  };
};

export const resolveGuidePreviewMode = (
  previewTarget: string,
  message?: Pick<CoworkMessage, 'type' | 'content' | 'metadata'> | null,
) => {
  const inlineHtmlContent = extractInlineGuideHtmlContent(message);
  if (inlineHtmlContent) {
    return resolveGuidePreviewModeBase(previewTarget, {
      type: 'assistant',
      content: inlineHtmlContent,
      metadata: message?.metadata,
    });
  }
  return resolveGuidePreviewModeBase(previewTarget, message);
};

export {
  GuidePreviewMode,
  buildGuideScenesFromLinkedPresentationManifest,
  isArtifactGuidePreviewTarget,
  isLocalGuidePreviewTarget,
  loadGuidePreviewDescriptor,
  toGuidePreviewFileUrl,
  toLocalGuidePreviewPath,
};
