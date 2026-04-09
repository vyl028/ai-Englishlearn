import { z } from 'zod';

// Kimi/OpenAI 配置
const API_KEY = process.env.OPENAI_API_KEY || '';
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.kimi.com/coding/';
const MODEL = process.env.OPENAI_MODEL || 'kimi-k2.5';
const TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '120000');

// 带超时的 fetch 函数
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 通用 AI 请求函数（带重试机制）
async function callAI(
  messages: any[],
  responseFormat?: { type: string },
  maxTokens: number = 4000,
  retries: number = 2
): Promise<string> {
  const url = `${BASE_URL}chat/completions`;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({
            model: MODEL,
            messages,
            temperature: 0.7,
            max_tokens: maxTokens,
            ...(responseFormat && { response_format: responseFormat }),
          }),
        },
        TIMEOUT_MS
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI API error: ${response.status} - ${errorText}`);
      }

      const data: any = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('AI 返回空内容');
      }

      return content;
    } catch (error: any) {
      lastError = error;

      // 如果是最后一次尝试，直接抛出错误
      if (attempt === retries) {
        break;
      }

      // 检查是否是可重试的错误
      const isRetryable =
        error.name === 'AbortError' || // 超时
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('fetch failed') ||
        (error.message?.includes('AI API error') &&
          (error.message?.includes('429') || // 速率限制
            error.message?.includes('502') || // 网关错误
            error.message?.includes('503') || // 服务不可用
            error.message?.includes('504'))); // 网关超时

      if (!isRetryable) {
        throw error;
      }

      // 指数退避重试：1s, 2s
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[AI] 请求失败，${delay}ms 后重试 (${attempt + 1}/${retries})...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('AI 请求失败');
}

// JSON 提取工具
function extractJson(text: string): any {
  // 尝试直接解析
  try {
    return JSON.parse(text);
  } catch {
    // 尝试从代码块中提取
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // ignore
      }
    }
    // 尝试从文本中提取 JSON 对象
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // ignore
      }
    }
  }
  throw new Error('无法从响应中提取 JSON');
}

export class AIService {
  // 生成单词释义
  static async defineWord(term: string) {
    const messages = [
      {
        role: 'system',
        content: `你是一个英语词典助手。请为给定的英语单词或短语生成中文释义和拓展信息。

请以 JSON 格式返回，结构如下：
{
  "definitions": [
    {
      "word": "原词",
      "partOfSpeech": "词性 (noun/verb/adjective/adverb/phrase等)",
      "definition": "中文释义",
      "enrichment": {
        "collocations": ["常见搭配1", "常见搭配2"],
        "synonyms": ["同义词1", "同义词2"],
        "antonyms": ["反义词1", "反义词2"],
        "examples": [
          { "en": "英文例句", "zh": "中文翻译" }
        ],
        "usageZh": "用法说明（80字以内）",
        "difficulty": "难度 (easy/medium/hard)"
      }
    }
  ]
}

对于多词性单词，返回多个 definition 对象。`,
      },
      {
        role: 'user',
        content: `请为 "${term}" 生成释义和拓展信息`,
      },
    ];

    const response = await callAI(messages, undefined, 2000);
    const result = extractJson(response);

    // 验证返回格式
    if (!result.definitions || !Array.isArray(result.definitions)) {
      throw new Error('AI 返回格式不正确');
    }

    return result;
  }

  // 图片识别单词
  static async extractWordsFromImage(imageBase64: string) {
    const messages = [
      {
        role: 'system',
        content: `你是一个图像文字识别助手。请识别图片中的英语单词，并为每个单词生成中文释义和拓展信息。

请以 JSON 格式返回：
{
  "words": [
    {
      "word": "识别出的单词",
      "partOfSpeech": "词性",
      "definition": "中文释义",
      "enrichment": {
        "collocations": ["搭配1", "搭配2", "搭配3"],
        "examples": [{ "en": "例句", "zh": "翻译" }],
        "usageZh": "用法说明"
      }
    }
  ]
}

