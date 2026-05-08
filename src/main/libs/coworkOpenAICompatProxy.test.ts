import { describe, expect, test } from 'vitest';
import type http from 'http';
import { isAllowedProxyHost } from './coworkOpenAICompatProxy';

const fakeReq = (host?: string): http.IncomingMessage =>
  ({ headers: host !== undefined ? { host } : {} }) as http.IncomingMessage;

describe('isAllowedProxyHost', () => {
  test('accepts 127.0.0.1 with port', () => {
    expect(isAllowedProxyHost(fakeReq('127.0.0.1:54321'))).toBe(true);
  });

  test('accepts 127.0.0.1 without port', () => {
    expect(isAllowedProxyHost(fakeReq('127.0.0.1'))).toBe(true);
  });

  test('accepts localhost with port', () => {
    expect(isAllowedProxyHost(fakeReq('localhost:12345'))).toBe(true);
  });

  test('accepts localhost without port', () => {
    expect(isAllowedProxyHost(fakeReq('localhost'))).toBe(true);
  });

  test('accepts [::1] with port', () => {
    expect(isAllowedProxyHost(fakeReq('[::1]:12345'))).toBe(true);
  });

  test('accepts [::1] without port', () => {
    expect(isAllowedProxyHost(fakeReq('[::1]'))).toBe(true);
  });

  test('allows missing Host header', () => {
    expect(isAllowedProxyHost(fakeReq(undefined))).toBe(true);
  });

  test('rejects attacker rebind domain', () => {
    expect(isAllowedProxyHost(fakeReq('evil.rebind.xxx:12345'))).toBe(false);
  });

  test('rejects attacker domain without port', () => {
    expect(isAllowedProxyHost(fakeReq('attacker.com'))).toBe(false);
  });

  test('rejects 0.0.0.0', () => {
    expect(isAllowedProxyHost(fakeReq('0.0.0.0:12345'))).toBe(false);
  });

  test('allows empty Host header (non-browser client)', () => {
    expect(isAllowedProxyHost(fakeReq(''))).toBe(true);
  });
});
