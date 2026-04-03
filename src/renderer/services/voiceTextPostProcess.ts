import { apiService } from './api';

const VOICE_POST_PROCESS_TIMEOUT_MS = 12_000;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('Voice text post-processing timed out.'));
    }, timeoutMs);

    promise.then((value) => {
      window.clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      window.clearTimeout(timer);
      reject(error);
    });
  });
};

const normalizeModelText = (value: string): string => {
  return value
    .replace(/^["'“”‘’]+/, '')
    .replace(/["'“”‘’]+$/, '')
    .trim();
};

class VoiceTextPostProcessService {
  async correctSttText(rawText: string): Promise<string> {
    const text = rawText.trim();
    if (!text) {
      return '';
    }

    const result = await withTimeout(apiService.completeText({
      systemPrompt: [
        '你是语音识别纠错助手。',
        '只修正中文语音识别结果中的同音字、错别字、标点和明显断句问题。',
        '不要扩写，不要总结，不要改写语气，不要新增事实。',
        '请保留用户原意，并尽量保留可能的命令词，如：发送、取消、停止输入、结束发送。',
        '只输出修正后的纯文本。',
      ].join('\n'),
      userPrompt: text,
      temperature: 0.1,
      maxTokens: 512,
    }), VOICE_POST_PROCESS_TIMEOUT_MS);

    return normalizeModelText(result) || text;
  }

  async rewriteTtsScript(rawText: string): Promise<string> {
    const text = rawText.trim();
    if (!text) {
      return '';
    }

    const result = await withTimeout(apiService.completeText({
      systemPrompt: [
        '你是中文口播稿改写助手。',
        '请把输入内容改写成自然、简洁、适合直接朗读的中文口播稿。',
        '不要新增事实，不要改变原意，不要解释你的修改。',
        '尽量去掉书面化、列表腔、Markdown 感和工具调用口吻。',
        '只输出适合朗读的纯文本。',
      ].join('\n'),
      userPrompt: text,
      temperature: 0.3,
      maxTokens: 1024,
    }), VOICE_POST_PROCESS_TIMEOUT_MS);

    return normalizeModelText(result) || text;
  }
}

export const voiceTextPostProcessService = new VoiceTextPostProcessService();
