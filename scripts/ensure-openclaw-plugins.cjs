'use strict';

/**
 * Ensure preinstalled OpenClaw plugins are downloaded and placed into the
 * runtime extensions directory.
 *
 * Uses the OpenClaw CLI (`openclaw plugins install`) to handle downloading,
 * dependency resolution, and proper module setup for each plugin declared in
 * package.json ("openclaw.plugins").
 *
 * Flow per plugin:
 *   1. Checks a local cache in vendor/openclaw-plugins/{id}/
 *   2. Installs via `openclaw plugins install` if not cached at the right version
 *   3. Copies the plugin into vendor/openclaw-runtime/current/extensions/{id}/
 *
 * Environment variables:
 *   OPENCLAW_SKIP_PLUGINS          - Set to "1" to skip this script entirely
 *   OPENCLAW_FORCE_PLUGIN_INSTALL  - Set to "1" to force re-download all plugins
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function log(msg) {
  console.log(`[openclaw-plugins] ${msg}`);
}

function die(msg) {
  console.error(`[openclaw-plugins] ERROR: ${msg}`);
  process.exit(1);
}

function copyDirRecursive(src, dest) {
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function fixBinSymlinks(baseDir) {
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isSymbolicLink()) {
        const binDir = path.dirname(full);
        if (path.basename(binDir) !== '.bin') continue;
        const target = fs.readlinkSync(full);
        if (!path.isAbsolute(target)) continue;
        const nmSegment = '/node_modules/';
        const nmIdx = target.lastIndexOf(nmSegment);
        if (nmIdx === -1) continue;
        const relToNm = target.slice(nmIdx + nmSegment.length);
        const newTarget = path.join('..', relToNm);
        try {
          fs.unlinkSync(full);
          fs.symlinkSync(newTarget, full);
        } catch {
          // best-effort
        }
      }
    }
  };
  walk(baseDir);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function runOpenClawCli(args, opts = {}) {
  const openclawMjs = path.join(
    rootDir, 'vendor', 'openclaw-runtime', 'current', 'openclaw.mjs',
  );

  if (!fs.existsSync(openclawMjs)) {
    throw new Error(`OpenClaw CLI not found at ${openclawMjs}`);
  }

  const result = spawnSync(process.execPath, [openclawMjs, ...args], {
    encoding: 'utf-8',
    stdio: opts.stdio || 'inherit',
    cwd: opts.cwd || rootDir,
    env: { ...process.env, ...opts.env },
    timeout: opts.timeout || 5 * 60 * 1000,
  });

  if (result.error) {
    throw new Error(`openclaw ${args.join(' ')} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    throw new Error(
      `openclaw ${args.join(' ')} exited with code ${result.status}` +
      (stderr ? `\n${stderr}` : ''),
    );
  }

  return (result.stdout || '').trim();
}

function npmPack(npmSpec, version, registry, outputDir) {
  const isWin = process.platform === 'win32';
  const npmBin = isWin ? 'npm.cmd' : 'npm';
  const args = ['pack', `${npmSpec}@${version}`, '--pack-destination', outputDir];
  if (registry) {
    args.push(`--registry=${registry}`);
  }

  const result = spawnSync(npmBin, args, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: outputDir,
    shell: isWin,
    timeout: 3 * 60 * 1000,
    windowsVerbatimArguments: isWin,
  });

  if (result.error) {
    throw new Error(`npm pack ${npmSpec}@${version} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    throw new Error(
      `npm pack ${npmSpec}@${version} exited with code ${result.status}` +
      (stderr ? `\n${stderr}` : ''),
    );
  }

  const tgzName = (result.stdout || '').trim().split('\n').pop();
  return path.join(outputDir, tgzName);
}

if (process.env.OPENCLAW_SKIP_PLUGINS === '1') {
  log('Skipped (OPENCLAW_SKIP_PLUGINS=1).');
  process.exit(0);
}

const pkg = require(path.join(rootDir, 'package.json'));
const plugins = (pkg.openclaw && pkg.openclaw.plugins) || [];

if (!Array.isArray(plugins) || plugins.length === 0) {
  log('No plugins declared in package.json, nothing to do.');
  process.exit(0);
}

for (const plugin of plugins) {
  if (!plugin.id || !plugin.npm || !plugin.version) {
    die(
      `Invalid plugin declaration: ${JSON.stringify(plugin)}. ` +
      'Each plugin must have "id", "npm", and "version" fields.',
    );
  }
}

const forceInstall = process.env.OPENCLAW_FORCE_PLUGIN_INSTALL === '1';
const pluginCacheBase = path.join(rootDir, 'vendor', 'openclaw-plugins');
const runtimeCurrentDir = path.join(rootDir, 'vendor', 'openclaw-runtime', 'current');
const runtimeExtensionsDir = path.join(runtimeCurrentDir, 'third-party-extensions');

ensureDir(runtimeExtensionsDir);
ensureDir(pluginCacheBase);

log(`Processing ${plugins.length} plugin(s)...`);

for (const plugin of plugins) {
  const { id, npm: npmSpec, version, registry, optional } = plugin;
  const cacheDir = path.join(pluginCacheBase, id);
  const installInfoPath = path.join(cacheDir, 'plugin-install-info.json');
  const targetDir = path.join(runtimeExtensionsDir, id);

  log(`--- Plugin: ${id} (${npmSpec}@${version}) ---`);

  let needsDownload = true;
  if (!forceInstall && fs.existsSync(installInfoPath)) {
    const info = readJsonFile(installInfoPath);
    if (info && info.version === version && info.npmSpec === npmSpec) {
      log(`Cache hit (version=${version}), skipping download.`);
      needsDownload = false;
    } else {
      log(`Cache version mismatch (cached=${info?.version || 'none'}, wanted=${version}).`);
    }
  }

  if (needsDownload) {
    log(`Installing ${npmSpec}@${version} via OpenClaw CLI...`);
    const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-plugin-staging-'));

    try {
      let installSpec;

      if (registry) {
        log(`  Packing from custom registry: ${registry}`);
        const tgzPath = npmPack(npmSpec, version, registry, stagingDir);
        installSpec = tgzPath;
      } else {
        installSpec = `${npmSpec}@${version}`;
      }

      runOpenClawCli(
        ['plugins', 'install', installSpec, '--force', '--dangerously-force-unsafe-install'],
        {
          env: {
            OPENCLAW_STATE_DIR: stagingDir,
            npm_config_legacy_peer_deps: 'true',
          },
          stdio: 'inherit',
        },
      );

      const installedDir = path.join(stagingDir, 'extensions', id);
      if (!fs.existsSync(installedDir)) {
        const extDir = path.join(stagingDir, 'extensions');
        const entries = fs.existsSync(extDir) ? fs.readdirSync(extDir) : [];
        if (entries.length === 0) {
          throw new Error('No plugin found in staging directory after install');
        }
        const actualDir = path.join(extDir, entries[0]);
        if (
          !fs.existsSync(path.join(actualDir, 'openclaw.plugin.json')) &&
          !fs.existsSync(path.join(actualDir, 'package.json'))
        ) {
          throw new Error(`Installed plugin directory ${entries[0]} has no plugin manifest`);
        }
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { recursive: true, force: true });
        }
        ensureDir(path.dirname(cacheDir));
        copyDirRecursive(actualDir, cacheDir);
        fixBinSymlinks(cacheDir);
      } else {
        if (fs.existsSync(cacheDir)) {
          fs.rmSync(cacheDir, { recursive: true, force: true });
        }
        ensureDir(path.dirname(cacheDir));
        copyDirRecursive(installedDir, cacheDir);
        fixBinSymlinks(cacheDir);
      }

      fs.writeFileSync(
        installInfoPath,
        JSON.stringify(
          {
            pluginId: id,
            npmSpec,
            version,
            installedAt: new Date().toISOString(),
          },
          null,
          2,
        ) + '\n',
        'utf-8',
      );

      log(`Downloaded and cached ${id}@${version}.`);
    } catch (err) {
      if (optional) {
        log(`WARNING: Failed to install optional plugin ${id}: ${err.message}`);
        log(`Skipping ${id} - it may not be available from this network.`);
        continue;
      }
      die(`Failed to install plugin ${id}: ${err.message}`);
    } finally {
      try {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }

  if (!fs.existsSync(cacheDir)) {
    if (optional) {
      log(`Skipping ${id} - cache not available (optional plugin).`);
      continue;
    }
    die(`Plugin cache directory missing after install: ${cacheDir}`);
  }

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  copyDirRecursive(cacheDir, targetDir);

  const targetInfoPath = path.join(targetDir, 'plugin-install-info.json');
  if (fs.existsSync(targetInfoPath)) {
    fs.unlinkSync(targetInfoPath);
  }

  log(`Installed ${id} -> ${path.relative(rootDir, targetDir)}`);
}

log(`All ${plugins.length} plugin(s) installed successfully.`);
