import { expect, test } from 'vitest';
import {
  EdgeTtsRuntimeMode,
  normalizeEdgeTtsRate,
  normalizeEdgeTtsVolume,
  resolveEdgeTtsRuntimeMode,
  stripEdgeVoiceIdentifier,
  toEdgeVoiceIdentifier,
} from './edgeTtsService';

test('toEdgeVoiceIdentifier prefixes the short name', () => {
  expect(toEdgeVoiceIdentifier('zh-CN-XiaoxiaoNeural')).toBe('edge:zh-CN-XiaoxiaoNeural');
});

test('stripEdgeVoiceIdentifier removes the edge prefix', () => {
  expect(stripEdgeVoiceIdentifier('edge:en-US-AriaNeural')).toBe('en-US-AriaNeural');
  expect(stripEdgeVoiceIdentifier('com.apple.voice.compact.zh-CN.Ting-Ting')).toBeUndefined();
});

test('normalizeEdgeTtsRate maps the default rate to neutral', () => {
  expect(normalizeEdgeTtsRate(0.5)).toBe('+0%');
  expect(normalizeEdgeTtsRate(1)).toBe('+50%');
});

test('normalizeEdgeTtsVolume maps the default volume to neutral', () => {
  expect(normalizeEdgeTtsVolume(1)).toBe('+0%');
  expect(normalizeEdgeTtsVolume(0)).toBe('-100%');
});

test('resolveEdgeTtsRuntimeMode prefers bundled runtime in packaged builds', () => {
  expect(resolveEdgeTtsRuntimeMode({
    isPackaged: true,
    bundledReady: true,
    managedReady: true,
  })).toBe(EdgeTtsRuntimeMode.Bundled);
});

test('resolveEdgeTtsRuntimeMode reuses managed runtime when packaged build already has one', () => {
  expect(resolveEdgeTtsRuntimeMode({
    isPackaged: true,
    bundledReady: false,
    managedReady: true,
  })).toBe(EdgeTtsRuntimeMode.Managed);
});

test('resolveEdgeTtsRuntimeMode marks packaged build without runtime as unavailable', () => {
  expect(resolveEdgeTtsRuntimeMode({
    isPackaged: true,
    bundledReady: false,
    managedReady: false,
  })).toBe(EdgeTtsRuntimeMode.Unavailable);
});
