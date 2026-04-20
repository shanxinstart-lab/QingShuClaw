'use strict';

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pkg = require(path.join(rootDir, 'package.json'));

const repoUrl = pkg.openclaw?.repo || 'https://github.com/openclaw/openclaw.git';
const currentVersion = pkg.openclaw?.version || '';
const targetVersion = process.argv[2] || currentVersion;
const localOpenclawSrc = process.env.OPENCLAW_SRC || path.resolve(rootDir, '..', 'openclaw');
const patchDir = path.join(rootDir, 'scripts', 'patches', targetVersion);
const gitEnv = {
  ...process.env,
  GIT_TERMINAL_PROMPT: '0',
};
const GIT_TIMEOUT_MS = 60 * 1000;

function log(message) {
  console.log(`[openclaw-audit] ${message}`);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf-8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    env: options.env || gitEnv,
    timeout: options.timeout || GIT_TIMEOUT_MS,
  }).trim();
}

function runResult(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf-8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    env: options.env || gitEnv,
    timeout: options.timeout || GIT_TIMEOUT_MS,
  });
}

function ensureGitAvailable() {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  const result = runResult(checker, ['git']);
  if (result.status !== 0) {
    throw new Error('git is required for OpenClaw upgrade audit');
  }
}

function printSection(title) {
  console.log(`\n== ${title} ==`);
}

function inspectLocalOpenclaw() {
  const status = {
    exists: fs.existsSync(localOpenclawSrc),
    path: localOpenclawSrc,
    dirty: false,
    currentRef: '',
    currentTag: '',
    statusLines: [],
  };

  if (!status.exists || !fs.existsSync(path.join(localOpenclawSrc, '.git'))) {
    return status;
  }

  const shortStatus = runResult('git', ['status', '--short'], { cwd: localOpenclawSrc });
  status.statusLines = (shortStatus.stdout || '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);
  status.dirty = status.statusLines.length > 0;

  const branch = runResult('git', ['branch', '--show-current'], { cwd: localOpenclawSrc });
  const head = runResult('git', ['rev-parse', '--short', 'HEAD'], { cwd: localOpenclawSrc });
  const tag = runResult('git', ['describe', '--tags', '--exact-match', 'HEAD'], { cwd: localOpenclawSrc });
  status.currentRef = (branch.stdout || head.stdout || '').trim();
  status.currentTag = (tag.stdout || '').trim();

  return status;
}

function checkRemoteTagExists() {
  const result = runResult('git', ['ls-remote', '--tags', repoUrl, targetVersion]);
  const line = (result.stdout || '').trim();
  return {
    exists: result.status === 0 && Boolean(line),
    line,
  };
}

function cloneTargetTag(tempDir) {
  const cloneDir = path.join(tempDir, 'openclaw');
  const result = runResult('git', ['clone', '--branch', targetVersion, '--depth', '1', repoUrl, cloneDir], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    throw new Error(stderr || `failed to clone ${targetVersion}`);
  }
  return cloneDir;
}

function auditPatches(cloneDir) {
  if (!fs.existsSync(patchDir)) {
    return {
      exists: false,
      patches: [],
    };
  }

  const patchFiles = fs.readdirSync(patchDir)
    .filter((file) => file.endsWith('.patch'))
    .sort();

  const results = patchFiles.map((file) => {
    const patchPath = path.join(patchDir, file);
    const forward = runResult('git', ['apply', '--check', '--ignore-whitespace', patchPath], { cwd: cloneDir });
    if (forward.status === 0) {
      return { file, status: 'applicable' };
    }

    const reverse = runResult('git', ['apply', '--check', '--reverse', '--ignore-whitespace', patchPath], { cwd: cloneDir });
    if (reverse.status === 0) {
      return { file, status: 'already_applied' };
    }

    return {
      file,
      status: 'incompatible',
      forwardError: (forward.stderr || '').trim(),
      reverseError: (reverse.stderr || '').trim(),
    };
  });

  return {
    exists: true,
    patches: results,
  };
}

function main() {
  ensureGitAvailable();

  printSection('Context');
  log(`Current package openclaw.version: ${currentVersion || '(missing)'}`);
  log(`Target version: ${targetVersion || '(missing)'}`);
  log(`Repo: ${repoUrl}`);

  const local = inspectLocalOpenclaw();
  printSection('Local Source');
  if (!local.exists) {
    log(`Local OpenClaw source not found: ${local.path}`);
  } else if (!fs.existsSync(path.join(local.path, '.git'))) {
    log(`Path exists but is not a git repository: ${local.path}`);
  } else {
    log(`Path: ${local.path}`);
    log(`HEAD: ${local.currentTag || local.currentRef || '(unknown)'}`);
    log(`Dirty: ${local.dirty ? 'yes' : 'no'}`);
    if (local.dirty) {
      local.statusLines.slice(0, 20).forEach((line) => log(`dirty> ${line}`));
      if (local.statusLines.length > 20) {
        log(`dirty> ... (${local.statusLines.length - 20} more)`);
      }
    }
  }

  printSection('Remote Tag');
  const remoteTag = checkRemoteTagExists();
  if (!remoteTag.exists) {
    log(`Tag not found on remote: ${targetVersion}`);
    process.exitCode = 1;
    return;
  }
  log(`Remote tag exists: ${targetVersion}`);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-upgrade-audit-'));
  let cloneDir = '';
  try {
    printSection('Temporary Clone');
    cloneDir = cloneTargetTag(tempDir);
    log(`Cloned ${targetVersion} to ${cloneDir}`);

    const patchAudit = auditPatches(cloneDir);
    printSection('Patch Audit');
    if (!patchAudit.exists) {
      log(`No patch directory found: ${patchDir}`);
    } else if (patchAudit.patches.length === 0) {
      log(`Patch directory exists but has no .patch files: ${patchDir}`);
    } else {
      patchAudit.patches.forEach((patch) => {
        log(`${patch.status}: ${patch.file}`);
        if (patch.status === 'incompatible') {
          const detail = patch.forwardError || patch.reverseError;
          if (detail) {
            log(`detail> ${detail.split('\n')[0]}`);
          }
        }
      });

      const incompatibleCount = patchAudit.patches.filter((patch) => patch.status === 'incompatible').length;
      if (incompatibleCount > 0) {
        log(`Patch audit failed: ${incompatibleCount}/${patchAudit.patches.length} patch(es) incompatible with ${targetVersion}`);
        process.exitCode = 2;
      } else {
        log(`Patch audit passed for ${targetVersion}`);
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
