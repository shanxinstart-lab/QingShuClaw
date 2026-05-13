import { describe, expect, test } from 'vitest';

import { SENSITIVE_LOG_KEY_PATTERN, serializeForLog } from './sanitizeForLog';

describe('SENSITIVE_LOG_KEY_PATTERN', () => {
  const shouldMatch = [
    'apiKey',
    'api_key',
    'api-key',
    'x-api-key',
    'ApiKey',
    'API_KEY',
    'token',
    'accessToken',
    'access_token',
    'access-token',
    'refreshToken',
    'refresh_token',
    'refresh-token',
    'secret',
    'password',
    'authorization',
    'Authorization',
    'cookie',
    'Cookie',
    'session',
    'sessionId',
  ];

  const shouldNotMatch = [
    'model',
    'Content-Type',
    'url',
    'method',
    'query',
    'name',
    'description',
    'anthropic-version',
    'status',
  ];

  const knownFalsePositives = [
    'max_tokens',
  ];

  test.each(shouldMatch)('matches sensitive key: %s', (key) => {
    expect(SENSITIVE_LOG_KEY_PATTERN.test(key)).toBe(true);
  });

  test.each(shouldNotMatch)('does not match safe key: %s', (key) => {
    expect(SENSITIVE_LOG_KEY_PATTERN.test(key)).toBe(false);
  });

  test.each(knownFalsePositives)('documents known false positive: %s', (key) => {
    expect(SENSITIVE_LOG_KEY_PATTERN.test(key)).toBe(true);
  });
});

describe('serializeForLog', () => {
  test('redacts x-api-key in HTTP-style headers object', () => {
    const result = serializeForLog({
      'x-api-key': 'sk-ant-1234567890abcdef',
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    });

    expect(result).toContain('[redacted]');
    expect(result).not.toContain('sk-ant-1234567890abcdef');
    expect(result).toContain('2023-06-01');
    expect(result).toContain('application/json');
  });

  test('redacts authorization header', () => {
    const result = serializeForLog({
      Authorization: 'Bearer <test-token>',
    });

    expect(result).toContain('[redacted]');
    expect(result).not.toContain('<test-token>');
  });

  test('redacts multiple sensitive keys in one object', () => {
    const result = serializeForLog({
      apiKey: 'key-123',
      password: 'p@ss',
      secret: 'shh',
      model: 'glm-5',
    });

    expect(result).not.toContain('key-123');
    expect(result).not.toContain('p@ss');
    expect(result).not.toContain('shh');
    expect(result).toContain('glm-5');
  });

  test('redacts sensitive values in deeply nested objects', () => {
    const result = serializeForLog({
      provider: {
        config: {
          api_key: 'deep-secret-key',
          endpoint: 'https://api.example.com',
        },
      },
    });

    expect(result).not.toContain('deep-secret-key');
    expect(result).toContain('https://api.example.com');
  });

  test('handles circular references without throwing', () => {
    const obj: Record<string, unknown> = { name: 'test' };
    obj.self = obj;

    const result = serializeForLog(obj);

    expect(result).toContain('[circular]');
    expect(result).toContain('test');
  });

  test('preserves non-sensitive primitive values', () => {
    const result = serializeForLog({
      count: 42,
      enabled: true,
      label: null,
    });

    expect(result).toContain('42');
    expect(result).toContain('true');
    expect(result).toContain('null');
  });

  test('redacts inline authorization tokens in plain text values', () => {
    const result = serializeForLog({
      message: 'request failed with Authorization: Bearer secret-token-123',
    });

    expect(result).toContain('Authorization: Bearer [redacted]');
    expect(result).not.toContain('secret-token-123');
  });

  test('redacts inline api keys in plain text values', () => {
    const result = serializeForLog({
      message: 'upstream returned api_key=sk-secret-value and status=401',
    });

    expect(result).toContain('api_key=[redacted]');
    expect(result).toContain('status=401');
    expect(result).not.toContain('sk-secret-value');
  });

  test('redacts sensitive URL query parameters without hiding safe parameters', () => {
    const result = serializeForLog({
      message: 'fetch failed for https://api.example.com/search?query=qingshu&api_key=sk-secret-value&status=401#details',
    });

    expect(result).toContain('query=qingshu');
    expect(result).toContain('api_key=[redacted]');
    expect(result).toContain('status=401');
    expect(result).toContain('#details');
    expect(result).not.toContain('sk-secret-value');
  });

  test('redacts multiple sensitive URL query parameters in plain text values', () => {
    const result = serializeForLog({
      message: 'callback https://example.com/cb?access_token=access-secret&refresh_token=refresh-secret&sessionId=session-secret',
    });

    expect(result).toContain('access_token=[redacted]');
    expect(result).toContain('refresh_token=[redacted]');
    expect(result).toContain('sessionId=[redacted]');
    expect(result).not.toContain('access-secret');
    expect(result).not.toContain('refresh-secret');
    expect(result).not.toContain('session-secret');
  });
});
