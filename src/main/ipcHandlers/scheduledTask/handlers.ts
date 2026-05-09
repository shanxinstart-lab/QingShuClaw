import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import {
  IpcChannel as ScheduledTaskIpc,
  DeliveryMode as STDeliveryMode,
  SessionTarget as STSessionTarget,
  PayloadKind as STPayloadKind,
} from '../../../scheduledTask/constants';
import { PlatformRegistry } from '../../../shared/platform';
import { mapGatewayJob, type CronJobService } from '../../../scheduledTask/cronJobService';
import type { ScheduledTask } from '../../../scheduledTask/types';
import { listScheduledTaskChannels } from './helpers';

export interface ScheduledTaskHandlerDeps {
  getCronJobService: () => CronJobService;
  getIMGatewayManager: () => {
    getIMStore: () => {
      getSessionMapping: (conversationId: string, platform: string) => {
        coworkSessionId: string;
      } | undefined;
      listSessionMappings: (platform: string, accountId?: string) => Array<{
        imConversationId: string;
        platform: string;
        coworkSessionId: string;
        lastActiveAt: number;
      }>;
    } | undefined;
    primeConversationReplyRoute: (
      platform: string,
      conversationId: string,
      coworkSessionId: string,
    ) => Promise<void>;
  } | null;
  getOpenClawRuntimeAdapter: () => {
    getGatewayClient: () => unknown;
    fetchSessionByKey: (sessionKey: string) => Promise<unknown>;
  } | null;
}

/**
 * Normalize announce-mode IM delivery before handing it to OpenClaw cron.
 * Mutates `normalizedInput` in place to preserve the existing IPC contract.
 */
async function applyAnnounceDeliveryNormalization(
  normalizedInput: Record<string, any>,
  getIMGatewayManager: ScheduledTaskHandlerDeps['getIMGatewayManager'],
): Promise<void> {
  const delivery = normalizedInput.delivery;
  if (!(delivery && delivery.mode === STDeliveryMode.Announce && delivery.channel && delivery.to)) {
    return;
  }

  const platform = PlatformRegistry.platformOfChannel(delivery.channel);
  if (!platform) return;

  normalizedInput.sessionTarget = STSessionTarget.Isolated;
  if (normalizedInput.payload?.kind === STPayloadKind.SystemEvent) {
    normalizedInput.payload = {
      kind: STPayloadKind.AgentTurn,
      message: normalizedInput.payload.text || '',
    };
  }

  // Strip IM subtype prefix before passing delivery.to to OpenClaw.
  const rawTo = delivery.to;
  const colonIdx = rawTo.lastIndexOf(':');
  if (colonIdx > 0) {
    delivery.to = rawTo.slice(colonIdx + 1);
    console.debug('[ScheduledTask] stripped IM subtype prefix from delivery.to.');
  }

  if (platform === 'dingtalk') {
    const imStore = getIMGatewayManager()?.getIMStore();
    const mapping = imStore?.getSessionMapping(rawTo, platform);
    if (mapping) {
      await getIMGatewayManager()!.primeConversationReplyRoute(
        platform, rawTo, mapping.coworkSessionId,
      );
    }
  }
}

