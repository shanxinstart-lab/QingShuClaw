import { expect, test } from 'vitest';
import {
  normalizeEdgeTtsRate,
  normalizeEdgeTtsVolume,
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