最多返回 6 个单词，优先选择图片中最清晰、最重要的词汇。`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: '请识别图片中的英语单词：' },
          { type: 'image_url', image_url: { url: imageBase64 } },
        ],
      },
    ];

    const response = await callAI(messages, undefined, 2500);
    const result = extractJson(response);

    if (!result.words || !Array.isArray(result.words)) {
      throw new Error('AI 返回格式不正确');
    }

    return result;
  }

  // 生成练习题
  static async generatePractice(
    words: { word: string; definition: string; partOfSpeech: string }[],
    questionCount: number = 10,
    allowedTypes: ('mcq' | 'fill_blank' | 'reorder')[] = ['mcq', 'fill_blank', 'reorder']
  ) {
    const wordsText = words.map(w => `${w.word} (${w.partOfSpeech}): ${w.definition}`).join('\n');

    const messages = [
      {
        role: 'system',
        content: `你是一个英语练习题生成助手。请基于给定的单词列表生成练习题。

题型说明：
1. mcq (选择题): 单句填空，A/B/C/D 选项，测试词义和用法
2. fill_blank (填空题): 句子挖空，填写单词正确形式
3. reorder (重组题): 打乱单词顺序，要求重组为正确句子

请以 JSON 格式返回：
{
  "questions": [
    {
      "type": "mcq|fill_blank|reorder",
      "targetWord": "目标单词",
      "promptZh": "题干中文（仅mcq需要）",
      "promptEn": "题干英文",
      "options": ["A选项", "B选项", "C选项", "D选项"], // mcq only
      "correctAnswer": "正确答案",
      "answer": "标准答案（与correctAnswer相同，兼容性）",
      "explanation": "答案解析",
      "analysis": "详细分析（与explanation相同，兼容性）",
      "grammar": "语法讲解",
      "usage": "词汇用法讲解",
      "fragments": ["单词1", "单词2", "单词3"] // reorder only
    }
  ]
}

共生成 ${questionCount} 道题，题型从 [${allowedTypes.join(', ')}] 中随机选择。`,
      },
      {
        role: 'user',
        content: `请基于以下单词生成练习题：\n${wordsText}`,
      },
    ];

    const response = await callAI(messages, undefined, 3500);
    const result = extractJson(response);

    if (!result.questions || !Array.isArray(result.questions)) {
      throw new Error('AI 返回格式不正确');
    }

    return result;
  }

  // 生成故事
  static async generateStory(
    words: { word: string; definition: string }[]
  ) {
    const wordsText = words.map(w => `${w.word}: ${w.definition}`).join('\n');

    const messages = [
      {
        role: 'system',
        content: `你是一个英语故事生成助手。请基于给定的单词列表编写一个有趣的故事，帮助学习者记忆这些单词。

请以 JSON 格式返回：
{
  "title": "故事标题",
  "story": "英文故事正文",
  "translation": "中文翻译"
}

要求：
1. 故事长度适中，约 200-400 词
2. 自然地融入给定的单词
3. 情节有趣，易于理解
4. 提供流畅的中文翻译`,
      },
      {
        role: 'user',
        content: `请基于以下单词生成故事：\n${wordsText}`,
      },
    ];

    const response = await callAI(messages, undefined, 3500);
    const result = extractJson(response);

    if (!result.title || !result.story || !result.translation) {
      throw new Error('AI 返回格式不正确');
    }

    return result;
  }

  // 作文批改
  static async reviewEssay(title: string | undefined, essay: string) {
    const messages = [
      {
        role: 'system',
        content: `你是一个雅思写作 Task 2 批改专家。请对作文进行全面批改和评分。

请以 JSON 格式返回：
{
  "scores": {
    "tr": "任务回应分数 (0-9)",
    "cc": "连贯与衔接分数 (0-9)",
    "lr": "词汇资源分数 (0-9)",
    "gra": "语法范围与准确性分数 (0-9)",
    "overall": "总分 (0-9)",
    "cefr": "CEFR等级 (A1-C2)"
  },
  "issues": [
    {
      "type": "grammar|spelling|vocabulary|logic|coherence",
      "severity": "high|medium|low",
      "message": "问题描述",
      "original": "原文片段",
      "suggestion": "修改建议",
      "corrected": "修正后的句子"
    }
  ],
  "revisedTextEn": "优化后的完整作文（英文）",
  "revisedTextZh": "优化后作文的中文翻译",
  "keyChanges": [
    {
      "before": "修改前",
      "after": "修改后",
      "explanation": "修改原因"
    }
  ]
}

