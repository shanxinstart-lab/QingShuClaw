import path from 'node:path';
import fs from 'node:fs';
import { describe, expect, test, vi } from 'vitest';

const electronPaths = vi.hoisted(() => ({
  userData: '/tmp/qingshuclaw-user-data',
}));

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return electronPaths.userData;
      return '/tmp';
    },
  },
}));

describe('openaiCodexAuth', () => {
  test('keeps Codex auth under app userData', async () => {
    const { getCodexHomeDir } = await import('./openaiCodexAuth');

    expect(getCodexHomeDir()).toBe(path.join(electronPaths.userData, 'codex'));
  });

  test('reads ChatGPT Codex auth tokens from app userData', async () => {
    const { getCodexAuthFilePath, readOpenAICodexAuthFile } = await import('./openaiCodexAuth');
    const authPath = getCodexAuthFilePath();
    fs.mkdirSync(path.dirname(authPath), { recursive: true });
    const payload = Buffer.from(JSON.stringify({
      email: 'user@example.com',
      exp: 1893456000,
    })).toString('base64url');
    fs.writeFileSync(authPath, JSON.stringify({
      auth_mode: 'chatgpt',
      tokens: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        id_token: `header.${payload}.sig`,
        account_id: 'acct-test',
      },
    }), 'utf8');

    expect(readOpenAICodexAuthFile()).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      idToken: `header.${payload}.sig`,
      accountId: 'acct-test',
      email: 'user@example.com',
      expiresAt: 1893456000000,
    });
  });

  test('returns null when ChatGPT Codex auth file is missing or invalid', async () => {
    const { getCodexAuthFilePath, logoutOpenAICodex, readOpenAICodexAuthFile } = await import('./openaiCodexAuth');
    const authPath = getCodexAuthFilePath();
    fs.rmSync(path.dirname(authPath), { recursive: true, force: true });
    expect(readOpenAICodexAuthFile()).toBeNull();

    fs.mkdirSync(path.dirname(authPath), { recursive: true });
    fs.writeFileSync(authPath, JSON.stringify({
      auth_mode: 'apikey',
      tokens: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      },
    }), 'utf8');

    expect(readOpenAICodexAuthFile()).toBeNull();
    expect(() => logoutOpenAICodex()).not.toThrow();
  });
});
