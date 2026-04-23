import { describe, expect, test } from 'vitest';

import reducer, { addSession, updateMessageContent } from './coworkSlice';

describe('coworkSlice', () => {
  test('uses the latest streaming snapshot without local append merge', () => {
    const sessionId = 'session-1';
    const messageId = 'assistant-1';
    const initialState = reducer(undefined, addSession({
      id: sessionId,
      title: 'Test Session',
      claudeSessionId: null,
      status: 'running',
      pinned: false,
      cwd: '/tmp',
      systemPrompt: '',
      executionMode: 'local',
      agentId: 'main',
      messages: [{
        id: messageId,
        type: 'assistant',
        content: 'Hello world',
        timestamp: 1,
      }],
      activeSkillIds: [],
      createdAt: 1,
      updatedAt: 1,
    }));

    const nextState = reducer(initialState, updateMessageContent({
      sessionId,
      messageId,
      content: 'Hello',
    }));

    expect(nextState.currentSession?.messages[0]?.content).toBe('Hello');
  });
});
