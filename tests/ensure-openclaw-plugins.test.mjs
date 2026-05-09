import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  buildGitEnv,
  buildNpmPackEnv,
  isGitSpec,
  isLocalPathSpec,
  parseGitSpec,
  resolveGitPackSpec,
  resolvePluginInstallSource,
} = require('../scripts/ensure-openclaw-plugins.cjs');

test('ensure-openclaw-plugins detects local path specs', () => {
  assert.equal(isLocalPathSpec('/tmp/openclaw-nim-channel'), true);
  assert.equal(isLocalPathSpec('./plugins/openclaw-nim-channel'), true);
  assert.equal(isLocalPathSpec('@scope/openclaw-plugin'), false);
});

test('ensure-openclaw-plugins detects git specs from GitHub', () => {
  assert.equal(isGitSpec('git+https://github.com/netease-im/openclaw-nim-channel.git'), true);
  assert.equal(isGitSpec('https://github.com/netease-im/openclaw-nim-channel.git'), true);
  assert.equal(isGitSpec('github:netease-im/openclaw-nim-channel'), true);
  assert.equal(isGitSpec('@scope/openclaw-plugin'), false);
});

test('ensure-openclaw-plugins appends version as git ref when the spec has no hash', () => {
  assert.equal(
    resolveGitPackSpec('git+https://github.com/netease-im/openclaw-nim-channel.git', '1.0.3'),
    'git+https://github.com/netease-im/openclaw-nim-channel.git#1.0.3',
  );
  assert.equal(
    resolveGitPackSpec('git+https://github.com/netease-im/openclaw-nim-channel.git#main', '1.0.3'),
    'git+https://github.com/netease-im/openclaw-nim-channel.git#main',
  );
});

test('ensure-openclaw-plugins resolves git sources to packed installs', () => {
  assert.deepEqual(resolvePluginInstallSource({
    id: 'openclaw-nim-channel',
    npm: 'git+https://github.com/netease-im/openclaw-nim-channel.git',
    version: '1.0.3',
  }), {
    kind: 'git',
    gitSpec: 'git+https://github.com/netease-im/openclaw-nim-channel.git#1.0.3',
    pinnedDisplaySpec: 'git+https://github.com/netease-im/openclaw-nim-channel.git#1.0.3',
  });
});

test('ensure-openclaw-plugins parses git specs into clone url and ref', () => {
  assert.deepEqual(parseGitSpec(
    'git+https://github.com/netease-im/openclaw-nim-channel.git',
    '1.1.0',
  ), {
    cloneUrl: 'https://github.com/netease-im/openclaw-nim-channel.git',
    ref: '1.1.0',
  });

  assert.deepEqual(parseGitSpec(
    'github:netease-im/openclaw-nim-channel#main',
    '1.1.0',
  ), {
    cloneUrl: 'https://github.com/netease-im/openclaw-nim-channel.git',
    ref: 'main',
  });
});

test('ensure-openclaw-plugins clears conflicting npm prefer env vars for git pack', () => {
  const previous = {
    npm_config_prefer_offline: process.env.npm_config_prefer_offline,
    npm_config_prefer_online: process.env.npm_config_prefer_online,
    NPM_CONFIG_PREFER_OFFLINE: process.env.NPM_CONFIG_PREFER_OFFLINE,
    NPM_CONFIG_PREFER_ONLINE: process.env.NPM_CONFIG_PREFER_ONLINE,
  };

  try {
    process.env.npm_config_prefer_offline = 'true';
    process.env.npm_config_prefer_online = 'true';
    process.env.NPM_CONFIG_PREFER_OFFLINE = 'true';
    process.env.NPM_CONFIG_PREFER_ONLINE = 'true';

    const env = buildNpmPackEnv();
    assert.equal(env.npm_config_prefer_offline, '');
    assert.equal(env.npm_config_prefer_online, '');
    assert.equal(env.NPM_CONFIG_PREFER_OFFLINE, '');
    assert.equal(env.NPM_CONFIG_PREFER_ONLINE, '');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test('ensure-openclaw-plugins disables interactive git prompts for clone', () => {
  assert.equal(buildGitEnv().GIT_TERMINAL_PROMPT, '0');
});

test('ensure-openclaw-plugins preserves existing registry and local path behavior', () => {
  assert.deepEqual(resolvePluginInstallSource({
    id: 'moltbot-popo',
    npm: 'moltbot-popo',
    version: '2.0.7',
    registry: 'https://npm.nie.netease.com',
  }), {
    kind: 'packed',
    packSpec: 'moltbot-popo@2.0.7',
    pinnedDisplaySpec: 'moltbot-popo@2.0.7',
    registry: 'https://npm.nie.netease.com',
  });

  assert.deepEqual(resolvePluginInstallSource({
    id: 'local-plugin',
    npm: '/tmp/local-plugin',
    version: '1.0.0',
  }), {
    kind: 'direct',
    installSpec: '/tmp/local-plugin',
    pinnedDisplaySpec: '/tmp/local-plugin',
  });
});
