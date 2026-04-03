import { apiService } from './api';

const VOICE_POST_PROCESS_TIMEOUT_MS = 12_000;

const STT_CORRECTION_SYSTEM_PROMPT = [
  '你是一个语音识别文本纠错助手。',
  '你的任务是纠正中文语音转文字中的同音词、错别字、标点和明显断句问题。',
  '不要扩写，不要总结，不要解释，不要补充新事实，不要改变原意。',
  '如果原文中可能包含命令词，例如“发送”“取消”“停止输入”“结束发送”，必须保留其语义。',
  '只输出纠正后的纯文本。',
].join('\n');

const TTS_REWRITE_SYSTEM_PROMPT = [
  '你是一个中文口播稿改写助手。',
  '请把输入内容改写成自然、简洁、适合语音朗读的中文口播稿。',
  '不要新增事实，不要改变原意，不要输出标题、解释或额外说明。',
  '尽量去掉 Markdown 感、工具味、列表腔和过强的书面表达。',
  '只输出最终的纯文本口播稿。',
].join('\n');

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Voice post-process timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }).catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
};

const normalizeModelOutput = (value: string): string => {
  return value
    .trim()
    .replace(/^["'“”‘’]+/, '')
    .replace(/["'“”‘’]+$/, '')
    .trim();
};

const runPostProcessPrompt = async (input: string, systemPrompt: string): Promise<string> => {
  const result = await withTimeout(apiService.chat(input, undefined, [
    {
      role: 'system',
      content: systemPrompt,
    },
  ]), VOICE_POST_PROCESS_TIMEOUT_MS);

  return normalizeModelOutput(result.content);
};

class VoiceTextPostProcessService {
  async correctSttText(rawText: string): Promise<string> {
    const normalized = rawText.trim();
    if (!normalized) {
      return '';
    }

    try {
      const corrected = await runPostProcessPrompt(normalized, STT_CORRECTION_SYSTEM_PROMPT);
      return corrected || normalized;
    } catch (error) {
      console.warn('[VoicePostProcess] Failed to correct STT text, falling back to raw text:', error);
      return normalized;
    }
  }

  async rewriteTtsText(rawText: string): Promise<string> {
    const normalized = rawText.trim();
    if (!normalized) {
      return '';
    }

    try {
      const rewritten = await runPostProcessPrompt(normalized, TTS_REWRITE_SYSTEM_PROMPT);
      return rewritten || normalized;
    } catch (error) {
      console.warn('[VoicePostProcess] Failed to rewrite TTS script, falling back to cleaned text:', error);
      return normalized;
    }
  }
}

export const voiceTextPostProcessService = new VoiceTextPostProcessService();
