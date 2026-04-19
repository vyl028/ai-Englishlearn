import { z } from 'zod';

// Kimi/OpenAI 配置
const API_KEY = process.env.OPENAI_API_KEY || '';
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.kimi.com/coding/';
const MODEL = process.env.OPENAI_MODEL || 'kimi-k2.5';
const TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '120000');

// 视觉模型配置（专用于图片识别，主模型不支持视觉）
const VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'qwen3-vl:235b';

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

interface CallLLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: string };
  retries?: number;
  stripThink?: boolean;
  baseUrl?: string;
  apiKey?: string;
}

// 统一 AI 请求函数（支持重试、模型切换、推理块清理）
async function callLLM(messages: any[], options: CallLLMOptions = {}): Promise<string> {
  const {
    model = MODEL,
    temperature = 0.7,
    maxTokens = 4000,
    responseFormat,
    retries = 2,
    stripThink = false,
    baseUrl = BASE_URL,
    apiKey = API_KEY,
  } = options;

  const url = `${baseUrl}chat/completions`;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
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

      return stripThink ? content.replace(/<think>[\s\S]*?<\/think>/g, '').trim() : content;
    } catch (error: any) {
      lastError = error;

      if (attempt === retries) break;

      const isRetryable =
        error.name === 'AbortError' ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('fetch failed') ||
        (error.message?.includes('AI API error') &&
          (error.message?.includes('429') ||
            error.message?.includes('502') ||
            error.message?.includes('503') ||
            error.message?.includes('504')));

      if (!isRetryable) throw error;

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
    // 简单补全失败，尝试更智能的修复
    return trySmartFixTruncatedJson(text);
  }
}

// 智能修复截断的 JSON，处理嵌套结构
function trySmartFixTruncatedJson(text: string): string | null {
  let fixed = text.trim();

  // 找到最后一个完整的属性值对，尝试截断到那里
  // 匹配模式："key": value (可以是字符串、数字、对象、数组、true/false/null)

  // 如果文本以逗号结尾，移除逗号
  if (fixed.endsWith(',')) {
    fixed = fixed.slice(0, -1);
  }

  // 尝试找到最后一个完整的字符串值
  const lastStringMatch = fixed.match(/"([^"]*)"\s*$/);
  if (lastStringMatch && !fixed.match(/"[^"]*":\s*$/)) {
    // 最后一个字符串不是键，可能是值，尝试关闭它
  }

  // 计算每个层级的括号状态
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let escapeNext = false;
  let lastValidPos = 0;

  for (let i = 0; i < fixed.length; i++) {
    const char = fixed[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !inString) {
      inString = true;
      continue;
    }

    if (char === '"' && inString) {
      inString = false;
      // 记录可能的完整值位置
      if (braceDepth === 1 && bracketDepth === 0) {
        lastValidPos = i + 1;
      }
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      braceDepth++;
    } else if (char === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        lastValidPos = i + 1;
      }
    } else if (char === '[') {
      bracketDepth++;
    } else if (char === ']') {
      bracketDepth--;
    }
  }

  // 如果我们在字符串中间截断了，需要修复
  if (inString) {
    // 找到最后一个未闭合的字符串开始位置
    const lastQuote = fixed.lastIndexOf('"');
    if (lastQuote > 0) {
      // 检查这是否是一个键的开始
      const afterQuote = fixed.slice(lastQuote + 1).trim();
      if (afterQuote.startsWith(':')) {
        // 这是一个键，后面应该有值但被截断了
        fixed = fixed.slice(0, lastQuote) + '"';
      } else {
        // 这是一个字符串值被截断
        fixed = fixed.slice(0, lastQuote + 1);
      }
    }
  }

  // 重新计算并补全括号
  let newFixed = fixed;
  let newBraceDepth = 0;
  let newBracketDepth = 0;
  let newInString = false;
  let newEscape = false;

  for (let i = 0; i < newFixed.length; i++) {
    const char = newFixed[i];
    if (newEscape) {
      newEscape = false;
      continue;
    }
    if (char === '\\') {
      newEscape = true;
      continue;
    }
    if (char === '"' && !newInString) {
      newInString = true;
      continue;
    }
    if (char === '"' && newInString) {
      newInString = false;
      continue;
    }
    if (newInString) continue;
    if (char === '{') newBraceDepth++;
    if (char === '}') newBraceDepth--;
    if (char === '[') newBracketDepth++;
    if (char === ']') newBracketDepth--;
  }

  if (newInString) {
    newFixed += '"';
  }

  while (newBracketDepth > 0) {
    newFixed += ']';
    newBracketDepth--;
  }

  while (newBraceDepth > 0) {
    newFixed += '}';
    newBraceDepth--;
  }

  // 移除末尾的逗号
  if (newFixed.endsWith(',')) {
    newFixed = newFixed.slice(0, -1);
  }

  try {
    JSON.parse(newFixed);
    console.log('[AI] Smart fix successful');
    return newFixed;
  } catch {
    return null;
  }
}

