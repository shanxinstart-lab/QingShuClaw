import { randomUUID } from 'crypto';
import { app, net } from 'electron';
import extractZip from 'extract-zip';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  DEFAULT_PET_ID,
  PET_DOWNLOAD_TIMEOUT_MS,
  PET_MAX_SPRITESHEET_BYTES,
  PetImportKind,
  PetSource,
} from '../../shared/pet/constants';
import type { PetCatalogEntry, PetImportRequest, PetImportResult } from '../../shared/pet/types';
import {
  BUILTIN_PETS,
  builtinPetById,
  builtinPetDownloadUrl,
  createBuiltinCatalogEntry,
} from './catalog';
import { loadPetManifest, validateSpritesheetDimensions } from './manifest';

const PET_CACHE_VERSION = 'v1';
const PET_DOWNLOAD_HOST = 'persistent.oaistatic.com';
const PET_DOWNLOAD_PATH_PREFIX = '/codex/pets/v1/';

export const isAllowedPetAssetDownloadUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:'
      && parsed.hostname === PET_DOWNLOAD_HOST
      && parsed.pathname.startsWith(PET_DOWNLOAD_PATH_PREFIX);
  } catch {
    return false;
  }
};

const ensureDir = (dir: string): void => {
  fs.mkdirSync(dir, { recursive: true });
};

const copyDir = (source: string, destination: string): void => {
  ensureDir(destination);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDir(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
};

const resolveImportSourceDir = (sourcePath: string): string => {
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) return sourcePath;
  const fileName = path.basename(sourcePath);
  if (fileName === 'pet.json' || fileName === 'avatar.json') {
    const parent = path.dirname(sourcePath);
    if (!parent || parent === sourcePath) {
      throw new Error('Pet manifest path has no containing directory.');
    }
    return parent;
  }
  throw new Error('Pet import must be a directory, a zip package, pet.json, or avatar.json.');
};

const validateImportTree = (root: string): void => {
  const resolvedRoot = fs.realpathSync(root);
  const visit = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error('Pet import package must not contain symbolic links.');
      }
      const resolved = fs.realpathSync(entryPath);
      if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
        throw new Error('Pet import package contains files outside the import directory.');
      }
      if (entry.isSymbolicLink()) {
        throw new Error('Pet import package must not contain symbolic links.');
      }
      if (entry.isDirectory()) {
        visit(entryPath);
      }
    }
  };
  visit(root);
};

const removeDirIfExists = (target: string): void => {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
};

const getPetTempRoot = (): string => {
  const electronApp = app as typeof app | undefined;
  return electronApp?.getPath?.('temp') ?? os.tmpdir();
};

const sanitizePetId = (value: string): string => (
  value.trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
);

const findPetRoot = (dir: string): { root: string; manifestFile: 'pet.json' | 'avatar.json' } | null => {
  if (fs.existsSync(path.join(dir, 'pet.json'))) return { root: dir, manifestFile: 'pet.json' };
  if (fs.existsSync(path.join(dir, 'avatar.json'))) return { root: dir, manifestFile: 'avatar.json' };

  const children = fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const child of children) {
    const nested = path.join(dir, child.name);
    if (fs.existsSync(path.join(nested, 'pet.json'))) return { root: nested, manifestFile: 'pet.json' };
    if (fs.existsSync(path.join(nested, 'avatar.json'))) return { root: nested, manifestFile: 'avatar.json' };
  }
  return null;
};

const defaultCodexHome = (): string => (
  path.join(os.homedir(), '.codex')
);

export class PetStore {
  private readonly bundledPetsDir: string;
  private readonly userPetsDir: string;
  private readonly legacyAvatarsDir: string;
  private readonly downloadedAssetsDir: string;
  private readonly codexHomeDir: string;

  constructor(options?: { bundledPetsDir?: string; userDataDir?: string; codexHomeDir?: string }) {
    const userDataDir = options?.userDataDir ?? app.getPath('userData');
    this.codexHomeDir = options?.codexHomeDir ?? defaultCodexHome();
    this.bundledPetsDir = options?.bundledPetsDir
      ?? (app.isPackaged
        ? path.join(process.resourcesPath, 'pets')
        : path.join(process.cwd(), 'resources', 'pets'));
    const petRoot = path.join(userDataDir, 'pets');
    this.userPetsDir = path.join(petRoot, 'custom');
    this.legacyAvatarsDir = path.join(petRoot, 'avatars');
    this.downloadedAssetsDir = path.join(petRoot, 'cache', PET_CACHE_VERSION, 'assets');
  }

  listPets(): PetCatalogEntry[] {
    return [
      ...this.listBuiltinPets(),
      ...this.listBundledCustomPets(),
      ...this.listCustomPets(),
      ...this.listCodexCustomPets(),
    ].sort((left, right) => {
      if (left.source !== right.source) return left.source.localeCompare(right.source);
      return left.displayName.localeCompare(right.displayName);
    });
  }

