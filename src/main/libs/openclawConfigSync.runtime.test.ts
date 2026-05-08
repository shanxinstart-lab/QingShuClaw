import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => process.cwd(),
    getPath: (name: string) => {
      if (name === 'home') return os.homedir();
      return os.tmpdir();
    },
  },
}));

const mockRuntimeState = vi.hoisted(() => ({
  proxyPort: null as number | null,
  rawApiConfig: {
    config: {
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-test',
      apiType: 'openai',
    },
    providerMetadata: {
      providerName: 'openai',
      codingPlanEnabled: false,
      supportsImage: false,
      modelName: 'GPT Test',
    },
  },
}));

vi.mock('./claudeSettings', () => ({
  getAllServerModelMetadata: () => [],
  resolveAllEnabledProviderConfigs: () => [],
  resolveAllProviderApiKeys: () => ({}),
  resolveRawApiConfig: () => mockRuntimeState.rawApiConfig,
}));

vi.mock('./openclawLocalExtensions', () => ({
  hasBundledOpenClawExtension: (id: string) => [
    'mcp-bridge',
    'openclaw-lark',
    'openclaw-nim-channel',
    'nimsuite-openclaw-nim-channel',
  ].includes(id),
  resolveOpenClawExtensionConfigId: (id: string) => ({
    'openclaw-nim-channel': 'nimsuite-openclaw-nim-channel',
  }[id] ?? id),
  resolveOpenClawExtensionLoadPath: () => null,
}));

vi.mock('./openclawTokenProxy', () => ({
  getOpenClawTokenProxyPort: () => mockRuntimeState.proxyPort,
}));

