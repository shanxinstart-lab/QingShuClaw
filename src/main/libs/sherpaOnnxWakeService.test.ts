import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => os.tmpdir(),
  },
}));

import { __testUtils } from './sherpaOnnxWakeService';

describe('SherpaOnnxWakeService keyword preparation', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('filters out unsupported neutral-tone variants before building keywords', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qsc-sherpa-kws-'));
    tempDirs.push(tempDir);
    const tokensPath = path.join(tempDir, 'tokens.txt');
    fs.writeFileSync(
      tokensPath,
      [
        'x 1',
        'iǎo 2',
        'l 3',
        'íng 4',
        'ǐng 5',
        'ìng 6',
      ].join('\n'),
    );

    const supportedTokens = __testUtils.loadSupportedTokens(tokensPath);
    const prepared = __testUtils.prepareWakeKeywordsWithSupportedTokens(['小灵'], supportedTokens);

    expect(prepared).not.toBeNull();
    expect(prepared?.wakeWords).toEqual(['小灵']);
    expect(prepared?.keywordsContent).toContain('x iǎo l íng @小灵');
    expect(prepared?.keywordsContent).not.toContain('x iǎo l ing @小灵');
  });

  test('returns null when every generated variant is unsupported by tokens', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qsc-sherpa-kws-'));
    tempDirs.push(tempDir);
    const tokensPath = path.join(tempDir, 'tokens.txt');
    fs.writeFileSync(tokensPath, ['x 1', 'iǎo 2', 'l 3'].join('\n'));

    const supportedTokens = __testUtils.loadSupportedTokens(tokensPath);
    const prepared = __testUtils.prepareWakeKeywordsWithSupportedTokens(['小灵'], supportedTokens);

    expect(prepared).toBeNull();
  });
});
