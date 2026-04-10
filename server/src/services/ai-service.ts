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

// 尝试修复截断的 JSON
function tryFixTruncatedJson(text: string): string | null {
  let fixed = text.trim();

  // 如果结尾缺少 }，尝试补全
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;

  // 补全缺失的 ] 和 }
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    fixed += ']';
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    fixed += '}';
  }

  try {
    JSON.parse(fixed);
    return fixed;
  } catch {
    return null;
  }
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
        // 尝试修复截断的 JSON
        const fixed = tryFixTruncatedJson(match[1]);
        if (fixed) return JSON.parse(fixed);
      }
    }
    // 尝试从文本中提取 JSON 对象
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // 尝试修复截断的 JSON
        const fixed = tryFixTruncatedJson(jsonMatch[0]);
        if (fixed) return JSON.parse(fixed);
      }
    }
  }
  // 输出原始内容以便调试
  console.error('[AI] Failed to extract JSON. Raw text preview:', text.substring(0, 500));
  throw new Error('无法从响应中提取 JSON');
}

// 辅助函数：将值转换为数字（支持字符串数字）
function toNumber(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

// 验证并规范化作文批改结果
function validateAndNormalizeEssayReview(raw: any): any {
  // AI 实际返回的字段映射到前端期望的字段
  const result: any = {
    kind: 'ielts_task2_review',
    overallBand: 0,
    scores: {
      taskResponse: 0,
      coherenceCohesion: 0,
      lexicalResource: 0,
      grammaticalRangeAccuracy: 0,
      overallBand: 0,
    },
    summaryZh: '',
    strengthsZh: [],
    weaknessesZh: [],
    issues: [],
    beforeAfter: [],
    revisedTextEn: '',
  };

  console.log('[AI] Raw result keys:', Object.keys(raw));
  console.log('[AI] Raw scores:', JSON.stringify(raw.scores));
  console.log('[AI] Raw issues count:', Array.isArray(raw.issues) ? raw.issues.length : 0);
  console.log('[AI] Raw keyChanges count:', Array.isArray(raw.keyChanges) ? raw.keyChanges.length : 0);

  // 处理 overallBand（AI 可能返回为 scores.overall）
  if (raw.scores && typeof raw.scores === 'object') {
    // AI 返回的字段名：tr, cc, lr, gra, overall
    result.scores.taskResponse = toNumber(raw.scores.tr ?? raw.scores.taskResponse ?? raw.scores.task_response ?? 0);
    result.scores.coherenceCohesion = toNumber(raw.scores.cc ?? raw.scores.coherenceCohesion ?? raw.scores.coherence_cohesion ?? 0);
    result.scores.lexicalResource = toNumber(raw.scores.lr ?? raw.scores.lexicalResource ?? raw.scores.lexical_resource ?? 0);
    result.scores.grammaticalRangeAccuracy = toNumber(raw.scores.gra ?? raw.scores.grammaticalRangeAccuracy ?? raw.scores.grammatical_range_accuracy ?? 0);
    result.scores.overallBand = toNumber(raw.scores.overall ?? raw.scores.overallBand ?? raw.scores.overall_band ?? 0);
    result.overallBand = toNumber(raw.scores.overall ?? raw.overallBand ?? result.scores.overallBand);

    // 处理 CEFR 等级
    if (raw.scores.cefr) {
      result.level = {
        cefr: raw.scores.cefr,
        commentZh: '',
      };
    }
  }

  // 处理 level 对象（如果 AI 返回了单独的 level）
  if (raw.level && typeof raw.level === 'object') {
    result.level = {
      cefr: raw.level.cefr || raw.scores?.cefr || 'Unknown',
      commentZh: raw.level.commentZh || raw.level.comment_zh || '',
    };
  }

  // 处理 summaryZh
  if (raw.summaryZh) {
    result.summaryZh = raw.summaryZh;
  } else if (raw.summary_zh) {
    result.summaryZh = raw.summary_zh;
  } else {
    // 从 strengthsZh 和 weaknessesZh 生成 summary
    const parts: string[] = [];
    if (Array.isArray(raw.strengthsZh) && raw.strengthsZh.length > 0) {
      parts.push('优点：' + raw.strengthsZh.join('；'));
    }
    if (Array.isArray(raw.weaknessesZh) && raw.weaknessesZh.length > 0) {
      parts.push('可改进点：' + raw.weaknessesZh.join('；'));
    }
    result.summaryZh = parts.join('\n') || '作文批改完成';
  }

  // 处理 strengthsZh 和 weaknessesZh
  if (Array.isArray(raw.strengthsZh)) {
    result.strengthsZh = raw.strengthsZh;
  } else if (Array.isArray(raw.strengths_zh)) {
    result.strengthsZh = raw.strengths_zh;
  }

  if (Array.isArray(raw.weaknessesZh)) {
    result.weaknessesZh = raw.weaknessesZh;
  } else if (Array.isArray(raw.weaknesses_zh)) {
    result.weaknessesZh = raw.weaknesses_zh;
  }

  // 处理 revisedTextEn
  result.revisedTextEn = raw.revisedTextEn || raw.revised_text_en || raw.revisedText || '';

  // 规范化 issues 数组
  const validCategories = ['grammar', 'spelling', 'tense', 'logic', 'coherence', 'task_response', 'word_choice', 'punctuation', 'style', 'other'];
  const validSeverities = ['low', 'medium', 'high'];

  if (Array.isArray(raw.issues)) {
    result.issues = raw.issues.map((issue: any) => {
      const normalized: any = {
        category: 'other',
        suggestion: '',
        explanationZh: '',
      };

      if (issue && typeof issue === 'object') {
        // 处理 category（AI 可能返回 type）
        const cat = issue.category || issue.type;
        if (cat && validCategories.includes(cat)) {
          normalized.category = cat;
        } else if (cat) {
          const catLower = String(cat).toLowerCase();
          if (catLower.includes('grammar')) normalized.category = 'grammar';
          else if (catLower.includes('spell')) normalized.category = 'spelling';
          else if (catLower.includes('tense')) normalized.category = 'tense';
          else if (catLower.includes('logic')) normalized.category = 'logic';
          else if (catLower.includes('coheren')) normalized.category = 'coherence';
          else if (catLower.includes('task')) normalized.category = 'task_response';
          else if (catLower.includes('word') || catLower.includes('vocab')) normalized.category = 'word_choice';
          else if (catLower.includes('punct')) normalized.category = 'punctuation';
          else if (catLower.includes('style')) normalized.category = 'style';
        }

        // 处理 severity
        const sev = issue.severity;
        if (sev && validSeverities.includes(sev)) {
          normalized.severity = sev;
        } else if (sev) {
          const sevLower = String(sev).toLowerCase();
          if (sevLower.includes('high') || sevLower.includes('严重')) normalized.severity = 'high';
          else if (sevLower.includes('medium') || sevLower.includes('中等')) normalized.severity = 'medium';
          else if (sevLower.includes('low') || sevLower.includes('轻微')) normalized.severity = 'low';
        }

        // 处理字段映射
        normalized.original = issue.original || issue.original_text || issue.text || '';
        normalized.suggestion = issue.suggestion || issue.suggested || issue.correction || '';
        // AI 可能返回 message 而不是 explanationZh
        normalized.explanationZh = issue.explanationZh || issue.explanation_zh || issue.explanation || issue.message || '';
        normalized.exampleEn = issue.exampleEn || issue.example_en || issue.example || issue.corrected || '';
        normalized.exampleZh = issue.exampleZh || issue.example_zh || '';
      }

      return normalized;
    });
  }

  // 处理 beforeAfter（AI 可能返回 keyChanges）
  const beforeAfterSource = raw.beforeAfter || raw.before_after || raw.keyChanges || raw.key_changes;
  if (Array.isArray(beforeAfterSource)) {
    result.beforeAfter = beforeAfterSource.map((item: any) => ({
      before: item.before || item.original || '',
      after: item.after || item.revised || '',
      reasonZh: item.reasonZh || item.reason_zh || item.reason || item.explanation || item.explanationZh || '',
    }));
  }

  console.log('[AI] Normalized result:', JSON.stringify({
    overallBand: result.overallBand,
    scores: result.scores,
    issuesCount: result.issues.length,
    beforeAfterCount: result.beforeAfter.length,
    hasSummaryZh: !!result.summaryZh,
    hasRevisedTextEn: !!result.revisedTextEn,
  }));

  return result;
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
      "options": ["English option A", "English option B", "English option C", "English option D"], // mcq only: 四个英文选项
      "correctAnswer": "正确答案",
      "answer": "标准答案（与correctAnswer相同，兼容性）",
      "explanation": "答案解析",
      "analysis": "详细分析（与explanation相同，兼容性）",
      "grammar": "语法讲解",
      "usage": "词汇用法讲解",
      "parts": ["word1", "word2", "word3", "word4"], // reorder only: 打乱顺序的英文句子片段，至少4个
      "correctOrder": [2, 0, 1, 3], // reorder only: 正确顺序的索引数组，对应parts的索引
      "answerSentenceEn": "Correct sentence in English", // reorder only: 可选，完整正确句子
      "translationZh": "句子中文翻译", // reorder only: 可选
      "sentenceEn": "Fill in the blank sentence with ____ placeholder", // fill_blank only
      "acceptableAnswers": ["answer1", "answer2"] // fill_blank only: 可接受的答案列表（必填）
    }
  ]
}

