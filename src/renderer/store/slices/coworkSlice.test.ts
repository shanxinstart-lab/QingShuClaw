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

  test('merges metadata from streaming message updates', () => {
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
        content: 'Final answer',
        timestamp: 1,
        metadata: {
          isStreaming: true,
          isFinal: false,
        },
      }],
      activeSkillIds: [],
      createdAt: 1,
      updatedAt: 1,
    }));

    const nextState = reducer(initialState, updateMessageContent({
      sessionId,
      messageId,
      content: 'Final answer',
      metadata: {
        isStreaming: false,
        isFinal: true,
        model: 'gpt-test',
        usage: {
          inputTokens: 123,
          outputTokens: 45,
        },
      },
    }));

    expect(nextState.currentSession?.messages[0]?.metadata).toMatchObject({
      isStreaming: false,
      isFinal: true,
      model: 'gpt-test',
      usage: {
        inputTokens: 123,
        outputTokens: 45,
      },
    });
  });

  test('keeps early streaming updates when the full message has not arrived yet', () => {
    const sessionId = 'session-1';
    const messageId = 'assistant-early';
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
      messages: [],
      activeSkillIds: [],
      createdAt: 1,
      updatedAt: 1,
    }));

    const nextState = reducer(initialState, updateMessageContent({
      sessionId,
      messageId,
      content: 'Streaming answer',
      metadata: {
        isStreaming: true,
      },
    }));

    expect(nextState.currentSession?.messages).toHaveLength(1);
    expect(nextState.currentSession?.messages[0]).toMatchObject({
      id: messageId,
      type: 'assistant',
      content: 'Streaming answer',
      metadata: {
        isStreaming: true,
      },
    });
  });
});
