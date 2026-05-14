import fs from 'fs';
import path from 'path';

import {
  PET_FRAME_DEFAULTS,
  PET_SPRITESHEET_HEIGHT,
  PET_SPRITESHEET_WIDTH,
} from '../../shared/pet/constants';
import type {
  PetAnimation,
  PetFrameSpec,
  PetManifest,
  RawPetManifest,
} from '../../shared/pet/types';
import { readImageDimensions } from './imageSize';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

export const defaultPetAnimations = (): Record<string, PetAnimation> => ({
  idle: idleAnimation(),
  running: appStateAnimation(7, 6, 120, 220),
  waiting: appStateAnimation(6, 6, 150, 260),
  review: appStateAnimation(8, 6, 150, 280),
  failed: appStateAnimation(5, 8, 140, 240),
  'running-right': appStateAnimation(1, 8, 120, 220),
  'running-left': appStateAnimation(2, 8, 120, 220),
  waving: appStateAnimation(3, 4, 140, 280),
  jumping: appStateAnimation(4, 5, 140, 280),
  move_right: appStateAnimation(1, 8, 120, 220),
  move_left: appStateAnimation(2, 8, 120, 220),
  wave: appStateAnimation(3, 4, 140, 280),
  bounce: appStateAnimation(4, 5, 140, 280),
  sad: appStateAnimation(5, 8, 140, 240),
});

function appStateAnimation(
  rowIndex: number,
  frameCount: number,
  frameDurationMs: number,
  finalFrameDurationMs: number,
): PetAnimation {
  const primary = Array.from({ length: frameCount }, (_unused, columnIndex) => ({
    spriteIndex: rowIndex * PET_FRAME_DEFAULTS.columns + columnIndex,
    durationMs: columnIndex === frameCount - 1 ? finalFrameDurationMs : frameDurationMs,
  }));
  return {
    frames: [...primary, ...primary, ...primary, ...idleAnimation().frames],
    loopStart: primary.length * 3,
    fallback: 'idle',
  };
}

function idleAnimation(): PetAnimation {
  return {
    frames: [
      [0, 1680],
      [1, 660],
      [2, 660],
      [3, 840],
      [4, 840],
      [5, 1920],
    ].map(([spriteIndex, durationMs]) => ({ spriteIndex, durationMs })),
    loopStart: 0,
    fallback: 'idle',
  };
}

function normalizeFrame(value: unknown): PetFrameSpec {
  const raw = isRecord(value) ? value : {};
  const width = Number(raw.width);
  const height = Number(raw.height);
  const columns = Number(raw.columns);
  const rows = Number(raw.rows);
  return {
    width: Number.isFinite(width) && width > 0 ? Math.round(width) : PET_FRAME_DEFAULTS.width,
    height: Number.isFinite(height) && height > 0 ? Math.round(height) : PET_FRAME_DEFAULTS.height,
    columns: Number.isFinite(columns) && columns > 0 ? Math.round(columns) : PET_FRAME_DEFAULTS.columns,
    rows: Number.isFinite(rows) && rows > 0 ? Math.round(rows) : PET_FRAME_DEFAULTS.rows,
  };
}

function normalizeAnimations(raw: RawPetManifest['animations']): Record<string, PetAnimation> {
  const animations = defaultPetAnimations();
  if (!raw || !isRecord(raw)) return animations;

  for (const [name, spec] of Object.entries(raw)) {
    if (!spec || !Array.isArray(spec.frames) || spec.frames.length === 0) continue;
    const fps = typeof spec.fps === 'number' && spec.fps > 0 ? spec.fps : 8;
    const durationMs = Math.max(1, Math.round(1000 / fps));
    animations[name] = {
      frames: spec.frames
        .filter((spriteIndex) => Number.isInteger(spriteIndex) && spriteIndex >= 0)
        .map((spriteIndex) => ({ spriteIndex, durationMs })),
      loopStart: spec.loop === false ? null : 0,
      fallback: spec.fallback?.trim() || 'idle',
    };
  }

  if (!animations.idle || animations.idle.frames.length === 0) {
    animations.idle = defaultPetAnimations().idle;
  }
  return animations;
}

export function resolveManifestSpritesheetPath(petDir: string, spritesheetPath: string): string {
  const rawPath = spritesheetPath.trim() || 'spritesheet.webp';
  if (path.isAbsolute(rawPath)) {
    throw new Error('Pet spritesheet path must be relative.');
  }

  const normalized = path.normalize(rawPath);
  if (
    normalized === '..'
    || normalized.startsWith(`..${path.sep}`)
    || normalized.split(path.sep).includes('..')
    || path.isAbsolute(normalized)
  ) {
    throw new Error('Pet spritesheet path must stay inside the pet directory.');
  }

  return path.join(petDir, normalized);
}

export function validateSpritesheetDimensions(
  filePath: string,
  frame: PetFrameSpec = PET_FRAME_DEFAULTS,
): void {
  const buffer = fs.readFileSync(filePath);
  const dimensions = readImageDimensions(buffer);
  const expectedWidth = frame.width * frame.columns;
  const expectedHeight = frame.height * frame.rows;
  if (
    dimensions.width !== expectedWidth
    || dimensions.height !== expectedHeight
    || dimensions.width !== PET_SPRITESHEET_WIDTH
    || dimensions.height !== PET_SPRITESHEET_HEIGHT
  ) {
    throw new Error(
      `Pet spritesheet must be ${PET_SPRITESHEET_WIDTH}x${PET_SPRITESHEET_HEIGHT} pixels.`,
    );
  }
}

export function loadPetManifest(
  petDir: string,
  manifestFile: 'pet.json' | 'avatar.json',
  fallbackId: string,
): PetManifest {
  const manifestPath = path.join(petDir, manifestFile);
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as RawPetManifest;
  const manifestId = raw.id?.trim() || fallbackId;
  const displayName = raw.displayName?.trim() || manifestId;
  const description = raw.description?.trim() || '';
  const frame = normalizeFrame(raw.frame);
  const spritesheetPath = resolveManifestSpritesheetPath(
    petDir,
    raw.spritesheetPath?.trim() || 'spritesheet.webp',
  );

  if (!fs.existsSync(spritesheetPath)) {
    throw new Error(`Pet spritesheet is missing: ${spritesheetPath}`);
  }
  validateSpritesheetDimensions(spritesheetPath, frame);

  return {
    id: manifestId,
    displayName,
    description,
    spritesheetPath,
    frame,
    animations: normalizeAnimations(raw.animations),
  };
}
