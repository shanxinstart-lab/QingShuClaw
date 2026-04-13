import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { AssistantSpeechGuard } from './assistantSpeechGuard';
import { TtsPlaybackSource } from '../../shared/tts/constants';

const FOLLOW_UP_REQUEST = {
  submitCommand: '发送',
  cancelCommand: '取消',
  sessionTimeoutMs: 20_000,
  autoRestartAfterReply: true,
  source: 'follow_up' as const,
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('grace window 内没有助手播报时会正常触发续麦', () => {
  const dispatchFollowUp = vi.fn();
  const guard = new AssistantSpeechGuard(dispatchFollowUp);

  guard.scheduleFollowUp(FOLLOW_UP_REQUEST);
  vi.advanceTimersByTime(399);
  expect(dispatchFollowUp).not.toHaveBeenCalled();

  vi.advanceTimersByTime(1);
  expect(dispatchFollowUp).toHaveBeenCalledTimes(1);
});

test('助手播报结束后会在冷却时间后触发续麦', () => {
  const dispatchFollowUp = vi.fn();
  const guard = new AssistantSpeechGuard(dispatchFollowUp);

  guard.scheduleFollowUp(FOLLOW_UP_REQUEST);
  guard.handleTtsStarted(TtsPlaybackSource.AssistantReply);
  vi.advanceTimersByTime(2_000);
  expect(dispatchFollowUp).not.toHaveBeenCalled();

  guard.handleTtsStopped(TtsPlaybackSource.AssistantReply);
  vi.advanceTimersByTime(799);
  expect(dispatchFollowUp).not.toHaveBeenCalled();

  vi.advanceTimersByTime(1);
  expect(dispatchFollowUp).toHaveBeenCalledTimes(1);
});

test('连续收到 follow-up 时只保留最后一次请求', () => {
  const dispatchFollowUp = vi.fn();
  const guard = new AssistantSpeechGuard(dispatchFollowUp);

  guard.handleTtsStarted(TtsPlaybackSource.AssistantReply);
  guard.scheduleFollowUp(FOLLOW_UP_REQUEST);
  guard.scheduleFollowUp({
    ...FOLLOW_UP_REQUEST,
    submitCommand: '结束发送',
  });

  guard.handleTtsStopped(TtsPlaybackSource.AssistantReply);
  vi.advanceTimersByTime(800);

  expect(dispatchFollowUp).toHaveBeenCalledTimes(1);
  expect(dispatchFollowUp).toHaveBeenCalledWith({
    ...FOLLOW_UP_REQUEST,
    submitCommand: '结束发送',
  });
});
