/**
 * IM Gateway Manager
 * Unified manager for DingTalk, Feishu, NIM gateways
 * and Telegram, Discord, QQ, WeCom, Weixin, POPO, NeteaseBee via OpenClaw
 */

import type * as FeishuAuthModule from '@larksuite/openclaw-lark-tools/dist/utils/feishu-auth.js';
import type * as LarkSdk from '@larksuiteoapi/node-sdk';
import type Database from 'better-sqlite3';
import { EventEmitter } from 'events';

import { classifyErrorKey } from '../../common/coworkErrorClassify';
import type { CoworkStore } from '../coworkStore';
import { t } from '../i18n';
import type { CoworkRuntime } from '../libs/agentEngine/types';
import { fetchJsonWithTimeout } from './http';
import { IMChatHandler } from './imChatHandler';
import { IMCoworkHandler } from './imCoworkHandler';
import {
  buildDingTalkSendParamsFromRoute,
  buildDingTalkSessionKeyCandidates,
  type OpenClawDeliveryRoute,
  resolveManagedSessionDeliveryRoute,
  resolveOpenClawDeliveryRouteForSessionKeys,
} from './imDeliveryRoute';
import {
  isAnyGatewayConnected,
  isPlatformEnabled,
  pickConfiguredInstance,
} from './imGatewayConfigState';
import type {
  IMScheduledTaskCreationResult,
  ParsedIMScheduledTaskRequest,
} from './imScheduledTaskHandler';
import { createIMScheduledTaskRequestDetector } from './imScheduledTaskHandler';
import { IMStore } from './imStore';
import { NimGateway } from './nimGateway';
import {
  IMConnectivityCheck,
  IMConnectivityTestResult,
  IMConnectivityVerdict,
  IMGatewayConfig,
  IMGatewayStatus,
  IMLLMConfig,
  IMMessage,
  NimConfig,
  PopoOpenClawConfig,
  Platform,
} from './types';
const WEIXIN_OPENCLAW_CHANNEL = 'openclaw-weixin';
const WEIXIN_ALREADY_CONNECTED_MESSAGE = '已连接过此 OpenClaw';
const CONNECTIVITY_TIMEOUT_MS = 10_000;
const INBOUND_ACTIVITY_WARN_AFTER_MS = 2 * 60 * 1000;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type GatewayClientLike = {
  request: <T = Record<string, unknown>>(
    method: string,
    params?: unknown,
    opts?: { expectFinal?: boolean },
  ) => Promise<T>;
};

const pickConfiguredNimInstance = (config: IMGatewayConfig) => pickConfiguredInstance(
  config.nim?.instances ?? [],
  (instance) => Boolean(
    (instance.nimToken && instance.nimToken.trim())
    || (instance.appKey && instance.account && instance.token),
  ),
);

const pickConfiguredPopoInstance = (config: IMGatewayConfig) => pickConfiguredInstance(
  config.popo?.instances ?? [],
  (instance) => Boolean(
    instance.appKey
    && instance.appSecret
    && instance.aesKey
    && ((instance.connectionMode ?? 'websocket') === 'websocket' || instance.token),
  ),
);

const mergeNimConfigOverride = (
  current: IMGatewayConfig['nim'],
  override?: Partial<IMGatewayConfig['nim'] & NimConfig>,
): IMGatewayConfig['nim'] => {
  if (!override) {
    return current;
  }
  if (Array.isArray(override.instances)) {
    return { ...current, ...override };
  }
  const { instances: _instances, ...singleConfig } = override;
  return {
    ...current,
    ...singleConfig,
    instances: [{
      ...current.instances[0],
      instanceId: current.instances[0]?.instanceId ?? 'nim-override',
      instanceName: current.instances[0]?.instanceName ?? 'NIM Bot',
      ...singleConfig,
    }],
  };
};

const mergePopoConfigOverride = (
  current: IMGatewayConfig['popo'],
  override?: Partial<IMGatewayConfig['popo'] & PopoOpenClawConfig>,
): IMGatewayConfig['popo'] => {
  if (!override) {
    return current;
  }
  if (Array.isArray(override.instances)) {
    return { ...current, ...override };
  }
  const { instances: _instances, ...singleConfig } = override;
  return {
    ...current,
    ...singleConfig,
    instances: [{
      ...current.instances[0],
      instanceId: current.instances[0]?.instanceId ?? 'popo-override',
      instanceName: current.instances[0]?.instanceName ?? 'POPO Bot',
      ...singleConfig,
    }],
  };
};

interface OpenClawSessionsListResult {
  sessions?: unknown[];
}

interface WeixinQrLoginStartResult {
  qrDataUrl?: string;
  message: string;
  sessionKey?: string;
}

interface WeixinQrLoginWaitResult {
  connected: boolean;
  message: string;
  accountId?: string;
  alreadyConnected?: boolean;
}

interface OpenClawChannelAccountSnapshot {
  accountId?: unknown;
  running?: unknown;
  configured?: unknown;
  enabled?: unknown;
  lastError?: unknown;
  lastStartAt?: unknown;
  lastInboundAt?: unknown;
  lastOutboundAt?: unknown;
}

interface OpenClawChannelsStatusResult {
  channelAccounts?: Record<string, unknown>;
}

interface TelegramGetMeResponse {
  ok?: boolean;
  result?: {
    username?: string;
  };
  description?: string;
}

interface DiscordUserResponse {
  username?: string;
  discriminator?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isWeixinAlreadyConnectedMessage(message?: string): boolean {
  return Boolean(message?.includes(WEIXIN_ALREADY_CONNECTED_MESSAGE));
}

type FeishuBotInfoResponse = {
  code: number;
  msg?: string;
  data?: {
    app_name?: string;
    bot?: {
      app_name?: string;
    };
  };
};

export interface IMGatewayManagerOptions {
  coworkRuntime?: CoworkRuntime;
  coworkStore?: CoworkStore;
  ensureCoworkReady?: () => Promise<void>;
  isOpenClawEngine?: () => boolean;
  syncOpenClawConfig?: () => Promise<void>;
  ensureOpenClawGatewayConnected?: () => Promise<void>;
  getOpenClawGatewayClient?: () => GatewayClientLike | null;
  ensureOpenClawGatewayReady?: () => Promise<void>;
  getOpenClawSessionKeysForCoworkSession?: (sessionId: string) => string[];
  createScheduledTask?: (params: {
    sessionId: string;
    message: IMMessage;
    request: ParsedIMScheduledTaskRequest;
  }) => Promise<IMScheduledTaskCreationResult>;
}

export class IMGatewayManager extends EventEmitter {
  private nimGateway: NimGateway;
  private imStore: IMStore;
  private chatHandler: IMChatHandler | null = null;
  private coworkHandler: IMCoworkHandler | null = null;
  private getLLMConfig: (() => Promise<IMLLMConfig | null>) | null = null;
  private getSkillsPrompt: (() => Promise<string | null>) | null = null;
  private ensureCoworkReady: (() => Promise<void>) | null = null;
  private isOpenClawEngine: (() => boolean) | null = null;
  private syncOpenClawConfig: (() => Promise<void>) | null = null;
  private ensureOpenClawGatewayConnected: (() => Promise<void>) | null = null;
  private getOpenClawGatewayClient: (() => GatewayClientLike | null) | null = null;
  private ensureOpenClawGatewayReady: (() => Promise<void>) | null = null;
  private getOpenClawSessionKeysForCoworkSession: ((sessionId: string) => string[]) | null = null;
  private createScheduledTask:
    | ((params: {
        sessionId: string;
        message: IMMessage;
        request: ParsedIMScheduledTaskRequest;
      }) => Promise<IMScheduledTaskCreationResult>)
    | null = null;

  // Cowork dependencies
  private coworkRuntime: CoworkRuntime | null = null;
  private coworkStore: CoworkStore | null = null;


  // DingTalk direct HTTP API token cache
  private dingTalkAccessToken: string | null = null;
  private dingTalkAccessTokenExpiry = 0;

  constructor(db: Database.Database, saveDb: () => void, options?: IMGatewayManagerOptions) {
    super();

    this.imStore = new IMStore(db, saveDb);
    this.nimGateway = new NimGateway();

    // Store Cowork dependencies if provided
    if (options?.coworkRuntime && options?.coworkStore) {
      this.coworkRuntime = options.coworkRuntime;
      this.coworkStore = options.coworkStore;
    }
    this.ensureCoworkReady = options?.ensureCoworkReady ?? null;
    this.isOpenClawEngine = options?.isOpenClawEngine ?? null;
    this.syncOpenClawConfig = options?.syncOpenClawConfig ?? null;
    this.ensureOpenClawGatewayConnected = options?.ensureOpenClawGatewayConnected ?? null;
    this.getOpenClawGatewayClient = options?.getOpenClawGatewayClient ?? null;
    this.ensureOpenClawGatewayReady = options?.ensureOpenClawGatewayReady ?? null;
    this.getOpenClawSessionKeysForCoworkSession = options?.getOpenClawSessionKeysForCoworkSession ?? null;
    this.createScheduledTask = options?.createScheduledTask ?? null;

    // Forward gateway events
    this.setupGatewayEventForwarding();
  }

  /**
   * Set up event forwarding from gateways
   */
  private setupGatewayEventForwarding(): void {
    // DingTalk runs via OpenClaw; no direct gateway events to forward

    // NIM runs via OpenClaw; no direct gateway events to forward

    // netease-bee runs via OpenClaw; no direct gateway events to forward

    // QQ runs via OpenClaw; no direct gateway events to forward

    // WeCom runs via OpenClaw; no direct gateway events to forward

    // Weixin runs via OpenClaw; no direct gateway events to forward

    // POPO runs via OpenClaw; no direct gateway events to forward
  }

  /**
   * Reconnect all disconnected gateways
   * Called when network is restored via IPC event
   */
  reconnectAllDisconnected(): void {
    console.log('[IMGatewayManager] Reconnecting all disconnected gateways...');

    // DingTalk runs via OpenClaw; no direct reconnect needed

    // NIM runs via OpenClaw; no direct reconnect needed

    // netease-bee runs via OpenClaw; no direct reconnect needed

    // QQ runs via OpenClaw; no direct reconnection needed

    // WeCom runs via OpenClaw; no direct reconnection needed

    // Weixin runs via OpenClaw; no direct reconnection needed

    // POPO runs via OpenClaw; no direct reconnection needed
  }

  /**
   * Initialize the manager with LLM and skills providers
   */
  initialize(options: {
    getLLMConfig: () => Promise<IMLLMConfig | null>;
    getSkillsPrompt?: () => Promise<string | null>;
  }): void {
    this.getLLMConfig = options.getLLMConfig;
    this.getSkillsPrompt = options.getSkillsPrompt ?? null;

    // Set up message handlers for gateways
    this.setupMessageHandlers();
  }

  /**
   * Set up message handlers for both gateways
   */
  private setupMessageHandlers(): void {
    const messageHandler = async (
      message: IMMessage,
      replyFn: (text: string) => Promise<void>
    ): Promise<void> => {
      // Persist notification target whenever we receive a message
      this.persistNotificationTarget(message.platform);

      try {
        let response: string;

        // Always use Cowork mode if handler is available
        if (this.coworkHandler) {
          if (this.ensureCoworkReady) {
            await this.ensureCoworkReady();
          }
          console.log('[IMGatewayManager] Using Cowork mode for message processing');
          response = await this.coworkHandler.processMessage(message);
        } else {
          // Fallback to regular chat handler
          if (!this.chatHandler) {
            this.updateChatHandler();
          }

          if (!this.chatHandler) {
            throw new Error('Chat handler not available');
          }

          response = await this.chatHandler.processMessage(message);
        }

        await replyFn(response);
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        console.error(`[IMGatewayManager] Error processing message: ${errorMessage}`);
        // Don't send "Replaced by a newer IM request" error to user, just log it
        if (errorMessage === 'Replaced by a newer IM request') {
          return;
        }
        // Send error message to user
        try {
          const errorKey = classifyErrorKey(errorMessage);
          const friendlyMessage = errorKey ? t(errorKey) : errorMessage;
          await replyFn(`${t('imErrorPrefix')}: ${friendlyMessage}`);
        } catch (replyError) {
          console.error(`[IMGatewayManager] Failed to send error reply: ${replyError}`);
        }
      }
    };

    this.nimGateway.setMessageCallback(messageHandler);
  }

  /**
   * Persist the notification target for a platform after receiving a message.
   */
  private persistNotificationTarget(platform: Platform): void {
    try {
      let target: string | null = null;
      if (platform === 'nim') {
        target = this.nimGateway.getNotificationTarget();
      }
      // WeCom runs via OpenClaw; notification target not managed locally
      // Weixin runs via OpenClaw; notification target not managed locally
      // POPO runs via OpenClaw; notification target not managed locally
      if (target != null) {
        this.imStore.setNotificationTarget(platform, target);
      }
    } catch (err) {
      console.warn(`[IMGatewayManager] Failed to persist notification target for ${platform}:`, getErrorMessage(err));
    }
  }