重要说明：
- mcq 的 options 必须是英文选项（四个选项都是英文）
- reorder 的 parts 必须是英文句子片段

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

    // 数据规范化，确保所有必需字段都存在
    result.questions = result.questions.map((q: any) => {
      const normalized: any = {
        type: q.type || 'mcq',
        targetWord: q.targetWord || '',
        promptZh: q.promptZh || '',
        promptEn: q.promptEn || '',
        explanation: q.explanation || q.analysis || '',
        analysisZh: q.analysisZh || q.analysis || q.explanation || '',
        grammarZh: q.grammarZh || q.grammar || '',
        usageZh: q.usageZh || q.usage || '',
      };

      if (q.type === 'mcq') {
        normalized.options = Array.isArray(q.options) ? q.options : ['A', 'B', 'C', 'D'];
        normalized.answerIndex = typeof q.answerIndex === 'number' ? q.answerIndex : 0;
        if (q.correctAnswer && typeof normalized.answerIndex !== 'number') {
          const idx = ['A', 'B', 'C', 'D'].indexOf(q.correctAnswer);
          normalized.answerIndex = idx >= 0 ? idx : 0;
        }
      }

      if (q.type === 'fill_blank') {
        normalized.sentenceEn = q.sentenceEn || q.promptEn || '____';
        normalized.acceptableAnswers = Array.isArray(q.acceptableAnswers) ? q.acceptableAnswers :
                                        (q.correctAnswer ? [q.correctAnswer] : ['']);
      }

      if (q.type === 'reorder') {
        normalized.parts = Array.isArray(q.parts) ? q.parts : [];
        normalized.correctOrder = Array.isArray(q.correctOrder) ? q.correctOrder :
                                   normalized.parts.map((_: any, i: number) => i);
        normalized.answerSentenceEn = q.answerSentenceEn || '';
        normalized.translationZh = q.translationZh || '';
      }

      return normalized;
    });

    console.log('[AI] Practice generated:', JSON.stringify({
      totalQuestions: result.questions.length,
      mcqCount: result.questions.filter((q: any) => q.type === 'mcq').length,
      fillBlankCount: result.questions.filter((q: any) => q.type === 'fill_blank').length,
      reorderCount: result.questions.filter((q: any) => q.type === 'reorder').length,
      sampleQuestion: result.questions[0] || null,
    }, null, 2));

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
  "overallBand": "总分 (0-9)",
  "level": {
    "cefr": "CEFR等级 (A1-C2)",
    "commentZh": "等级评价中文说明（可选）"
  },
  "scores": {
    "taskResponse": "任务回应分数 (0-9)",
    "coherenceCohesion": "连贯与衔接分数 (0-9)",
    "lexicalResource": "词汇资源分数 (0-9)",
    "grammaticalRangeAccuracy": "语法范围与准确性分数 (0-9)"
  },
  "summaryZh": "总体评价中文摘要",
  "strengthsZh": ["优点1", "优点2"],
  "weaknessesZh": ["需改进1", "需改进2"],
  "issues": [
    {
      "category": "grammar|spelling|tense|logic|coherence|task_response|word_choice|punctuation",
      "severity": "low|medium|high",
      "original": "原文片段（英文）",
      "suggestion": "修改建议（英文）",
      "explanationZh": "问题中文解释",
      "exampleEn": "示例句子（英文，可选）",
      "exampleZh": "示例句子中文翻译（可选）"
    }
  ],
  "revisedTextEn": "优化后的完整作文（英文）",
  "beforeAfter": [
    {
      "before": "修改前片段",
      "after": "修改后片段",
      "reasonZh": "修改原因中文说明"
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

    const response = await callAI(messages, undefined, 8000);
    const rawResult = extractJson(response);

    console.log('[AI] Essay review raw result:', JSON.stringify({
      hasOverallBand: !!rawResult.overallBand,
      overallBandValue: rawResult.overallBand,
      hasScores: !!rawResult.scores,
      scoresValue: rawResult.scores,
      hasIssues: !!rawResult.issues,
      issuesCount: Array.isArray(rawResult.issues) ? rawResult.issues.length : 0,
      hasBeforeAfter: !!(rawResult.beforeAfter || rawResult.keyChanges),
      beforeAfterCount: Array.isArray(rawResult.beforeAfter || rawResult.keyChanges) ? (rawResult.beforeAfter || rawResult.keyChanges).length : 0,
      hasSummaryZh: !!rawResult.summaryZh,
      hasRevisedTextEn: !!rawResult.revisedTextEn,
    }, null, 2));

    // 数据验证和补全，确保返回格式符合前端期望
    const result = validateAndNormalizeEssayReview(rawResult);

    console.log('[AI] Essay review normalized result:', JSON.stringify({
      kind: result.kind,
      overallBand: result.overallBand,
      scores: result.scores,
      issuesCount: result.issues?.length || 0,
      beforeAfterCount: result.beforeAfter?.length || 0,
      hasSummaryZh: !!result.summaryZh,
      summaryZhPreview: result.summaryZh?.substring(0, 100),
      hasRevisedTextEn: !!result.revisedTextEn,
    }, null, 2));

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
  ]${generateQuestions ? `,
  "questions": [
    {
      "question": "题目",
      "options": ["A选项", "B选项", "C选项", "D选项"],
      "correctAnswer": "A/B/C/D",
      "explanation": "解析",
      "location": "定位依据"
    }
  ]` : ''}
}