describe('OpenClawConfigSync runtime config output', () => {
  let tmpDir: string;
  let configPath: string;
  let stateDir: string;

  beforeEach(() => {
    mockRuntimeState.proxyPort = null;
    mockRuntimeState.rawApiConfig = {
      config: {
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        model: 'gpt-test',
        apiType: 'openai',
      },
      providerMetadata: {
        providerName: 'openai',
        codingPlanEnabled: false,
        supportsImage: false,
        modelName: 'GPT Test',
      },
    };
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-config-sync-'));
    stateDir = path.join(tmpDir, 'state');
    configPath = path.join(stateDir, 'openclaw.json');
    fs.mkdirSync(stateDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const createSync = async (overrides: Record<string, unknown> = {}) => {
    const { OpenClawConfigSync } = await import('./openclawConfigSync');
    return new OpenClawConfigSync({
      engineManager: {
        getConfigPath: () => configPath,
        getGatewayToken: () => 'gateway-token',
        getStateDir: () => stateDir,
        getBaseDir: () => tmpDir,
        getStatus: () => ({ version: 'test-version' }),
        getDesiredVersion: () => 'test-version',
      } as never,
      getCoworkConfig: () => ({
        workingDirectory: tmpDir,
        systemPrompt: '',
        executionMode: 'local',
        agentEngine: 'openclaw',
        memoryEnabled: false,
        memoryImplicitUpdateEnabled: false,
        memoryLlmJudgeEnabled: false,
        memoryGuardLevel: 'balanced',
        memoryUserMemoriesMaxItems: 100,
        skipMissedJobs: false,
        openClawSessionPolicy: { keepAlive: '30d' },
      }),
      getDingTalkInstances: () => [],
      getFeishuInstances: () => [],
      getQQInstances: () => [],
      getWecomInstances: () => [],
      getPopoConfig: () => null,
      getNimConfig: () => null,
      getNeteaseBeeChanConfig: () => null,
      getWeixinConfig: () => null,
      getIMSettings: () => null,
      getSkillsList: () => [],
      getAgents: () => [],
      ...overrides,
    } as never);
  };

  test('writes main workspace without unsupported agents.defaults.cwd', async () => {
    const sync = await createSync();

    const result = sync.sync('cwd-schema-compat');
    expect(result.ok).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.agents.defaults.workspace).toBe(path.join(stateDir, 'workspace-main'));
    expect(config.agents.defaults).not.toHaveProperty('cwd');
  });

  test('disables mcporter so MCP routing uses the built-in bridge', async () => {
    const sync = await createSync();

    const result = sync.sync('managed-skill-overrides');
    expect(result.ok).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.skills.entries.mcporter).toEqual({ enabled: false });
  });

  test('adds missing array items in MCP bridge tool schemas for OpenAI compatibility', async () => {
    const sync = await createSync({
      getMcpBridgeConfig: () => ({
        callbackUrl: 'http://127.0.0.1:12345/mcp',
        askUserCallbackUrl: 'http://127.0.0.1:12345/ask',
        secret: 'test-secret',
        tools: [{
          server: 'github',
          name: 'create_issue',
          description: 'Create an issue',
          inputSchema: {
            type: 'object',
            properties: {
              attachments: {
                type: 'array',
                description: 'Optional issue attachments',
              },
            },
          },
        }],
      }),
    });

    const result = sync.sync('mcp-array-items');
    expect(result.ok).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const [tool] = config.plugins.entries['mcp-bridge'].config.tools;
    expect(tool.inputSchema.properties.attachments.items).toEqual({});
  });

  test('writes only supported Weixin channel schema fields', async () => {
    const sync = await createSync({
      getWeixinConfig: () => ({
        enabled: true,
        accountId: 'wx-account-1',
        dmPolicy: 'open',
        allowFrom: ['user-1'],
        groupPolicy: 'open',
        groupAllowFrom: [],
        debug: true,
      }),
    });

    const result = sync.sync('weixin-channel-schema');
    expect(result.ok).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.channels['openclaw-weixin']).toEqual({
      enabled: true,
      dmPolicy: 'open',
      allowFrom: ['user-1', '*'],
    });
    expect(config.channels['openclaw-weixin']).not.toHaveProperty('accountId');
  });

  test('prefers external lark and bundled qqbot plugin entries', async () => {
    const sync = await createSync({
      getFeishuInstances: () => [{
        enabled: true,
        appId: 'cli_feishu_app',
        appSecret: 'secret',
        instanceId: 'feishu-instance-1',
        instanceName: 'Feishu Bot 1',
        domain: 'feishu',
        dmPolicy: 'open',
        allowFrom: ['*'],
        groupPolicy: 'allowlist',
        groupAllowFrom: [],
        groups: { '*': { requireMention: true } },
        historyLimit: 50,
        streaming: true,
        replyMode: 'auto',
        blockStreaming: false,
        footer: {},
        mediaMaxMb: 30,
        debug: true,
      }],
      getQQInstances: () => [{
        enabled: true,
        appId: 'qq-app-id',
        appSecret: 'qq-secret',
        instanceId: 'qq-instance-1',
        instanceName: 'QQ Bot 1',
        dmPolicy: 'open',
        allowFrom: ['*'],
        groupPolicy: 'open',
        groupAllowFrom: [],
        historyLimit: 50,
        markdownSupport: true,
        imageServerBaseUrl: '',
        debug: true,
      }],
    });

    const result = sync.sync('feishu-lark-qqbot');
    expect(result.ok).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.plugins.entries['openclaw-lark']).toEqual({ enabled: true });
    expect(config.plugins.entries.feishu).toEqual({ enabled: false });
    expect(config.plugins.entries.qqbot).toEqual({ enabled: true });
    expect(config.plugins.entries).not.toHaveProperty('openclaw-qqbot');
  });

  test('cleans stale plugin package ids and preserves manifest entry config', async () => {
    fs.writeFileSync(configPath, JSON.stringify({
      plugins: {
        entries: {
          'clawemail-email': { enabled: true },
          'openclaw-nim-channel': { enabled: true },
          'nimsuite-openclaw-nim-channel': { enabled: false, config: { retained: true } },
          'qwen-portal-auth': { enabled: true },
        },
      },
    }, null, 2));

    const sync = await createSync({
      getNimConfig: () => ({
        enabled: true,
        appKey: 'nim-app-key',
        account: 'nim-account',
        token: 'nim-token',
      }),
    });

    const result = sync.sync('plugin-entry-cleanup');
    expect(result.ok).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(config.plugins.entries).not.toHaveProperty('clawemail-email');
    expect(config.plugins.entries).not.toHaveProperty('openclaw-nim-channel');
    expect(config.plugins.entries).not.toHaveProperty('qwen-portal-auth');
    expect(config.plugins.entries['nimsuite-openclaw-nim-channel']).toEqual({
      enabled: true,
      config: { retained: true },
    });
  });
});