  /**
   * Restore notification target from SQLite after gateway starts.
   */
  private restoreNotificationTarget(platform: Platform): void {
    try {
      const target = this.imStore.getNotificationTarget(platform);
      if (target == null) return;

      if (platform === 'nim') {
        this.nimGateway.setNotificationTarget(target);
      }
      // WeCom runs via OpenClaw; notification target not managed locally
      // Weixin runs via OpenClaw; notification target not managed locally
      // POPO runs via OpenClaw; notification target not managed locally
      console.log(`[IMGatewayManager] Restored notification target for ${platform}`);
    } catch (err) {
      console.warn(`[IMGatewayManager] Failed to restore notification target for ${platform}:`, getErrorMessage(err));
    }
  }

  /**
   * Update chat handler with current settings
   */
  private updateChatHandler(): void {
    if (!this.getLLMConfig) {
      console.warn('[IMGatewayManager] LLM config provider not set');
      return;
    }

    const imSettings = this.imStore.getIMSettings();

    this.chatHandler = new IMChatHandler({
      getLLMConfig: this.getLLMConfig,
      getSkillsPrompt: this.getSkillsPrompt || undefined,
      imSettings,
    });

    // Update or create Cowork handler if dependencies are available
    this.updateCoworkHandler();
  }

  /**
   * Update or create Cowork handler
   * Always creates handler if dependencies are available (Cowork mode is always enabled for IM)
   */
  private updateCoworkHandler(): void {
    // Always create Cowork handler if we have the required dependencies
    if (this.coworkRuntime && this.coworkStore && !this.coworkHandler) {
      const detectScheduledTaskRequest = this.getLLMConfig && this.createScheduledTask
        ? createIMScheduledTaskRequestDetector({
            getLLMConfig: this.getLLMConfig,
          })
        : undefined;
      this.coworkHandler = new IMCoworkHandler({
        coworkRuntime: this.coworkRuntime,
        coworkStore: this.coworkStore,
        imStore: this.imStore,
        getSkillsPrompt: this.getSkillsPrompt || undefined,
        detectScheduledTaskRequest,
        createScheduledTask: this.createScheduledTask || undefined,
        sendAsyncReply: async (platform, conversationId, text) => {
          return this.sendConversationReply(platform, conversationId, text);
        },
      });
      console.log('[IMGatewayManager] Cowork handler created');
    }
  }

  // ==================== Configuration ====================
  getConfig(): IMGatewayConfig {
    return this.imStore.getConfig();
  }

  getIMStore(): IMStore {
    return this.imStore;
  }

  setConfig(config: Partial<IMGatewayConfig>, options?: { syncGateway?: boolean }): void {
    const previousConfig = this.imStore.getConfig();
    this.imStore.setConfig(config);

    // Update chat handler if settings changed
    if (config.settings) {
      this.updateChatHandler();
    }


    // NIM now runs via OpenClaw; config sync is handled by IPC handler

    // DingTalk now runs via OpenClaw; config sync is handled by IPC handler

    // Feishu now runs via OpenClaw; config sync is handled by IPC handler


    // Hot-update netease-bee config: sync OpenClaw config when credentials change.
    // Only perform sync when syncGateway is explicitly true (i.e. user clicked Save).
    if (options?.syncGateway && config['netease-bee']) {
      const oldNb = previousConfig['netease-bee'];
      const newNb = { ...oldNb, ...config['netease-bee'] };
      const credentialsChanged =
        newNb.clientId !== oldNb?.clientId ||
        newNb.secret !== oldNb?.secret;
      if (credentialsChanged) {
        console.log('[IMGatewayManager] netease-bee credentials changed, syncing OpenClaw config...');
        this.syncOpenClawConfig?.();
      }
    }

    // QQ runs via OpenClaw; config changes are synced via OpenClawConfigSync

    // WeCom runs via OpenClaw; config changes are synced via OpenClawConfigSync

    // Weixin runs via OpenClaw; config changes are synced via OpenClawConfigSync

    // POPO runs via OpenClaw; config changes are synced via OpenClawConfigSync

  }

  private async restartGateway(platform: Platform): Promise<void> {
    console.log(`[IMGatewayManager] Restarting ${platform} gateway...`);
    await this.stopGateway(platform);
    await this.startGateway(platform);
    console.log(`[IMGatewayManager] ${platform} gateway restarted successfully`);
  }

  // ==================== Status ====================
  getStatus(): IMGatewayStatus {
    const config = this.getConfig();
    // Telegram runs via OpenClaw; reflect enabled+configured state as connected
    const tgConfig = config.telegram;
    const telegramStatus = {
      connected: Boolean(tgConfig?.enabled && tgConfig.botToken),
      startedAt: null as number | null,
      lastError: null as string | null,
      botUsername: null as string | null,
      lastInboundAt: null as number | null,
      lastOutboundAt: null as number | null,
    };
    // Discord runs via OpenClaw; reflect enabled+configured state as connected
    const dcConfig = config.discord;
    const discordStatus = {
      connected: Boolean(dcConfig?.enabled && dcConfig.botToken),
      starting: false,
      startedAt: null as number | null,
      lastError: null as string | null,
      botUsername: null as string | null,
      lastInboundAt: null as number | null,
      lastOutboundAt: null as number | null,
    };
    // DingTalk runs via OpenClaw; reflect enabled+configured state per instance
    const dingtalkStatus = {
      instances: (config.dingtalk?.instances || []).map((inst) => ({
        instanceId: inst.instanceId,
        instanceName: inst.instanceName,
        connected: Boolean(inst.enabled && inst.clientId && inst.clientSecret),
        startedAt: null as number | null,
        lastError: null as string | null,
        lastInboundAt: null as number | null,
        lastOutboundAt: null as number | null,
      })),
    };
    // Feishu runs via OpenClaw; reflect enabled+configured state per instance
    const feishuStatus = {
      instances: (config.feishu?.instances || []).map((inst) => ({
        instanceId: inst.instanceId,
        instanceName: inst.instanceName,
        connected: Boolean(inst.enabled && inst.appId && inst.appSecret),
        startedAt: null as string | null,
        botOpenId: null as string | null,
        error: null as string | null,
        lastInboundAt: null as number | null,
        lastOutboundAt: null as number | null,
      })),
    };
    return {
      dingtalk: dingtalkStatus,
      feishu: feishuStatus,
      telegram: telegramStatus,
      qq: {
        instances: (config.qq?.instances || []).map((inst) => ({
          instanceId: inst.instanceId,
          instanceName: inst.instanceName,
          connected: Boolean(inst.enabled && inst.appId && inst.appSecret),
          startedAt: null as number | null,
          lastError: null as string | null,
          lastInboundAt: null as number | null,
          lastOutboundAt: null as number | null,
        })),
      },
      discord: discordStatus,
      nim: (() => {
        const nmConfig = pickConfiguredNimInstance(config);
        return {
          connected: Boolean(nmConfig?.enabled && ((nmConfig.nimToken && nmConfig.nimToken.trim()) || (nmConfig.appKey && nmConfig.account && nmConfig.token))),
          startedAt: null as number | null,
          lastError: null as string | null,
          botAccount: nmConfig?.account || null,
          lastInboundAt: null as number | null,
          lastOutboundAt: null as number | null,
        };
      })(),
      'netease-bee': (() => {
        const beeConfig = config['netease-bee'];
        return {
          connected: Boolean(beeConfig?.enabled && beeConfig?.clientId && beeConfig?.secret),
          startedAt: null as number | null,
          lastError: null as string | null,
          botAccount: null as string | null,
          lastInboundAt: null as number | null,
          lastOutboundAt: null as number | null,
        };
      })(),
      wecom: {
        instances: (config.wecom?.instances || []).map((inst) => ({
          instanceId: inst.instanceId,
          instanceName: inst.instanceName,
          connected: Boolean(inst.enabled && inst.botId && inst.secret),
          startedAt: null as number | null,
          lastError: null as string | null,
          botId: inst.botId || null,
          lastInboundAt: null as number | null,
          lastOutboundAt: null as number | null,
        })),
      },
      weixin: {
        connected: Boolean(config.weixin?.enabled),
        accountId: config.weixin?.accountId?.trim() || null,
        startedAt: null as number | null,
        lastError: null as string | null,
        lastInboundAt: null as number | null,
        lastOutboundAt: null as number | null,
      },
      popo: {
        connected: Boolean(pickConfiguredPopoInstance(config)?.enabled),
        startedAt: null as number | null,
        lastError: null as string | null,
        lastInboundAt: null as number | null,
        lastOutboundAt: null as number | null,
      },
    };
  }

  async getStatusWithOpenClawRuntime(): Promise<IMGatewayStatus> {
    const status = this.getStatus();
    const client = this.getOpenClawGatewayClient?.();
    if (!client) return status;

    try {
      const runtimeStatus = await this.requestOpenClawChannelsStatus(client);
      const weixinAccount = this.pickWeixinAccountSnapshot(runtimeStatus, status.weixin.accountId);
      if (!weixinAccount) return status;

      const configured = weixinAccount.configured === true;
      const running = weixinAccount.running === true;
      const enabled = weixinAccount.enabled !== false;
      const accountId = readString(weixinAccount.accountId) ?? status.weixin.accountId ?? null;
      status.weixin = {
        ...status.weixin,
        accountId,
        connected: running || (enabled && configured && status.weixin.connected),
        startedAt: readNumber(weixinAccount.lastStartAt),
        lastError: readString(weixinAccount.lastError),
        lastInboundAt: readNumber(weixinAccount.lastInboundAt),
        lastOutboundAt: readNumber(weixinAccount.lastOutboundAt),
      };
    } catch (error) {
      console.debug('[IMGatewayManager] failed to enrich Weixin status from OpenClaw runtime:', error);
    }

    return status;
  }

  private async requestOpenClawChannelsStatus(
    client: GatewayClientLike,
  ): Promise<OpenClawChannelsStatusResult> {
    return client.request<OpenClawChannelsStatusResult>(
      'channels.status',
      { probe: false, timeoutMs: 2000 },
    );
  }

  private getWeixinAccountSnapshots(
    runtimeStatus: OpenClawChannelsStatusResult,
  ): OpenClawChannelAccountSnapshot[] {
    const rawAccounts = runtimeStatus.channelAccounts?.[WEIXIN_OPENCLAW_CHANNEL];
    if (!Array.isArray(rawAccounts)) return [];

    return rawAccounts
      .filter(isRecord)
      .map((account) => account as OpenClawChannelAccountSnapshot);
  }

  private pickWeixinAccountSnapshot(
    runtimeStatus: OpenClawChannelsStatusResult,
    preferredAccountId?: string | null,
  ): OpenClawChannelAccountSnapshot | null {
    const accounts = this.getWeixinAccountSnapshots(runtimeStatus);
    if (accounts.length === 0) return null;

    const preferred = preferredAccountId?.trim();
    if (preferred) {
      const matched = accounts.find((account) => readString(account.accountId) === preferred);
      if (matched) return matched;
    }

    return accounts.find((account) => account.running === true)
      ?? accounts.find((account) => account.configured === true)
      ?? accounts[0];
  }

  private async resolveWeixinRuntimeAccountId(client: GatewayClientLike): Promise<string | undefined> {
    try {
      const runtimeStatus = await this.requestOpenClawChannelsStatus(client);
      const preferred = this.getConfig().weixin?.accountId;
      const account = this.pickWeixinAccountSnapshot(runtimeStatus, preferred);
      return readString(account?.accountId) ?? undefined;
    } catch (error) {
      console.debug('[IMGatewayManager] failed to resolve Weixin account from OpenClaw runtime:', error);
      return undefined;
    }
  }

