import { ProviderName } from '../../shared/providers';

export const buildApiRequestHeaders = (
  provider: string,
  apiKey: string,
): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    if (provider === ProviderName.Gemini) {
      headers['x-goog-api-key'] = apiKey;
    } else {
      headers.Authorization = `Bearer ${apiKey}`;
    }
  }

  if (provider === ProviderName.Copilot) {
    headers['Copilot-Integration-Id'] = 'vscode-chat';
    headers['Editor-Version'] = 'vscode/1.96.2';
    headers['Editor-Plugin-Version'] = 'copilot-chat/0.26.7';
    headers['User-Agent'] = 'GitHubCopilotChat/0.26.7';
    headers['Openai-Intent'] = 'conversation-panel';
  }

  return headers;
};