// JSON 提取工具
function stripJsonPreamble(text: string): string {
  // 移除常见的前缀文字，直到第一个 { 或 [
  const idxObj = text.indexOf('{');
  const idxArr = text.indexOf('[');
  let start = -1;
  if (idxObj >= 0 && idxArr >= 0) start = Math.min(idxObj, idxArr);
  else if (idxObj >= 0) start = idxObj;
  else if (idxArr >= 0) start = idxArr;
  if (start > 0) return text.slice(start);
  return text;
}

function stripJsonPostamble(text: string): string {
  // 找到最后一个匹配的 } 或 ]
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let escapeNext = false;
  let lastValidPos = -1;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (char === '\\') { escapeNext = true; continue; }
    if (char === '"' && !inString) { inString = true; continue; }
    if (char === '"' && inString) { inString = false; continue; }
    if (inString) continue;
    if (char === '{') braceDepth++;
    else if (char === '}') { braceDepth--; if (braceDepth === 0 && bracketDepth === 0) lastValidPos = i; }
    else if (char === '[') bracketDepth++;
    else if (char === ']') { bracketDepth--; if (braceDepth === 0 && bracketDepth === 0) lastValidPos = i; }
  }
  if (lastValidPos >= 0) return text.slice(0, lastValidPos + 1);
  return text;
}

