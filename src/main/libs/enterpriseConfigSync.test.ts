import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('enterpriseConfigSync', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enterprise-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('module exports expected functions', async () => {
    const mod = await import('./enterpriseConfigSync');
    expect(typeof mod.resolveEnterpriseConfigPath).toBe('function');
    expect(typeof mod.syncEnterpriseConfig).toBe('function');
    expect(typeof mod.mergeOpenClawConfigs).toBe('function');
  });

  test('manifest with all sync disabled parses correctly', () => {
    const manifestDir = path.join(tmpDir, 'enterprise-config');
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(
      path.join(manifestDir, 'manifest.json'),
      JSON.stringify({
        version: '1.0.0',
        name: 'Test',
        ui: { hideTabs: [], disableUpdate: false },
        sync: { openclaw: false, skills: false, agents: false, mcp: false },
      })
    );
    const raw = fs.readFileSync(path.join(manifestDir, 'manifest.json'), 'utf-8');
    const manifest = JSON.parse(raw);
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.sync.openclaw).toBe(false);
  });

  test('app_config.json roundtrips correctly', () => {
    const appConfig = {
      api: { key: 'sk-test', baseUrl: 'https://api.example.com' },
      model: { defaultModel: 'test-model', defaultModelProvider: 'test' },
      providers: { test: { enabled: true, apiKey: 'sk-test', baseUrl: 'https://api.example.com', models: [] } },
      theme: 'dark',
      language: 'zh',
    };
    const raw = JSON.stringify(appConfig);
    const parsed = JSON.parse(raw);
    expect(parsed.providers.test.enabled).toBe(true);
    expect(parsed.model.defaultModel).toBe('test-model');
  });

  test('sandbox mode mapping covers all modes', () => {
    const map: Record<string, string> = { off: 'local', 'non-main': 'auto', all: 'sandbox' };
    expect(map['off']).toBe('local');
    expect(map['non-main']).toBe('auto');
    expect(map['all']).toBe('sandbox');
  });

  test('channel key mapping covers all platform aliases used by enterprise import', () => {
    const map: Record<string, string> = {
      telegram: 'telegramOpenClaw', discord: 'discordOpenClaw',
      feishu: 'feishuOpenClaw', dingtalk: 'dingtalkOpenClaw', 'dingtalk-connector': 'dingtalkOpenClaw',
      qqbot: 'qq', wecom: 'wecomOpenClaw', 'moltbot-popo': 'popo',
      nim: 'nim', 'openclaw-weixin': 'weixin', xiaomifeng: 'xiaomifeng',
    };
    expect(Object.keys(map)).toHaveLength(11);
    expect(map['telegram']).toBe('telegramOpenClaw');
    expect(map['dingtalk']).toBe('dingtalkOpenClaw');
    expect(map['dingtalk-connector']).toBe('dingtalkOpenClaw');
    expect(map['qqbot']).toBe('qq');
    expect(map['moltbot-popo']).toBe('popo');
    expect(map['openclaw-weixin']).toBe('weixin');
  });

  test('syncEnterpriseConfig reads moltbot-popo accounts with top-level enterprise overrides', async () => {
    const configDir = path.join(tmpDir, 'enterprise-config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'manifest.json'),
      JSON.stringify({
        version: '1.0.0',
        name: 'Test',
        sync: { openclaw: true, skills: false, agents: false, mcp: false },
      }),
    );
    fs.writeFileSync(
      path.join(configDir, 'openclaw.json'),
      JSON.stringify({
        channels: {
          'moltbot-popo': {
            accounts: {
              default: {
                enabled: true,
                appKey: 'old-key',
                appSecret: 'old-secret',
                connectionMode: 'websocket',
                aesKey: 'old-aes',
                dmPolicy: 'open',
                allowFrom: ['*'],
              },
            },
            enabled: true,
            appKey: 'new-key',
            appSecret: 'new-secret',
            connectionMode: 'webhook',
            webhookPort: 3200,
            dmPolicy: 'allowlist',
            allowFrom: ['u1'],
          },
        },
      }),
    );

    const mod = await import('./enterpriseConfigSync');
    const setPopoConfigCalls: Array<Record<string, unknown>> = [];
    const imStore = {
      setPopoConfig: (config: Record<string, unknown>) => {
        setPopoConfigCalls.push(config);
      },
      setTelegramOpenClawConfig: () => undefined,
      setDiscordOpenClawConfig: () => undefined,
      setFeishuOpenClawConfig: () => undefined,
      setDingTalkOpenClawConfig: () => undefined,
      setQQConfig: () => undefined,
      setWecomConfig: () => undefined,
      setNimConfig: () => undefined,
      setWeixinConfig: () => undefined,
      setNeteaseBeeChanConfig: () => undefined,
    };

    mod.syncEnterpriseConfig(
      configDir,
      { get: () => undefined, set: () => undefined } as any,
      imStore as any,
      () => undefined,
      () => undefined,
      () => undefined,
      () => undefined,
    );

    expect(setPopoConfigCalls).toEqual([
      {
        enabled: true,
        appKey: 'new-key',
        appSecret: 'new-secret',
        connectionMode: 'webhook',
        aesKey: 'old-aes',
        dmPolicy: 'allowlist',
        allowFrom: ['u1'],
        webhookPort: 3200,
      },
    ]);
  });

  test('syncEnterpriseConfig writes moltbot-popo accounts to multi-instance store when available', async () => {
    const configDir = path.join(tmpDir, 'enterprise-config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'manifest.json'),
      JSON.stringify({
        version: '1.0.0',
        name: 'Test',
        sync: { openclaw: true, skills: false, agents: false, mcp: false },
      }),
    );
    fs.writeFileSync(
      path.join(configDir, 'openclaw.json'),
      JSON.stringify({
        channels: {
          'moltbot-popo': {
            accounts: {
              bot1: {
                enabled: true,
                name: 'Sales Bot',
                appKey: 'old-key-1',
                appSecret: 'old-secret-1',
                aesKey: 'old-aes-1',
              },
              bot2: {
                enabled: false,
                appKey: 'old-key-2',
                appSecret: 'old-secret-2',
                aesKey: 'old-aes-2',
              },
            },
            enabled: true,
            appKey: 'new-key',
            appSecret: 'new-secret',
            connectionMode: 'webhook',
            webhookPort: 3200,
            dmPolicy: 'allowlist',
            allowFrom: ['u1'],
          },
        },
      }),
    );

    const mod = await import('./enterpriseConfigSync');
    const setPopoMultiInstanceCalls: Array<Record<string, unknown>> = [];
    const setPopoConfigCalls: Array<Record<string, unknown>> = [];
    const imStore = {
      setPopoMultiInstanceConfig: (config: Record<string, unknown>) => {
        setPopoMultiInstanceCalls.push(config);
      },
      setPopoConfig: (config: Record<string, unknown>) => {
        setPopoConfigCalls.push(config);
      },
      setTelegramOpenClawConfig: () => undefined,
      setDiscordOpenClawConfig: () => undefined,
      setFeishuOpenClawConfig: () => undefined,
      setDingTalkOpenClawConfig: () => undefined,
      setQQConfig: () => undefined,
      setWecomConfig: () => undefined,
      setNimConfig: () => undefined,
      setWeixinConfig: () => undefined,
      setNeteaseBeeChanConfig: () => undefined,
    };

    mod.syncEnterpriseConfig(
      configDir,
      { get: () => undefined, set: () => undefined } as any,
      imStore as any,
      () => undefined,
      () => undefined,
      () => undefined,
      () => undefined,
    );

    expect(setPopoConfigCalls).toEqual([]);
    expect(setPopoMultiInstanceCalls).toEqual([
      {
        instances: [
          {
            enabled: true,
            name: 'Sales Bot',
            appKey: 'new-key',
            appSecret: 'new-secret',
            aesKey: 'old-aes-1',
            connectionMode: 'webhook',
            webhookPort: 3200,
            dmPolicy: 'allowlist',
            allowFrom: ['u1'],
            instanceId: 'bot1',
            instanceName: 'Sales Bot',
          },
          {
            enabled: true,
            appKey: 'new-key',
            appSecret: 'new-secret',
            aesKey: 'old-aes-2',
            connectionMode: 'webhook',
            webhookPort: 3200,
            dmPolicy: 'allowlist',
            allowFrom: ['u1'],
            instanceId: 'bot2',
            instanceName: 'POPO Bot 2',
          },
        ],
      },
    ]);
  });

  test('syncEnterpriseConfig syncs feishu account maps into existing instances', async () => {
    const configDir = path.join(tmpDir, 'enterprise-config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'manifest.json'),
      JSON.stringify({
        version: '1.0.0',
        name: 'Test',
        sync: { openclaw: true, skills: false, agents: false, mcp: false },
      }),
    );
    fs.writeFileSync(
      path.join(configDir, 'openclaw.json'),
      JSON.stringify({
        channels: {
          feishu: {
            accounts: {
              abcdef12: {
                enabled: true,
                name: 'Old Bot',
                appId: 'old-app',
                appSecret: 'old-secret',
                dmPolicy: 'open',
                allowFrom: ['*'],
              },
            },
            enabled: true,
            appId: 'new-app',
            appSecret: 'new-secret',
            dmPolicy: 'allowlist',
            allowFrom: ['u1'],
          },
        },
      }),
    );

    const mod = await import('./enterpriseConfigSync');
    const setFeishuInstanceConfigCalls: Array<{ instanceId: string; config: Record<string, unknown> }> = [];
    const imStore = {
      getFeishuInstances: () => [{ instanceId: 'abcdef12-long-existing-id' }],
      setFeishuInstanceConfig: (instanceId: string, config: Record<string, unknown>) => {
        setFeishuInstanceConfigCalls.push({ instanceId, config });
      },
      setFeishuOpenClawConfig: () => undefined,
      setTelegramOpenClawConfig: () => undefined,
      setDiscordOpenClawConfig: () => undefined,
      setDingTalkOpenClawConfig: () => undefined,
      setQQConfig: () => undefined,
      setWecomConfig: () => undefined,
      setPopoConfig: () => undefined,
      setNimConfig: () => undefined,
      setWeixinConfig: () => undefined,
      setNeteaseBeeChanConfig: () => undefined,
    };

    mod.syncEnterpriseConfig(
      configDir,
      { get: () => undefined, set: () => undefined } as any,
      imStore as any,
      () => undefined,
      () => undefined,
      () => undefined,
      () => undefined,
    );

    expect(setFeishuInstanceConfigCalls).toEqual([
      {
        instanceId: 'abcdef12-long-existing-id',
        config: {
          enabled: true,
          instanceName: 'Old Bot',
          appId: 'new-app',
          appSecret: 'new-secret',
          domain: undefined,
          dmPolicy: 'allowlist',
          allowFrom: ['u1'],
          groupPolicy: undefined,
          groupAllowFrom: undefined,
          groups: undefined,
          historyLimit: undefined,
          streaming: undefined,
          replyMode: undefined,
          blockStreaming: undefined,
          footer: undefined,
          blockStreamingCoalesce: undefined,
          mediaMaxMb: undefined,
        },
      },
    ]);
  });

  test('syncEnterpriseConfig preserves wecom websocket url from account maps', async () => {
    const configDir = path.join(tmpDir, 'enterprise-config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'manifest.json'),
      JSON.stringify({
        version: '1.0.0',
        name: 'Test',
        sync: { openclaw: true, skills: false, agents: false, mcp: false },
      }),
    );
    fs.writeFileSync(
      path.join(configDir, 'openclaw.json'),
      JSON.stringify({
        channels: {
          wecom: {
            accounts: {
              wc001122: {
                enabled: true,
                name: 'WeCom Bot',
                botId: 'bot-id',
                secret: 'secret',
                websocketUrl: 'wss://wecom.example/ws',
                dmPolicy: 'open',
              },
            },
          },
        },
      }),
    );

    const mod = await import('./enterpriseConfigSync');
    const setWecomInstanceConfigCalls: Array<{ instanceId: string; config: Record<string, unknown> }> = [];
    const imStore = {
      getWecomInstances: () => [{ instanceId: 'wc001122-existing-id' }],
      setWecomInstanceConfig: (instanceId: string, config: Record<string, unknown>) => {
        setWecomInstanceConfigCalls.push({ instanceId, config });
      },
      setWecomConfig: () => undefined,
      setTelegramOpenClawConfig: () => undefined,
      setDiscordOpenClawConfig: () => undefined,
      setFeishuOpenClawConfig: () => undefined,
      setDingTalkOpenClawConfig: () => undefined,
      setQQConfig: () => undefined,
      setPopoConfig: () => undefined,
      setNimConfig: () => undefined,
      setWeixinConfig: () => undefined,
      setNeteaseBeeChanConfig: () => undefined,
    };

    mod.syncEnterpriseConfig(
      configDir,
      { get: () => undefined, set: () => undefined } as any,
      imStore as any,
      () => undefined,
      () => undefined,
      () => undefined,
      () => undefined,
    );

    expect(setWecomInstanceConfigCalls).toEqual([
      {
        instanceId: 'wc001122-existing-id',
        config: {
          enabled: true,
          instanceName: 'WeCom Bot',
          botId: 'bot-id',
          secret: 'secret',
          websocketUrl: 'wss://wecom.example/ws',
          dmPolicy: 'open',
          allowFrom: undefined,
          groupPolicy: undefined,
          groupAllowFrom: undefined,
          sendThinkingMessage: undefined,
        },
      },
    ]);
  });

  test('mergeOpenClawConfigs removes top-level credentials when accounts exist', async () => {
    const mod = await import('./enterpriseConfigSync');
    const merged = mod.mergeOpenClawConfigs(
      {
        channels: {
          feishu: {
            accounts: {
              default: {
                appId: 'runtime-app',
                appSecret: 'runtime-secret',
              },
            },
            appId: 'runtime-app',
            appSecret: 'runtime-secret',
            dmPolicy: 'open',
          },
        },
      },
      {
        channels: {
          feishu: {
            appId: 'enterprise-app',
            appSecret: 'enterprise-secret',
            dmPolicy: 'allowlist',
            allowFrom: ['u1'],
          },
        },
      },
    );

    expect(merged.channels).toEqual({
      feishu: {
        accounts: {
          default: {
            appId: 'enterprise-app',
            appSecret: 'enterprise-secret',
            dmPolicy: 'allowlist',
            allowFrom: ['u1'],
          },
        },
        dmPolicy: 'allowlist',
        allowFrom: ['u1'],
      },
    });
  });

  test('mergeOpenClawConfigs preserves runtime plugin load paths and appends enterprise paths', async () => {
    const mod = await import('./enterpriseConfigSync');
    const merged = mod.mergeOpenClawConfigs(
      {
        plugins: {
          load: {
            paths: ['/runtime/plugins'],
          },
        },
      },
      {
        plugins: {
          load: {
            paths: ['/enterprise/custom-plugins'],
          },
        },
      },
    );

    expect(merged).toEqual({
      plugins: {
        load: {
          paths: [
            '/runtime/plugins',
            '/enterprise/custom-plugins',
          ],
        },
      },
    });
  });

  test('syncEnterpriseConfig prefers agent cwd over workspace for cowork working directory', async () => {
    const configDir = path.join(tmpDir, 'enterprise-config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'manifest.json'),
      JSON.stringify({
        version: '1.0.0',
        name: 'Test',
        sync: { openclaw: true, skills: false, agents: false, mcp: false },
      }),
    );
    fs.writeFileSync(
      path.join(configDir, 'openclaw.json'),
      JSON.stringify({
        agents: {
          defaults: {
            workspace: '/tmp/runtime-workspace-main',
            cwd: '/tmp/task-working-directory',
            sandbox: { mode: 'off' },
          },
        },
      }),
    );

    const mod = await import('./enterpriseConfigSync');
    const setConfigCalls: Array<Record<string, string>> = [];
    const imStore = {
      setTelegramOpenClawConfig: () => undefined,
      setDiscordOpenClawConfig: () => undefined,
      setFeishuOpenClawConfig: () => undefined,
      setDingTalkOpenClawConfig: () => undefined,
      setQQConfig: () => undefined,
      setWecomConfig: () => undefined,
      setPopoConfig: () => undefined,
      setNimConfig: () => undefined,
      setWeixinConfig: () => undefined,
      setNeteaseBeeChanConfig: () => undefined,
    };

    mod.syncEnterpriseConfig(
      configDir,
      { get: () => undefined, set: () => undefined } as any,
      imStore as any,
      () => undefined,
      () => undefined,
      (config) => setConfigCalls.push(config),
      () => undefined,
    );

    expect(setConfigCalls).toContainEqual({
      agentEngine: 'openclaw',
      executionMode: 'local',
      workingDirectory: '/tmp/task-working-directory',
    });
  });

  test('recursive directory copy preserves nested structure', () => {
    const src = path.join(tmpDir, 'src-skill');
    const dest = path.join(tmpDir, 'dest-skill');
    fs.mkdirSync(path.join(src, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(src, 'SKILL.md'), '# Test Skill');
    fs.writeFileSync(path.join(src, 'sub', 'config.json'), '{}');

    const copyDir = (s: string, d: string) => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
      for (const entry of fs.readdirSync(s, { withFileTypes: true })) {
        const sp = path.join(s, entry.name);
        const dp = path.join(d, entry.name);
        if (entry.isDirectory()) copyDir(sp, dp);
        else fs.copyFileSync(sp, dp);
      }
    };
    copyDir(src, dest);

    expect(fs.existsSync(path.join(dest, 'SKILL.md'))).toBe(true);
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf-8')).toBe('# Test Skill');
    expect(fs.existsSync(path.join(dest, 'sub', 'config.json'))).toBe(true);
  });

  test('manifest with hideTabs filters correctly', () => {
    const hideTabs = ['settings.im', 'settings.model'];
    const allTabKeys = ['general', 'coworkAgentEngine', 'model', 'im', 'email', 'about'];
    const filtered = allTabKeys.filter(key => {
      const hideKeys = hideTabs.map(t => t.replace('settings.', ''));
      return !hideKeys.includes(key);
    });
    expect(filtered).toEqual(['general', 'coworkAgentEngine', 'email', 'about']);
  });
});
