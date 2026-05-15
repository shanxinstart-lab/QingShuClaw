import { describe, expect, test, vi } from 'vitest';

const mockElectron = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  windows: [] as Array<{
    isDestroyed: () => boolean;
    webContents: {
      getURL: () => string;
      send: ReturnType<typeof vi.fn>;
    };
  }>,
}));

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => mockElectron.windows,
    fromWebContents: () => null,
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      mockElectron.handlers.set(channel, handler);
    },
  },
}));

import { DEFAULT_PET_CONFIG } from '../../shared/pet/config';
import { PetIpcChannel, PetMode, PetSource, PetStatus } from '../../shared/pet/constants';
import type { PetCatalogEntry, PetConfig } from '../../shared/pet/types';
import { registerPetIpc } from './petIpc';

const pet: PetCatalogEntry = {
  id: 'codex',
  displayName: 'Codex',
  description: 'Codex pet',
  source: PetSource.Bundled,
  bundled: true,
  installed: true,
  selectable: true,
};

const createConfigStore = (config: PetConfig) => ({
  config,
  getConfig() {
    return this.config;
  },
  setConfig(update: Partial<PetConfig>) {
    this.config = {
      ...this.config,
      ...update,
      floatingWindow: {
        ...this.config.floatingWindow,
        ...(update.floatingWindow ?? {}),
      },
    };
    return this.config;
  },
});

const invoke = async <T,>(channel: string, ...args: unknown[]): Promise<T> => {
  const handler = mockElectron.handlers.get(channel);
  if (!handler) throw new Error(`Missing IPC handler for ${channel}`);
  return await handler({}, ...args) as T;
};

describe('registerPetIpc session acknowledgement', () => {
  test('refresh emits a runtime state from the main pet catalog source', async () => {
    mockElectron.handlers.clear();
    mockElectron.windows = [];
    const config = {
      ...DEFAULT_PET_CONFIG,
      enabled: true,
      mode: PetMode.Floating,
    };
    const windowController = {
      setRuntimeState: vi.fn(),
      syncConfig: vi.fn(),
      setVisible: vi.fn(() => config),
      setActivityOpen: vi.fn(),
      moveBy: vi.fn(),
      persistPosition: vi.fn(),
    };
    const petStore = {
      listPets: vi.fn(() => [pet]),
      ensurePet: vi.fn(async () => pet),
      importPet: vi.fn(),
      deletePet: vi.fn(),
    };
    registerPetIpc({
      configStore: createConfigStore(config),
      petStore: petStore as never,
      windowController: windowController as never,
      getMainWindow: () => null,
      showMainWindow: vi.fn(),
    });

    const refreshed = await invoke<{ success: boolean; state?: { pets: PetCatalogEntry[] } }>(
      PetIpcChannel.Refresh,
    );

    expect(refreshed.success).toBe(true);
    expect(refreshed.state?.pets.map((item) => item.id)).toEqual(['codex']);
    expect(petStore.listPets).toHaveBeenCalled();
    expect(windowController.setRuntimeState).toHaveBeenCalledWith(expect.objectContaining({
      pets: expect.arrayContaining([expect.objectContaining({ id: 'codex' })]),
    }));
  });

  test('keeps acknowledged completed sessions from reappearing after another renderer projects cowork state', async () => {
    mockElectron.handlers.clear();
    mockElectron.windows = [];
    const config = {
      ...DEFAULT_PET_CONFIG,
      enabled: true,
      mode: PetMode.Floating,
    };
    const windowController = {
      setRuntimeState: vi.fn(),
      syncConfig: vi.fn(),
      setVisible: vi.fn(() => config),
      setActivityOpen: vi.fn(),
      moveBy: vi.fn(),
      persistPosition: vi.fn(),
    };
    registerPetIpc({
      configStore: createConfigStore(config),
      petStore: {
        listPets: () => [pet],
        ensurePet: vi.fn(async () => pet),
        importPet: vi.fn(),
        deletePet: vi.fn(),
      } as never,
      windowController: windowController as never,
      getMainWindow: () => null,
      showMainWindow: vi.fn(),
    });
    const projection = {
      status: PetStatus.Review,
      message: 'Ready',
      session: { id: 'task-1', title: 'Task 1' },
      activeSessions: [
        {
          id: 'task-1',
          title: 'Task 1',
          status: PetStatus.Review,
          message: 'Done',
          progressLabel: 'Ready',
          updatedAt: Date.now() - 100,
        },
      ],
    };

    const firstProjection = await invoke<{ success: boolean; state?: { activeSessions: unknown[] } }>(
      PetIpcChannel.SetRuntimeProjection,
      projection,
    );
    expect(firstProjection.state?.activeSessions).toHaveLength(1);

    const acknowledged = await invoke<{ success: boolean; state?: { activeSessions: unknown[] } }>(
      PetIpcChannel.AcknowledgeSession,
      'task-1',
    );
    expect(acknowledged.state?.activeSessions).toEqual([]);

    const secondProjection = await invoke<{ success: boolean; state?: { activeSessions: unknown[] } }>(
      PetIpcChannel.SetRuntimeProjection,
      projection,
    );
    expect(secondProjection.state?.activeSessions).toEqual([]);
  });
});
