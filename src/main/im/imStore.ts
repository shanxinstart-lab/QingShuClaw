/**
 * IM Gateway Store
 * SQLite operations for IM configuration storage
 */

import { Database } from 'sql.js';

import { PlatformRegistry } from '../../shared/platform';
import {
  DEFAULT_DINGTALK_MULTI_INSTANCE_CONFIG,
  DEFAULT_DINGTALK_OPENCLAW_CONFIG,
  DEFAULT_DISCORD_OPENCLAW_CONFIG,
  DEFAULT_FEISHU_MULTI_INSTANCE_CONFIG,
  DEFAULT_FEISHU_OPENCLAW_CONFIG,
  DEFAULT_IM_SETTINGS,
  DEFAULT_NETEASE_BEE_CONFIG,
  DEFAULT_NIM_CONFIG,
  DEFAULT_POPO_CONFIG,
  DEFAULT_QQ_CONFIG,
  DEFAULT_QQ_MULTI_INSTANCE_CONFIG,
  DEFAULT_TELEGRAM_OPENCLAW_CONFIG,
  DEFAULT_WECOM_CONFIG,
  DEFAULT_WECOM_MULTI_INSTANCE_CONFIG,
  DEFAULT_WEIXIN_CONFIG,
  DingTalkInstanceConfig,
  DingTalkMultiInstanceConfig,
  DingTalkOpenClawConfig,
  DiscordOpenClawConfig,
  FeishuInstanceConfig,
  FeishuMultiInstanceConfig,
  FeishuOpenClawConfig,
  IMGatewayConfig,
  IMSessionMapping,
  IMSettings,
  NeteaseBeeChanConfig,
  NimConfig,
  Platform,
  PopoOpenClawConfig,
  QQConfig,
  QQInstanceConfig,
  QQMultiInstanceConfig,
  TelegramOpenClawConfig,
  WecomInstanceConfig,
  WecomMultiInstanceConfig,
  WecomOpenClawConfig,
  WeixinOpenClawConfig,
} from './types';

interface StoredConversationReplyRoute {
  channel: string;
  to: string;
  accountId?: string;
}

export class IMStore {
  private db: Database;
  private saveDb: () => void;

  constructor(db: Database, saveDb: () => void) {
    this.db = db;
    this.saveDb = saveDb;
    this.initializeTables();
    this.migrateDefaults();
  }

  private initializeTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS im_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // IM session mappings table for Cowork mode
    this.db.run(`
      CREATE TABLE IF NOT EXISTS im_session_mappings (
        im_conversation_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        cowork_session_id TEXT NOT NULL,
        openclaw_session_key TEXT,
        created_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL,
        PRIMARY KEY (im_conversation_id, platform)
      );
    `);

    // Migration: Add agent_id column to im_session_mappings
    const mappingCols = this.db.exec('PRAGMA table_info(im_session_mappings)');
    const mappingColNames = (mappingCols[0]?.values ?? []).map((r) => r[1] as string);
    if (!mappingColNames.includes('agent_id')) {
      this.db.run("ALTER TABLE im_session_mappings ADD COLUMN agent_id TEXT NOT NULL DEFAULT 'main'");
    }
    if (!mappingColNames.includes('openclaw_session_key')) {
      this.db.run('ALTER TABLE im_session_mappings ADD COLUMN openclaw_session_key TEXT');
    }