export function registerScheduledTaskHandlers(deps: ScheduledTaskHandlerDeps): void {
  const { getCronJobService, getIMGatewayManager, getOpenClawRuntimeAdapter } = deps;

  const listPersistedJobs = (): ScheduledTask[] => {
    const jobsPath = path.join(app.getPath('userData'), 'openclaw', 'state', 'cron', 'jobs.json');
    try {
      const raw = fs.readFileSync(jobsPath, 'utf8');
      const parsed = JSON.parse(raw) as { jobs?: unknown[] };
      if (!Array.isArray(parsed.jobs)) {
        return [];
      }
      return parsed.jobs.flatMap((job) => {
        try {
          return [mapGatewayJob(job as Parameters<typeof mapGatewayJob>[0])];
        } catch (error) {
          console.warn('[ScheduledTask] Failed to map persisted cron job, skipping:', error);
          return [];
        }
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[ScheduledTask] Failed to read persisted cron jobs:', error);
      }
      return [];
    }
  };

  ipcMain.handle(ScheduledTaskIpc.List, async () => {
    try {
      if (!getOpenClawRuntimeAdapter()?.getGatewayClient()) {
        return { success: true, tasks: listPersistedJobs() };
      }
      const tasks = await getCronJobService().listJobs();
      return { success: true, tasks };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list tasks' };
    }
  });

  ipcMain.handle(ScheduledTaskIpc.Get, async (_event, id: string) => {
    try {
      const task = await getCronJobService().getJob(id);
      return { success: true, task };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get task' };
    }
  });

  ipcMain.handle(ScheduledTaskIpc.Create, async (_event, input: any) => {
    try {
      const normalizedInput = input && typeof input === 'object' ? { ...input } : {};
      console.debug('[ScheduledTask] create input received.');
      await applyAnnounceDeliveryNormalization(normalizedInput, getIMGatewayManager);

      const task = await getCronJobService().addJob(normalizedInput);
      console.log('[IPC][scheduledTask:create] result task id:', task?.id, 'name:', task?.name);
      return { success: true, task };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create task' };
    }
  });

  ipcMain.handle(ScheduledTaskIpc.Update, async (_event, id: string, input: any) => {
    try {
      const normalizedInput = input && typeof input === 'object' ? { ...input } : {};
      console.debug('[ScheduledTask] update input received.');
      await applyAnnounceDeliveryNormalization(normalizedInput, getIMGatewayManager);

      const task = await getCronJobService().updateJob(id, normalizedInput);
      console.log('[IPC][scheduledTask:update] result task id:', task?.id, 'name:', task?.name);
      return { success: true, task };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update task' };
    }
  });

  ipcMain.handle(ScheduledTaskIpc.Delete, async (_event, id: string) => {
    try {
      await getCronJobService().removeJob(id);
      return { success: true, result: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete task' };
    }
  });

  ipcMain.handle(ScheduledTaskIpc.Toggle, async (_event, id: string, enabled: boolean) => {
    try {
      const task = await getCronJobService().toggleJob(id, enabled);
      return { success: true, task };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to toggle task' };
    }
  });

  ipcMain.handle(ScheduledTaskIpc.RunManually, async (_event, id: string) => {
    try {
      await getCronJobService().runJob(id);
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[IPC] Manual run failed for ${id}:`, msg);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle(ScheduledTaskIpc.Stop, async (_event, _id: string) => {
    try {
      // OpenClaw doesn't expose a direct stop API for running cron jobs
      // The job will complete or timeout on its own
      return { success: true, result: false };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to stop task' };
    }
  });

  ipcMain.handle(ScheduledTaskIpc.ListRuns, async (_event, taskId: string, limit?: number, offset?: number) => {
    try {
      const runs = await getCronJobService().listRuns(taskId, limit, offset);
      return { success: true, runs };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list runs' };
    }
  });

  ipcMain.handle(ScheduledTaskIpc.CountRuns, async (_event, taskId: string) => {
    try {
      const count = await getCronJobService().countRuns(taskId);
      return { success: true, count };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to count runs' };
    }
  });

  ipcMain.handle(ScheduledTaskIpc.ListAllRuns, async (_event, limit?: number, offset?: number) => {
    try {
      const runs = await getCronJobService().listAllRuns(limit, offset);
      return { success: true, runs };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list all runs' };
    }
  });

  ipcMain.handle(ScheduledTaskIpc.ResolveSession, async (_event, sessionKey: string) => {
    try {
      if (!sessionKey) return { success: true, session: null };
      // Fetch session history from OpenClaw (returns transient session, not persisted)
      const session = await getOpenClawRuntimeAdapter()?.fetchSessionByKey(sessionKey);
      return { success: true, session: session ?? null };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to resolve session' };
    }
  });

  ipcMain.handle(ScheduledTaskIpc.ListChannels, async () => {
    try {
      return { success: true, channels: listScheduledTaskChannels() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list channels' };
    }
  });

  ipcMain.handle(ScheduledTaskIpc.ListChannelConversations, async (
    _event,
    channel: string,
    accountId?: string,
    filterAccountId?: string,
  ) => {
    try {
      console.log('[IPC][listChannelConversations] channel:', channel);
      const platform = PlatformRegistry.platformOfChannel(channel);
      console.log('[IPC][listChannelConversations] resolved platform:', platform);
      if (!platform) {
        console.log('[IPC][listChannelConversations] no platform mapping, returning empty');
        return { success: true, conversations: [] };
      }
      const imStore = getIMGatewayManager()?.getIMStore();
      if (!imStore) {
        console.log('[IPC][listChannelConversations] no imStore available, returning empty');
        return { success: true, conversations: [] };
      }
      const mappings = imStore.listSessionMappings(platform, filterAccountId ?? accountId);
      console.log('[IPC][listChannelConversations] found', mappings.length, 'session mappings for platform:', platform);
      const conversations = mappings.map((m) => ({
        conversationId: m.imConversationId,
        platform: m.platform,
        coworkSessionId: m.coworkSessionId,
        lastActiveAt: m.lastActiveAt,
      }));
      console.log('[IPC][listChannelConversations] conversations:', JSON.stringify(conversations, null, 2));
      return { success: true, conversations };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list conversations' };
    }
  });
}
