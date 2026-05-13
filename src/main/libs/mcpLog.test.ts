import { expect, test } from 'vitest';

import { getToolTextPreview, looksLikeTransportErrorText, serializeForLog, serializeToolContentForLog } from './mcpLog';

test('serializeForLog redacts sensitive fields', () => {
  const preview = serializeForLog({
    query: 'latest AI news',
    apiKey: 'secret-api-key',
    nested: {
      refreshToken: 'secret-refresh-token',
    },
  });

  expect(preview).toContain('[redacted]');
  expect(preview).not.toContain('secret-api-key');
  expect(preview).not.toContain('secret-refresh-token');
});

test('serializeToolContentForLog keeps a readable preview', () => {
  const preview = serializeToolContentForLog([
    { type: 'text', text: 'fetch failed' },
  ]);

  expect(preview).toContain('fetch failed');
  expect(preview).toContain('"type":"text"');
});

test('serializeToolContentForLog redacts sensitive fields inside tool content', () => {
  const preview = serializeToolContentForLog([
    {
      type: 'text',
      text: 'ok',
      headers: {
        Authorization: 'Bearer secret-token',
      },
    },
  ]);

  expect(preview).toContain('[redacted]');
  expect(preview).not.toContain('secret-token');
});

test('serializeToolContentForLog redacts inline bearer tokens inside text content', () => {
  const preview = serializeToolContentForLog([
    {
      type: 'text',
      text: 'fetch failed with Bearer secret-token-123456',
    },
  ]);

  expect(preview).toContain('Bearer [redacted]');
  expect(preview).not.toContain('secret-token-123456');
});

test('getToolTextPreview joins text blocks', () => {
  const preview = getToolTextPreview([
    { type: 'text', text: 'first line' },
    { type: 'text', text: 'second line' },
    { type: 'image', url: 'https://example.com/image.png' },
  ]);

  expect(preview).toBe('first line second line');
});

test('getToolTextPreview truncates long text previews', () => {
  const preview = getToolTextPreview([
    { type: 'text', text: 'x'.repeat(20) },
  ], 8);

  expect(preview).toBe('xxxxxxxx...');
});

test('looksLikeTransportErrorText detects network-style failures', () => {
  expect(looksLikeTransportErrorText('fetch failed')).toBe(true);
  expect(looksLikeTransportErrorText('socket hang up while calling upstream')).toBe(true);
  expect(looksLikeTransportErrorText('Detailed Results: example.com')).toBe(false);
});
