export interface GenerateOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
}

export interface ImageInput {
  dataUri: string;
}

export interface GenerateTextParams {
  systemPrompt?: string;
  userPrompt: string;
  image?: ImageInput;
  model?: string;
  options?: GenerateOptions;
  signal?: AbortSignal;
}

export function getAiErrorMessage(status: number, provider: 'Gemini' | 'OpenAI'): string {
  if (status === 401 || status === 403) {
    return provider === 'Gemini'
      ? 'AI 配置错误：GOOGLE_API_KEY / GEMINI_API_KEY 无效或缺失。'
      : 'AI 配置错误：OPENAI_API_KEY 无效或缺失。';
  }
  if (status === 429) {
    return 'AI 当前繁忙（429），已自动重试仍失败，请稍后再试。';
  }
  if (status >= 500) {
    return `AI 服务暂时不可用（${status}），已自动重试仍失败，请稍后再试。`;
  }
  return `${provider} 请求失败（${status}），请稍后重试。`;
}
