import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

import {
  __openclawLocalExtensionsTestUtils,
  cleanupStaleThirdPartyPluginsFromBundledDir,
} from './openclawLocalExtensions';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lobsterai-openclaw-extensions-'));
}

function writeManifest(baseDir: string, directoryId: string, manifest: unknown): void {
  const dir = path.join(baseDir, directoryId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'openclaw.plugin.json'), JSON.stringify(manifest), 'utf8');
}

describe('openclawLocalExtensions manifest helpers', () => {
  test('reads manifest plugin id separately from directory id', () => {
    const dir = makeTmpDir();
    try {
      writeManifest(dir, 'openclaw-nim-channel', { id: 'nimsuite-openclaw-nim-channel' });

      const manifest = __openclawLocalExtensionsTestUtils.readExtensionManifest(
        dir,
        'openclaw-nim-channel',
        'bundled',
      );

      expect(manifest).toMatchObject({
        directoryId: 'openclaw-nim-channel',
        pluginId: 'nimsuite-openclaw-nim-channel',
        source: 'bundled',
      });
      expect(manifest?.directory).toBe(path.join(dir, 'openclaw-nim-channel'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('lists only directories with valid manifest ids', () => {
    const dir = makeTmpDir();
    try {
      writeManifest(dir, 'email-dir', { id: 'email' });
      writeManifest(dir, 'empty-id', { id: '   ' });
      fs.mkdirSync(path.join(dir, 'bad-json'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'bad-json', 'openclaw.plugin.json'), '{bad', 'utf8');
      fs.writeFileSync(path.join(dir, 'loose-file'), 'ignored', 'utf8');

      const manifests = __openclawLocalExtensionsTestUtils.listExtensionManifests(dir, 'local');

      expect(manifests).toHaveLength(1);
      expect(manifests[0]).toMatchObject({
        directoryId: 'email-dir',
        pluginId: 'email',
        source: 'local',
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns an empty list for missing extension directories', () => {
    expect(__openclawLocalExtensionsTestUtils.listExtensionManifests(null, 'local')).toEqual([]);
  });
});

describe('openclawLocalExtensions cleanup helpers', () => {
  test('removes stale third-party plugins from both legacy scan directories', () => {
    const runtimeRoot = makeTmpDir();
    try {
      const distPluginDir = path.join(runtimeRoot, 'dist', 'extensions', 'openclaw-lark');
      const rootPluginDir = path.join(runtimeRoot, 'extensions', 'openclaw-lark');
      fs.mkdirSync(distPluginDir, { recursive: true });
      fs.mkdirSync(rootPluginDir, { recursive: true });
      fs.writeFileSync(path.join(distPluginDir, 'openclaw.plugin.json'), '{}', 'utf8');
      fs.writeFileSync(path.join(rootPluginDir, 'openclaw.plugin.json'), '{}', 'utf8');

      const removed = cleanupStaleThirdPartyPluginsFromBundledDir(runtimeRoot, ['openclaw-lark']);

      expect(removed).toEqual(['openclaw-lark', 'openclaw-lark']);
      expect(fs.existsSync(distPluginDir)).toBe(false);
      expect(fs.existsSync(rootPluginDir)).toBe(false);
    } finally {
      fs.rmSync(runtimeRoot, { recursive: true, force: true });
    }
  });
});
