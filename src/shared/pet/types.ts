import type {
  PetAnchor,
  PetAssetPolicy,
  PetImportKind,
  PetMode,
  PetSource,
  PetStatus,
} from './constants';

export type PetAnimationFrame = {
  spriteIndex: number;
  durationMs: number;
};

export type PetAnimation = {
  frames: PetAnimationFrame[];
  loopStart: number | null;
  fallback: string;
};

export type PetFrameSpec = {
  width: number;
  height: number;
  columns: number;
  rows: number;
};

export type PetManifest = {
  id: string;
  displayName: string;
  description: string;
  spritesheetPath: string;
  frame: PetFrameSpec;
  animations: Record<string, PetAnimation>;
};

export type RawPetManifest = {
  id?: string;
  displayName?: string;
  description?: string;
  spritesheetPath?: string;
  frame?: Partial<PetFrameSpec>;
  animations?: Record<string, {
    frames?: number[];
    fps?: number;
    loop?: boolean;
    fallback?: string;
  }>;
};

export type PetCatalogEntry = {
  id: string;
  displayName: string;
  description: string;
  source: PetSource;
  bundled: boolean;
  installed: boolean;
  selectable: boolean;
  spritesheetFile?: string;
  downloadUrl?: string;
  manifest?: PetManifest;
  error?: string;
};

export type PetFloatingWindowConfig = {
  enabled: boolean;
  visible: boolean;
  displayId?: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
};

export type PetConfig = {
  enabled: boolean;
  mode: PetMode;
  selectedPetId: string | null;
  anchor: PetAnchor;
  animationsEnabled: boolean;
  customPetsEnabled: boolean;
  assetPolicy: PetAssetPolicy;
  floatingWindow: PetFloatingWindowConfig;
};

export type PetRuntimeState = {
  config: PetConfig;
  status: PetStatus;
  message: string | null;
  session: {
    id: string;
    title: string;
  } | null;
  activeSessions: PetRuntimeSession[];
  activePet: PetCatalogEntry | null;
  pets: PetCatalogEntry[];
};

export type PetRuntimeSession = {
  id: string;
  title: string;
  status: PetStatus;
  message: string | null;
  progressLabel: string | null;
  updatedAt: number;
};

export type PetImportRequest = {
  path: string;
  kind?: PetImportKind;
};

export type PetImportResult = {
  success: boolean;
  pet?: PetCatalogEntry;
  error?: string;
};
