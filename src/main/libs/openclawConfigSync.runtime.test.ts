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
  hasBundledOpenClawExtension: (id: string) => id === 'mcp-bridge',
  resolveOpenClawExtensionConfigId: (id: string) => id,
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
});
