import type { CoworkMessage } from '../../types/cowork';
import type { GuideScene } from '../../../shared/desktopAssistant/constants';
import {
  PresentationBridgeVersion,
  type LinkedPresentationManifest,
} from '../../../shared/desktopAssistant/presentationBridge';

export const GuidePreviewMode = {
  Linked: 'linked',
  External: 'external',
  Artifact: 'artifact',
} as const;
export type GuidePreviewMode = typeof GuidePreviewMode[keyof typeof GuidePreviewMode];

export interface GuidePreviewDescriptor {
  mode: GuidePreviewMode;
  previewUrl: string | null;
  htmlContent: string | null;
  linkedManifest: LinkedPresentationManifest | null;
}

const LINKED_PRESENTATION_ROOT_PATTERN = /\bdata-qingshu-presentation=(["'])v1\1/iu;
const GUIDE_SCENE_PATTERN = /<(section|article|div)\b([^>]*)>([\s\S]*?)<\/\1>/giu;

const stripHtmlTags = (value: string): string => value
  .replace(/<script[\s\S]*?<\/script>/giu, ' ')
  .replace(/<style[\s\S]*?<\/style>/giu, ' ')
  .replace(/<[^>]+>/gu, ' ')
  .replace(/&nbsp;/gu, ' ')
  .replace(/&amp;/gu, '&')
  .replace(/&lt;/gu, '<')
  .replace(/&gt;/gu, '>')
  .replace(/\s+/gu, ' ')
  .trim();

const extractTagTexts = (body: string, tagName: string): string[] => {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'giu');
  return Array.from(body.matchAll(pattern))
    .map((match) => stripHtmlTags(match[1] || ''))
    .map((text) => text.trim())
    .filter(Boolean);
};

const extractHtmlTitle = (htmlContent: string): string | undefined => {
  const titleMatch = htmlContent.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu);
  const title = stripHtmlTags(titleMatch?.[1] || '');
  return title || undefined;
};

export const isArtifactGuidePreviewTarget = (previewTarget: string): boolean => (
  /^#artifact-[A-Za-z0-9_-]+$/u.test(previewTarget)
);

export const isLocalGuidePreviewTarget = (previewTarget: string): boolean => (
  previewTarget.startsWith('/') || previewTarget.startsWith('localfile://')
);

export const toLocalGuidePreviewPath = (previewTarget: string): string => (
  previewTarget.startsWith('localfile://')
    ? previewTarget.replace(/^localfile:\/\//u, '')
    : previewTarget
);

export const toGuidePreviewFileUrl = (previewTarget: string): string | null => {
  if (!isLocalGuidePreviewTarget(previewTarget)) {
    return null;
  }
  return `file://${encodeURI(toLocalGuidePreviewPath(previewTarget))}`;
};

export const decodeTextDataUrl = (dataUrl: string): string => {
  const separatorIndex = dataUrl.indexOf(',');
  if (separatorIndex < 0) {
    return '';
  }
  const base64 = dataUrl.slice(separatorIndex + 1);
  const binary = window.atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
};

export const extractLinkedPresentationManifestFromHtml = (
  htmlContent: string,
): LinkedPresentationManifest | null => {
  if (!LINKED_PRESENTATION_ROOT_PATTERN.test(htmlContent)) {
    return null;
  }

  const scenes = Array.from(htmlContent.matchAll(GUIDE_SCENE_PATTERN))
    .map((match) => {
      const attrs = match[2] || '';
      const body = match[3] || '';
      const sceneIdMatch = attrs.match(/\bdata-guide-scene-id=(["'])([^"']+)\1/iu);
      const sceneId = sceneIdMatch?.[2]?.trim();
      if (!sceneId) {
        return null;
      }

      const titleAttrMatch = attrs.match(/\bdata-guide-scene-title=(["'])([^"']+)\1/iu);
      const domIdMatch = attrs.match(/\bid=(["'])([A-Za-z][\w-]*)\1/iu);
      const headings = [
        ...extractTagTexts(body, 'h1'),
        ...extractTagTexts(body, 'h2'),
        ...extractTagTexts(body, 'h3'),
      ];
      const title = titleAttrMatch?.[2]?.trim() || headings[0] || sceneId;
      const anchor = domIdMatch?.[2] ? `#${domIdMatch[2]}` : undefined;
      return {
        id: sceneId,
        title,
        anchor,
      };
    })
    .filter((scene): scene is NonNullable<typeof scene> => Boolean(scene));

  if (scenes.length === 0) {
    return null;
  }

  return {
    version: PresentationBridgeVersion.V1,
    title: extractHtmlTitle(htmlContent),
    scenes,
  };
};

export const buildGuideScenesFromLinkedPresentationManifest = (
  manifest: LinkedPresentationManifest,
): GuideScene[] => {
  return manifest.scenes.map((scene, index) => ({
    id: scene.id || `linked-scene-${index + 1}`,
    title: scene.title || `第 ${index + 1} 幕`,
    summary: scene.title || `第 ${index + 1} 幕`,
    anchor: scene.anchor,
  }));
};

export const resolveGuidePreviewMode = (
  previewTarget: string,
  message?: Pick<CoworkMessage, 'type' | 'content' | 'metadata'> | null,
): GuidePreviewMode => {
  if (isArtifactGuidePreviewTarget(previewTarget)) {
    return GuidePreviewMode.Artifact;
  }

  const htmlContent = typeof message?.content === 'string' ? message.content : '';
  if (htmlContent && extractLinkedPresentationManifestFromHtml(htmlContent)) {
    return GuidePreviewMode.Linked;
  }

  return GuidePreviewMode.External;
};

export const loadGuidePreviewDescriptor = async (input: {
  previewTarget: string;
}): Promise<GuidePreviewDescriptor> => {
  if (isArtifactGuidePreviewTarget(input.previewTarget)) {
    return {
      mode: GuidePreviewMode.Artifact,
      previewUrl: null,
      htmlContent: null,
      linkedManifest: null,
    };
  }

  if (!isLocalGuidePreviewTarget(input.previewTarget)) {
    return {
      mode: GuidePreviewMode.External,
      previewUrl: input.previewTarget,
      htmlContent: null,
      linkedManifest: null,
    };
  }

  const filePath = toLocalGuidePreviewPath(input.previewTarget);
  const fileUrl = toGuidePreviewFileUrl(input.previewTarget);
  const readResult = await window.electron.dialog.readFileAsDataUrl(filePath);
  if (!readResult.success || !readResult.dataUrl) {
    return {
      mode: GuidePreviewMode.External,
      previewUrl: fileUrl,
      htmlContent: null,
      linkedManifest: null,
    };
  }

  const htmlContent = decodeTextDataUrl(readResult.dataUrl);
  const linkedManifest = extractLinkedPresentationManifestFromHtml(htmlContent);
  return {
    mode: linkedManifest ? GuidePreviewMode.Linked : GuidePreviewMode.External,
    previewUrl: fileUrl,
    htmlContent,
    linkedManifest,
  };
};
