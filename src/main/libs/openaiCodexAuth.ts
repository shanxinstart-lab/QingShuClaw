import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export interface CodexOAuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  accountId?: string;
  email?: string;
  /** Absolute expiry in ms epoch. 0 if unknown. */
  expiresAt: number;
}

interface CodexAuthFile {
  auth_mode?: string;
  tokens?: {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
    account_id?: string;
  };
}

function trimNonEmpty(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '==='.slice((b64.length + 3) % 4);
    const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/**
 * Directory used by OpenClaw's OpenAI Codex provider for auth.json.
 *
 * Keep it under the app userData directory instead of the user's real
 * ~/.codex so QingShuClaw/OpenClaw auth state does not overwrite a system
 * Codex CLI login.
 */
export function getCodexHomeDir(): string {
  return path.join(app.getPath('userData'), 'codex');
}

export function getCodexAuthFilePath(): string {
  return path.join(getCodexHomeDir(), 'auth.json');
}

export function readOpenAICodexAuthFile(): CodexOAuthTokens | null {
  try {
    const raw = fs.readFileSync(getCodexAuthFilePath(), 'utf8');
    const parsed = JSON.parse(raw) as CodexAuthFile;
    if (!parsed || parsed.auth_mode !== 'chatgpt') return null;

    const accessToken = trimNonEmpty(parsed.tokens?.access_token);
    const refreshToken = trimNonEmpty(parsed.tokens?.refresh_token);
    if (!accessToken || !refreshToken) return null;

    const idToken = trimNonEmpty(parsed.tokens?.id_token);
    const accountId = trimNonEmpty(parsed.tokens?.account_id);
    const claims = idToken ? decodeJwtPayload(idToken) : null;
    const email = trimNonEmpty(claims?.email);
    const expiresAt = typeof claims?.exp === 'number' ? claims.exp * 1000 : 0;

    return {
      accessToken,
      refreshToken,
      idToken,
      accountId,
      email,
      expiresAt,
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') {
      console.warn('[OpenAICodexAuth] failed to read auth.json:', error);
    }
    return null;
  }
}
