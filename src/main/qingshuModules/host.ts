import {
  QingShuModuleStatusKind,
  QingShuToolVisibility,
  type QingShuExtensionHost,
  type QingShuExtensionModule,
  type QingShuModuleFeatureFlags,
  type QingShuModuleRegistration,
  type QingShuModuleStatus,
  type QingShuPluginDescriptor,
  type QingShuSharedToolCatalog,
  type QingShuSharedToolDescriptor,
  type QingShuToolBundleId,
} from './types';

type QingShuExtensionHostDeps = {
  resolveFeatureFlags: (moduleId: string, enabledByDefault: boolean) => QingShuModuleFeatureFlags;
};

type RegisteredModule = {
  registration: QingShuModuleRegistration;
  flags: QingShuModuleFeatureFlags;
  status: QingShuModuleStatus;
};

export class DefaultQingShuExtensionHost implements QingShuExtensionHost {
  private readonly resolveFeatureFlags: QingShuExtensionHostDeps['resolveFeatureFlags'];
  private initialized = false;
  private readonly modules = new Map<string, RegisteredModule>();
  private readonly failedModules: QingShuModuleStatus[] = [];

  constructor(deps: QingShuExtensionHostDeps) {
    this.resolveFeatureFlags = deps.resolveFeatureFlags;
  }

  initialize(modules: QingShuExtensionModule[]): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    for (const extensionModule of modules) {
      try {
        const registration = extensionModule.register();
        const flags = this.resolveFeatureFlags(
          registration.moduleId,
          registration.enabledByDefault,
        );
        const enabled = Boolean(flags.enabled);
        const status: QingShuModuleStatus = {
          moduleId: registration.moduleId,
          version: registration.version,
          status: enabled ? QingShuModuleStatusKind.Active : QingShuModuleStatusKind.Disabled,
          enabled,
          sharedToolsEnabled: enabled && Boolean(flags.sharedToolsEnabled),
          builtInSkillsEnabled: enabled && Boolean(flags.builtInSkillsEnabled),
        };
        this.modules.set(registration.moduleId, {
          registration,
          flags,
          status,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[QingShuExtensionHost] Failed to register module:', error);
        this.failedModules.push({
          moduleId: `failed-${this.failedModules.length + 1}`,
          version: 'unknown',
          status: QingShuModuleStatusKind.Failed,
          enabled: false,
          sharedToolsEnabled: false,
          builtInSkillsEnabled: false,
          error: message,
        });
      }
    }
  }

  listModuleStatuses(): QingShuModuleStatus[] {
    return [
      ...Array.from(this.modules.values()).map((entry) => ({ ...entry.status })),
      ...this.failedModules.map((status) => ({ ...status })),
    ];
  }

  getSharedToolCatalog(): QingShuSharedToolCatalog {
    return {
      generatedAt: Date.now(),
      modules: this.listModuleStatuses(),
      tools: this.getEnabledSharedTools(),
    };
  }

  getEnabledSharedTools(): QingShuSharedToolDescriptor[] {
    const tools: QingShuSharedToolDescriptor[] = [];
    for (const entry of this.modules.values()) {
      if (!entry.status.sharedToolsEnabled) {
        continue;
      }
      for (const tool of entry.registration.sharedToolDescriptors) {
        if (tool.visibility !== QingShuToolVisibility.Shared) {
          continue;
        }
        tools.push({ ...tool });
      }
    }
    return tools.sort((left, right) => left.toolName.localeCompare(right.toolName));
  }

  getEnabledToolBundles(): QingShuToolBundleId[] {
    const bundles = new Set<QingShuToolBundleId>();
    for (const entry of this.modules.values()) {
      if (!entry.status.sharedToolsEnabled) {
        continue;
      }
      for (const bundle of entry.registration.toolBundles) {
        bundles.add(bundle);
      }
    }
    return Array.from(bundles).sort();
  }

  getPluginDescriptors(): QingShuPluginDescriptor[] {
    const descriptors: QingShuPluginDescriptor[] = [];
    for (const entry of this.modules.values()) {
      if (!entry.status.enabled) {
        continue;
      }
      descriptors.push(...(entry.registration.pluginDescriptors ?? []));
    }
    return descriptors;
  }
}