${generateQuestions ? '请生成 5 道中国考试风格的选择题。' : '不要生成 questions 字段。'}`,
      },
      {
        role: 'user',
        content: `请分析以下文章：\n\n${article}`,
      },
    ];

    const response = await callAI(messages, undefined, 4500);
    const rawResult = extractJson(response);

    console.log('[AI] Article study raw result keys:', Object.keys(rawResult));
    console.log('[AI] Article study raw structure:', JSON.stringify(rawResult.structure ? { hasParagraphs: !!rawResult.structure.paragraphs, paragraphsCount: rawResult.structure.paragraphs?.length } : null));
    console.log('[AI] Article study raw syntax:', JSON.stringify(rawResult.syntax ? { hasHighlights: !!rawResult.syntax.highlights, highlightsCount: rawResult.syntax.highlights?.length } : null));
    console.log('[AI] Article study raw difficultSentences:', Array.isArray(rawResult.difficultSentences) ? `count: ${rawResult.difficultSentences.length}` : `type: ${typeof rawResult.difficultSentences}`);
    console.log('[AI] Article study raw keyVocabulary:', Array.isArray(rawResult.keyVocabulary) ? `count: ${rawResult.keyVocabulary.length}` : `type: ${typeof rawResult.keyVocabulary}`);
    console.log('[AI] Article study raw phrases:', Array.isArray(rawResult.phrases) ? `count: ${rawResult.phrases.length}` : `type: ${typeof rawResult.phrases}`);

    // AI 返回的字段名映射到前端期望的字段名
    const rawStructure = rawResult.structure || {};
    const rawSyntax = rawResult.syntax || {};

    // 数据规范化，确保返回格式符合前端期望
    const result: any = {
      kind: 'article_study',
      structure: {
        overallMainIdeaZh: rawStructure.overallMainIdea || rawStructure.overallMainIdeaZh || '',
        outlineZh: rawStructure.outline || rawStructure.outlineZh || '',
        paragraphs: (rawStructure.paragraphs || []).map((p: any) => ({
          index: p.index || 0,
          mainIdeaZh: p.mainIdea || p.mainIdeaZh || '',
          roleZh: p.role || p.roleZh || '',
          logicToPrevZh: p.relationToPrevious || p.logicToPrevZh || '',
        })),
        relations: (rawStructure.relations || []).map((r: any) => ({
          from: r.from || 0,
          to: r.to || 0,
          relationZh: r.relationZh || r.relation || '',
        })),
      },
      syntax: {
        overviewZh: rawSyntax.overview || rawSyntax.overviewZh || '',
        highlights: (rawSyntax.highlights || []).map((h: any) => ({
          sentenceEn: h.sentence || h.sentenceEn || '',
          pointsZh: Array.isArray(h.pointsZh) ? h.pointsZh : (h.analysis ? [h.analysis] : []),
        })),
      },
      hardSentences: (rawResult.difficultSentences || []).map((s: any) => ({
        originalEn: s.original || s.originalEn || '',
        translationZh: s.translation || s.translationZh || '',
        coreStructureEn: s.breakdown || s.coreStructure || s.coreStructureEn || '',
        tenseVoiceZh: s.tenseVoice || s.tenseVoiceZh || '',
        clauses: Array.isArray(s.clauses) ? s.clauses.map((c: any) => ({
          clauseEn: c.clause || c.clauseEn || '',
          functionZh: c.function || c.functionZh || '',
        })) : [],
        explanationZh: s.explanation || s.explanationZh || '',
        simplifiedEn: s.simplified || s.simplifiedEn || '',
        rebuiltEn: s.rewrite || s.rebuilt || s.rebuiltEn || '',
      })),
      keywords: (rawResult.keyVocabulary || []).map((k: any) => ({
        term: k.word || k.term || '',
        pos: k.partOfSpeech || k.pos || '',
        meaningZh: k.meaning || k.meaningZh || '',
        noteZh: k.usage || k.note || k.noteZh || '',
        exampleEn: k.example || k.exampleEn || '',
      })),
      phrases: (rawResult.phrases || []).map((p: any) => ({
        phrase: p.phrase || '',
        meaningZh: p.meaning || p.meaningZh || '',
        noteZh: p.note || p.noteZh || '',
        exampleEn: p.example || p.exampleEn || '',
      })),
      questions: (rawResult.questions || []).map((q: any) => ({
        questionEn: q.question || q.questionEn || '',
        options: q.options || [],
        answerIndex: q.correctAnswer ? ['A', 'B', 'C', 'D'].indexOf(q.correctAnswer) : (q.answerIndex || 0),
        analysisZh: q.explanation || q.analysis || q.analysisZh || '',
        locate: q.location ? { quoteEn: q.location } : (q.locate || {}),
      })),
    };

    console.log('[AI] Article study normalized result:', JSON.stringify({
      kind: result.kind,
      hasStructure: !!result.structure,
      structureParagraphsCount: result.structure?.paragraphs?.length || 0,
      hasSyntax: !!result.syntax,
      syntaxHighlightsCount: result.syntax?.highlights?.length || 0,
      hardSentencesCount: result.hardSentences?.length || 0,
      keywordsCount: result.keywords?.length || 0,
      phrasesCount: result.phrases?.length || 0,
      questionsCount: result.questions?.length || 0,
    }));

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
