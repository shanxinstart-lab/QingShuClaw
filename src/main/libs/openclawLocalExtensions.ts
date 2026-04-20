import { app } from 'electron';
import fs from 'fs';
import path from 'path';

const LOCAL_EXTENSIONS_DIR = 'openclaw-extensions';
const THIRD_PARTY_EXTENSIONS_DIR = 'third-party-extensions';

type OpenClawExtensionInfo = {
  id: string;
  dirName: string;
  rootDir: string;
};

const findLocalExtensionsSourceDir = (): string | null => {
  if (app.isPackaged) {
    return null;
  }

  const candidates = [
    path.join(app.getAppPath(), LOCAL_EXTENSIONS_DIR),
    path.join(process.cwd(), LOCAL_EXTENSIONS_DIR),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // Ignore missing candidates.
    }
  }

  return null;
};

const findBundledExtensionsDir = (): string | null => {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'cfmind', THIRD_PARTY_EXTENSIONS_DIR)]
    : [
        path.join(app.getAppPath(), 'vendor', 'openclaw-runtime', 'current', THIRD_PARTY_EXTENSIONS_DIR),
        path.join(process.cwd(), 'vendor', 'openclaw-runtime', 'current', THIRD_PARTY_EXTENSIONS_DIR),
      ];

  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // Ignore missing candidates.
    }
  }

  return null;
};

const readExtensionInfos = (baseDir: string | null): OpenClawExtensionInfo[] => {
  if (!baseDir) {
    return [];
  }

  try {
    return fs.readdirSync(baseDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => {
        const rootDir = path.join(baseDir, entry.name);
        const manifestPath = path.join(rootDir, 'openclaw.plugin.json');
        if (!fs.existsSync(manifestPath)) {
          return [];
        }
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { id?: string };
          const id = typeof manifest.id === 'string' && manifest.id.trim()
            ? manifest.id.trim()
            : entry.name;
          return [{ id, dirName: entry.name, rootDir }];
        } catch {
          return [{ id: entry.name, dirName: entry.name, rootDir }];
        }
      });
  } catch {
    return [];
  }
};

export const syncLocalOpenClawExtensionsIntoRuntime = (
  runtimeRoot: string,
): { sourceDir: string | null; copied: string[] } => {
  const sourceDir = findLocalExtensionsSourceDir();
  if (!sourceDir) {
    return { sourceDir: null, copied: [] };
  }

  const targetExtensionsDir = path.join(runtimeRoot, THIRD_PARTY_EXTENSIONS_DIR);
  try {
    if (!fs.statSync(targetExtensionsDir).isDirectory()) {
      return { sourceDir, copied: [] };
    }
  } catch {
    return { sourceDir, copied: [] };
  }

  const copied: string[] = [];
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    fs.cpSync(
      path.join(sourceDir, entry.name),
      path.join(targetExtensionsDir, entry.name),
      { recursive: true, force: true },
    );
    copied.push(entry.name);
  }

  return { sourceDir, copied };
};

export const listLocalOpenClawExtensionIds = (): string[] => {
  return readExtensionInfos(findLocalExtensionsSourceDir()).map((entry) => entry.id);
};

export const listBundledOpenClawExtensionIds = (): string[] => {
  return readExtensionInfos(findBundledExtensionsDir()).map((entry) => entry.id);
};

export const hasBundledOpenClawExtension = (extensionId: string): boolean => {
  const matchesExtensionId = (entry: OpenClawExtensionInfo): boolean =>
    entry.id === extensionId || entry.dirName === extensionId;

  return readExtensionInfos(findBundledExtensionsDir()).some(matchesExtensionId)
    || readExtensionInfos(findLocalExtensionsSourceDir()).some(matchesExtensionId);
};

export const resolveOpenClawExtensionLoadPath = (extensionId: string): string | null => {
  const matchesExtensionId = (entry: OpenClawExtensionInfo): boolean =>
    entry.id === extensionId || entry.dirName === extensionId;

  const localMatch = readExtensionInfos(findLocalExtensionsSourceDir()).find(matchesExtensionId);
  if (localMatch) {
    return localMatch.rootDir;
  }

  const bundledMatch = readExtensionInfos(findBundledExtensionsDir()).find(matchesExtensionId);
  return bundledMatch?.rootDir ?? null;
};

export const resolveOpenClawExtensionConfigId = (extensionId: string): string | null => {
  const matchesExtensionId = (entry: OpenClawExtensionInfo): boolean =>
    entry.id === extensionId || entry.dirName === extensionId;

  const localMatch = readExtensionInfos(findLocalExtensionsSourceDir()).find(matchesExtensionId);
  if (localMatch) {
    return localMatch.id;
  }

  const bundledMatch = readExtensionInfos(findBundledExtensionsDir()).find(matchesExtensionId);
  return bundledMatch?.id ?? null;
};

export const findThirdPartyExtensionsDir = (): string | null => {
  const dir = findBundledExtensionsDir();
  if (!dir) return null;
  try {
    return fs.realpathSync(dir);
  } catch {
    return dir;
  }
};

export const cleanupStaleThirdPartyPluginsFromBundledDir = (
  runtimeRoot: string,
  thirdPartyPluginIds: readonly string[],
): string[] => {
  const staleDirs = [
    path.join(runtimeRoot, 'dist', 'extensions'),
    path.join(runtimeRoot, 'extensions'),
  ];
  const removed: string[] = [];

  for (const id of thirdPartyPluginIds) {
    for (const baseDir of staleDirs) {
      const staleDir = path.join(baseDir, id);
      try {
        if (fs.statSync(staleDir).isDirectory()) {
          fs.rmSync(staleDir, { recursive: true, force: true });
          removed.push(id);
        }
      } catch {
        // Directory doesn't exist or can't be accessed — nothing to clean up.
      }
    }
  }

  return removed;
};