    this.saveDb();
  }

  /**
   * Migrate existing IM configs to ensure stable defaults.
   */
  private migrateDefaults(): void {
    const platforms = PlatformRegistry.platforms;
    let changed = false;

    for (const platform of platforms) {
      const result = this.db.exec('SELECT value FROM im_config WHERE key = ?', [platform]);
      if (!result[0]?.values[0]) continue;

      try {
        const config = JSON.parse(result[0].values[0][0] as string);
        if (config.debug === undefined || config.debug === false) {
          config.debug = true;
          const now = Date.now();
          this.db.run(
            'UPDATE im_config SET value = ?, updated_at = ? WHERE key = ?',
            [JSON.stringify(config), now, platform]
          );
          changed = true;
        }
      } catch {
        // Ignore parse errors
      }
    }

    const settingsResult = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['settings']);
    if (settingsResult[0]?.values[0]) {
      try {
        const settings = JSON.parse(settingsResult[0].values[0][0] as string) as Partial<IMSettings>;
        // Keep IM and desktop behavior aligned: skills auto-routing should be on by default.
        // Historical renderer default could persist `skillsEnabled: false` unintentionally.
        if (settings.skillsEnabled !== true) {
          settings.skillsEnabled = true;
          const now = Date.now();
          this.db.run(
            'UPDATE im_config SET value = ?, updated_at = ? WHERE key = ?',
            [JSON.stringify(settings), now, 'settings']
          );
          changed = true;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Migrate feishu renderMode from 'text' to 'card' (previous renderer default was incorrect)
    const feishuResult = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['feishu']);
    if (feishuResult[0]?.values[0]) {
      try {
        const feishuConfig = JSON.parse(feishuResult[0].values[0][0] as string) as Partial<{ renderMode: string }>;
        if (feishuConfig.renderMode === 'text') {
          feishuConfig.renderMode = 'card';
          const now = Date.now();
          this.db.run(
            'UPDATE im_config SET value = ?, updated_at = ? WHERE key = ?',
            [JSON.stringify(feishuConfig), now, 'feishu']
          );
          changed = true;
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Migrate old native Telegram config to new OpenClaw format
    const oldTelegramResult = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['telegram']);
    const newTelegramResult = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['telegramOpenClaw']);
    if (oldTelegramResult[0]?.values[0] && !newTelegramResult[0]?.values[0]) {
      try {
        const oldConfig = JSON.parse(oldTelegramResult[0].values[0][0] as string) as {
          enabled?: boolean;
          botToken?: string;
          allowedUserIds?: string[];
          debug?: boolean;
        };
        if (oldConfig.botToken) {
          const hasAllowList = Array.isArray(oldConfig.allowedUserIds) && oldConfig.allowedUserIds.length > 0;
          const newConfig = {
            ...DEFAULT_TELEGRAM_OPENCLAW_CONFIG,
            enabled: oldConfig.enabled ?? false,
            botToken: oldConfig.botToken,
            allowFrom: oldConfig.allowedUserIds ?? [],
            dmPolicy: hasAllowList ? 'allowlist' as const : 'pairing' as const,
            debug: oldConfig.debug ?? true,
          };
          const now = Date.now();
          this.db.run(
            'INSERT OR REPLACE INTO im_config (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)',
            ['telegramOpenClaw', JSON.stringify(newConfig), now, now]
          );
          this.db.run('DELETE FROM im_config WHERE key = ?', ['telegram']);
          changed = true;
          console.log('[IMStore] Migrated old Telegram config to OpenClaw format');
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Migrate old native Discord config to new OpenClaw format
    const oldDiscordResult = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['discord']);
    const newDiscordResult = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['discordOpenClaw']);
    if (oldDiscordResult[0]?.values[0] && !newDiscordResult[0]?.values[0]) {
      try {
        const oldConfig = JSON.parse(oldDiscordResult[0].values[0][0] as string) as {
          enabled?: boolean;
          botToken?: string;
          debug?: boolean;
        };
        if (oldConfig.botToken) {
          const newConfig = {
            ...DEFAULT_DISCORD_OPENCLAW_CONFIG,
            enabled: oldConfig.enabled ?? false,
            botToken: oldConfig.botToken,
            debug: oldConfig.debug ?? true,
          };
          const now = Date.now();
          this.db.run(
            'INSERT OR REPLACE INTO im_config (key, value, updated_at) VALUES (?, ?, ?)',
            ['discordOpenClaw', JSON.stringify(newConfig), now]
          );
          this.db.run('DELETE FROM im_config WHERE key = ?', ['discord']);
          changed = true;
          console.log('[IMStore] Migrated old Discord config to OpenClaw format');
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Migrate old native Feishu config to new OpenClaw format
    const oldFeishuResult2 = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['feishu']);
    const newFeishuResult = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['feishuOpenClaw']);
    if (oldFeishuResult2[0]?.values[0] && !newFeishuResult[0]?.values[0]) {
      try {
        const oldConfig = JSON.parse(oldFeishuResult2[0].values[0][0] as string) as Partial<{ enabled: boolean; appId: string; appSecret: string; domain: string; debug: boolean }>;
        if (oldConfig.appId) {
          const newConfig: FeishuOpenClawConfig = {
            ...DEFAULT_FEISHU_OPENCLAW_CONFIG,
            enabled: oldConfig.enabled ?? false,
            appId: oldConfig.appId,
            appSecret: oldConfig.appSecret ?? '',
            domain: oldConfig.domain || 'feishu',
            debug: oldConfig.debug ?? true,
          };
          const now = Date.now();
          this.db.run(
            'INSERT OR REPLACE INTO im_config (key, value, updated_at) VALUES (?, ?, ?)',
            ['feishuOpenClaw', JSON.stringify(newConfig), now]
          );
          this.db.run('DELETE FROM im_config WHERE key = ?', ['feishu']);
          changed = true;
          console.log('[IMStore] Migrated old Feishu config to OpenClaw format');
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Migrate old native DingTalk config to new OpenClaw format
    const oldDingtalkResult = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['dingtalk']);
    const newDingtalkResult = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['dingtalkOpenClaw']);
    if (oldDingtalkResult[0]?.values[0] && !newDingtalkResult[0]?.values[0]) {
      try {
        const oldConfig = JSON.parse(oldDingtalkResult[0].values[0][0] as string) as Partial<{ enabled: boolean; clientId: string; clientSecret: string; debug: boolean }>;
        if (oldConfig.clientId) {
          const newConfig: DingTalkOpenClawConfig = {
            ...DEFAULT_DINGTALK_OPENCLAW_CONFIG,
            enabled: oldConfig.enabled ?? false,
            clientId: oldConfig.clientId,
            clientSecret: oldConfig.clientSecret ?? '',
            debug: oldConfig.debug ?? false,
          };
          const now = Date.now();
          this.db.run(
            'INSERT OR REPLACE INTO im_config (key, value, updated_at) VALUES (?, ?, ?)',
            ['dingtalkOpenClaw', JSON.stringify(newConfig), now]
          );
          this.db.run('DELETE FROM im_config WHERE key = ?', ['dingtalk']);
          changed = true;
          console.log('[IMStore] Migrated old DingTalk config to OpenClaw format');
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Migrate old native WeCom config to new OpenClaw format
    const oldWecomResult = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['wecom']);
    const newWecomResult = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['wecomOpenClaw']);
    if (oldWecomResult[0]?.values[0] && !newWecomResult[0]?.values[0]) {
      try {
        const oldConfig = JSON.parse(oldWecomResult[0].values[0][0] as string) as Partial<{ enabled: boolean; botId: string; secret: string; debug: boolean }>;
        if (oldConfig.botId) {
          const newConfig: WecomOpenClawConfig = {
            ...DEFAULT_WECOM_CONFIG,
            enabled: oldConfig.enabled ?? false,
            botId: oldConfig.botId,
            secret: oldConfig.secret ?? '',
            debug: oldConfig.debug ?? true,
          };
          const now = Date.now();
          this.db.run(
            'INSERT OR REPLACE INTO im_config (key, value, updated_at) VALUES (?, ?, ?)',
            ['wecomOpenClaw', JSON.stringify(newConfig), now]
          );
          this.db.run('DELETE FROM im_config WHERE key = ?', ['wecom']);
          changed = true;
          console.log('[IMStore] Migrated old WeCom config to OpenClaw format');
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Migrate popo configs that have token but no connectionMode:
    // These are existing webhook users from before connectionMode was introduced.
    // Preserve their setup by explicitly setting connectionMode to 'webhook'.
    const popoResult = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['popo']);
    if (popoResult[0]?.values[0]) {
      try {
        const popoConfig = JSON.parse(popoResult[0].values[0][0] as string) as Partial<PopoOpenClawConfig>;
        if (popoConfig.token && !popoConfig.connectionMode) {
          popoConfig.connectionMode = 'webhook';
          const now = Date.now();
          this.db.run(
            'UPDATE im_config SET value = ?, updated_at = ? WHERE key = ?',
            [JSON.stringify(popoConfig), now, 'popo']
          );
          changed = true;
          console.log('[IMStore] Migrated popo config: inferred connectionMode=webhook from existing token');
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Migrate 'xiaomifeng' config key to 'netease-bee'
    const oldXmfResult = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['xiaomifeng']);
    const newBeeResult = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['netease-bee']);
    if (oldXmfResult[0]?.values[0] && !newBeeResult[0]?.values[0]) {
      try {
        const oldConfig = JSON.parse(oldXmfResult[0].values[0][0] as string) as Partial<NeteaseBeeChanConfig>;
        const now = Date.now();
        this.db.run(
          'INSERT INTO im_config (key, value, updated_at) VALUES (?, ?, ?)',
          ['netease-bee', JSON.stringify({ ...DEFAULT_NETEASE_BEE_CONFIG, ...oldConfig }), now]
        );
        this.db.run('DELETE FROM im_config WHERE key = ?', ['xiaomifeng']);
        changed = true;
        console.log('[IMStore] Migrated xiaomifeng config to netease-bee');
      } catch {
        // Ignore parse errors
      }
    }

    // Migrate single DingTalk config to multi-instance format
    const oldDingTalkSingle = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['dingtalkOpenClaw']);
    const existingDingTalkInstances = this.db.exec('SELECT key FROM im_config WHERE key LIKE ?', ['dingtalk:%']);
    if (oldDingTalkSingle[0]?.values[0] && !(existingDingTalkInstances[0]?.values?.length ?? 0)) {
      try {
        const oldConfig = JSON.parse(oldDingTalkSingle[0].values[0][0] as string) as DingTalkOpenClawConfig;
        const instanceId = crypto.randomUUID();
        const instanceConfig: DingTalkInstanceConfig = {
          ...DEFAULT_DINGTALK_OPENCLAW_CONFIG,
          ...oldConfig,
          instanceId,
          instanceName: 'DingTalk Bot 1',
        };
        const now = Date.now();
        this.db.run(
          'INSERT OR REPLACE INTO im_config (key, value, updated_at) VALUES (?, ?, ?)',
          [`dingtalk:${instanceId}`, JSON.stringify(instanceConfig), now]
        );
        this.db.run('DELETE FROM im_config WHERE key = ?', ['dingtalkOpenClaw']);
        const settings = this.getConfigValue<IMSettings>('settings');
        if (settings?.platformAgentBindings?.dingtalk) {
          settings.platformAgentBindings[`dingtalk:${instanceId}`] = settings.platformAgentBindings.dingtalk;
          delete settings.platformAgentBindings.dingtalk;
          this.db.run(
            'INSERT OR REPLACE INTO im_config (key, value, updated_at) VALUES (?, ?, ?)',
            ['settings', JSON.stringify(settings), now]
          );
        }
        changed = true;
      } catch {
        // Ignore parse errors
      }
    }

    // Migrate single Feishu config to multi-instance format
    const oldFeishuSingle = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['feishuOpenClaw']);
    const existingFeishuInstances = this.db.exec('SELECT key FROM im_config WHERE key LIKE ?', ['feishu:%']);
    if (oldFeishuSingle[0]?.values[0] && !(existingFeishuInstances[0]?.values?.length ?? 0)) {
      try {
        const oldConfig = JSON.parse(oldFeishuSingle[0].values[0][0] as string) as FeishuOpenClawConfig;
        const instanceId = crypto.randomUUID();
        const instanceConfig: FeishuInstanceConfig = {
          ...DEFAULT_FEISHU_OPENCLAW_CONFIG,
          ...oldConfig,
          instanceId,
          instanceName: 'Feishu Bot 1',
        };
        const now = Date.now();
        this.db.run(
          'INSERT OR REPLACE INTO im_config (key, value, updated_at) VALUES (?, ?, ?)',
          [`feishu:${instanceId}`, JSON.stringify(instanceConfig), now]
        );
        this.db.run('DELETE FROM im_config WHERE key = ?', ['feishuOpenClaw']);
        const settings = this.getConfigValue<IMSettings>('settings');
        if (settings?.platformAgentBindings?.feishu) {
          settings.platformAgentBindings[`feishu:${instanceId}`] = settings.platformAgentBindings.feishu;
          delete settings.platformAgentBindings.feishu;
          this.db.run(
            'INSERT OR REPLACE INTO im_config (key, value, updated_at) VALUES (?, ?, ?)',
            ['settings', JSON.stringify(settings), now]
          );
        }
        changed = true;
      } catch {
        // Ignore parse errors
      }
    }

    // Migrate single QQ config to multi-instance format
    const oldQQSingle = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['qq']);
    const existingQQInstances = this.db.exec('SELECT key FROM im_config WHERE key LIKE ?', ['qq:%']);
    if (oldQQSingle[0]?.values[0] && !(existingQQInstances[0]?.values?.length ?? 0)) {
      try {
        const oldConfig = JSON.parse(oldQQSingle[0].values[0][0] as string) as QQConfig;
        const instanceId = crypto.randomUUID();
        const instanceConfig: QQInstanceConfig = {
          ...DEFAULT_QQ_CONFIG,
          ...oldConfig,
          instanceId,
          instanceName: 'QQ Bot 1',
        };
        const now = Date.now();
        this.db.run(
          'INSERT OR REPLACE INTO im_config (key, value, updated_at) VALUES (?, ?, ?)',
          [`qq:${instanceId}`, JSON.stringify(instanceConfig), now]
        );
        this.db.run('DELETE FROM im_config WHERE key = ?', ['qq']);
        const settings = this.getConfigValue<IMSettings>('settings');
        if (settings?.platformAgentBindings?.qq) {
          settings.platformAgentBindings[`qq:${instanceId}`] = settings.platformAgentBindings.qq;
          delete settings.platformAgentBindings.qq;
          this.db.run(
            'INSERT OR REPLACE INTO im_config (key, value, updated_at) VALUES (?, ?, ?)',
            ['settings', JSON.stringify(settings), now]
          );
        }
        changed = true;
      } catch {
        // Ignore parse errors
      }
    }

    // Migrate single WeCom config to multi-instance format
    const oldWecomSingle = this.db.exec('SELECT value FROM im_config WHERE key = ?', ['wecomOpenClaw']);
    const existingWecomInstances = this.db.exec('SELECT key FROM im_config WHERE key LIKE ?', ['wecom:%']);
    if (oldWecomSingle[0]?.values[0] && !(existingWecomInstances[0]?.values?.length ?? 0)) {
      try {
        const oldConfig = JSON.parse(oldWecomSingle[0].values[0][0] as string) as WecomOpenClawConfig;
        const instanceId = crypto.randomUUID();
        const instanceConfig: WecomInstanceConfig = {
          ...DEFAULT_WECOM_CONFIG,
          ...oldConfig,
          instanceId,
          instanceName: 'WeCom Bot 1',
        };
        const now = Date.now();
        this.db.run(
          'INSERT OR REPLACE INTO im_config (key, value, updated_at) VALUES (?, ?, ?)',
          [`wecom:${instanceId}`, JSON.stringify(instanceConfig), now]
        );
        this.db.run('DELETE FROM im_config WHERE key = ?', ['wecomOpenClaw']);
        const settings = this.getConfigValue<IMSettings>('settings');
        if (settings?.platformAgentBindings?.wecom) {
          settings.platformAgentBindings[`wecom:${instanceId}`] = settings.platformAgentBindings.wecom;
          delete settings.platformAgentBindings.wecom;
          this.db.run(
            'INSERT OR REPLACE INTO im_config (key, value, updated_at) VALUES (?, ?, ?)',
            ['settings', JSON.stringify(settings), now]
          );
        }
        changed = true;
      } catch {
        // Ignore parse errors
      }
    }

    if (changed) {
      this.saveDb();
    }
  }

  private getConfigValue<T>(key: string): T | undefined {
    const result = this.db.exec('SELECT value FROM im_config WHERE key = ?', [key]);
    if (!result[0]?.values[0]) return undefined;
    const value = result[0].values[0][0] as string;
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.warn(`Failed to parse im_config value for ${key}`, error);
      return undefined;
    }
  }

  private setConfigValue<T>(key: string, value: T): void {
    const now = Date.now();
    this.db.run(`
      INSERT INTO im_config (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `, [key, JSON.stringify(value), now]);
    this.saveDb();
  }

  // ==================== Full Config Operations ====================

  getConfig(): IMGatewayConfig {
    const dingtalk = this.getDingTalkMultiInstanceConfig();
    const feishu = this.getFeishuMultiInstanceConfig();
    const telegram = this.getConfigValue<TelegramOpenClawConfig>('telegramOpenClaw') ?? DEFAULT_TELEGRAM_OPENCLAW_CONFIG;
    const discord = this.getConfigValue<DiscordOpenClawConfig>('discordOpenClaw') ?? DEFAULT_DISCORD_OPENCLAW_CONFIG;
    const nimConfig = this.getConfigValue<NimConfig>('nim') ?? DEFAULT_NIM_CONFIG;
    const neteaseBeeChan = this.getConfigValue<NeteaseBeeChanConfig>('netease-bee') ?? DEFAULT_NETEASE_BEE_CONFIG;
    const qq = this.getQQMultiInstanceConfig();
    const wecom = this.getWecomMultiInstanceConfig();
    const popo = this.getConfigValue<PopoOpenClawConfig>('popo') ?? DEFAULT_POPO_CONFIG;
    const weixin = this.getConfigValue<WeixinOpenClawConfig>('weixin') ?? DEFAULT_WEIXIN_CONFIG;
    const settings = this.getConfigValue<IMSettings>('settings') ?? DEFAULT_IM_SETTINGS;

    // Resolve enabled field: default to false for safety
    // User must explicitly enable the service by setting enabled: true
    const resolveEnabled = <T extends { enabled?: boolean }>(stored: T, defaults: T): T => {
      const merged = { ...defaults, ...stored };
      // If enabled is not explicitly set, default to false (safer behavior)
      if (stored.enabled === undefined) {
        return { ...merged, enabled: false };
      }
      return merged;
    };

    const resolveInstanceEnabled = <
      T extends { instances: Array<{ enabled?: boolean }> }
    >(stored: T, defaults: T): T => ({
      ...defaults,
      ...stored,
      instances: (stored.instances ?? defaults.instances).map((instance) => {
        if (instance.enabled === undefined) {
          return { ...instance, enabled: false };
        }
        return instance;
      }) as T['instances'],
    });

    return {
      dingtalk: resolveInstanceEnabled(dingtalk, DEFAULT_DINGTALK_MULTI_INSTANCE_CONFIG),
      feishu: resolveInstanceEnabled(feishu, DEFAULT_FEISHU_MULTI_INSTANCE_CONFIG),
      telegram: resolveEnabled(telegram, DEFAULT_TELEGRAM_OPENCLAW_CONFIG),
      discord: resolveEnabled(discord, DEFAULT_DISCORD_OPENCLAW_CONFIG),
      nim: resolveEnabled(nimConfig, DEFAULT_NIM_CONFIG),
      'netease-bee': resolveEnabled(neteaseBeeChan, DEFAULT_NETEASE_BEE_CONFIG),
      qq: resolveInstanceEnabled(qq, DEFAULT_QQ_MULTI_INSTANCE_CONFIG),
      wecom: resolveInstanceEnabled(wecom, DEFAULT_WECOM_MULTI_INSTANCE_CONFIG),
      popo: resolveEnabled(popo, DEFAULT_POPO_CONFIG),
      weixin: resolveEnabled(weixin, DEFAULT_WEIXIN_CONFIG),
      settings: { ...DEFAULT_IM_SETTINGS, ...settings },
    };
  }

  setConfig(config: Partial<IMGatewayConfig>): void {
    if (config.dingtalk) {
      this.setDingTalkMultiInstanceConfig(config.dingtalk);
    }
    if (config.feishu) {
      this.setFeishuMultiInstanceConfig(config.feishu);
    }
    if (config.telegram) {
      this.setTelegramOpenClawConfig(config.telegram);
    }
    if (config.discord) {
      this.setDiscordOpenClawConfig(config.discord);
    }
    if (config.nim) {
      this.setNimConfig(config.nim);
    }
    if (config['netease-bee']) {
      this.setNeteaseBeeChanConfig(config['netease-bee']);
    }
    if (config.qq) {
      this.setQQMultiInstanceConfig(config.qq);
    }
    if (config.wecom) {
      this.setWecomMultiInstanceConfig(config.wecom);
    }
    if (config.popo) {
      this.setPopoConfig(config.popo);
    }
    if (config.weixin) {
      this.setWeixinConfig(config.weixin);
    }
    if (config.settings) {
      this.setIMSettings(config.settings);
    }
  }

  // ==================== DingTalk OpenClaw Config ====================

  getDingTalkOpenClawConfig(): DingTalkOpenClawConfig {
    return this.getDingTalkInstances()[0] ?? { ...DEFAULT_DINGTALK_OPENCLAW_CONFIG };
  }

  setDingTalkOpenClawConfig(config: Partial<DingTalkOpenClawConfig>): void {
    const current = this.getDingTalkInstances()[0];
    if (current) {
      this.setDingTalkInstanceConfig(current.instanceId, config);
      return;
    }
    const instanceId = crypto.randomUUID();
    this.setDingTalkInstanceConfig(instanceId, {
      ...config,
      instanceId,
      instanceName: 'DingTalk Bot 1',
    });
  }

  getDingTalkInstances(): DingTalkInstanceConfig[] {
    const result = this.db.exec('SELECT key, value FROM im_config WHERE key LIKE ?', ['dingtalk:%']);
    const rows = result[0]?.values ?? [];
    return rows.flatMap((row) => {
      try {
        const config = JSON.parse(row[1] as string) as DingTalkInstanceConfig;
        return [{ ...DEFAULT_DINGTALK_OPENCLAW_CONFIG, ...config }];
      } catch {
        return [];
      }
    });
  }

  getDingTalkInstanceConfig(instanceId: string): DingTalkInstanceConfig | null {
    const stored = this.getConfigValue<DingTalkInstanceConfig>(`dingtalk:${instanceId}`);
    return stored ? { ...DEFAULT_DINGTALK_OPENCLAW_CONFIG, ...stored } : null;
  }

  setDingTalkInstanceConfig(instanceId: string, config: Partial<DingTalkInstanceConfig>): void {
    const current = this.getDingTalkInstanceConfig(instanceId);
    this.setConfigValue(`dingtalk:${instanceId}`, current
      ? { ...current, ...config }
      : {
          ...DEFAULT_DINGTALK_OPENCLAW_CONFIG,
          instanceId,
          instanceName: config.instanceName || 'DingTalk Bot',
          ...config,
        });
  }

  deleteDingTalkInstance(instanceId: string): void {
    const settings = this.getIMSettings();
    const bindingKey = `dingtalk:${instanceId}`;
    if (settings.platformAgentBindings?.[bindingKey]) {
      delete settings.platformAgentBindings[bindingKey];
      this.setIMSettings({ platformAgentBindings: settings.platformAgentBindings });
    }
    this.db.run('DELETE FROM im_config WHERE key = ?', [`dingtalk:${instanceId}`]);
    this.saveDb();
  }

  getDingTalkMultiInstanceConfig(): DingTalkMultiInstanceConfig {
    const instances = this.getDingTalkInstances();
    return instances.length > 0 ? { instances } : DEFAULT_DINGTALK_MULTI_INSTANCE_CONFIG;
  }

  setDingTalkMultiInstanceConfig(config: DingTalkMultiInstanceConfig): void {
    for (const instance of config.instances) {
      this.setDingTalkInstanceConfig(instance.instanceId, instance);
    }
  }

  // ==================== Feishu OpenClaw Config ====================

  getFeishuOpenClawConfig(): FeishuOpenClawConfig {
    return this.getFeishuInstances()[0] ?? { ...DEFAULT_FEISHU_OPENCLAW_CONFIG };
  }

  setFeishuOpenClawConfig(config: Partial<FeishuOpenClawConfig>): void {
    const current = this.getFeishuInstances()[0];
    if (current) {
      this.setFeishuInstanceConfig(current.instanceId, config);
      return;
    }
    const instanceId = crypto.randomUUID();
    this.setFeishuInstanceConfig(instanceId, {
      ...config,
      instanceId,
      instanceName: 'Feishu Bot 1',
    });
  }

  getFeishuInstances(): FeishuInstanceConfig[] {
    const result = this.db.exec('SELECT key, value FROM im_config WHERE key LIKE ?', ['feishu:%']);
    const rows = result[0]?.values ?? [];
    return rows.flatMap((row) => {
      try {
        const config = JSON.parse(row[1] as string) as FeishuInstanceConfig;
        return [{ ...DEFAULT_FEISHU_OPENCLAW_CONFIG, ...config }];
      } catch {
        return [];
      }
    });
  }

  getFeishuInstanceConfig(instanceId: string): FeishuInstanceConfig | null {
    const stored = this.getConfigValue<FeishuInstanceConfig>(`feishu:${instanceId}`);
    return stored ? { ...DEFAULT_FEISHU_OPENCLAW_CONFIG, ...stored } : null;
  }

  setFeishuInstanceConfig(instanceId: string, config: Partial<FeishuInstanceConfig>): void {
    const current = this.getFeishuInstanceConfig(instanceId);
    this.setConfigValue(`feishu:${instanceId}`, current
      ? { ...current, ...config }
      : {
          ...DEFAULT_FEISHU_OPENCLAW_CONFIG,
          instanceId,
          instanceName: config.instanceName || 'Feishu Bot',
          ...config,
        });
  }

  deleteFeishuInstance(instanceId: string): void {
    const settings = this.getIMSettings();
    const bindingKey = `feishu:${instanceId}`;
    if (settings.platformAgentBindings?.[bindingKey]) {
      delete settings.platformAgentBindings[bindingKey];
      this.setIMSettings({ platformAgentBindings: settings.platformAgentBindings });
    }
    this.db.run('DELETE FROM im_config WHERE key = ?', [`feishu:${instanceId}`]);
    this.saveDb();
  }

  getFeishuMultiInstanceConfig(): FeishuMultiInstanceConfig {
    const instances = this.getFeishuInstances();
    return instances.length > 0 ? { instances } : DEFAULT_FEISHU_MULTI_INSTANCE_CONFIG;
  }

  setFeishuMultiInstanceConfig(config: FeishuMultiInstanceConfig): void {
    for (const instance of config.instances) {
      this.setFeishuInstanceConfig(instance.instanceId, instance);
    }
  }

  // ==================== Discord OpenClaw Config ====================

  getDiscordOpenClawConfig(): DiscordOpenClawConfig {
    const stored = this.getConfigValue<DiscordOpenClawConfig>('discordOpenClaw');
    return { ...DEFAULT_DISCORD_OPENCLAW_CONFIG, ...stored };
  }

  setDiscordOpenClawConfig(config: Partial<DiscordOpenClawConfig>): void {
    const current = this.getDiscordOpenClawConfig();
    this.setConfigValue('discordOpenClaw', { ...current, ...config });
  }

  // ==================== NIM Config ====================

  getNimConfig(): NimConfig {
    const stored = this.getConfigValue<NimConfig>('nim');
    return { ...DEFAULT_NIM_CONFIG, ...stored };
  }

  setNimConfig(config: Partial<NimConfig>): void {
    const current = this.getNimConfig();
    this.setConfigValue('nim', { ...current, ...config });
  }

  // ==================== NeteaseBee Chan Config ====================

  getNeteaseBeeChanConfig(): NeteaseBeeChanConfig {
    const stored = this.getConfigValue<NeteaseBeeChanConfig>('netease-bee');
    return { ...DEFAULT_NETEASE_BEE_CONFIG, ...stored };
  }

  setNeteaseBeeChanConfig(config: Partial<NeteaseBeeChanConfig>): void {
    const current = this.getNeteaseBeeChanConfig();
    this.setConfigValue('netease-bee', { ...current, ...config });
  }

  // ==================== Telegram OpenClaw Config ====================

  getTelegramOpenClawConfig(): TelegramOpenClawConfig {
    const stored = this.getConfigValue<TelegramOpenClawConfig>('telegramOpenClaw');
    return { ...DEFAULT_TELEGRAM_OPENCLAW_CONFIG, ...stored };
  }

  setTelegramOpenClawConfig(config: Partial<TelegramOpenClawConfig>): void {
    const current = this.getTelegramOpenClawConfig();
    this.setConfigValue('telegramOpenClaw', { ...current, ...config });
  }

  // ==================== QQ Config ====================

  getQQConfig(): QQConfig {
    return this.getQQInstances()[0] ?? { ...DEFAULT_QQ_CONFIG };
  }

  setQQConfig(config: Partial<QQConfig>): void {
    const current = this.getQQInstances()[0];
    if (current) {
      this.setQQInstanceConfig(current.instanceId, config);
      return;
    }
    const instanceId = crypto.randomUUID();
    this.setQQInstanceConfig(instanceId, {
      ...config,
      instanceId,
      instanceName: 'QQ Bot 1',
    });
  }

  getQQInstances(): QQInstanceConfig[] {
    const result = this.db.exec('SELECT key, value FROM im_config WHERE key LIKE ?', ['qq:%']);
    const rows = result[0]?.values ?? [];
    return rows.flatMap((row) => {
      try {
        const config = JSON.parse(row[1] as string) as QQInstanceConfig;
        return [{ ...DEFAULT_QQ_CONFIG, ...config }];
      } catch {
        return [];
      }
    });
  }

  getQQInstanceConfig(instanceId: string): QQInstanceConfig | null {
    const stored = this.getConfigValue<QQInstanceConfig>(`qq:${instanceId}`);
    return stored ? { ...DEFAULT_QQ_CONFIG, ...stored } : null;
  }

  setQQInstanceConfig(instanceId: string, config: Partial<QQInstanceConfig>): void {
    const current = this.getQQInstanceConfig(instanceId);
    this.setConfigValue(`qq:${instanceId}`, current
      ? { ...current, ...config }
      : {
          ...DEFAULT_QQ_CONFIG,
          instanceId,
          instanceName: config.instanceName || 'QQ Bot',
          ...config,
        });
  }

  deleteQQInstance(instanceId: string): void {
    const settings = this.getIMSettings();
    const bindingKey = `qq:${instanceId}`;
    if (settings.platformAgentBindings?.[bindingKey]) {
      delete settings.platformAgentBindings[bindingKey];
      this.setIMSettings({ platformAgentBindings: settings.platformAgentBindings });
    }
    this.db.run('DELETE FROM im_config WHERE key = ?', [`qq:${instanceId}`]);
    this.saveDb();
  }

  getQQMultiInstanceConfig(): QQMultiInstanceConfig {
    const instances = this.getQQInstances();
    return instances.length > 0 ? { instances } : DEFAULT_QQ_MULTI_INSTANCE_CONFIG;
  }

  setQQMultiInstanceConfig(config: QQMultiInstanceConfig): void {
    for (const instance of config.instances) {
      this.setQQInstanceConfig(instance.instanceId, instance);
    }
  }

  // ==================== WeCom OpenClaw Config ====================

  getWecomConfig(): WecomOpenClawConfig {
    return this.getWecomInstances()[0] ?? { ...DEFAULT_WECOM_CONFIG };
  }

  setWecomConfig(config: Partial<WecomOpenClawConfig>): void {
    const current = this.getWecomInstances()[0];
    if (current) {
      this.setWecomInstanceConfig(current.instanceId, config);
      return;
    }
    const instanceId = crypto.randomUUID();
    this.setWecomInstanceConfig(instanceId, {
      ...config,
      instanceId,
      instanceName: 'WeCom Bot 1',
    });
  }

  getWecomInstances(): WecomInstanceConfig[] {
    const result = this.db.exec('SELECT key, value FROM im_config WHERE key LIKE ?', ['wecom:%']);
    const rows = result[0]?.values ?? [];
    return rows.flatMap((row) => {
      try {
        const config = JSON.parse(row[1] as string) as WecomInstanceConfig;
        return [{ ...DEFAULT_WECOM_CONFIG, ...config }];
      } catch {
        return [];
      }
    });
  }

  getWecomInstanceConfig(instanceId: string): WecomInstanceConfig | null {
    const stored = this.getConfigValue<WecomInstanceConfig>(`wecom:${instanceId}`);
    return stored ? { ...DEFAULT_WECOM_CONFIG, ...stored } : null;
  }

  setWecomInstanceConfig(instanceId: string, config: Partial<WecomInstanceConfig>): void {
    const current = this.getWecomInstanceConfig(instanceId);
    this.setConfigValue(`wecom:${instanceId}`, current
      ? { ...current, ...config }
      : {
          ...DEFAULT_WECOM_CONFIG,
          instanceId,
          instanceName: config.instanceName || 'WeCom Bot',
          ...config,
        });
  }

  deleteWecomInstance(instanceId: string): void {
    const settings = this.getIMSettings();
    const bindingKey = `wecom:${instanceId}`;
    if (settings.platformAgentBindings?.[bindingKey]) {
      delete settings.platformAgentBindings[bindingKey];
      this.setIMSettings({ platformAgentBindings: settings.platformAgentBindings });
    }
    this.db.run('DELETE FROM im_config WHERE key = ?', [`wecom:${instanceId}`]);
    this.saveDb();
  }

  getWecomMultiInstanceConfig(): WecomMultiInstanceConfig {
    const instances = this.getWecomInstances();
    return instances.length > 0 ? { instances } : DEFAULT_WECOM_MULTI_INSTANCE_CONFIG;
  }

  setWecomMultiInstanceConfig(config: WecomMultiInstanceConfig): void {
    for (const instance of config.instances) {
      this.setWecomInstanceConfig(instance.instanceId, instance);
    }
  }

  // ==================== POPO ====================

  getPopoConfig(): PopoOpenClawConfig {
    const stored = this.getConfigValue<PopoOpenClawConfig>('popo');
    return { ...DEFAULT_POPO_CONFIG, ...stored };
  }

  setPopoConfig(config: Partial<PopoOpenClawConfig>): void {
    const current = this.getPopoConfig();
    this.setConfigValue('popo', { ...current, ...config });
  }

  // ==================== Weixin (微信) ====================

  getWeixinConfig(): WeixinOpenClawConfig {
    const stored = this.getConfigValue<WeixinOpenClawConfig>('weixin');
    return { ...DEFAULT_WEIXIN_CONFIG, ...stored };
  }

  setWeixinConfig(config: Partial<WeixinOpenClawConfig>): void {
    const current = this.getWeixinConfig();
    this.setConfigValue('weixin', { ...current, ...config });
  }

  // ==================== IM Settings ====================

  getIMSettings(): IMSettings {
    const stored = this.getConfigValue<IMSettings>('settings');
    return { ...DEFAULT_IM_SETTINGS, ...stored };
  }

  setIMSettings(settings: Partial<IMSettings>): void {
    const current = this.getIMSettings();
    this.setConfigValue('settings', { ...current, ...settings });
  }

  // ==================== Utility ====================

  /**
   * Clear all IM configuration
   */
  clearConfig(): void {
    this.db.run('DELETE FROM im_config');
    this.saveDb();
  }

  /**
   * Check if IM is configured (at least one platform has credentials)
   */
  isConfigured(): boolean {
    const config = this.getConfig();
    const hasDingTalk = this.getDingTalkInstances().some((instance) => !!(instance.clientId && instance.clientSecret));
    const hasFeishu = this.getFeishuInstances().some((instance) => !!(instance.appId && instance.appSecret));
    const hasTelegram = !!config.telegram.botToken;
    const hasDiscord = !!config.discord.botToken;
    const hasNim = !!(config.nim.appKey && config.nim.account && config.nim.token);
    const hasNeteaseBeeChan = !!(config['netease-bee']?.clientId && config['netease-bee']?.secret);
    const hasQQ = this.getQQInstances().some((instance) => !!(instance.appId && instance.appSecret));
    const hasWecom = this.getWecomInstances().some((instance) => !!(instance.botId && instance.secret));
    return hasDingTalk || hasFeishu || hasTelegram || hasDiscord || hasNim || hasNeteaseBeeChan || hasQQ || hasWecom;
  }

  // ==================== Notification Target Persistence ====================

  /**
   * Get persisted notification target for a platform
   */
  getNotificationTarget(platform: Platform): any | null {
    return this.getConfigValue<any>(`notification_target:${platform}`) ?? null;
  }

  /**
   * Persist notification target for a platform
   */
  setNotificationTarget(platform: Platform, target: any): void {
    this.setConfigValue(`notification_target:${platform}`, target);
  }

  getConversationReplyRoute(
    platform: Platform,
    conversationId: string,
  ): StoredConversationReplyRoute | null {
    const normalizedConversationId = conversationId.trim();
    if (!normalizedConversationId) {
      return null;
    }
    return this.getConfigValue<StoredConversationReplyRoute>(
      `conversation_reply_route:${platform}:${normalizedConversationId}`,
    ) ?? null;
  }

  setConversationReplyRoute(
    platform: Platform,
    conversationId: string,
    route: StoredConversationReplyRoute,
  ): void {
    const normalizedConversationId = conversationId.trim();
    if (!normalizedConversationId) {
      return;
    }
    this.setConfigValue(`conversation_reply_route:${platform}:${normalizedConversationId}`, route);
  }

  // ==================== Session Mapping Operations ====================

  /**
   * Get session mapping by IM conversation ID and platform
   */
  getSessionMapping(imConversationId: string, platform: Platform): IMSessionMapping | null {
    const result = this.db.exec(
      'SELECT im_conversation_id, platform, cowork_session_id, agent_id, openclaw_session_key, created_at, last_active_at FROM im_session_mappings WHERE im_conversation_id = ? AND platform = ?',
      [imConversationId, platform]
    );
    if (!result[0]?.values[0]) return null;
    const row = result[0].values[0];
    return {
      imConversationId: row[0] as string,
      platform: row[1] as Platform,
      coworkSessionId: row[2] as string,
      agentId: (row[3] as string) || 'main',
      ...(row[4] ? { openClawSessionKey: row[4] as string } : {}),
      createdAt: row[5] as number,
      lastActiveAt: row[6] as number,
    };
  }

  /**
   * Find the IM mapping that owns a given cowork session ID.
   */
  getSessionMappingByCoworkSessionId(coworkSessionId: string): IMSessionMapping | null {
    const result = this.db.exec(
      'SELECT im_conversation_id, platform, cowork_session_id, agent_id, openclaw_session_key, created_at, last_active_at FROM im_session_mappings WHERE cowork_session_id = ? LIMIT 1',
      [coworkSessionId]
    );
    if (!result[0]?.values[0]) return null;
    const row = result[0].values[0];
    return {
      imConversationId: row[0] as string,
      platform: row[1] as Platform,
      coworkSessionId: row[2] as string,
      agentId: (row[3] as string) || 'main',
      ...(row[4] ? { openClawSessionKey: row[4] as string } : {}),
      createdAt: row[5] as number,
      lastActiveAt: row[6] as number,
    };
  }

  /**
   * Create a new session mapping
   */
  createSessionMapping(
    imConversationId: string,
    platform: Platform,
    coworkSessionId: string,
    agentId: string = 'main',
    openClawSessionKey: string = '',
  ): IMSessionMapping {
    const now = Date.now();
    const normalizedOpenClawSessionKey = openClawSessionKey.trim();
    this.db.run(
      'INSERT INTO im_session_mappings (im_conversation_id, platform, cowork_session_id, agent_id, openclaw_session_key, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [imConversationId, platform, coworkSessionId, agentId, normalizedOpenClawSessionKey || null, now, now]
    );
    this.saveDb();
    return {
      imConversationId,
      platform,
      coworkSessionId,
      agentId,
      ...(normalizedOpenClawSessionKey ? { openClawSessionKey: normalizedOpenClawSessionKey } : {}),
      createdAt: now,
      lastActiveAt: now,
    };
  }

  /**
   * Update last active time for a session mapping
   */
  updateSessionLastActive(imConversationId: string, platform: Platform): void {
    const now = Date.now();
    this.db.run(
      'UPDATE im_session_mappings SET last_active_at = ? WHERE im_conversation_id = ? AND platform = ?',
      [now, imConversationId, platform]
    );
    this.saveDb();
  }

  /**
   * Update the target session and agent for an existing mapping.
   * Used when the platform's agent binding changes.
   */
  updateSessionMappingTarget(
    imConversationId: string,
    platform: Platform,
    newCoworkSessionId: string,
    newAgentId: string,
    newOpenClawSessionKey?: string,
  ): void {
    const now = Date.now();
    const normalizedOpenClawSessionKey = newOpenClawSessionKey?.trim() || null;
    this.db.run(
      'UPDATE im_session_mappings SET cowork_session_id = ?, agent_id = ?, openclaw_session_key = COALESCE(?, openclaw_session_key), last_active_at = ? WHERE im_conversation_id = ? AND platform = ?',
      [newCoworkSessionId, newAgentId, normalizedOpenClawSessionKey, now, imConversationId, platform]
    );
    this.saveDb();
  }

  updateSessionOpenClawSessionKey(
    imConversationId: string,
    platform: Platform,
    openClawSessionKey: string,
  ): void {
    const normalizedKey = openClawSessionKey.trim();
    if (!normalizedKey) return;
    const now = Date.now();
    this.db.run(
      'UPDATE im_session_mappings SET openclaw_session_key = ?, last_active_at = ? WHERE im_conversation_id = ? AND platform = ?',
      [normalizedKey, now, imConversationId, platform]
    );
    this.saveDb();
  }

  /**
   * Delete a session mapping
   */
  deleteSessionMapping(imConversationId: string, platform: Platform): void {
    this.db.run(
      'DELETE FROM im_session_mappings WHERE im_conversation_id = ? AND platform = ?',
      [imConversationId, platform]
    );
    this.saveDb();
  }

  /**
   * Delete all session mappings that reference a given cowork session ID.
   * Called when a cowork session is deleted so that the IM conversation
   * can be re-synced as a fresh session.
   */
  deleteSessionMappingByCoworkSessionId(coworkSessionId: string): void {
    this.db.run(
      'DELETE FROM im_session_mappings WHERE cowork_session_id = ?',
      [coworkSessionId]
    );
    this.saveDb();
  }

  /**
   * List all session mappings for a platform, optionally filtered by IM bot accountId.
   */
  listSessionMappings(platform?: Platform, accountId?: string): IMSessionMapping[] {
    let query: string;
    let params: string[] = [];

    if (platform && accountId) {
      query = "SELECT im_conversation_id, platform, cowork_session_id, agent_id, openclaw_session_key, created_at, last_active_at FROM im_session_mappings WHERE platform = ? AND (im_conversation_id LIKE ? OR im_conversation_id LIKE 'group:%') ORDER BY last_active_at DESC";
      params = [platform, `${accountId}:%`];
    } else if (platform) {
      query = 'SELECT im_conversation_id, platform, cowork_session_id, agent_id, openclaw_session_key, created_at, last_active_at FROM im_session_mappings WHERE platform = ? ORDER BY last_active_at DESC';
      params = [platform];
    } else {
      query = 'SELECT im_conversation_id, platform, cowork_session_id, agent_id, openclaw_session_key, created_at, last_active_at FROM im_session_mappings ORDER BY last_active_at DESC';
    }

    const result = this.db.exec(query, params);
    if (!result[0]?.values) return [];
    return result[0].values.map(row => ({
      imConversationId: row[0] as string,
      platform: row[1] as Platform,
      coworkSessionId: row[2] as string,
      agentId: (row[3] as string) || 'main',
      ...(row[4] ? { openClawSessionKey: row[4] as string } : {}),
      createdAt: row[5] as number,
      lastActiveAt: row[6] as number,
    }));
  }
}