  async testGateway(
    platform: Platform,
    configOverride?: Partial<IMGatewayConfig>
  ): Promise<IMConnectivityTestResult> {
    // Telegram always uses OpenClaw mode
    if (platform === 'telegram') {
      return this.testTelegramOpenClawConnectivity(configOverride);
    }

    // Discord always uses OpenClaw mode
    if (platform === 'discord') {
      return this.testDiscordOpenClawConnectivity(configOverride);
    }

    // Feishu always uses OpenClaw mode
    if (platform === 'feishu') {
      return this.testFeishuOpenClawConnectivity(configOverride);
    }

    // DingTalk always uses OpenClaw mode
    if (platform === 'dingtalk') {
      return this.testDingTalkOpenClawConnectivity(configOverride);
    }

    if (platform === 'nim') {
      return this.testNimOpenClawConnectivity(configOverride);
    }

    // WeCom always uses OpenClaw mode
    if (platform === 'wecom') {
      return this.testWecomOpenClawConnectivity(configOverride);
    }

    // Weixin always uses OpenClaw mode
    if (platform === 'weixin') {
      return this.testWeixinOpenClawConnectivity(configOverride);
    }

    // POPO always uses OpenClaw mode
    if (platform === 'popo') {
      return this.testPopoOpenClawConnectivity(configOverride);
    }

    // QQ always uses OpenClaw mode
    if (platform === 'qq') {
      return this.testQQOpenClawConnectivity(configOverride);
    }

    // NetEase Bee is an internal relay channel with no standalone gateway to test
    if (platform === 'netease-bee') {
      return {
        platform,
        testedAt: Date.now(),
        verdict: 'warn',
        checks: [{
          code: 'gateway_running',
          level: 'info',
          message: t('imNeteaseBeeStandaloneTestUnsupported'),
        }],
      };
    }

    const config = this.buildMergedConfig(configOverride);
    const checks: IMConnectivityCheck[] = [];
    const testedAt = Date.now();

    const addCheck = (check: IMConnectivityCheck) => {
      checks.push(check);
    };

    const missingCredentials = this.getMissingCredentials(platform, config);
    if (missingCredentials.length > 0) {
      addCheck({
        code: 'missing_credentials',
        level: 'fail',
        message: t('imMissingCredentials', { fields: missingCredentials.join(', ') }),
        suggestion: t('imFillCredentials'),
      });

      return {
        platform,
        testedAt,
        verdict: 'fail',
        checks,
      };
    }

    try {
      const authMessage = await this.withTimeout(
        this.runAuthProbe(platform, config),
        CONNECTIVITY_TIMEOUT_MS,
        t('imAuthProbeTimeout')
      );
      addCheck({
        code: 'auth_check',
        level: 'pass',
        message: authMessage,
      });
    } catch (error) {
      addCheck({
        code: 'auth_check',
        level: 'fail',
        message: t('imAuthFailed', { error: getErrorMessage(error) }),
        suggestion: t('imAuthFailedSuggestion'),
      });
      return {
        platform,
        testedAt,
        verdict: 'fail',
        checks,
      };
    }

    const status = this.getStatus();
    const enabled = this.getPlatformEnabled(config, platform);
    const connected = this.isConnected(platform);

    if (enabled && !connected) {
      addCheck({
        code: 'gateway_running',
        level: 'warn',
        message: t('imChannelEnabledNotConnected'),
        suggestion: t('imChannelEnabledNotConnectedSuggestion'),
      });
    } else {
      addCheck({
        code: 'gateway_running',
        level: connected ? 'pass' : 'info',
        message: connected ? t('imChannelRunning') : t('imChannelNotEnabled'),
        suggestion: connected ? undefined : t('imChannelNotEnabledSuggestion'),
      });
    }

    const startedAt = this.getStartedAtMs(platform, status);
    const lastInboundAt = this.getLastInboundAt(platform, status);
    const lastOutboundAt = this.getLastOutboundAt(platform, status);

    if (connected && startedAt && testedAt - startedAt >= INBOUND_ACTIVITY_WARN_AFTER_MS) {
      if (!lastInboundAt) {
        addCheck({
          code: 'inbound_activity',
          level: 'warn',
          message: t('imNoInboundAfter2Min'),
          suggestion: t('imNoInboundSuggestion'),
        });
      } else {
        addCheck({
          code: 'inbound_activity',
          level: 'pass',
          message: t('imInboundDetected'),
        });
      }
    } else if (connected) {
      addCheck({
        code: 'inbound_activity',
        level: 'info',
        message: t('imGatewayJustStarted'),
      });
    }

    if (connected && lastInboundAt) {
      if (!lastOutboundAt) {
        addCheck({
          code: 'outbound_activity',
          level: 'warn',
          message: t('imNoOutbound'),
          suggestion: t('imNoOutboundSuggestion'),
        });
      } else {
        addCheck({
          code: 'outbound_activity',
          level: 'pass',
          message: t('imOutboundDetected'),
        });
      }
    } else if (connected) {
      addCheck({
        code: 'outbound_activity',
        level: 'info',
        message: t('imNoInboundForOutboundCheck'),
      });
    }

    const lastError = this.getLastError(platform, status);
    if (lastError) {
      addCheck({
        code: 'platform_last_error',
        level: connected ? 'warn' : 'fail',
        message: t('imRecentError', { error: lastError }),
        suggestion: connected
          ? t('imRecentErrorConnectedSuggestion')
          : t('imRecentErrorDisconnectedSuggestion'),
      });
    }

    if (platform === 'qq') {
      addCheck({
        code: 'qq_guild_mention_hint',
        level: 'info',
        message: t('imQqOpenClawHint'),
        suggestion: t('imQqMentionHint'),
      });
    }

    return {
      platform,
      testedAt,
      verdict: this.calculateVerdict(checks),
      checks,
    };
  }

  // ==================== Gateway Control ====================
  async startGateway(platform: Platform): Promise<void> {
    // Ensure chat handler is ready
    this.updateChatHandler();

    if (platform === 'dingtalk') {
      // DingTalk runs via OpenClaw gateway (dingtalk-connector plugin)
      console.log('[IMGatewayManager] DingTalk in OpenClaw mode, syncing config instead of starting direct gateway');
      await this.syncOpenClawConfig?.();
      await this.ensureOpenClawGatewayConnected?.();
      return;
    } else if (platform === 'feishu') {
      // Feishu runs via OpenClaw gateway (feishu-openclaw-plugin)
      console.log('[IMGatewayManager] Feishu in OpenClaw mode, syncing config instead of starting direct gateway');
      await this.syncOpenClawConfig?.();
      await this.ensureOpenClawGatewayConnected?.();
      return;
    } else if (platform === 'telegram') {
      // Telegram always runs via OpenClaw gateway
      console.log('[IMGatewayManager] Telegram in OpenClaw mode, syncing config instead of starting direct gateway');
      await this.syncOpenClawConfig?.();
      // Connect the gateway WebSocket so channel events (e.g. Telegram messages) are received
      await this.ensureOpenClawGatewayConnected?.();
      return;
    } else if (platform === 'discord') {
      // Discord runs via OpenClaw gateway
      console.log('[IMGatewayManager] Discord in OpenClaw mode, syncing config instead of starting direct gateway');
      await this.syncOpenClawConfig?.();
      await this.ensureOpenClawGatewayConnected?.();
      return;
    } else if (platform === 'nim') {
      // NIM runs via OpenClaw gateway (openclaw-nim plugin)
      console.log('[IMGatewayManager] NIM in OpenClaw mode, syncing config instead of starting direct gateway');
      await this.syncOpenClawConfig?.();
      await this.ensureOpenClawGatewayConnected?.();
      return;
    } else if (platform === 'netease-bee') {
      // netease-bee runs via OpenClaw gateway
      console.log('[IMGatewayManager] netease-bee in OpenClaw mode, syncing config instead of starting direct gateway');
      await this.syncOpenClawConfig?.();
      await this.ensureOpenClawGatewayConnected?.();
      return;
    } else if (platform === 'qq') {
      // QQ runs via OpenClaw gateway (qqbot plugin)
      console.log('[IMGatewayManager] QQ in OpenClaw mode, syncing config instead of starting direct gateway');
      await this.syncOpenClawConfig?.();
      await this.ensureOpenClawGatewayConnected?.();
      return;
    } else if (platform === 'wecom') {
      // WeCom runs via OpenClaw gateway (wecom-openclaw-plugin)
      console.log('[IMGatewayManager] WeCom in OpenClaw mode, syncing config instead of starting direct gateway');
      await this.syncOpenClawConfig?.();
      await this.ensureOpenClawGatewayConnected?.();
      return;
    } else if (platform === 'weixin') {
      // Weixin runs via OpenClaw gateway (weixin-openclaw-plugin)
      console.debug('[IMGatewayManager] Weixin in OpenClaw mode, syncing config instead of starting direct gateway');
      await this.syncOpenClawConfig?.();
      await this.ensureOpenClawGatewayConnected?.();
      return;
    } else if (platform === 'popo') {
      // POPO runs via OpenClaw gateway (moltbot-popo plugin)
      console.log('[IMGatewayManager] POPO in OpenClaw mode, syncing config instead of starting direct gateway');
      await this.syncOpenClawConfig?.();
      await this.ensureOpenClawGatewayConnected?.();
      return;
    }

    // Restore persisted notification target
    this.restoreNotificationTarget(platform);
  }

  async stopGateway(platform: Platform): Promise<void> {
    if (platform === 'dingtalk') {
      // DingTalk runs via OpenClaw gateway
      console.log('[IMGatewayManager] DingTalk in OpenClaw mode, syncing disabled config');
      await this.syncOpenClawConfig?.();
      return;
    } else if (platform === 'feishu') {
      // Feishu runs via OpenClaw gateway
      console.log('[IMGatewayManager] Feishu in OpenClaw mode, syncing disabled config');
      await this.syncOpenClawConfig?.();
      return;
    } else if (platform === 'telegram') {
      // Telegram always runs via OpenClaw gateway
      console.log('[IMGatewayManager] Telegram in OpenClaw mode, syncing disabled config');
      await this.syncOpenClawConfig?.();
      return;
    } else if (platform === 'discord') {
      // Discord runs via OpenClaw gateway
      console.log('[IMGatewayManager] Discord in OpenClaw mode, syncing disabled config');
      await this.syncOpenClawConfig?.();
      return;
    } else if (platform === 'nim') {
      // NIM runs via OpenClaw gateway
      console.log('[IMGatewayManager] NIM in OpenClaw mode, syncing disabled config');
      await this.syncOpenClawConfig?.();
      return;
    } else if (platform === 'netease-bee') {
      // netease-bee runs via OpenClaw gateway
      console.log('[IMGatewayManager] netease-bee in OpenClaw mode, syncing disabled config');
      await this.syncOpenClawConfig?.();
      return;
    } else if (platform === 'qq') {
      // QQ runs via OpenClaw gateway
      console.log('[IMGatewayManager] QQ in OpenClaw mode, syncing disabled config');
      await this.syncOpenClawConfig?.();
      return;
    } else if (platform === 'wecom') {
      // WeCom runs via OpenClaw gateway
      console.log('[IMGatewayManager] WeCom in OpenClaw mode, syncing disabled config');
      await this.syncOpenClawConfig?.();
      return;
    } else if (platform === 'weixin') {
      // Weixin runs via OpenClaw gateway
      console.debug('[IMGatewayManager] Weixin in OpenClaw mode, syncing disabled config');
      await this.syncOpenClawConfig?.();
      return;
    } else if (platform === 'popo') {
      // POPO runs via OpenClaw gateway
      console.log('[IMGatewayManager] POPO in OpenClaw mode, syncing disabled config');
      await this.syncOpenClawConfig?.();
      return;
    }
  }

  /**
   * Start all enabled gateways.
   *
   * OpenClaw platforms (dingtalk/feishu/telegram/discord/qq/wecom/weixin/popo/nim) are batched
   * so that `syncOpenClawConfig` + `ensureOpenClawGatewayConnected` are called
   * only **once** regardless of how many OpenClaw platforms are enabled.
   * This avoids N serial gateway restarts which cause message loss, Telegram
   * `getUpdates` conflicts, and rate-limit issues.
   */
  async startAllEnabled(): Promise<void> {
    const config = this.getConfig();

    // Ensure chat handler is ready (called once instead of per-platform)
    this.updateChatHandler();

    // --- OpenClaw platforms: collect and batch into a single sync ---

    const openClawPlatformsToStart: Platform[] = [];

    const dingtalkInstances = config.dingtalk?.instances || [];
    if (dingtalkInstances.some((item) => item.enabled && item.clientId && item.clientSecret)) {
      openClawPlatformsToStart.push('dingtalk');
    }
    const feishuInstances = config.feishu?.instances || [];
    if (feishuInstances.some((item) => item.enabled && item.appId && item.appSecret)) {
      openClawPlatformsToStart.push('feishu');
    }
    if (config.telegram?.enabled && config.telegram.botToken) {
      openClawPlatformsToStart.push('telegram');
    }
    if (config.discord.enabled && config.discord.botToken) {
      openClawPlatformsToStart.push('discord');
    }
    const qqInstances = config.qq?.instances || [];
    if (qqInstances.some((item) => item.enabled && item.appId && item.appSecret)) {
      openClawPlatformsToStart.push('qq');
    }
    const wecomInstances = config.wecom?.instances || [];
    if (wecomInstances.some((item) => item.enabled && item.botId && item.secret)) {
      openClawPlatformsToStart.push('wecom');
    }
    if (config.weixin?.enabled) {
      openClawPlatformsToStart.push('weixin');
    }
    if (pickConfiguredPopoInstance(config)?.enabled) {
      openClawPlatformsToStart.push('popo');
    }
    if (pickConfiguredNimInstance(config)?.enabled) {
      openClawPlatformsToStart.push('nim');
    }
    if (config['netease-bee']?.enabled && config['netease-bee']?.clientId && config['netease-bee']?.secret) {
      openClawPlatformsToStart.push('netease-bee');
    }

    if (openClawPlatformsToStart.length > 0) {
      console.log(`[IMGatewayManager] Starting OpenClaw platforms in batch: ${openClawPlatformsToStart.join(', ')}`);
      try {
        await this.syncOpenClawConfig?.();
        await this.ensureOpenClawGatewayConnected?.();
      } catch (error) {
        console.error(`[IMGatewayManager] Failed to start OpenClaw platforms: ${getErrorMessage(error)}`);
      }
    }
  }

