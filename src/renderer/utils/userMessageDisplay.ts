/**
 * Display-side transformation for user messages from IM channels.
 * Strips IM-specific media metadata and replaces image paths with renderable
 * markdown image syntax. This does not affect the content sent to the model.
 */

const NIM_PLACEHOLDER_RE = /^\[(图片|语音消息|视频|文件|多媒体消息)\](?:\s+(https?:\/\/\S+))?\s*$/m;
const ATTACHMENT_INFO_BLOCK_RE = /\n?\[附件信息\]\n(?:- .+(?:\n|$))+/;
const OPENCLAW_MEDIA_RE = /\[media attached:\s*(.+?)\s*\(([^)]+)\)(?:\s*\|\s*(.+?))?\s*\]/g;
const OPENCLAW_INSTRUCTION_RE = /To send an image back, prefer the message tool[^\n]*(?:\n(?!\n)[^\n]*)*/gi;
const MEDIA_TAG_RE = /^\s*media:\w+\s*$/gm;
const SYSTEM_TIMESTAMP_LINE_RE = /^System:\s*\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+[^\]]*\].*$/gm;
const OPENCLAW_INBOUND_IMAGE_RE = /^((?:[A-Za-z]:\\|\/)[^\n]*[/\\]openclaw[/\\]state[/\\]media[/\\]inbound[/\\][^\n]+\.(?:jpg|jpeg|png|gif|bmp|webp))\s*$/gm;
const IMAGE_EXTENSIONS = /\.(?:jpg|jpeg|png|gif|bmp|webp)$/i;

function encodeFilePathAsMarkdownImage(filePath: string): string {
  const trimmed = filePath.trim();
  const normalized = trimmed.replace(/\\/g, '/');
  const urlPath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  const encoded = encodeURI(urlPath);
  return `![](file://${encoded})`;
}

export function parseUserMessageForDisplay(content: string): string {
  if (!content) return content;

  let result = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const imagePaths: string[] = [];

  if (result.includes('[图片]') || result.includes('[语音消息]') || result.includes('[视频]')
    || result.includes('[文件]') || result.includes('[多媒体消息]') || result.includes('[附件信息]')) {
    result = result.replace(NIM_PLACEHOLDER_RE, (_match, _type, url) => url || '');
    result = result.replace(ATTACHMENT_INFO_BLOCK_RE, '');
  }

  if (result.includes('[media attached:')) {
    let match: RegExpExecArray | null;
    const mediaRe = new RegExp(OPENCLAW_MEDIA_RE.source, OPENCLAW_MEDIA_RE.flags);
    while ((match = mediaRe.exec(result)) !== null) {
      const firstPath = match[1].trim();
      const mime = match[2].trim();
      const secondPath = match[3]?.trim();
      const filePath = secondPath || firstPath;
      if ((mime.startsWith('image/') || mime === 'image/*') && filePath) {
        imagePaths.push(filePath);
      }
    }

    result = result.replace(new RegExp(OPENCLAW_MEDIA_RE.source, OPENCLAW_MEDIA_RE.flags), '');
    result = result.replace(OPENCLAW_INSTRUCTION_RE, '');
    result = result.replace(MEDIA_TAG_RE, '');
  }

  result = result.replace(SYSTEM_TIMESTAMP_LINE_RE, '');

  result = result.replace(OPENCLAW_INBOUND_IMAGE_RE, (_match, filePath) => {
    const normalizedPath = filePath.trim();
    if (IMAGE_EXTENSIONS.test(normalizedPath)) {
      const alreadyExtracted = imagePaths.some(
        existing => existing.toLowerCase() === normalizedPath.toLowerCase(),
      );
      if (!alreadyExtracted) {
        imagePaths.push(normalizedPath);
      }
    }
    return '';
  });

  result = result.replace(/\n{3,}/g, '\n\n').trim();

  if (imagePaths.length > 0) {
    const imageMarkdown = imagePaths.map(encodeFilePathAsMarkdownImage).join('\n');
    result = result ? `${result}\n\n${imageMarkdown}` : imageMarkdown;
  }

  return result;
}
