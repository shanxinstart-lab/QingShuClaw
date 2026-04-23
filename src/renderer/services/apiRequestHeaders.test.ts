import { describe, expect, test } from 'vitest';

import { ProviderName } from '../../shared/providers';
import { buildApiRequestHeaders } from './apiRequestHeaders';

describe('buildApiRequestHeaders', () => {
  test('uses Bearer auth for standard providers', () => {
    expect(buildApiRequestHeaders(ProviderName.OpenAI, 'test-key')).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
    });
  });

  test('uses x-goog-api-key for gemini', () => {
    expect(buildApiRequestHeaders(ProviderName.Gemini, 'gemini-key')).toEqual({
      'Content-Type': 'application/json',
      'x-goog-api-key': 'gemini-key',
    });
  });

  test('adds GitHub Copilot compatibility headers', () => {
    expect(buildApiRequestHeaders(ProviderName.Copilot, 'copilot-key')).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer copilot-key',
      'Copilot-Integration-Id': 'vscode-chat',
      'Editor-Version': 'vscode/1.96.2',
      'Editor-Plugin-Version': 'copilot-chat/0.26.7',
      'User-Agent': 'GitHubCopilotChat/0.26.7',
      'Openai-Intent': 'conversation-panel',
    });
  });
});