  async stopAll(): Promise<void> {
    // All platforms run via OpenClaw; nothing to stop directly
  }

  isAnyConnected(): boolean {
    return isAnyGatewayConnected(this.getStatus());
  }

  isConnected(platform: Platform): boolean {
    if (platform === 'dingtalk') {
      // DingTalk runs via OpenClaw; consider it connected when any instance is enabled and configured
      const config = this.getConfig();
      const dingtalkInstances = config.dingtalk?.instances || [];
      return dingtalkInstances.some((item) => item.enabled && item.clientId && item.clientSecret);
    }
    if (platform === 'feishu') {
      // Feishu runs via OpenClaw; consider it connected when any instance is enabled and configured
      const config = this.getConfig();
      const feishuInstances = config.feishu?.instances || [];
      return feishuInstances.some((item) => item.enabled && item.appId && item.appSecret);
    }
    if (platform === 'telegram') {
      // Telegram runs via OpenClaw; consider it connected when enabled and configured
      const config = this.getConfig();
      return Boolean(config.telegram?.enabled && config.telegram.botToken);
    }
    if (platform === 'discord') {
      // Discord runs via OpenClaw; consider it connected when enabled and configured
      const config = this.getConfig();
      return Boolean(config.discord?.enabled && config.discord.botToken);
    }
    if (platform === 'nim') {
      // NIM runs via OpenClaw; consider it connected when enabled and configured
      const config = this.getConfig();
      return Boolean(pickConfiguredNimInstance(config)?.enabled);
    }
    if (platform === 'netease-bee') {
      // netease-bee runs via OpenClaw; status comes from OpenClaw
      const config = this.getConfig();
      return Boolean(config['netease-bee']?.enabled && config['netease-bee']?.clientId && config['netease-bee']?.secret);
    }
    if (platform === 'qq') {
      // QQ runs via OpenClaw; consider it connected when any instance is enabled and configured
      const config = this.getConfig();
      const qqInstances = config.qq?.instances || [];
      return qqInstances.some((item) => item.enabled && item.appId && item.appSecret);
    }
    if (platform === 'wecom') {
      // WeCom runs via OpenClaw; consider it connected when any instance is enabled and configured
      const config = this.getConfig();
      const wecomInstances = config.wecom?.instances || [];
      return wecomInstances.some((item) => item.enabled && item.botId && item.secret);
    }
    if (platform === 'weixin') {
      const config = this.getConfig();
      return Boolean(config.weixin?.enabled);
    }
    if (platform === 'popo') {
      // POPO runs via OpenClaw; consider it connected when enabled and configured
      const config = this.getConfig();
      return Boolean(pickConfiguredPopoInstance(config)?.enabled);
    }
    return false;
  }

  async sendNotification(platform: Platform, _text: string): Promise<boolean> {
    if (!this.isConnected(platform)) {
      console.warn(`[IMGatewayManager] Cannot send notification: ${platform} is not connected`);
      return false;
    }

    try {
      if (platform === 'nim') {
        // NIM runs via OpenClaw; notifications not yet supported via plugin
        console.log('[IMGatewayManager] NIM notification via OpenClaw not yet supported');
      } else if (platform === 'qq') {
        // QQ runs via OpenClaw; notifications are handled by the qqbot plugin
        console.log('[IMGatewayManager] QQ notification via OpenClaw not yet supported');
      } else if (platform === 'wecom') {
        // WeCom runs via OpenClaw; notifications are handled by the wecom-openclaw-plugin
        console.log('[IMGatewayManager] WeCom notification via OpenClaw not yet supported');
      } else if (platform === 'weixin') {
        // Weixin runs via OpenClaw; notifications are handled by the weixin-openclaw-plugin
        console.debug('[IMGatewayManager] Weixin notification via OpenClaw not yet supported');
      } else if (platform === 'popo') {
        // POPO runs via OpenClaw; notifications are handled by the moltbot-popo plugin
        console.log('[IMGatewayManager] POPO notification via OpenClaw not yet supported');
      } else if (platform === 'netease-bee') {
        // netease-bee runs via OpenClaw; notifications not yet supported
        console.log('[IMGatewayManager] netease-bee notification via OpenClaw not yet supported');
      }
      return true;
    } catch (error) {
      console.error(`[IMGatewayManager] Failed to send notification via ${platform}:`, getErrorMessage(error));
      return false;
    }
  }

  async sendNotificationWithMedia(platform: Platform, _text: string): Promise<boolean> {
    if (!this.isConnected(platform)) {
      console.warn(`[IMGatewayManager] Cannot send notification: ${platform} is not connected`);
      return false;
    }

    try {
      if (platform === 'nim') {
        // NIM runs via OpenClaw; notifications not yet supported via plugin
        console.log('[IMGatewayManager] NIM notification with media via OpenClaw not yet supported');
      } else if (platform === 'qq') {
        // QQ runs via OpenClaw; notifications are handled by the qqbot plugin
        console.log('[IMGatewayManager] QQ notification with media via OpenClaw not yet supported');
      } else if (platform === 'wecom') {
        // WeCom runs via OpenClaw; notifications are handled by the wecom-openclaw-plugin
        console.log('[IMGatewayManager] WeCom notification with media via OpenClaw not yet supported');
      } else if (platform === 'weixin') {
        // Weixin runs via OpenClaw; notifications are handled by the weixin-openclaw-plugin
        console.debug('[IMGatewayManager] Weixin notification with media via OpenClaw not yet supported');
      } else if (platform === 'popo') {
        // POPO runs via OpenClaw; notifications are handled by the moltbot-popo plugin
        console.log('[IMGatewayManager] POPO notification with media via OpenClaw not yet supported');
      } else if (platform === 'netease-bee') {
        // netease-bee runs via OpenClaw; notifications not yet supported
        console.log('[IMGatewayManager] netease-bee notification via OpenClaw not yet supported');
      }
      return true;
    } catch (error) {
      console.error(`[IMGatewayManager] Failed to send notification with media via ${platform}:`, getErrorMessage(error));
      return false;
    }
  }

  private async testTelegramOpenClawConnectivity(
    configOverride?: Partial<IMGatewayConfig>
  ): Promise<IMConnectivityTestResult> {
    const checks: IMConnectivityCheck[] = [];
    const testedAt = Date.now();
    const platform: Platform = 'telegram';

    // Resolve the Telegram config (now TelegramOpenClawConfig type)
    const mergedConfig = this.buildMergedConfig(configOverride);
    const tgConfig = mergedConfig.telegram;
    const botToken = tgConfig?.botToken || '';

    // Check 1: Bot token present
    if (!botToken) {
      checks.push({
        code: 'missing_credentials',
        level: 'fail',
        message: t('imTelegramMissingBotToken'),
        suggestion: t('imTelegramFillBotToken'),
      });
      return { platform, testedAt, verdict: 'fail', checks };
    }

    // Check 2: Auth probe via Telegram API (getMe)
    try {
      const response = await this.withTimeout(
        fetchJsonWithTimeout<TelegramGetMeResponse>(
          `https://api.telegram.org/bot${botToken}/getMe`,
          {},
          CONNECTIVITY_TIMEOUT_MS
        ),
        CONNECTIVITY_TIMEOUT_MS,
        t('imAuthProbeTimeout')
      );
      if (response?.ok && response.result?.username) {
        checks.push({
          code: 'auth_check',
          level: 'pass',
          message: t('imTelegramAuthPassed', { username: response.result.username }),
        });
      } else {
        checks.push({
          code: 'auth_check',
          level: 'fail',
          message: t('imTelegramAuthFailed', { error: response?.description || t('imTelegramAuthFailedUnknown') }),
          suggestion: t('imTelegramCheckToken'),
        });
        return { platform, testedAt, verdict: 'fail', checks };
      }
    } catch (error) {
      checks.push({
        code: 'auth_check',
        level: 'fail',
        message: t('imTelegramAuthFailed', { error: getErrorMessage(error) }),
        suggestion: t('imTelegramCheckTokenNetwork'),
      });
      return { platform, testedAt, verdict: 'fail', checks };
    }

    // Check 3: OpenClaw Gateway running
    checks.push({
      code: 'gateway_running',
      level: 'info',
      message: t('imTelegramOpenClawHint'),
    });

    const verdict: IMConnectivityVerdict = checks.some(c => c.level === 'fail')
      ? 'fail'
      : checks.some(c => c.level === 'warn')
        ? 'warn'
        : 'pass';

    return { platform, testedAt, verdict, checks };
  }

  private async testDiscordOpenClawConnectivity(
    configOverride?: Partial<IMGatewayConfig>
  ): Promise<IMConnectivityTestResult> {
    const checks: IMConnectivityCheck[] = [];
    const testedAt = Date.now();
    const platform: Platform = 'discord';

    const mergedConfig = this.buildMergedConfig(configOverride);
    const dcConfig = mergedConfig.discord;
    const botToken = dcConfig?.botToken || '';

    // Check 1: Bot token present
    if (!botToken) {
      checks.push({
        code: 'missing_credentials',
        level: 'fail',
        message: t('imDiscordMissingBotToken'),
        suggestion: t('imDiscordFillBotToken'),
      });
      return { platform, testedAt, verdict: 'fail', checks };
    }

    // Check 2: Auth probe via Discord API (/users/@me)
    try {
      const response = await this.withTimeout(
        fetchJsonWithTimeout<DiscordUserResponse>(
          'https://discord.com/api/v10/users/@me',
          { headers: { Authorization: `Bot ${botToken}` } },
          CONNECTIVITY_TIMEOUT_MS
        ),
        CONNECTIVITY_TIMEOUT_MS,
        t('imAuthProbeTimeout')
      );
      const username = response?.username
        ? `${response.username}${response.discriminator && response.discriminator !== '0' ? `#${response.discriminator}` : ''}`
        : 'unknown';
      checks.push({
        code: 'auth_check',
        level: 'pass',
        message: t('imDiscordAuthPassed', { username }),
      });
    } catch (error) {
      checks.push({
        code: 'auth_check',
        level: 'fail',
        message: t('imDiscordAuthFailed', { error: getErrorMessage(error) }),
        suggestion: t('imDiscordCheckTokenNetwork'),
      });
      return { platform, testedAt, verdict: 'fail', checks };
    }

    // Check 3: OpenClaw Gateway running info
    checks.push({
      code: 'gateway_running',
      level: 'info',
      message: t('imDiscordOpenClawHint'),
    });

    // Check 4: Group mention hint
    checks.push({
      code: 'discord_group_requires_mention',
      level: 'info',
      message: t('imDiscordGroupMention'),
    });

    const verdict: IMConnectivityVerdict = checks.some(c => c.level === 'fail')
      ? 'fail'
      : checks.some(c => c.level === 'warn')
        ? 'warn'
        : 'pass';

    return { platform, testedAt, verdict, checks };
  }

  private async testFeishuOpenClawConnectivity(
    configOverride?: Partial<IMGatewayConfig>
  ): Promise<IMConnectivityTestResult> {
    const checks: IMConnectivityCheck[] = [];
    const testedAt = Date.now();
    const platform: Platform = 'feishu';

    const mergedConfig = this.buildMergedConfig(configOverride);
    const feishuInstances = mergedConfig.feishu?.instances || [];
    const fsConfig = pickConfiguredInstance(
      feishuInstances,
      (instance) => Boolean(instance.appId && instance.appSecret),
    );

    // Check 1: Credentials present
    if (!fsConfig?.appId || !fsConfig?.appSecret) {
      const missing: string[] = [];
      if (!fsConfig?.appId) missing.push('appId');
      if (!fsConfig?.appSecret) missing.push('appSecret');
      checks.push({
        code: 'missing_credentials',
        level: 'fail',
        message: t('imMissingCredentials', { fields: missing.join(', ') }),
        suggestion: t('imFeishuFillAppIdSecret'),
      });
      return { platform, testedAt, verdict: 'fail', checks };
    }

    // Check 2: Auth probe via Feishu API
    try {
      const Lark = await import('@larksuiteoapi/node-sdk');
      const domain = this.resolveFeishuDomain(fsConfig.domain, Lark);
      const client = new Lark.Client({
        appId: fsConfig.appId,
        appSecret: fsConfig.appSecret,
        appType: Lark.AppType.SelfBuild,
        domain,
      });
      const response = await client.request({
        method: 'GET',
        url: '/open-apis/bot/v3/info',
      }) as FeishuBotInfoResponse;
      if (response.code !== 0) {
        throw new Error(response.msg || `code ${response.code}`);
      }
      const botName = response.data?.app_name ?? response.data?.bot?.app_name ?? 'unknown';
      checks.push({
        code: 'auth_check',
        level: 'pass',
        message: t('imFeishuAuthPassed', { botName }),
      });
    } catch (error) {
      checks.push({
        code: 'auth_check',
        level: 'fail',
        message: t('imFeishuAuthFailed', { error: getErrorMessage(error) }),
        suggestion: t('imFeishuCheckAppIdSecret'),
      });
      return { platform, testedAt, verdict: 'fail', checks };
    }

    // Check 3: OpenClaw Gateway running info
    checks.push({
      code: 'gateway_running',
      level: 'info',
      message: t('imFeishuOpenClawHint'),
    });

    // Check 4: Group mention hint
    checks.push({
      code: 'feishu_group_requires_mention',
      level: 'info',
      message: t('imFeishuGroupMention'),
      suggestion: t('imFeishuGroupMentionSuggestion'),
    });

    // Check 5: Event subscription hint
    checks.push({
      code: 'feishu_event_subscription_required',
      level: 'info',
      message: t('imFeishuEventSubscription'),
      suggestion: t('imFeishuEventSubscriptionSuggestion'),
    });

    const verdict: IMConnectivityVerdict = checks.some(c => c.level === 'fail')
      ? 'fail'
      : checks.some(c => c.level === 'warn')
        ? 'warn'
        : 'pass';

    return { platform, testedAt, verdict, checks };
  }

