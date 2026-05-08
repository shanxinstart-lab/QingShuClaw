import { describe, expect, test } from 'vitest';

import { parseUserMessageForDisplay } from './userMessageDisplay';

const WIN_INBOUND = String.raw`C:\Users\yangwn\AppData\Roaming\LobsterAI\openclaw\state\media\inbound`;
const MAC_INBOUND = '/Users/yangwn/Library/Application Support/LobsterAI/openclaw/state/media/inbound';

const fileImg = (dir: string, name: string) => `${dir}${dir.includes('\\') ? '\\' : '/'}${name}`;

const toFileUrl = (p: string) => {
  const normalized = p.replace(/\\/g, '/');
  const urlPath = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `![](file://${encodeURI(urlPath)})`;
};

describe('parseUserMessageForDisplay passthrough', () => {
  test('keeps empty input unchanged', () => {
    expect(parseUserMessageForDisplay('')).toBe('');
  });

  test('keeps null and undefined unchanged', () => {
    expect(parseUserMessageForDisplay(null as unknown as string)).toBe(null);
    expect(parseUserMessageForDisplay(undefined as unknown as string)).toBe(undefined);
  });

  test('keeps plain text unchanged', () => {
    expect(parseUserMessageForDisplay('你好，今天天气不错')).toBe('你好，今天天气不错');
  });

  test('keeps normal markdown unchanged', () => {
    const md = '## Hello\n\n- item 1\n- item 2\n\n```js\nconsole.log("hi")\n```';
    expect(parseUserMessageForDisplay(md)).toBe(md);
  });

  test('keeps file paths outside inbound media unchanged', () => {
    const msg = String.raw`C:\Users\yangwn\Desktop\screenshot.jpg`;
    expect(parseUserMessageForDisplay(msg)).toBe(msg);
  });
});

describe('parseUserMessageForDisplay NIM and DingTalk media metadata', () => {
  test('strips image placeholder and attachment metadata while preserving URL', () => {
    const imgPath = fileImg(WIN_INBOUND, 'abc123.jpg');
    const input = [
      '[图片] https://nos.netease.com/xxx.jpg',
      '',
      '[附件信息]',
      `- 类型: image, 路径: ${imgPath}, MIME: image/jpeg, 尺寸: 1920x1080`,
    ].join('\n');

    expect(parseUserMessageForDisplay(input)).toBe('https://nos.netease.com/xxx.jpg');
  });

  test('strips image placeholder without URL', () => {
    const input = [
      '[图片]',
      '',
      '[附件信息]',
      `- 类型: image, 路径: ${fileImg(WIN_INBOUND, 'abc123.jpg')}, MIME: image/jpeg`,
    ].join('\n');

    expect(parseUserMessageForDisplay(input)).toBe('');
  });

  test('preserves user text and media URL', () => {
    const input = [
      '看看这张图',
      '[图片] https://nos.netease.com/xxx.jpg',
      '',
      '[附件信息]',
      `- 类型: image, 路径: ${fileImg(WIN_INBOUND, 'abc123.jpg')}, MIME: image/jpeg`,
    ].join('\n');

    const result = parseUserMessageForDisplay(input);
    expect(result).toContain('看看这张图');
    expect(result).toContain('https://nos.netease.com/xxx.jpg');
    expect(result).not.toContain('[图片]');
  });

  test('strips audio placeholder and attachment metadata', () => {
    const input = [
      '[语音消息]',
      '',
      '[附件信息]',
      `- 类型: audio, 路径: ${WIN_INBOUND}\\voice.mp3, MIME: audio/mp3`,
    ].join('\n');

    const result = parseUserMessageForDisplay(input);
    expect(result).not.toContain('[语音消息]');
    expect(result).not.toContain('[附件信息]');
  });

  test('strips file placeholder while preserving URL', () => {
    expect(parseUserMessageForDisplay('[文件] https://nos.netease.com/file.pdf')).toBe(
      'https://nos.netease.com/file.pdf',
    );
  });

  test('strips file placeholder without URL', () => {
    expect(parseUserMessageForDisplay('[文件]')).toBe('');
  });

  test('strips multiple attachment metadata lines', () => {
    const input = [
      '[图片]',
      '',
      '[附件信息]',
      `- 类型: image, 路径: ${fileImg(WIN_INBOUND, 'img1.jpg')}, MIME: image/jpeg`,
      `- 类型: image, 路径: ${fileImg(WIN_INBOUND, 'img2.png')}, MIME: image/png`,
    ].join('\n');

    const result = parseUserMessageForDisplay(input);
    expect(result).not.toContain('[附件信息]');
    expect(result).not.toContain('[图片]');
  });
});