请给出详细、建设性的反馈。`,
      },
      {
        role: 'user',
        content: `题目：${title || '无'}\n\n作文：\n${essay}`,
      },
    ];

    const response = await callAI(messages, undefined, 4500);
    const result = extractJson(response);

    return result;
  }

  // 文章分析
  static async studyArticle(article: string, generateQuestions: boolean = false) {
    const messages = [
      {
        role: 'system',
        content: `你是一个英语阅读教学助手。请对文章进行深度分析，帮助学习者理解。

请以 JSON 格式返回：
{
  "structure": {
    "paragraphs": [
      {
        "index": 段落序号,
        "mainIdea": "段落主旨",
        "role": "段落角色（引入/论证/举例/总结等）",
        "relationToPrevious": "与前文逻辑关系"
      }
    ]
  },
  "syntax": {
    "highlights": [
      {
        "sentence": "例句",
        "analysis": "句法分析（从句/时态/语态等）"
      }
    ]
  },
  "difficultSentences": [
    {
      "original": "原句",
      "breakdown": "结构拆解",
      "simplified": "简化表达",
      "rewrite": "重写示范"
    }
  ],
  "keyVocabulary": [
    {
      "word": "单词/短语",
      "meaning": "中文释义",
      "usage": "用法提示"
    }
  ],
  "questions": [ // 仅在 generateQuestions 为 true 时
    {
      "question": "题目",
      "options": ["A选项", "B选项", "C选项", "D选项"],
      "correctAnswer": "A/B/C/D",
      "explanation": "解析",
      "location": "定位依据"
    }
  ]
}

${generateQuestions ? '请生成 5 道中国考试风格的选择题。' : ''}`,
      },
      {
        role: 'user',
        content: `请分析以下文章：\n\n${article}`,
      },
    ];

    const response = await callAI(messages, undefined, 4500);
    const result = extractJson(response);

    return result;
  }

  // 口语对话
  static async speakingChat(params: {
    scenario?: string;
    userTextEn: string;
    history?: Array<{ role: 'user' | 'assistant'; contentEn: string }>;
    targetLevel?: string;
  }) {
    const { scenario, userTextEn, history, targetLevel } = params;

    const historyText = (history || [])
      .slice(-12)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${String(m.contentEn || '').trim()}`)
      .filter((s) => s.trim())
      .join('\n');

    const messages = [
      {
        role: 'system',
        content: `你是一个友好的英语对话伙伴和严格的口语教练，帮助中国学习者提高英语口语。

重要约束：
- 你没有访问用户音频的权限，只能基于转写文本进行反馈
- 对话回复语言：英语
- 教练/反馈语言：简体中文
- 助手回复要自然简短（1-3句话），像真实对话一样
- 给出实用的纠正建议，而非泛泛的表扬

目标水平：${targetLevel || 'B1'}`,
      },
      {
        role: 'user',
        content: `场景：${scenario || '日常对话'}

对话历史：
${historyText || '（无）'}

用户说的话（英语转写）：
${userTextEn.trim()}

请完成以下两件事：
1) 作为助手用英语回复（1-3句话），自然地继续对话
2) 基于文本评估用户的表达，用简体中文给出反馈：
   - 指出 1-4 个关键问题（语法/用词/流利度/连贯性）
   - 提供更自然的纠正版本（英语）
   - 给出 1-2 条实用建议

请以 JSON 格式返回：
{
  "assistantReplyEn": "助手回复（英语）",
  "feedbackZh": "反馈（简体中文）",
  "correctedUserEn": "纠正后的用户表达（英语，可选）",
  "issues": [
    {"type": "grammar|word_choice|fluency|coherence|other", "original": "原文", "suggestion": "建议", "reasonZh": "原因（中文）"}
  ],
  "scoreOverall": 75
}`,
      },
    ];

    const response = await callAI(messages, undefined, 1500);
    const result = extractJson(response);

    return {
      kind: 'speaking_chat',
      assistantReplyEn: result.assistantReplyEn || 'Could you say that again?',
      feedbackZh: result.feedbackZh || '（AI 未返回反馈）',
      correctedUserEn: result.correctedUserEn,
      issues: result.issues || [],
      scoreOverall: typeof result.scoreOverall === 'number' ? result.scoreOverall : undefined,
    };
  }
}
