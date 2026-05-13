import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

process.env.APPLY_OPENCLAW_PATCHES_TEST_MODE = '1';

const require = createRequire(import.meta.url);
const {
  getNormalizedPatchTempPath,
  preparePatchForGitApply,
} = require('../../../scripts/apply-openclaw-patches.cjs');

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

describe('apply-openclaw-patches helpers', () => {
  test('uses process-specific temp patch names for normalized CRLF patches', () => {
    const tempPath = getNormalizedPatchTempPath('001-demo.patch', {
      tmpDir: '/tmp/qingshu',
      pid: 4242,
    });

    expect(tempPath).toBe('/tmp/qingshu/lobsterai-patch-4242-001-demo.patch');
  });

  test('keeps normalized temp patches inside the temp directory', () => {
    const tempPath = getNormalizedPatchTempPath('../001-demo.patch', {
      tmpDir: '/tmp/qingshu',
      pid: 4242,
    });

    expect(tempPath).toBe('/tmp/qingshu/lobsterai-patch-4242-001-demo.patch');
  });

  test('normalizes CRLF patches into process-specific temp files', () => {
    const dir = makeTempDir('openclaw-patch-test-');
    const patchPath = path.join(dir, '001-demo.patch');
    fs.writeFileSync(patchPath, 'diff --git a/a b/a\r\n+hello\r\n', 'utf8');

    const prepared = preparePatchForGitApply(patchPath, '001-demo.patch', {
      tmpDir: dir,
      pid: 4242,
    });

    expect(prepared).toEqual({
      needsNormalize: true,
      patchPath: path.join(dir, 'lobsterai-patch-4242-001-demo.patch'),
    });
    expect(fs.readFileSync(prepared.patchPath, 'utf8')).toBe('diff --git a/a b/a\n+hello\n');
  });

  test('keeps LF-only patches on their original path', () => {
    const dir = makeTempDir('openclaw-patch-test-');
    const patchPath = path.join(dir, '001-demo.patch');
    fs.writeFileSync(patchPath, 'diff --git a/a b/a\n+hello\n', 'utf8');

    expect(preparePatchForGitApply(patchPath, '001-demo.patch', {
      tmpDir: dir,
      pid: 4242,
    })).toEqual({
      needsNormalize: false,
      patchPath,
    });
  });
});
