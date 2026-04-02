import { describe, expect, test } from 'vitest';
import { buildSpeechDraftText, resolveSpeechVoiceCommand, SpeechVoiceCommandAction } from './coworkSpeechText';

const DEFAULT_SPEECH_VOICE_COMMAND_CONFIG = {
  stopCommand: '停止输入',
  submitCommand: '结束发送',
};

describe('buildSpeechDraftText', () => {
  test('returns speech text when draft is empty', () => {
    expect(buildSpeechDraftText('', 'hello world')).toBe('hello world');
  });

  test('appends speech text on a new line when draft has content', () => {
    expect(buildSpeechDraftText('existing draft', 'hello world')).toBe('existing draft\nhello world');
  });

  test('preserves trailing newline on the base text', () => {
    expect(buildSpeechDraftText('existing draft\n', 'hello world')).toBe('existing draft\nhello world');
  });

  test('ignores whitespace-only speech text', () => {
    expect(buildSpeechDraftText('existing draft', '   ')).toBe('existing draft');
  });
});

describe('resolveSpeechVoiceCommand', () => {
  test('does not trigger when no command phrase exists', () => {
    expect(resolveSpeechVoiceCommand('帮我总结一下今天的会议内容', DEFAULT_SPEECH_VOICE_COMMAND_CONFIG)).toEqual({
      action: null,
      cleanedSpeechText: '帮我总结一下今天的会议内容',
    });
  });

  test('detects submit command at the tail', () => {
    expect(resolveSpeechVoiceCommand('帮我总结一下今天的会议内容 结束发送', DEFAULT_SPEECH_VOICE_COMMAND_CONFIG)).toEqual({
      action: SpeechVoiceCommandAction.Submit,
      cleanedSpeechText: '帮我总结一下今天的会议内容',
    });
  });

  test('detects stop command with trailing punctuation', () => {
    expect(resolveSpeechVoiceCommand('继续记录下一条，停止输入。', DEFAULT_SPEECH_VOICE_COMMAND_CONFIG)).toEqual({
      action: SpeechVoiceCommandAction.Stop,
      cleanedSpeechText: '继续记录下一条，',
    });
  });

  test('ignores command phrase when it is not at the tail', () => {
    expect(resolveSpeechVoiceCommand('如果用户说结束发送这个词，不要真的发送', DEFAULT_SPEECH_VOICE_COMMAND_CONFIG)).toEqual({
      action: null,
      cleanedSpeechText: '如果用户说结束发送这个词，不要真的发送',
    });
  });

  test('supports custom command phrases', () => {
    expect(resolveSpeechVoiceCommand('继续记录会议结论 马上发出', {
      stopCommand: '暂停记录',
      submitCommand: '马上发出',
    })).toEqual({
      action: SpeechVoiceCommandAction.Submit,
      cleanedSpeechText: '继续记录会议结论',
    });
  });

  test('disables stop command when the phrase is empty', () => {
    expect(resolveSpeechVoiceCommand('继续记录下一条 停止输入', {
      stopCommand: '',
      submitCommand: '结束发送',
    })).toEqual({
      action: null,
      cleanedSpeechText: '继续记录下一条 停止输入',
    });
  });
});