  private async testDingTalkOpenClawConnectivity(
    configOverride?: Partial<IMGatewayConfig>
  ): Promise<IMConnectivityTestResult> {
    const checks: IMConnectivityCheck[] = [];
    const testedAt = Date.now();
    const platform: Platform = 'dingtalk';

    const mergedConfig = this.buildMergedConfig(configOverride);
    const dingTalkInstances = mergedConfig.dingtalk?.instances || [];
    const dtConfig = pickConfiguredInstance(
      dingTalkInstances,
      (instance) => Boolean(instance.clientId && instance.clientSecret),
    );

    // Check 1: Credentials present
    if (!dtConfig?.clientId || !dtConfig?.clientSecret) {
      const missing: string[] = [];
      if (!dtConfig?.clientId) missing.push('clientId');
      if (!dtConfig?.clientSecret) missing.push('clientSecret');
      checks.push({
        code: 'missing_credentials',
        level: 'fail',
        message: t('imMissingCredentials', { fields: missing.join(', ') }),
        suggestion: t('imDingtalkFillClientIdSecret'),
      });
      return { platform, testedAt, verdict: 'fail', checks };
    }

    // Check 2: Auth probe via DingTalk API
    try {
      const tokenUrl = `https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(dtConfig.clientId)}&appsecret=${encodeURIComponent(dtConfig.clientSecret)}`;
      const resp = await this.withTimeout(
        fetchJsonWithTimeout<{ errcode?: number; errmsg?: string; access_token?: string }>(tokenUrl, {}, CONNECTIVITY_TIMEOUT_MS),
        CONNECTIVITY_TIMEOUT_MS,
        t('imAuthProbeTimeout')
      );
      if (resp.errcode && resp.errcode !== 0) {
        throw new Error(resp.errmsg || `errcode ${resp.errcode}`);
      }
      checks.push({
        code: 'auth_check',
        level: 'pass',
        message: t('imDingtalkAuthPassed'),
      });
    } catch (error) {
      checks.push({
        code: 'auth_check',
        level: 'fail',
        message: t('imDingtalkAuthFailed', { error: getErrorMessage(error) }),
        suggestion: t('imDingtalkCheckClientIdSecret'),
      });
      return { platform, testedAt, verdict: 'fail', checks };
    }

    // Check 3: OpenClaw Gateway running info
    checks.push({
      code: 'gateway_running',
      level: 'info',
      message: t('imDingtalkOpenClawHint'),
    });

    // Check 4: Bot membership hint
    checks.push({
      code: 'dingtalk_bot_membership_hint',
      level: 'info',
      message: t('imDingtalkBotMembership'),
      suggestion: t('imDingtalkBotMembershipSuggestion'),
    });

    const verdict: IMConnectivityVerdict = checks.some(c => c.level === 'fail')
      ? 'fail'
      : checks.some(c => c.level === 'warn')
        ? 'warn'
        : 'pass';

    return { platform, testedAt, verdict, checks };
  }

  private async testWecomOpenClawConnectivity(
    configOverride?: Partial<IMGatewayConfig>
  ): Promise<IMConnectivityTestResult> {
    const checks: IMConnectivityCheck[] = [];
    const testedAt = Date.now();
    const platform: Platform = 'wecom';

    const mergedConfig = this.buildMergedConfig(configOverride);
    const wecomInstances = mergedConfig.wecom?.instances || [];
    const wcConfig = pickConfiguredInstance(
      wecomInstances,
      (instance) => Boolean(instance.botId && instance.secret),
    );

    // Check 1: Credentials present
    if (!wcConfig?.botId || !wcConfig?.secret) {
      const missing: string[] = [];
      if (!wcConfig?.botId) missing.push('botId');
      if (!wcConfig?.secret) missing.push('secret');
      checks.push({
        code: 'missing_credentials',
        level: 'fail',
        message: t('imMissingCredentials', { fields: missing.join(', ') }),
        suggestion: t('imWecomFillBotIdSecret'),
      });
      return { platform, testedAt, verdict: 'fail', checks };
    }

    // Check 2: Config completeness passes
    checks.push({
      code: 'auth_check',
      level: 'pass',
      message: t('imWecomConfigReady', { botId: wcConfig.botId }),
    });

    // Check 3: OpenClaw Gateway running info
    checks.push({
      code: 'gateway_running',
      level: 'info',
      message: t('imWecomOpenClawHint'),
    });

    const verdict: IMConnectivityVerdict = checks.some(c => c.level === 'fail')
      ? 'fail'
      : checks.some(c => c.level === 'warn')
        ? 'warn'
        : 'pass';

    return { platform, testedAt, verdict, checks };
  }

  private async testWeixinOpenClawConnectivity(
    configOverride?: Partial<IMGatewayConfig>
  ): Promise<IMConnectivityTestResult> {
    const checks: IMConnectivityCheck[] = [];
    const testedAt = Date.now();
    const platform: Platform = 'weixin';

    const mergedConfig = this.buildMergedConfig(configOverride);
    const wxConfig = mergedConfig.weixin;

    // Weixin has no credentials; just check if enabled
    if (!wxConfig?.enabled) {
      checks.push({
        code: 'gateway_running',
        level: 'info',
        message: t('imWeixinNotEnabled'),
        suggestion: t('imWeixinEnableSuggestion'),
      });
      return { platform, testedAt, verdict: 'pass', checks };
    }

    // Config completeness passes (no credentials needed)
    checks.push({
      code: 'auth_check',
      level: 'pass',
      message: t('imWeixinConfigReady'),
    });

    // OpenClaw Gateway running info
    checks.push({
      code: 'gateway_running',
      level: 'info',
      message: t('imWeixinOpenClawHint'),
    });

    const verdict: IMConnectivityVerdict = checks.some(c => c.level === 'fail')
      ? 'fail'
      : checks.some(c => c.level === 'warn')
        ? 'warn'
        : 'pass';

    return { platform, testedAt, verdict, checks };
  }

  /**
   * Start Weixin QR code login via OpenClaw Gateway RPC.
   * Returns the QR code data URL and a session key for polling.
   */
  async weixinQrLoginStart(): Promise<WeixinQrLoginStartResult> {
    const client = this.getOpenClawGatewayClient?.();
    if (!client) {
      await this.ensureOpenClawGatewayReady?.();
      const retryClient = this.getOpenClawGatewayClient?.();
      if (!retryClient) {
        return { message: 'OpenClaw Gateway is not running. Please start OpenClaw engine first.' };
      }
      return this.doWeixinQrLoginStart(retryClient);
    }
    return this.doWeixinQrLoginStart(client);
  }

  private async doWeixinQrLoginStart(client: GatewayClientLike): Promise<WeixinQrLoginStartResult> {
    try {
      const result = await client.request<WeixinQrLoginStartResult>(
        'web.login.start',
        { force: true, timeoutMs: 300000, verbose: true },
      );
      console.log('[IMGatewayManager] Weixin QR login start result:', result.message);
      return result;
    } catch (err) {
      console.error('[IMGatewayManager] Weixin QR login start failed:', err);
      return { message: `Failed to start Weixin login: ${String(err)}` };
    }
  }

  /**
   * Wait for Weixin QR code scan completion via OpenClaw Gateway RPC.
   */
  async weixinQrLoginWait(sessionKey?: string): Promise<WeixinQrLoginWaitResult> {
    const client = this.getOpenClawGatewayClient?.();
    if (!client) {
      return { connected: false, message: 'OpenClaw Gateway is not connected.' };
    }
    try {
      const result = await client.request<WeixinQrLoginWaitResult>(
        'web.login.wait',
        // OpenClaw's current web.login.wait schema has no sessionKey field, so
        // the QR flow still has to pass the plugin session key through accountId.
        { timeoutMs: 480000, ...(sessionKey ? { accountId: sessionKey } : {}) },
      );
      const alreadyConnected = result.alreadyConnected === true
        || isWeixinAlreadyConnectedMessage(result.message);
      const configuredAccountId = this.getConfig().weixin?.accountId?.trim() || undefined;
      const resolvedAccountId = result.accountId
        ?? (alreadyConnected ? configuredAccountId ?? await this.resolveWeixinRuntimeAccountId(client) : undefined);
      console.log('[IMGatewayManager] Weixin QR login wait completed:', JSON.stringify({
        connected: result.connected,
        alreadyConnected,
        accountId: resolvedAccountId,
      }));
      if (result.connected) {
        // The OpenClaw login handler starts the Weixin channel after scanning.
        // Avoid a config-driven restart here, otherwise the just-established
        // login session can be interrupted and active gateway work gets drained.
        await this.ensureOpenClawGatewayConnected?.();
      }
      return {
        ...result,
        alreadyConnected,
        accountId: resolvedAccountId,
      };
    } catch (err) {
      console.error('[IMGatewayManager] Weixin QR login wait failed:', err);
      return { connected: false, message: `Login failed: ${String(err)}` };
    }
  }

  // ---------------------------------------------------------------------------
  // POPO QR code login (direct HTTP polling, no OpenClaw gateway RPC)
  // ---------------------------------------------------------------------------

  private static readonly POPO_QRCODE_BASE_URL =
    'https://f2e.popo.netease.com/polymers/lobster-bot-h5/?pp_htb=1&pp_back_type=cross&taskToken=';
  private static readonly POPO_POLLING_API =
    'https://open.popo.netease.com/open-apis/no-auth/openclaw/v1/polling';
  private static readonly POPO_COMPLETE_API =
    'https://open.popo.netease.com/open-apis/no-auth/openclaw/v1/completed';
  private static readonly POPO_POLLING_INTERVAL_MS = 5_000;
  private static readonly POPO_POLLING_TIMEOUT_MS = 10 * 60_000;

  /**
   * Start POPO QR code login: generate a taskToken and return the QR URL.
   */
  popoQrLoginStart(): { qrUrl: string; taskToken: string; timeoutMs: number } {
    const { randomUUID } = require('crypto') as typeof import('crypto');
    const taskToken = randomUUID();
    const timeout = Date.now() + IMGatewayManager.POPO_POLLING_TIMEOUT_MS;
    const qrUrl = `${IMGatewayManager.POPO_QRCODE_BASE_URL}${taskToken}&timeout=${timeout}`;
    console.log('[IMGatewayManager] POPO QR login started, taskToken:', taskToken);
    return { qrUrl, taskToken, timeoutMs: IMGatewayManager.POPO_POLLING_TIMEOUT_MS };
  }