  getPet(id: string): PetCatalogEntry | null {
    return this.listPets().find((pet) => pet.id === id) ?? null;
  }

  getDefaultPet(): PetCatalogEntry | null {
    return this.getPet(DEFAULT_PET_ID) ?? this.listPets().find((pet) => pet.selectable) ?? null;
  }

  async ensurePet(id: string): Promise<PetCatalogEntry> {
    const builtin = builtinPetById(id);
    if (builtin) {
      const existing = this.builtinSpritesheetPath(builtin.spritesheetFile);
      if (existing) {
        return createBuiltinCatalogEntry(builtin, { installed: true, spritesheetPath: existing });
      }
      const downloaded = await this.downloadBuiltinPet(builtin.spritesheetFile);
      return createBuiltinCatalogEntry(builtin, { installed: true, spritesheetPath: downloaded });
    }

    const pet = this.getPet(id);
    if (!pet) {
      throw new Error(`Unknown pet: ${id}`);
    }
    return pet;
  }

  async importPet(request: PetImportRequest): Promise<PetImportResult> {
    try {
      const sourcePath = request.path;
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        throw new Error('Pet import path does not exist.');
      }

      ensureDir(this.userPetsDir);
      const tempDir = path.join(getPetTempRoot(), `qingshu-pet-${randomUUID()}`);
      ensureDir(tempDir);
      try {
        const kind = request.kind
          ?? (sourcePath.toLowerCase().endsWith('.zip') ? PetImportKind.Zip : PetImportKind.Directory);
        if (kind === PetImportKind.Zip) {
          await extractZip(sourcePath, { dir: tempDir });
        } else {
          copyDir(resolveImportSourceDir(sourcePath), tempDir);
        }
        validateImportTree(tempDir);

        const root = findPetRoot(tempDir);
        if (!root) {
          throw new Error('Imported pet must contain pet.json or avatar.json.');
        }
        const manifest = loadPetManifest(root.root, root.manifestFile, path.basename(root.root));
        const petId = sanitizePetId(manifest.id);
        if (!petId) {
          throw new Error('Imported pet id is invalid.');
        }
        const destination = path.join(this.userPetsDir, petId);
        const staging = `${destination}.staging-${randomUUID()}`;
        copyDir(root.root, staging);
        const installedManifest = loadPetManifest(staging, root.manifestFile, petId);
        removeDirIfExists(destination);
        fs.renameSync(staging, destination);
        return {
          success: true,
          pet: {
            id: petId,
            displayName: installedManifest.displayName,
            description: installedManifest.description,
            source: root.manifestFile === 'avatar.json' ? PetSource.LegacyAvatar : PetSource.Custom,
            bundled: false,
            installed: true,
            selectable: true,
            manifest: {
              ...installedManifest,
              id: petId,
            },
          },
        };
      } finally {
        removeDirIfExists(tempDir);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import pet.',
      };
    }
  }

  deletePet(id: string): boolean {
    const safeId = sanitizePetId(id);
    if (!safeId || builtinPetById(safeId)) return false;
    const destinations = [
      path.join(this.userPetsDir, safeId),
      path.join(this.legacyAvatarsDir, safeId),
    ];
    let deleted = false;
    for (const destination of destinations) {
      if (!fs.existsSync(destination)) continue;
      removeDirIfExists(destination);
      deleted = true;
    }
    return deleted;
  }

  private listBuiltinPets(): PetCatalogEntry[] {
    return BUILTIN_PETS.map((pet) => {
      const spritesheetPath = this.builtinSpritesheetPath(pet.spritesheetFile);
      return createBuiltinCatalogEntry(pet, {
        installed: !!spritesheetPath,
        spritesheetPath,
        ...(!spritesheetPath && pet.bundled ? { error: 'Bundled pet spritesheet is missing or invalid.' } : {}),
      });
    });
  }

  private listCustomPets(): PetCatalogEntry[] {
    const entries: PetCatalogEntry[] = [];
    for (const directoryName of ['custom', 'avatars']) {
      const baseDir = directoryName === 'custom'
        ? this.userPetsDir
        : this.legacyAvatarsDir;
      if (!fs.existsSync(baseDir)) continue;
      for (const child of fs.readdirSync(baseDir, { withFileTypes: true })) {
        if (!child.isDirectory()) continue;
        const petDir = path.join(baseDir, child.name);
        const manifestFile = fs.existsSync(path.join(petDir, 'pet.json'))
          ? 'pet.json'
          : fs.existsSync(path.join(petDir, 'avatar.json'))
            ? 'avatar.json'
            : null;
        if (!manifestFile) continue;
        try {
          const manifest = loadPetManifest(petDir, manifestFile, child.name);
          entries.push({
            id: sanitizePetId(manifest.id || child.name),
            displayName: manifest.displayName,
            description: manifest.description,
            source: manifestFile === 'avatar.json' ? PetSource.LegacyAvatar : PetSource.Custom,
            bundled: false,
            installed: true,
            selectable: true,
            manifest,
          });
        } catch (error) {
          entries.push({
            id: child.name,
            displayName: child.name,
            description: '',
            source: directoryName === 'custom' ? PetSource.Custom : PetSource.LegacyAvatar,
            bundled: false,
            installed: false,
            selectable: false,
            error: error instanceof Error ? error.message : 'Invalid pet manifest.',
          });
        }
      }
    }
    return entries;
  }

  private listBundledCustomPets(): PetCatalogEntry[] {
    return this.listManifestPets([
      {
        baseDir: path.join(this.bundledPetsDir, 'custom'),
        manifestFile: 'pet.json',
        source: PetSource.Bundled,
      },
    ], true);
  }

  private listCodexCustomPets(): PetCatalogEntry[] {
    return this.listManifestPets([
      {
        baseDir: path.join(this.codexHomeDir, 'pets'),
        manifestFile: 'pet.json',
        source: PetSource.CodexCustom,
        idPrefix: 'codex:',
      },
      {
        baseDir: path.join(this.codexHomeDir, 'avatars'),
        manifestFile: 'avatar.json',
        source: PetSource.CodexCustom,
        idPrefix: 'codex:',
      },
    ]);
  }

  private listManifestPets(sources: Array<{
    baseDir: string;
    manifestFile: 'pet.json' | 'avatar.json';
    source: PetSource;
    idPrefix?: string;
  }>, bundled = false): PetCatalogEntry[] {
    const entriesById = new Map<string, PetCatalogEntry>();
    for (const source of sources) {
      if (!fs.existsSync(source.baseDir)) continue;
      for (const child of fs.readdirSync(source.baseDir, { withFileTypes: true })) {
        if (!child.isDirectory()) continue;
        const petDir = path.join(source.baseDir, child.name);
        if (!fs.existsSync(path.join(petDir, source.manifestFile))) continue;
        const id = `${source.idPrefix ?? ''}${sanitizePetId(child.name)}`;
        if (!id || entriesById.has(id)) continue;
        try {
          const manifest = loadPetManifest(petDir, source.manifestFile, child.name);
          entriesById.set(id, {
            id,
            displayName: manifest.displayName,
            description: manifest.description,
            source: source.source,
            bundled,
            installed: true,
            selectable: true,
            manifest: {
              ...manifest,
              id,
            },
          });
        } catch {
          continue;
        }
      }
    }
    return [...entriesById.values()];
  }

  private builtinSpritesheetPath(fileName: string): string | undefined {
    const candidates = [
      path.join(this.bundledPetsDir, fileName),
      path.join(this.downloadedAssetsDir, fileName),
    ];
    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      try {
        validateSpritesheetDimensions(candidate);
        return candidate;
      } catch {
        if (candidate.startsWith(this.downloadedAssetsDir)) {
          fs.rmSync(candidate, { force: true });
        }
      }
    }
    return undefined;
  }

  private async downloadBuiltinPet(fileName: string): Promise<string> {
    const url = builtinPetDownloadUrl(fileName);
    if (!isAllowedPetAssetDownloadUrl(url)) {
      throw new Error('Pet asset download URL is not allowed.');
    }

    const bytes = await new Promise<Buffer>((resolve, reject) => {
      const request = net.request(url);
      const chunks: Buffer[] = [];
      let received = 0;
      const timeout = setTimeout(() => {
        request.abort();
        reject(new Error('Pet asset download timed out.'));
      }, PET_DOWNLOAD_TIMEOUT_MS);

      request.on('response', (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          clearTimeout(timeout);
          reject(new Error(`Pet asset download failed with HTTP ${response.statusCode}.`));
          return;
        }
        response.on('data', (chunk: Buffer) => {
          received += chunk.length;
          if (received > PET_MAX_SPRITESHEET_BYTES) {
            clearTimeout(timeout);
            request.abort();
            reject(new Error('Pet asset download is too large.'));
            return;
          }
          chunks.push(Buffer.from(chunk));
        });
        response.on('end', () => {
          clearTimeout(timeout);
          resolve(Buffer.concat(chunks));
        });
      });
      request.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      request.end();
    });

    ensureDir(this.downloadedAssetsDir);
    const destination = path.join(this.downloadedAssetsDir, fileName);
    const staging = path.join(this.downloadedAssetsDir, `.${fileName}.${randomUUID()}.download`);
    fs.writeFileSync(staging, bytes);
    try {
      validateSpritesheetDimensions(staging);
      fs.renameSync(staging, destination);
    } catch (error) {
      fs.rmSync(staging, { force: true });
      throw error;
    }
    return destination;
  }
}