function findJsonCandidates(text: string): string[] {
  const candidates: string[] = [];
  // 1. markdown fenced block
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidates.push(fenced[1].trim());

  // 2. open fence without close
  const openFence = text.match(/```(?:json)?\s*([\s\S]*)/);
  if (openFence) candidates.push(openFence[1].trim());

  // 3. strip preamble/postamble
  const stripped = stripJsonPostamble(stripJsonPreamble(text));
  if (stripped) candidates.push(stripped);

  return candidates;
}

function extractJson(text: string): any {
  const trimmed = text.trim();
  // 1. 直接解析
  try { return JSON.parse(trimmed); } catch { /* continue */ }

  // 2. 尝试多个候选
  const candidates = findJsonCandidates(trimmed);
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch { /* try next */ }
    const fixed = tryFixTruncatedJson(candidate);
    if (fixed) {
      try { return JSON.parse(fixed); } catch { /* try next */ }
    }
  }

  // 3. 尝试找到最内层的 JSON 对象（从第一个 { 到最后一个匹配的 }）
  const objMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try { return JSON.parse(objMatch[0]); } catch {
      const fixed = tryFixTruncatedJson(objMatch[0]);
      if (fixed) {
        try { return JSON.parse(fixed); } catch { /* continue */ }
      }
    }
  }

  // 4. 尝试找到 JSON 数组（从第一个 [ 到最后一个匹配的 ]）
  const arrMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch {
      const fixed = tryFixTruncatedJson(arrMatch[0]);
      if (fixed) {
        try { return JSON.parse(fixed); } catch { /* continue */ }
      }
    }
  }

  console.error('[AI] Failed to extract JSON. Raw text preview:', trimmed.substring(0, 800));
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

// 去除 AI 在 revisedTextEn 开头添加的说明性文字（如 "Note: This revision..."）
function stripRevisedTextPreamble(text: string): string {
  if (!text) return '';

  // 常见的说明性前缀模式，匹配后删除到下一个段落
  const preamblePatterns = [
    /^Note:[^\n]*\n+/i,
    /^Note —[^\n]*\n+/i,
    /^Notice:[^\n]*\n+/i,
    /^This revision[^\n]*\n+/i,
    /^The following[^\n]*\n+/i,
    /^Below is[^\n]*\n+/i,
    /^Here is[^\n]*\n+/i,
    /^I have[^\n]*\n+/i,
    /^Please note[^\n]*\n+/i,
    /^\*\*Note\*\*:[^\n]*\n+/i,
    /^\[Note:[^\]]*\]\n+/i,
  ];

  let cleaned = text.trim();
  for (const pattern of preamblePatterns) {
    cleaned = cleaned.replace(pattern, '').trimStart();
  }
  return cleaned;
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

  // 处理 revisedTextEn — 去除 AI 有时在开头添加的说明性文字
  const rawRevisedText = raw.revisedTextEn || raw.revised_text_en || raw.revisedText || '';
  result.revisedTextEn = stripRevisedTextPreamble(rawRevisedText);

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

export type AiRuntimeConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  visionModel?: string;
};

export class AIService {
  // 生成单词释义
  static async defineWord(term: string, config?: AiRuntimeConfig) {
    const messages = [
      {
        role: 'system',
        content: `你是英语词典助手。为给定单词生成中文释义。

【绝对规则】
- 只返回纯 JSON 对象，不要 markdown 代码块（不要 \`\`\`），不要任何说明文字
- 不要加 "Here is"、"Sure" 等前缀，直接从第一个 { 开始

格式：
{"definitions":[{"word":"原词","partOfSpeech":"词性","definition":"中文释义","enrichment":{"collocations":["搭配1","搭配2"],"synonyms":["同义1","同义2"],"antonyms":["反义1"],"examples":[{"en":"例句","zh":"翻译"}],"usageZh":"用法说明（50字内）","difficulty":"easy|medium|hard"}}]}

注意：每个数组最多2项，examples只要1项，只返回最常用的1个词性。`,
      },
      {
        role: 'user',
        content: `"${term}"`,
      },
    ];

    const response = await callLLM(messages, {
      maxTokens: 1500,
      responseFormat: { type: 'json_object' },
      model: config?.model,
      baseUrl: config?.baseUrl,
      apiKey: config?.apiKey,
    });
    const result = extractJson(response);

    // 验证返回格式
    if (!result.definitions || !Array.isArray(result.definitions)) {
      throw new Error('AI 返回格式不正确');
    }

    return result;
  }

  // 步骤一：从图片中识别单词列表（只识别，不生成释义）
  static async recognizeWordsFromImage(imageBase64: string, config?: AiRuntimeConfig): Promise<string[]> {
    const messages = [
      {
        role: 'system',
        content: `你是专业的图片文字识别助手。
任务：识别图片中所有可见的英语单词，原样输出，不要修改。

规则：
- 包括教材、手写笔记、单词卡、屏幕截图等所有场景
- 如果图片只有少量单词（如单词卡），全部输出，一个都不能遗漏
- 如果图片是句子或段落，列出实词（名词/动词/形容词/副词），忽略 a/an/the/is/are/of/to/in/on/at/and/or/but/it/he/she/we/they 等功能词
- 最多返回 15 个单词
- 只返回纯 JSON，不要 markdown 代码块（不要 \`\`\`），不要任何说明文字
- 不要加 "Here is"、"Sure" 等前缀，直接从第一个 { 开始

返回格式：
{ "words": ["word1", "word2", "word3"] }`,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: '请识别图片中的所有英语单词：' },
          { type: 'image_url', image_url: { url: imageBase64 } },
        ],
      },
    ];

    const response = await callLLM(messages, {
      model: config?.visionModel || VISION_MODEL,
      temperature: 0.3,
      maxTokens: 500,
      retries: 0,
      stripThink: true,
      responseFormat: { type: 'json_object' },
      baseUrl: config?.baseUrl,
      apiKey: config?.apiKey,
    });
    const result = extractJson(response);

    if (!result.words || !Array.isArray(result.words)) {
      throw new Error('图片识别返回格式不正确');
    }

    return result.words
      .map((w: any) => (typeof w === 'string' ? w.trim() : String(w || '').trim()))
      .filter(Boolean);
  }

  // 图片识别单词（两步：先识别单词列表，再批量生成释义）
  static async extractWordsFromImage(imageBase64: string, config?: AiRuntimeConfig) {
    // Step 1：识别图片中的单词列表
    const wordList = await AIService.recognizeWordsFromImage(imageBase64, config);
    console.log('[AI] Recognized words from image:', wordList);

    if (wordList.length === 0) {
      return { words: [] };
    }

    // Step 2：对每个单词调用 defineWord 生成完整释义
    const words: any[] = [];
    for (const term of wordList) {
      try {
        const def = await AIService.defineWord(term, config);
        if (def.definitions && Array.isArray(def.definitions) && def.definitions.length > 0) {
          const d = def.definitions[0];
          words.push({
            word: d.word || term,
            partOfSpeech: d.partOfSpeech || 'noun',
            definition: d.definition || '',
            enrichment: d.enrichment,
          });
        }
      } catch (err) {
        console.warn(`[AI] Failed to define word "${term}", using fallback:`, err);
        // 降级：保留单词但不含释义，避免整批失败
        words.push({
          word: term,
          partOfSpeech: 'unknown',
          definition: '',
          enrichment: undefined,
        });
      }
    }

    // 过滤无效条目（保留 definition 为空的降级词条，只排除 word 本身为空的）
    const validWords = words.filter(
      (w: any) => w && typeof w.word === 'string' && w.word.trim()
    );

    return { words: validWords };
  }

  // 从图片中转录文章或作文文字（多模态 AI，替代 Tesseract）
  static async extractTextFromImage(imageBase64: string, mode: 'article' | 'essay', config?: AiRuntimeConfig): Promise<{ text: string }> {
    const systemPrompt = mode === 'article'
      ? `你是专业的图片文字转录助手。
任务：将图片中的英文文章完整、准确地转录为纯文本。

规则：
- 保留原文的段落结构（段落之间用空行分隔）
- 保持原文拼写，明显的印刷错误可以纠正
- 不添加任何注释、翻译或说明性文字
- 直接从第一个词开始输出，不加任何前言或后记`
      : `你是专业的手写与印刷文字识别助手。
任务：将图片中的英文作文完整转录为纯文本。

规则：
- 保留原文的所有拼写和语法错误（作文批改场景需要原始文本）
- 保留段落结构（段落之间用空行分隔）
- 不添加任何注释、评语或说明性文字
- 直接从第一个词开始输出，不加任何前言或后记`;

    const messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: '请转录图片中的文字：' },
          { type: 'image_url', image_url: { url: imageBase64 } },
        ],
      },
    ];

    const response = await callLLM(messages, {
      model: config?.visionModel || VISION_MODEL,
      temperature: 0.3,
      maxTokens: 4000,
      retries: 0,
      stripThink: true,
      baseUrl: config?.baseUrl,
      apiKey: config?.apiKey,
    });
    const text = response.trim();

    if (!text || text.length < 5) {
      throw new Error('未能从图片中识别到足够文字');
    }

    return { text };
  }

  // 生成练习题
  static async generatePractice(
    words: { word: string; definition: string; partOfSpeech: string }[],
    questionCount: number = 10,
    allowedTypes: ('mcq' | 'fill_blank' | 'reorder')[] = ['mcq', 'fill_blank', 'reorder'],
    config?: AiRuntimeConfig
  ) {
    const wordsText = words.map(w => `${w.word} (${w.partOfSpeech}): ${w.definition}`).join('\n');

    const messages = [
      {
        role: 'system',
        content: `你是一个英语练习题生成助手。请基于给定的单词列表生成${questionCount}道练习题。

【重要】必须生成${questionCount}道题目，不能多也不能少。

题型说明：
1. mcq (选择题): 单句填空，A/B/C/D 选项，测试词义和用法
2. fill_blank (填空题): 句子挖空，填写单词正确形式
3. reorder (重组题): 打乱单词顺序，要求重组为正确句子

【绝对规则】
- 只返回纯 JSON 对象，不要 markdown 代码块（不要 \`\`\`），不要任何说明文字
- 不要加 "Here is"、"Sure" 等前缀，直接从第一个 { 开始
- 必须生成${questionCount}道题目，不能多也不能少

请以 JSON 格式返回：
{
  "questions": [
    {
      "type": "mcq|fill_blank|reorder",
      "word": "目标单词",
      "promptEn": "题干英文（mcq和reorder需要）",
      "options": ["选项A英文", "选项B英文", "选项C英文", "选项D英文"], // mcq only: 四个英文选项
      "answerIndex": 0, // mcq only: 正确答案的索引 0-3（A=0, B=1, C=2, D=3）
      "analysisZh": "答案解析（必须是中文，详细解释为什么选择该答案）",
      "grammarZh": "语法讲解（必须是中文，讲解涉及的语法知识点）",
      "usageZh": "用法讲解（必须是中文，讲解单词的用法和搭配）",
      "parts": ["word1", "word2", "word3", "word4"], // reorder only: 打乱顺序的英文句子片段，至少4个
      "correctOrder": [2, 0, 1, 3], // reorder only: 正确顺序的索引数组，对应parts的索引
      "answerSentenceEn": "Correct sentence in English", // reorder only: 完整正确句子
      "translationZh": "句子中文翻译", // reorder only: 中文翻译
      "sentenceEn": "Fill in the blank sentence with ____ placeholder", // fill_blank only: 带空格的句子
      "acceptableAnswers": ["answer1", "answer2"] // fill_blank only: 可接受的答案列表（必填）
    }
  ]
}

【强制要求 - 非常重要，必须严格遵守】：
1. 所有解析字段必须是中文：
   - analysisZh: 必须是中文答案解析（不能用英文！）
   - grammarZh: 必须是中文语法讲解（不能用英文！）
   - usageZh: 必须是中文用法讲解（不能用英文！）
   注意：如果返回英文内容，系统会报错！

2. MCQ 题型：
   - promptEn: 英文题目句子（含空格）
   - options: 四个英文选项
   - answerIndex: 0-3 数字
   - 不要把题目放进选项里

3. fill_blank 题型：
   - sentenceEn: 带 ____ 的英文句子
   - acceptableAnswers: 答案列表

4. reorder 题型：
   - parts: 打乱顺序的英文片段
   - correctOrder: 索引数组

【题型分布要求】：
- 从 [${allowedTypes.join(', ')}] 中随机选择题型
- 不要按固定顺序（如选择、填空、重组、选择...）
- 确保题型分布随机，相邻题目可以是相同或不同题型

注意：analysisZh, grammarZh, usageZh 这三个字段的内容必须是纯中文，不要用英文！`,
      },
      {
        role: 'user',
        content: `请基于以下单词生成练习题：\n${wordsText}`,
      },
    ];

    const response = await callLLM(messages, {
      maxTokens: 3500,
      responseFormat: { type: 'json_object' },
      model: config?.model,
      baseUrl: config?.baseUrl,
      apiKey: config?.apiKey,
    });
    const result = extractJson(response);

    if (!result.questions || !Array.isArray(result.questions)) {
      throw new Error('AI 返回格式不正确');
    }

    // 辅助函数：检测文本是否包含中文字符
    const containsChinese = (text: string): boolean => {
      if (!text || typeof text !== 'string') return false;
      return /[\u4e00-\u9fa5]/.test(text);
    };

    // 辅助函数：获取中文内容，优先选择包含中文的字段
    const getChineseContent = (zhField: string, ...fallbackFields: string[]): string => {
      // 优先检查 zh 结尾的字段
      if (containsChinese(zhField)) return zhField;
      // 然后检查其他字段是否有中文内容
      for (const field of fallbackFields) {
        if (containsChinese(field)) return field;
      }
      // 如果都没有中文，优先返回 zh 字段（即使它是英文）
      return zhField || fallbackFields[0] || '';
    };

    // 数据规范化，确保所有必需字段都存在
    result.questions = result.questions.map((q: any, index: number) => {
      const normalized: any = {
        type: q.type || 'mcq',
        word: q.word || q.targetWord || '',
        promptEn: q.promptEn || '',
      };

      // 强制使用中文解析字段，优先选择包含中文的内容
      normalized.analysisZh = getChineseContent(
        q.analysisZh,
        q.explanationZh,
        q.analysis,
        q.explanation
      );
      normalized.grammarZh = getChineseContent(q.grammarZh, q.grammar);
      normalized.usageZh = getChineseContent(q.usageZh, q.usage);

      // 确保解析字段有中文内容，如果为空或非中文则提供默认中文解释
      const targetWord = normalized.word || q.word || '该单词';
      if (!containsChinese(normalized.analysisZh) || !normalized.analysisZh.trim()) {
        normalized.analysisZh = `正确答案是「${normalized.options?.[normalized.answerIndex] || targetWord}」。本题考查对单词「${targetWord}」含义的理解，需要结合上下文语境选择最合适的选项。`;
      }
      if (!containsChinese(normalized.grammarZh) || !normalized.grammarZh.trim()) {
        normalized.grammarZh = `本题涉及单词「${targetWord}」的语法应用。注意该单词在句中的成分和搭配关系，确保语法结构正确。`;
      }
      if (!containsChinese(normalized.usageZh) || !normalized.usageZh.trim()) {
        normalized.usageZh = `「${targetWord}」是一个常用词汇，建议多阅读相关例句来掌握其用法，注意与其他近义词的区别。`;
      }

      if (normalized.type === 'mcq') {
        // 确保有4个选项
        let options = Array.isArray(q.options) ? q.options.slice(0, 4) : [];
        while (options.length < 4) {
          options.push(`Option ${String.fromCharCode(65 + options.length)}`);
        }
        normalized.options = options;

        // 处理答案索引
        let answerIndex = 0;
        if (typeof q.answerIndex === 'number' && q.answerIndex >= 0 && q.answerIndex <= 3) {
          answerIndex = q.answerIndex;
        } else if (q.correctAnswer && typeof q.correctAnswer === 'string') {
          // 转换 A/B/C/D 为 0/1/2/3
          const idx = ['A', 'B', 'C', 'D'].indexOf(q.correctAnswer.toUpperCase());
          answerIndex = idx >= 0 ? idx : 0;
        }
        normalized.answerIndex = answerIndex;

        // 验证答案索引对应的选项是否存在
        if (!normalized.options[normalized.answerIndex]) {
          normalized.answerIndex = 0;
        }
      }

      if (normalized.type === 'fill_blank') {
        normalized.sentenceEn = q.sentenceEn || q.promptEn || '____';
        normalized.acceptableAnswers = Array.isArray(q.acceptableAnswers) && q.acceptableAnswers.length > 0
          ? q.acceptableAnswers
          : (q.correctAnswer ? [q.correctAnswer] : ['answer']);
      }

      if (normalized.type === 'reorder') {
        normalized.parts = Array.isArray(q.parts) && q.parts.length >= 2 ? q.parts : ['Part 1', 'Part 2', 'Part 3', 'Part 4'];
        normalized.correctOrder = Array.isArray(q.correctOrder) && q.correctOrder.length === normalized.parts.length
          ? q.correctOrder
          : normalized.parts.map((_: any, i: number) => i);
        normalized.answerSentenceEn = q.answerSentenceEn || '';
        normalized.translationZh = q.translationZh || '';
      }

      return normalized;
    });

    // Fisher-Yates 打乱算法，确保题型随机分布
    for (let i = result.questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result.questions[i], result.questions[j]] = [result.questions[j], result.questions[i]];
    }

    console.log('[AI] Practice generated:', JSON.stringify({
      totalQuestions: result.questions.length,
      mcqCount: result.questions.filter((q: any) => q.type === 'mcq').length,
      fillBlankCount: result.questions.filter((q: any) => q.type === 'fill_blank').length,
      reorderCount: result.questions.filter((q: any) => q.type === 'reorder').length,
    }, null, 2));

    return result;
  }

  // 生成故事
  static async generateStory(
    words: { word: string; definition: string }[],
    config?: AiRuntimeConfig
  ) {
    const wordsText = words.map(w => `${w.word}: ${w.definition}`).join('\n');

    const messages = [
      {
        role: 'system',
        content: `你是一个英语故事生成助手。请基于给定的单词列表编写一个有趣的故事，帮助学习者记忆这些单词。

【绝对规则】
- 只返回纯 JSON 对象，不要 markdown 代码块（不要 \`\`\`），不要任何说明文字
- 不要加 "Here is"、"Sure" 等前缀，直接从第一个 { 开始

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

    const response = await callLLM(messages, {
      maxTokens: 3500,
      responseFormat: { type: 'json_object' },
      model: config?.model,
      baseUrl: config?.baseUrl,
      apiKey: config?.apiKey,
    });
    const result = extractJson(response);

    if (!result.title || !result.story || !result.translation) {
      throw new Error('AI 返回格式不正确');
    }

    return result;
  }

  // 作文批改
  static async reviewEssay(title: string | undefined, essay: string, config?: AiRuntimeConfig) {
    const messages = [
      {
        role: 'system',
        content: `你是一个雅思写作 Task 2 批改专家。请对作文进行全面批改和评分。

【绝对规则】
- 只返回纯 JSON 对象，不要 markdown 代码块（不要 \`\`\`），不要任何说明文字
- 不要加 "Here is"、"Sure" 等前缀，直接从第一个 { 开始

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
  "revisedTextEn": "优化后的完整作文（英文）。重要：此字段只能包含修改后的作文正文，禁止包含任何说明、注释、前言或解释性文字（如 'Note:'、'This revision...' 等）。直接从作文第一段开始。",
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

    const response = await callLLM(messages, {
      maxTokens: 8000,
      responseFormat: { type: 'json_object' },
      model: config?.model,
      baseUrl: config?.baseUrl,
      apiKey: config?.apiKey,
    });
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
  static async studyArticle(article: string, generateQuestions: boolean = false, questionCount: number = 5, config?: AiRuntimeConfig) {
    const messages = [
      {
        role: 'system',
        content: `你是一个英语阅读教学助手。请对文章进行深度分析，帮助学习者理解。

【绝对规则】
- 只返回纯 JSON 对象，不要 markdown 代码块（不要 \`\`\`），不要任何说明文字
- 不要加 "Here is"、"Sure" 等前缀，直接从第一个 { 开始

请以 JSON 格式返回：
{
  "structure": {
    "overallMainIdea": "全文主旨（中文总结）",
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
      "question": "Question text in English",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "A/B/C/D",
      "explanation": "解析（中文）",
      "location": "定位依据（中文）"
    }
  ]` : ''}
}

${generateQuestions ? `【重要】必须生成 ${questionCount} 道阅读理解选择题，不能多也不能少。

要求：
1. 题目和选项必须是全英文
2. 解析可以用中文
3. 严格只生成 ${questionCount} 道题目` : '不要生成 questions 字段。'}`,
      },
      {
        role: 'user',
        content: `请分析以下文章：\n\n${article}`,
      },
    ];

    const response = await callLLM(messages, {
      maxTokens: 8000,
      model: config?.model,
      baseUrl: config?.baseUrl,
      apiKey: config?.apiKey,
    });
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
      questions: (rawResult.questions || [])
        .slice(0, generateQuestions ? questionCount : 0)
        .map((q: any) => ({
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
  }, config?: AiRuntimeConfig) {
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

【绝对规则】
- 只返回纯 JSON 对象，不要 markdown 代码块（不要 \`\`\`），不要任何说明文字
- 不要加 "Here is"、"Sure" 等前缀，直接从第一个 { 开始

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

    const response = await callLLM(messages, {
      maxTokens: 1500,
      responseFormat: { type: 'json_object' },
      model: config?.model,
      baseUrl: config?.baseUrl,
      apiKey: config?.apiKey,
    });
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