  /**
   * Poll POPO backend for QR scan result. Blocks until credentials are returned or timeout.
   * Returns { success, appKey, appSecret, aesKey } on success.
   */
  async popoQrLoginPoll(taskToken: string): Promise<{
    success: boolean;
    appKey?: string;
    appSecret?: string;
    aesKey?: string;
    message: string;
  }> {
    const deadline = Date.now() + IMGatewayManager.POPO_POLLING_TIMEOUT_MS;

    while (Date.now() < deadline) {
      try {
        const url = `${IMGatewayManager.POPO_POLLING_API}?taskToken=${taskToken}`;
        const resp = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8_000),
        });
        if (resp.ok) {
          const data = await resp.json() as {
            data?: { status?: string; result?: { appKey?: string; appSecret?: string; aesKey?: string } };
          };
          if (data?.data?.status === 'CREATED' && data.data.result) {
            const { appKey, appSecret, aesKey } = data.data.result;
            if (appKey && appSecret && aesKey) {
              console.log('[IMGatewayManager] POPO QR login got credentials');
              // Notify the backend that setup completed. This is best-effort only.
              void this.popoQrNotifyComplete(taskToken);
              return { success: true, appKey, appSecret, aesKey, message: 'POPO 机器人绑定成功！' };
            }
          }
        }
      } catch {
        // Ignore individual poll errors, keep trying
      }
      await new Promise((resolve) => setTimeout(resolve, IMGatewayManager.POPO_POLLING_INTERVAL_MS));
    }

    console.warn('[IMGatewayManager] POPO QR login poll timed out');
    return { success: false, message: '扫码超时，请重试。' };
  }

  private async popoQrNotifyComplete(taskToken: string): Promise<void> {
    try {
      const url = `${IMGatewayManager.POPO_COMPLETE_API}?taskToken=${taskToken}`;
      await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      console.warn('[IMGatewayManager] POPO QR notify complete failed (non-critical)');
    }
  }

  private async testNimOpenClawConnectivity(
    configOverride?: Partial<IMGatewayConfig>
  ): Promise<IMConnectivityTestResult> {
    const checks: IMConnectivityCheck[] = [];
    const testedAt = Date.now();
    const platform: Platform = 'nim';

    const mergedConfig = this.buildMergedConfig(configOverride);
    const nimConfig = pickConfiguredNimInstance(mergedConfig);

    if (!nimConfig?.appKey || !nimConfig?.account || !nimConfig?.token) {
      const missing: string[] = [];
      if (!nimConfig?.appKey) missing.push('appKey');
      if (!nimConfig?.account) missing.push('account');
      if (!nimConfig?.token) missing.push('token');
      checks.push({
        code: 'missing_credentials',
        level: 'fail',
        message: t('imMissingCredentials', { fields: missing.join(', ') }),
        suggestion: t('imNimFillCredentials'),
      });
      return { platform, testedAt, verdict: 'fail', checks };
    }

    checks.push({
      code: 'auth_check',
      level: 'pass',
      message: t('imNimConfigReady', { account: nimConfig.account }),
    });

    checks.push({
      code: 'gateway_running',
      level: 'info',
      message: t('imNimOpenClawHint'),
    });

    checks.push({
      code: 'nim_p2p_only_hint',
      level: 'info',
      message: t('imNimP2pOnly'),
      suggestion: t('imNimP2pOnlySuggestion'),
    });

    const verdict: IMConnectivityVerdict = checks.some(c => c.level === 'fail')
      ? 'fail'
      : checks.some(c => c.level === 'warn')
        ? 'warn'
        : 'pass';

    return { platform, testedAt, verdict, checks };
  }

  /**
   * Test POPO connectivity when running via OpenClaw runtime.
   * Validates config completeness; actual connection is handled by OpenClaw.
   */
  private async testPopoOpenClawConnectivity(
    configOverride?: Partial<IMGatewayConfig>
  ): Promise<IMConnectivityTestResult> {
    const checks: IMConnectivityCheck[] = [];
    const testedAt = Date.now();
    const platform: Platform = 'popo';

    const mergedConfig = this.buildMergedConfig(configOverride);
    const popoConfig = pickConfiguredPopoInstance(mergedConfig);

    // Check 1: Credentials present
    const isWebhookMode = (popoConfig?.connectionMode ?? 'websocket') === 'webhook';
    const missing: string[] = [];
    if (!popoConfig?.appKey) missing.push('appKey');
    if (!popoConfig?.appSecret) missing.push('appSecret');
    if (isWebhookMode && !popoConfig?.token) missing.push('token');
    if (!popoConfig?.aesKey) missing.push('aesKey');
    if (missing.length > 0) {
      checks.push({
        code: 'missing_credentials',
        level: 'fail',
        message: t('imMissingCredentials', { fields: missing.join(', ') }),
        suggestion: isWebhookMode
          ? t('imPopoFillWebhookCredentials')
          : t('imPopoFillWsCredentials'),
      });
      return { platform, testedAt, verdict: 'fail', checks };
    }

    // Check 2: Config completeness passes
    checks.push({
      code: 'auth_check',
      level: 'pass',
      message: t('imPopoConfigReady'),
    });

    // Check 3: OpenClaw Gateway running info
    checks.push({
      code: 'gateway_running',
      level: 'info',
      message: t('imPopoOpenClawHint'),
    });

    const verdict: IMConnectivityVerdict = checks.some(c => c.level === 'fail')
      ? 'fail'
      : checks.some(c => c.level === 'warn')
        ? 'warn'
        : 'pass';

    return { platform, testedAt, verdict, checks };
  }

  private async testQQOpenClawConnectivity(
    configOverride?: Partial<IMGatewayConfig>
  ): Promise<IMConnectivityTestResult> {
    const checks: IMConnectivityCheck[] = [];
    const testedAt = Date.now();
    const platform: Platform = 'qq';

    const mergedConfig = this.buildMergedConfig(configOverride);
    const qqInstances = mergedConfig.qq?.instances || [];
    const qqConfig = pickConfiguredInstance(
      qqInstances,
      (instance) => Boolean(instance.appId && instance.appSecret),
    );

    if (!qqConfig?.appId || !qqConfig?.appSecret) {
      const missing: string[] = [];
      if (!qqConfig?.appId) missing.push('appId');
      if (!qqConfig?.appSecret) missing.push('appSecret');
      checks.push({
        code: 'missing_credentials',
        level: 'fail',
        message: t('imMissingCredentials', { fields: missing.join(', ') }),
        suggestion: t('imQqFillAppIdSecret'),
      });
      return { platform, testedAt, verdict: 'fail', checks };
    }

    try {
      const tokenResponse = await this.withTimeout(
        fetchJsonWithTimeout<{ access_token?: string; expires_in?: number; code?: number; message?: string }>(
          'https://bots.qq.com/app/getAppAccessToken',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appId: qqConfig.appId, clientSecret: qqConfig.appSecret }),
          },
          CONNECTIVITY_TIMEOUT_MS
        ),
        CONNECTIVITY_TIMEOUT_MS,
        t('imAuthProbeTimeout')
      );
      if (!tokenResponse.access_token) {
        throw new Error(tokenResponse.message || t('imQqAccessTokenFailed'));
      }
      checks.push({
        code: 'auth_check',
        level: 'pass',
        message: t('imQqAuthPassed'),
      });
    } catch (error) {
      checks.push({
        code: 'auth_check',
        level: 'fail',
        message: t('imQqAuthFailed', { error: getErrorMessage(error) }),
        suggestion: t('imQqCheckAppIdSecret'),
      });
      return { platform, testedAt, verdict: 'fail', checks };
    }

    checks.push({
      code: 'gateway_running',
      level: 'info',
      message: t('imQqOpenClawHint'),
    });

    checks.push({
      code: 'qq_guild_mention_hint',
      level: 'info',
      message: t('imQqMentionHint'),
    });

    return {
      platform,
      testedAt,
      verdict: this.calculateVerdict(checks),
      checks,
    };
  }



  private buildMergedConfig(configOverride?: Partial<IMGatewayConfig>): IMGatewayConfig {
    const current = this.getConfig();
    if (!configOverride) {
      return current;
    }
    return {
      ...current,
      ...configOverride,
      dingtalk: configOverride.dingtalk || current.dingtalk,
      feishu: configOverride.feishu || current.feishu,
      qq: configOverride.qq || current.qq,
      telegram: { ...current.telegram, ...(configOverride.telegram || {}) },
      discord: { ...current.discord, ...(configOverride.discord || {}) },
      nim: mergeNimConfigOverride(current.nim, configOverride.nim),
      'netease-bee': { ...current['netease-bee'], ...(configOverride['netease-bee'] || {}) },
      wecom: configOverride.wecom || current.wecom,
      weixin: { ...current.weixin, ...(configOverride.weixin || {}) },
      popo: mergePopoConfigOverride(current.popo, configOverride.popo),
      settings: { ...current.settings, ...(configOverride.settings || {}) },
    };
  }

  private getMissingCredentials(platform: Platform, config: IMGatewayConfig): string[] {
    if (platform === 'dingtalk') {
      const dingtalkInstances = config.dingtalk?.instances || [];
      const dingtalkConfig = pickConfiguredInstance(
        dingtalkInstances,
        (instance) => Boolean(instance.clientId && instance.clientSecret),
      );
      const fields: string[] = [];
      if (!dingtalkConfig?.clientId) fields.push('clientId');
      if (!dingtalkConfig?.clientSecret) fields.push('clientSecret');
      return fields;
    }
    if (platform === 'feishu') {
      const feishuInstances = config.feishu?.instances || [];
      const feishuConfig = pickConfiguredInstance(
        feishuInstances,
        (instance) => Boolean(instance.appId && instance.appSecret),
      );
      const fields: string[] = [];
      if (!feishuConfig?.appId) fields.push('appId');
      if (!feishuConfig?.appSecret) fields.push('appSecret');
      return fields;
    }
    if (platform === 'telegram') {
      return config.telegram.botToken ? [] : ['botToken'];
    }
    if (platform === 'nim') {
      const nimConfig = pickConfiguredNimInstance(config);
      const fields: string[] = [];
      if (!nimConfig?.appKey) fields.push('appKey');
      if (!nimConfig?.account) fields.push('account');
      if (!nimConfig?.token && !nimConfig?.nimToken) fields.push('token');
      return fields;
    }
    if (platform === 'netease-bee') {
      const fields: string[] = [];
      if (!config['netease-bee']?.clientId) fields.push('clientId');
      if (!config['netease-bee']?.secret) fields.push('secret');
      return fields;
    }
    if (platform === 'qq') {
      const qqInstances = config.qq?.instances || [];
      const qqConfig = pickConfiguredInstance(
        qqInstances,
        (instance) => Boolean(instance.appId && instance.appSecret),
      );
      const fields: string[] = [];
      if (!qqConfig?.appId) fields.push('appId');
      if (!qqConfig?.appSecret) fields.push('appSecret');
      return fields;
    }
    if (platform === 'wecom') {
      const wecomInstances = config.wecom?.instances || [];
      const wecomConfig = pickConfiguredInstance(
        wecomInstances,
        (instance) => Boolean(instance.botId && instance.secret),
      );
      const fields: string[] = [];
      if (!wecomConfig?.botId) fields.push('botId');
      if (!wecomConfig?.secret) fields.push('secret');
      return fields;
    }
    if (platform === 'weixin') {
      // Weixin has no credentials; nothing to check
      return [];
    }
    if (platform === 'popo') {
      const popoConfig = pickConfiguredPopoInstance(config);
      const fields: string[] = [];
      if (!popoConfig?.appKey) fields.push('appKey');
      if (!popoConfig?.appSecret) fields.push('appSecret');
      if ((popoConfig?.connectionMode ?? 'websocket') === 'webhook' && !popoConfig?.token) fields.push('token');
      if (!popoConfig?.aesKey) fields.push('aesKey');
      return fields;
    }
    return config.discord.botToken ? [] : ['botToken'];
  }

  private async runAuthProbe(platform: Platform, config: IMGatewayConfig): Promise<string> {
    if (platform === 'dingtalk') {
      const dingtalkInstances = config.dingtalk?.instances || [];
      const dingtalkConfig = pickConfiguredInstance(
        dingtalkInstances,
        (instance) => Boolean(instance.clientId && instance.clientSecret),
      );
      if (!dingtalkConfig?.clientId || !dingtalkConfig?.clientSecret) {
        throw new Error(t('imConfigIncomplete'));
      }
      const tokenUrl = `https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(dingtalkConfig.clientId)}&appsecret=${encodeURIComponent(dingtalkConfig.clientSecret)}`;
      const resp = await fetchJsonWithTimeout<{ errcode?: number; errmsg?: string }>(tokenUrl, {}, CONNECTIVITY_TIMEOUT_MS);
      if (resp.errcode && resp.errcode !== 0) {
        throw new Error(resp.errmsg || `errcode ${resp.errcode}`);
      }
      return t('imDingtalkAuthPassed');
    }

    if (platform === 'feishu') {
      const feishuInstances = config.feishu?.instances || [];
      const feishuConfig = pickConfiguredInstance(
        feishuInstances,
        (instance) => Boolean(instance.appId && instance.appSecret),
      );
      if (!feishuConfig?.appId || !feishuConfig?.appSecret) {
        throw new Error(t('imConfigIncomplete'));
      }
      const Lark = await import('@larksuiteoapi/node-sdk');
      const domain = this.resolveFeishuDomain(feishuConfig.domain, Lark);
      const client = new Lark.Client({
        appId: feishuConfig.appId,
        appSecret: feishuConfig.appSecret,
        appType: Lark.AppType.SelfBuild,
        domain,
      });
      const response = await client.request({
        method: 'GET',
        url: '/open-apis/bot/v3/info',
      }) as FeishuBotInfoResponse;
      if (response.code !== 0) {
        throw new Error(response.msg || `code ${response.code}`);
      }
      const botName = response.data?.app_name ?? response.data?.bot?.app_name ?? 'unknown';
      return t('imFeishuAuthPassedWithBot', { botName });
    }

    if (platform === 'nim') {
      const nimConfig = pickConfiguredNimInstance(config);
      const appKey = nimConfig?.appKey;
      const account = nimConfig?.account;
      const token = nimConfig?.token || nimConfig?.nimToken;
      if (!appKey || !account || !token) {
        throw new Error(t('imConfigIncomplete'));
      }
      return t('imNimConfigReady', { account });
    }

    if (platform === 'netease-bee') {
      const nbConfig = config['netease-bee'];
      const clientId = nbConfig?.clientId;
      const secret = nbConfig?.secret;
      if (!clientId || !secret) {
        throw new Error(t('imConfigIncomplete'));
      }
      return t('imNeteaseBeeConfigReady', { clientId });
    }

    if (platform === 'wecom') {
      const wecomInstances = config.wecom?.instances || [];
      const wecomConfig = pickConfiguredInstance(
        wecomInstances,
        (instance) => Boolean(instance.botId && instance.secret),
      );
      const botId = wecomConfig?.botId;
      const secret = wecomConfig?.secret;
      if (!botId || !secret) {
        throw new Error(t('imConfigIncomplete'));
      }
      return t('imWecomConfigReadyOpenClaw', { botId });

    }

    if (platform === 'weixin') {
      // Weixin has no credentials to probe; just confirm enabled
      return t('imWeixinConfigReadyOpenClaw');
    }

    if (platform === 'popo') {
      const popoConfig = pickConfiguredPopoInstance(config);
      const appKey = popoConfig?.appKey;
      const appSecret = popoConfig?.appSecret;
      const token = popoConfig?.token;
      const aesKey = popoConfig?.aesKey;
      const connectionMode = popoConfig?.connectionMode;
      const isWebhook = (connectionMode ?? 'websocket') === 'webhook';
      if (!appKey || !appSecret || !aesKey || (isWebhook && !token)) {
        throw new Error(t('imConfigIncomplete'));
      }
      return t('imPopoConfigReadyOpenClaw');
    }

    if (platform === 'qq') {
      const qqInstances = config.qq?.instances || [];
      const qqConfig = pickConfiguredInstance(
        qqInstances,
        (instance) => Boolean(instance.appId && instance.appSecret),
      );
      const appId = qqConfig?.appId;
      const appSecret = qqConfig?.appSecret;
      if (!appId || !appSecret) {
        throw new Error(t('imConfigIncomplete'));
      }
      // Verify credentials by requesting an AccessToken directly via HTTP
      // This avoids starting a full WebSocket connection just for auth check
      const tokenResponse = await fetchJsonWithTimeout<{ access_token?: string; expires_in?: number; code?: number; message?: string }>(
        'https://bots.qq.com/app/getAppAccessToken',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId, clientSecret: appSecret }),
        },
        CONNECTIVITY_TIMEOUT_MS
      );
      if (!tokenResponse.access_token) {
        throw new Error(tokenResponse.message || t('imQqAccessTokenFailed'));
      }
      return t('imQqAuthPassed');
    }

    return t('imUnknownPlatform');
  }


  async sendConversationReply(platform: Platform, conversationId: string, text: string): Promise<boolean> {
    try {
      switch (platform) {
        default:
          return this.sendNotificationWithMedia(platform, text);
      }
    } catch (error) {
      console.error(`[IMGatewayManager] Failed to send conversation reply for ${platform}:${conversationId}:`, error);
      return false;
    }
  }

  // ─── DingTalk direct HTTP API ──────────────────────────────────────────────

  private async getDingTalkAccessToken(clientId: string, clientSecret: string): Promise<string> {
    const now = Date.now();
    if (this.dingTalkAccessToken && this.dingTalkAccessTokenExpiry > now + 60_000) {
      return this.dingTalkAccessToken;
    }

    const resp = await fetchJsonWithTimeout<{
      accessToken?: string;
      expireIn?: number;
    }>('https://api.dingtalk.com/v1.0/oauth2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appKey: clientId, appSecret: clientSecret }),
    }, 10_000);

    if (!resp.accessToken) {
      throw new Error('DingTalk accessToken response missing token');
    }

    this.dingTalkAccessToken = resp.accessToken;
    this.dingTalkAccessTokenExpiry = now + ((resp.expireIn ?? 7200) * 1000);
    return this.dingTalkAccessToken;
  }

  private async sendDingTalkDirectHttp(userId: string, text: string): Promise<boolean> {
    const dtConfig = this.imStore.getDingTalkOpenClawConfig();
    if (!dtConfig.clientId || !dtConfig.clientSecret) {
      console.warn('[IMGatewayManager] DingTalk direct send skipped: missing clientId/clientSecret');
      return false;
    }

    const token = await this.getDingTalkAccessToken(dtConfig.clientId, dtConfig.clientSecret);

    // Auto-detect markdown vs plain text.
    const hasMarkdown = /^[#*>\-]|[*_`#\[\]]/.test(text) || text.includes('\n');
    const msgKey = hasMarkdown ? 'sampleMarkdown' : 'sampleText';
    const msgParam = hasMarkdown
      ? { title: text.split('\n')[0].replace(/^[#*\s\->]+/, '').slice(0, 20) || 'Message', text }
      : { content: text };

    const body = {
      robotCode: dtConfig.clientId,
      userIds: [userId],
      msgKey,
      msgParam: JSON.stringify(msgParam),
    };

    console.log('[IMGatewayManager] DingTalk direct HTTP send', JSON.stringify({
      userId,
      msgKey,
      textLength: text.length,
    }));

    const resp = await fetchJsonWithTimeout<{
      processQueryKey?: string;
      message?: string;
    }>('https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend', {
      method: 'POST',
      headers: {
        'x-acs-dingtalk-access-token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }, 10_000);

    if (resp.processQueryKey) {
      console.log(`[IMGatewayManager] DingTalk direct send success: processQueryKey=${resp.processQueryKey}`);
      return true;
    }

    console.warn('[IMGatewayManager] DingTalk direct send unexpected response:', JSON.stringify(resp));
    return false;
  }
  async primeConversationReplyRoute(
    platform: Platform,
    conversationId: string,
    coworkSessionId: string,
  ): Promise<void> {
    if (platform !== 'dingtalk') {
      return;
    }

    try {
      const lookup = await this.lookupDingTalkConversationReplyRoute(conversationId, coworkSessionId);
      const resolved = lookup?.resolved;
      if (resolved) {
        this.cacheConversationReplyRoute('dingtalk', conversationId, resolved.route);
        const sendParams = buildDingTalkSendParamsFromRoute(resolved.route);
        console.log('[IMGatewayManager] Primed DingTalk reply route', JSON.stringify({
          conversationId,
          coworkSessionId: lookup.coworkSessionId,
          sessionKey: resolved.sessionKey,
          channel: resolved.route.channel,
          target: sendParams?.target ?? resolved.route.to,
          accountId: sendParams?.accountId ?? resolved.route.accountId ?? null,
        }));
        return;
      }

      // Fallback: construct route from session key JSON context.
      // When the OpenClaw session lacks deliveryContext (e.g. cron-triggered runs),
      // the session key itself may embed a JSON SessionContext with all needed info.
      const fallbackRoute = this.buildDingTalkRouteFromSessionKeys(
        lookup?.candidateSessionKeys ?? [],
      );
      if (fallbackRoute) {
        this.cacheConversationReplyRoute('dingtalk', conversationId, fallbackRoute.route);
        console.log('[IMGatewayManager] Primed DingTalk reply route from session key context', JSON.stringify({
          conversationId,
          coworkSessionId,
          sessionKey: fallbackRoute.sessionKey,
          channel: fallbackRoute.route.channel,
          target: fallbackRoute.route.to,
          accountId: fallbackRoute.route.accountId ?? null,
        }));
      }
    } catch (error) {
      console.warn(
        `[IMGatewayManager] Failed to prime DingTalk reply route for ${conversationId}:`,
        getErrorMessage(error),
      );
    }
  }

  private async resolveDingTalkConversationReplyTarget(
    conversationId: string,
  ): Promise<{ accountId?: string; target: string } | null> {
    let lookup: Awaited<ReturnType<IMGatewayManager['lookupDingTalkConversationReplyRoute']>> = null;
    try {
      lookup = await this.lookupDingTalkConversationReplyRoute(conversationId);
    } catch (error) {
      console.warn(
        `[IMGatewayManager] Failed to query OpenClaw DingTalk reply route for ${conversationId}:`,
        getErrorMessage(error),
      );
    }

    if (!lookup?.resolved) {
      if (lookup) {
        console.warn(
          `[IMGatewayManager] No OpenClaw delivery route found for DingTalk session ${lookup.coworkSessionId}`,
          JSON.stringify({
            conversationId,
            candidateSessionKeys: lookup.candidateSessionKeys,
            dingtalkSessionKeys: lookup.dingtalkSessionKeys,
          }),
        );
      }

      const cachedRoute = this.imStore.getConversationReplyRoute('dingtalk', conversationId);
      if (cachedRoute) {
        const cachedSendParams = buildDingTalkSendParamsFromRoute(cachedRoute);
        if (cachedSendParams) {
          console.log('[IMGatewayManager] Reused cached DingTalk reply route', JSON.stringify({
            conversationId,
            channel: cachedRoute.channel,
            target: cachedSendParams.target,
            accountId: cachedSendParams.accountId ?? null,
          }));
          return cachedSendParams;
        }
      }

      // Fallback: construct route from session key JSON context when OpenClaw
      // session lacks deliveryContext (common for cron-triggered runs).
      const fallbackRoute = this.buildDingTalkRouteFromSessionKeys(
        lookup?.candidateSessionKeys ?? [],
      );
      if (fallbackRoute) {
        this.cacheConversationReplyRoute('dingtalk', conversationId, fallbackRoute.route);
        const fallbackSendParams = buildDingTalkSendParamsFromRoute(fallbackRoute.route);
        if (fallbackSendParams) {
          console.log('[IMGatewayManager] Resolved DingTalk reply route from session key context', JSON.stringify({
            conversationId,
            sessionKey: fallbackRoute.sessionKey,
            channel: fallbackRoute.route.channel,
            target: fallbackSendParams.target,
            accountId: fallbackSendParams.accountId ?? null,
          }));
          return fallbackSendParams;
        }
      }

      return null;
    }

    const { resolved } = lookup;
    this.cacheConversationReplyRoute('dingtalk', conversationId, resolved.route);

    const sendParams = buildDingTalkSendParamsFromRoute(resolved.route);
    if (!sendParams) {
      console.warn(
        `[IMGatewayManager] OpenClaw route for ${resolved.sessionKey} is not a DingTalk route: ${resolved.route.channel}`,
      );
      return null;
    }

    console.log('[IMGatewayManager] Resolved DingTalk reply route', JSON.stringify({
      conversationId,
      coworkSessionId: lookup.coworkSessionId,
      sessionKey: resolved.sessionKey,
      channel: resolved.route.channel,
      target: sendParams.target,
      accountId: sendParams.accountId ?? null,
    }));
    return sendParams;
  }

  private async lookupDingTalkConversationReplyRoute(
    conversationId: string,
    coworkSessionId?: string,
  ): Promise<{
    coworkSessionId: string;
    candidateSessionKeys: string[];
    dingtalkSessionKeys: string[];
    resolved: { sessionKey: string; route: OpenClawDeliveryRoute } | null;
  } | null> {
    const normalizedCoworkSessionId = coworkSessionId?.trim()
      || this.imStore.getSessionMapping(conversationId, 'dingtalk')?.coworkSessionId
      || '';
    if (!normalizedCoworkSessionId) {
      return null;
    }

    const result = await this.requestOpenClawGateway<OpenClawSessionsListResult>('sessions.list', {
      includeGlobal: true,
      includeUnknown: true,
      limit: 200,
    });
    const sessions = Array.isArray(result?.sessions) ? result.sessions : [];
    const candidateSessionKeys = [
      ...(this.getOpenClawSessionKeysForCoworkSession?.(normalizedCoworkSessionId) ?? []),
      ...buildDingTalkSessionKeyCandidates(conversationId),
    ];

    return {
      coworkSessionId: normalizedCoworkSessionId,
      candidateSessionKeys,
      dingtalkSessionKeys: this.collectSessionKeysByChannel(sessions, 'dingtalk'),
      resolved: resolveOpenClawDeliveryRouteForSessionKeys(candidateSessionKeys, sessions)
        ?? resolveManagedSessionDeliveryRoute(normalizedCoworkSessionId, sessions),
    };
  }

  private cacheConversationReplyRoute(
    platform: Platform,
    conversationId: string,
    route: OpenClawDeliveryRoute,
  ): void {
    this.imStore.setConversationReplyRoute(platform, conversationId, route);
  }

  private collectSessionKeysByChannel(sessions: unknown[], channel: string): string[] {
    const normalizedChannel = channel.trim().toLowerCase();
    const matches: string[] = [];
    for (const entry of sessions) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        continue;
      }
      const record = entry as Record<string, unknown>;
      const key = typeof record.key === 'string' ? record.key.trim() : '';
      if (!key) {
        continue;
      }
      const deliveryContext = record.deliveryContext;
      const deliveryChannel = deliveryContext && typeof deliveryContext === 'object' && !Array.isArray(deliveryContext)
        ? (typeof (deliveryContext as Record<string, unknown>).channel === 'string'
          ? ((deliveryContext as Record<string, unknown>).channel as string)
          : undefined)
        : undefined;
      const lastChannel = typeof record.lastChannel === 'string' ? record.lastChannel : undefined;
      const routeChannel = (deliveryChannel ?? lastChannel ?? '').trim().toLowerCase();
      if (routeChannel !== normalizedChannel && !key.toLowerCase().includes(normalizedChannel)) {
        continue;
      }
      matches.push(key);
      if (matches.length >= 12) {
        break;
      }
    }
    return matches;
  }

  private parseDingTalkConversationTarget(
    conversationId: string,
  ): { accountId?: string; target: string } | null {
    const parts = conversationId.split(':').filter(Boolean);
    if (parts.length < 2) {
      return null;
    }

    const accountId = parts[0]?.trim();
    if (!accountId) {
      return null;
    }

    // The dingtalk-connector plugin uses "__default__" as an internal account
    // lookup key.  The send API expects this key (or undefined for default),
    // NOT the actual clientId.  Omit it so the plugin uses its default account.
    const resolvedAccountId = accountId === '__default__' ? undefined : accountId;

    if ((parts[1] === 'user' || parts[1] === 'group') && parts[2]) {
      return {
        accountId: resolvedAccountId,
        target: `${parts[1]}:${parts.slice(2).join(':')}`,
      };
    }

    const senderId = parts[1]?.trim();
    if (!senderId) {
      return null;
    }

    return {
      accountId: resolvedAccountId,
      target: `user:${senderId}`,
    };
  }

  private buildDingTalkRouteFromSessionKeys(
    sessionKeys: string[],
  ): { sessionKey: string; route: OpenClawDeliveryRoute } | null {
    for (const sessionKey of sessionKeys) {
      const jsonIdx = sessionKey.indexOf(':{');
      if (jsonIdx < 0) {
        continue;
      }
      const jsonStr = sessionKey.slice(jsonIdx + 1);
      let ctx: Record<string, unknown>;
      try {
        ctx = JSON.parse(jsonStr);
      } catch {
        continue;
      }
      if (!ctx || typeof ctx.channel !== 'string') {
        continue;
      }
      const channel = (ctx.channel as string).trim().toLowerCase();
      if (channel !== 'dingtalk-connector' && channel !== 'dingtalk') {
        continue;
      }

      // Determine the target address from the session context.
      const chatType = typeof ctx.chattype === 'string' ? ctx.chattype : 'direct';
      const peerId = typeof ctx.peerid === 'string' ? (ctx.peerid as string).trim() : '';
      const ctxConversationId = typeof ctx.conversationid === 'string' ? (ctx.conversationid as string).trim() : '';
      if (!peerId && !ctxConversationId) {
        continue;
      }

      const to = chatType === 'group'
        ? `group:${ctxConversationId || peerId}`
        : `user:${peerId || ctxConversationId}`;

      // Keep the original accountId from the session context (e.g. '__default__').
      // The dingtalk-connector plugin uses this as an account lookup key, NOT the clientId.
      // When accountId is '__default__', omit it so the plugin uses its default account.
      let accountId = typeof ctx.accountid === 'string' ? (ctx.accountid as string).trim() : undefined;
      if (!accountId || accountId === '__default__') {
        accountId = undefined;
      }

      return {
        sessionKey,
        route: {
          channel: 'dingtalk',
          to,
          ...(accountId ? { accountId } : {}),
        },
      };
    }
    return null;
  }

  /**
   * Fetch the OpenClaw config schema (JSON Schema + uiHints) from the gateway.
   * Returns { schema, uiHints } or null if the gateway is unavailable.
   */
  async getOpenClawConfigSchema(): Promise<{ schema: Record<string, unknown>; uiHints: Record<string, Record<string, unknown>> } | null> {
    try {
      return await this.requestOpenClawGateway<{ schema: Record<string, unknown>; uiHints: Record<string, Record<string, unknown>> }>('config.schema', {});
    } catch (err) {
      console.warn('[IMGatewayManager] Failed to fetch config.schema from OpenClaw gateway:', getErrorMessage(err));
      return null;
    }
  }

  private async requestOpenClawGateway<T = Record<string, unknown>>(
    method: string,
    params?: unknown,
  ): Promise<T> {
    let client = this.getOpenClawGatewayClient?.() ?? null;
    if (!client) {
      await this.ensureOpenClawGatewayReady?.();
      client = this.getOpenClawGatewayClient?.() ?? null;
    }
    if (!client) {
      throw new Error('OpenClaw gateway client is unavailable.');
    }
    return client.request<T>(method, params);
  }

  private resolveFeishuDomain(domain: string, Lark: typeof LarkSdk): symbol | string {
    if (domain === 'lark') return Lark.Domain.Lark;
    if (domain === 'feishu') return Lark.Domain.Feishu;
    return domain.replace(/\/+$/, '');
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutError: string): Promise<T> {
    let timeoutId: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<T>((_resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error(timeoutError)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    });
  }

  private getStartedAtMs(platform: Platform, status: IMGatewayStatus): number | null {
    if (platform === 'feishu') {
      const instance = status.feishu.instances.find((item) => item.connected) || status.feishu.instances[0];
      return instance?.startedAt ? Date.parse(instance.startedAt) : null;
    }
    if (platform === 'dingtalk') return status.dingtalk.instances.find((item) => item.connected)?.startedAt ?? status.dingtalk.instances[0]?.startedAt ?? null;
    if (platform === 'telegram') return status.telegram.startedAt;
    if (platform === 'nim') return status.nim.startedAt;
    if (platform === 'netease-bee') return status['netease-bee'].startedAt;
    if (platform === 'qq') return status.qq.instances.find((item) => item.connected)?.startedAt ?? status.qq.instances[0]?.startedAt ?? null;
    if (platform === 'wecom') return status.wecom.instances.find((item) => item.connected)?.startedAt ?? status.wecom.instances[0]?.startedAt ?? null;
    if (platform === 'weixin') return status.weixin.startedAt;
    if (platform === 'popo') return status.popo.startedAt;
    return status.discord.startedAt;
  }

  private getPlatformEnabled(config: IMGatewayConfig, platform: Platform): boolean {
    return isPlatformEnabled(config, platform);
  }

  private getLastInboundAt(platform: Platform, status: IMGatewayStatus): number | null {
    if (platform === 'dingtalk') return status.dingtalk.instances.find((item) => item.connected)?.lastInboundAt ?? status.dingtalk.instances[0]?.lastInboundAt ?? null;
    if (platform === 'feishu') return status.feishu.instances.find((item) => item.connected)?.lastInboundAt ?? status.feishu.instances[0]?.lastInboundAt ?? null;
    if (platform === 'telegram') return status.telegram.lastInboundAt;
    if (platform === 'nim') return status.nim.lastInboundAt;
    if (platform === 'netease-bee') return status['netease-bee'].lastInboundAt;
    if (platform === 'qq') return status.qq.instances.find((item) => item.connected)?.lastInboundAt ?? status.qq.instances[0]?.lastInboundAt ?? null;
    if (platform === 'wecom') return status.wecom.instances.find((item) => item.connected)?.lastInboundAt ?? status.wecom.instances[0]?.lastInboundAt ?? null;
    if (platform === 'weixin') return status.weixin.lastInboundAt;
    if (platform === 'popo') return status.popo.lastInboundAt;
    return status.discord.lastInboundAt;
  }

  private getLastOutboundAt(platform: Platform, status: IMGatewayStatus): number | null {
    if (platform === 'dingtalk') return status.dingtalk.instances.find((item) => item.connected)?.lastOutboundAt ?? status.dingtalk.instances[0]?.lastOutboundAt ?? null;
    if (platform === 'feishu') return status.feishu.instances.find((item) => item.connected)?.lastOutboundAt ?? status.feishu.instances[0]?.lastOutboundAt ?? null;
    if (platform === 'telegram') return status.telegram.lastOutboundAt;
    if (platform === 'nim') return status.nim.lastOutboundAt;
    if (platform === 'netease-bee') return status['netease-bee'].lastOutboundAt;
    if (platform === 'qq') return status.qq.instances.find((item) => item.connected)?.lastOutboundAt ?? status.qq.instances[0]?.lastOutboundAt ?? null;
    if (platform === 'wecom') return status.wecom.instances.find((item) => item.connected)?.lastOutboundAt ?? status.wecom.instances[0]?.lastOutboundAt ?? null;
    if (platform === 'weixin') return status.weixin.lastOutboundAt;
    if (platform === 'popo') return status.popo.lastOutboundAt;
    return status.discord.lastOutboundAt;
  }

  private getLastError(platform: Platform, status: IMGatewayStatus): string | null {
    if (platform === 'dingtalk') return status.dingtalk.instances.find((item) => item.lastError)?.lastError ?? status.dingtalk.instances[0]?.lastError ?? null;
    if (platform === 'feishu') return status.feishu.instances.find((item) => item.error)?.error ?? status.feishu.instances[0]?.error ?? null;
    if (platform === 'telegram') return status.telegram.lastError;
    if (platform === 'nim') return status.nim.lastError;
    if (platform === 'netease-bee') return status['netease-bee'].lastError;
    if (platform === 'qq') return status.qq.instances.find((item) => item.lastError)?.lastError ?? status.qq.instances[0]?.lastError ?? null;
    if (platform === 'wecom') return status.wecom.instances.find((item) => item.lastError)?.lastError ?? status.wecom.instances[0]?.lastError ?? null;
    if (platform === 'weixin') return status.weixin.lastError;
    if (platform === 'popo') return status.popo.lastError;
    return status.discord.lastError;
  }

  // ==================== Feishu Bot Install Helpers ====================

  /** Lazy-load and cache the feishu-auth module (avoid repeated dynamic import overhead). */
  private _feishuAuthModule: typeof FeishuAuthModule | null = null;
  private async getFeishuAuthModule(): Promise<typeof FeishuAuthModule> {
    if (!this._feishuAuthModule) {
      this._feishuAuthModule = await import('@larksuite/openclaw-lark-tools/dist/utils/feishu-auth.js');
    }
    return this._feishuAuthModule;
  }

  /**
   * Start the Feishu Device Flow onboarding: init + begin.
   * Returns data needed to render a QR code in the UI.
   * Also caches isLark so that pollFeishuInstall uses the correct domain.
   */
  private _feishuInstallIsLark = false;
  async startFeishuInstallQrcode(isLark: boolean): Promise<{
    url: string;
    deviceCode: string;
    interval: number;
    expireIn: number;
  }> {
    const { FeishuAuth } = await this.getFeishuAuthModule();
    this._feishuInstallIsLark = isLark;
    const auth = new FeishuAuth();
    auth.setDomain(isLark);
    await auth.init();
    const resp = await auth.begin();
    return {
      url: resp.verification_uri_complete,
      deviceCode: resp.device_code,
      interval: resp.interval ?? 5,
      expireIn: resp.expire_in ?? 300,
    };
  }

  /**
   * Poll Feishu Device Flow for the result of a QR code scan.
   * Uses the domain set during startFeishuInstallQrcode to ensure consistency.
   */
  async pollFeishuInstall(deviceCode: string): Promise<{
    done: boolean;
    appId?: string;
    appSecret?: string;
    domain?: string;
    error?: string;
  }> {
    const { FeishuAuth } = await this.getFeishuAuthModule();
    const auth = new FeishuAuth();
    auth.setDomain(this._feishuInstallIsLark);
    const resp = await auth.poll(deviceCode);
    if (resp.error) {
      if (resp.error === 'authorization_pending' || resp.error === 'slow_down') {
        return { done: false };
      }
      return { done: false, error: resp.error_description || resp.error };
    }
    if (resp.client_id && resp.client_secret) {
      const domain = resp.user_info?.tenant_brand === 'lark' ? 'lark' : 'feishu';
      return { done: true, appId: resp.client_id, appSecret: resp.client_secret, domain };
    }
    return { done: false };
  }

  /**
   * Validate existing Feishu app credentials (App ID + App Secret).
   */
  async verifyFeishuCredentials(appId: string, appSecret: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const { validateAppCredentials } = await this.getFeishuAuthModule();
    try {
      const valid = await validateAppCredentials(appId, appSecret);
      if (valid) {
        return { success: true };
      }
      return { success: false, error: t('feishuVerifyCredentialsFailed') };
    } catch (err) {
      return { success: false, error: getErrorMessage(err) || t('feishuVerifyFailed') };
    }
  }

  private calculateVerdict(checks: IMConnectivityCheck[]): IMConnectivityVerdict {
    if (checks.some((check) => check.level === 'fail')) {
      return 'fail';
    }
    if (checks.some((check) => check.level === 'warn')) {
      return 'warn';
    }
    return 'pass';
  }
}