describe('parseUserMessageForDisplay OpenClaw media metadata', () => {
  test('renders WeCom image metadata as markdown image', () => {
    const imgPath = fileImg(WIN_INBOUND, 'b02db622.jpg');
    const input = [
      `[media attached: ${imgPath} (image/jpeg) | ${imgPath}]`,
      'To send an image back, prefer the message tool (media/path/filePath). If you must inline, use MEDIA:https://example.com/image.jpg.',
      '',
      'media:image',
    ].join('\n');

    const result = parseUserMessageForDisplay(input);
    expect(result).toBe(toFileUrl(imgPath));
    expect(result).not.toContain('[media attached');
    expect(result).not.toContain('To send an image back');
    expect(result).not.toContain('media:image');
  });

  test('renders WeChat image metadata without alternate path', () => {
    const imgPath = fileImg(WIN_INBOUND, '154ba6cf.jpg');
    const input = [
      `[media attached: ${imgPath} (image/*)]`,
      'To send an image back, prefer the message tool (media/path/filePath).',
    ].join('\n');

    expect(parseUserMessageForDisplay(input)).toBe(toFileUrl(imgPath));
  });

  test('strips Feishu system line and renders image path', () => {
    const imgPath = fileImg(WIN_INBOUND, '0f209ea9.jpg');
    const input = [
      `[media attached: ${imgPath} (image/jpeg) | ${imgPath}]`,
      'To send an image back, prefer the message tool (media/path/filePath).',
      'System: [2026-04-27 15:54:25 GMT+8] Feishu[41f9d3b5] DM | ou_a17d2d2850e3d7a4cb4db0eeaf9cebd3 [msg:om_x100, image, 1 attachment(s)]',
      '',
      imgPath,
    ].join('\n');

    const result = parseUserMessageForDisplay(input);
    expect(result).toBe(toFileUrl(imgPath));
    expect(result).not.toContain('System:');
    expect(result).not.toContain('[media attached');
  });

  test('renders bare inbound path after server-side Feishu stripping', () => {
    const imgPath = fileImg(WIN_INBOUND, '58c6a4bb.jpg');
    expect(parseUserMessageForDisplay(imgPath)).toBe(toFileUrl(imgPath));
  });

  test('renders bare inbound path with CRLF', () => {
    const imgPath = fileImg(WIN_INBOUND, '58c6a4bb.jpg');
    expect(parseUserMessageForDisplay(`${imgPath}\r\n`)).toBe(toFileUrl(imgPath));
  });
});

describe('parseUserMessageForDisplay system metadata', () => {
  test('strips timestamped system header from text message', () => {
    const input = [
      'System: [2026-04-28 11:53:11 GMT+8] From user889589',
      '',
      '123',
    ].join('\n');

    expect(parseUserMessageForDisplay(input)).toBe('123');
  });

  test('strips multiple timestamped system lines', () => {
    const input = [
      'System: [2026-04-28 11:53:11 GMT+8] From user889589',
      'System: [2026-04-28 11:53:12 GMT+8] NIM[abc123] DM',
      '',
      'hello',
    ].join('\n');

    expect(parseUserMessageForDisplay(input)).toBe('hello');
  });

  test('keeps user text that only vaguely looks like a system line', () => {
    const msg = 'System: this is not a timestamp line';
    expect(parseUserMessageForDisplay(msg)).toBe(msg);
  });

  test('keeps system text without a valid timestamp', () => {
    const msg = 'System: [invalid] something';
    expect(parseUserMessageForDisplay(msg)).toBe(msg);
  });
});

describe('parseUserMessageForDisplay macOS media paths', () => {
  test('renders Mac inbound image path', () => {
    const imgPath = fileImg(MAC_INBOUND, 'abc123.jpg');
    expect(parseUserMessageForDisplay(imgPath)).toBe(toFileUrl(imgPath));
  });

  test('renders Mac path from OpenClaw media metadata', () => {
    const imgPath = fileImg(MAC_INBOUND, 'abc123.jpg');
    const input = [
      `[media attached: ${imgPath} (image/jpeg) | ${imgPath}]`,
      'To send an image back, prefer the message tool (media/path/filePath).',
    ].join('\n');

    expect(parseUserMessageForDisplay(input)).toBe(toFileUrl(imgPath));
  });
});
