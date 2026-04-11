// API 客户端配置
// 使用电脑IP地址，支持手机和电脑访问
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.0.100:4000';

// 调试：在浏览器控制台显示当前使用的API地址
if (typeof window !== 'undefined') {
  console.log('[API] Base URL:', API_BASE_URL);
}

// 存储 key
const TOKEN_KEY = 'lexi-auth-token';

// 获取 token
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

// 设置 token
export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

// 清除 token
export function clearToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// API 响应格式
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// 请求配置
interface RequestConfig extends RequestInit {
  skipAuth?: boolean;
  timeoutMs?: number;
}

// 带超时的 fetch
async function fetchWithTimeout(
  url: string,
  config: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...config,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// 通用请求函数
async function request<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  const timeoutMs = config.timeoutMs || 30000; // 默认 30 秒

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((config.headers as Record<string, string>) || {}),
  };

  // 添加认证 token
  if (!config.skipAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetchWithTimeout(
      url,
      {
        ...config,
        headers,
      },
      timeoutMs
    );

    const data: ApiResponse<T> = await response.json();

    // 如果 401，清除 token
    if (response.status === 401) {
      clearToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    return data;
  } catch (error) {
    // 调试：在控制台显示请求错误详情
    if (typeof window !== 'undefined') {
      console.error('[API] Request failed:', url, error);
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 'TIMEOUT_ERROR',
          message: '请求超时，请稍后重试',
        },
      };
    }
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : '网络请求失败',
      },
    };
  }
}

// ===== 认证 API =====

export interface User {
  id: string;
  username: string;
  createdAt: string;
}

export interface AuthResult {
  user: User;
  token: string;
}

export const authApi = {
  register: (username: string, password: string) =>
    request<AuthResult>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuth: true,
    }),

  login: (username: string, password: string) =>
    request<AuthResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuth: true,
    }),

  me: () => request<{ user: User }>('/api/auth/me'),
};

// ===== 单词 API =====

export interface Word {
  id: string;
  word: string;
  partOfSpeech: string;
  definition: string;
  enrichment?: {
    collocations?: string[];
    synonyms?: string[];
    antonyms?: string[];
    examples?: { en: string; zh: string }[];
    usageZh?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
  };
  groupId?: string | null;
  group?: {
    id: string;
    name: string;
  };
  capturedAt: string;
  mastered: boolean;
  photoData?: string;
}

export interface WordListResult {
  words: Word[];
  total: number;
  page: number;
  totalPages: number;
}

export interface WordFilters {
  search?: string;
  groupId?: string;
  mastered?: boolean;
  page?: number;
  limit?: number;
}

export const wordsApi = {
  list: (filters: WordFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.groupId !== undefined) params.append('groupId', filters.groupId);
    if (filters.mastered !== undefined) params.append('mastered', String(filters.mastered));
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    return request<WordListResult>(`/api/words?${params.toString()}`);
  },

  create: (data: Omit<Word, 'id' | 'capturedAt' | 'userId'>) =>
    request<Word>('/api/words', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createBatch: (items: Omit<Word, 'id' | 'capturedAt' | 'userId'>[]) =>
    request<{ created: Word[]; skipped: any[] }>('/api/words/batch', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  get: (id: string) => request<Word>(`/api/words/${id}`),

  update: (id: string, data: Partial<Word>) =>
    request<Word>(`/api/words/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/api/words/${id}`, {
      method: 'DELETE',
    }),

  deleteBatch: (ids: string[]) =>
    request<{ deleted: number }>('/api/words/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
};

// ===== 分组 API =====

export interface Group {
  id: string;
  name: string;
  order: number;
  wordCount?: number;
  createdAt: string;
}

export const groupsApi = {
  list: () => request<Group[]>('/api/groups'),

  create: (name: string) =>
    request<Group>('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  update: (id: string, data: Partial<Group>) =>
    request<Group>(`/api/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/api/groups/${id}`, {
      method: 'DELETE',
    }),

  reorder: (groupIds: string[]) =>
    request<{ success: boolean }>('/api/groups/reorder', {
      method: 'PUT',
      body: JSON.stringify({ groupIds }),
    }),
};

// ===== AI API =====

export interface DefinitionResult {
  definitions: Array<{
    word: string;
    partOfSpeech: string;
    definition: string;
    enrichment?: Word['enrichment'];
  }>;
}

export interface ExtractResult {
  words: Array<{
    word: string;
    partOfSpeech: string;
    definition: string;
    enrichment?: Word['enrichment'];
  }>;
}

export type QuestionType = 'mcq' | 'fill_blank' | 'reorder';

export interface PracticeQuestion {
  type: QuestionType;
  targetWord: string;
  promptZh?: string;
  promptEn: string;
  options?: string[];
  correctAnswer: string;
  answer?: string;
  explanation: string;
  analysis?: string;
  grammar?: string;
  usage?: string;
  fragments?: string[];
}

export interface PracticeResult {
  questions: PracticeQuestion[];
}

export interface StoryResult {
  title: string;
  story: string;
  translation: string;
}

export interface EssayReviewResult {
  scores: {
    tr: number;
    cc: number;
    lr: number;
    gra: number;
    overall: number;
    cefr: string;
  };
  issues: Array<{
    type: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    original?: string;
    suggestion?: string;
    corrected?: string;
  }>;
  revisedTextEn: string;
  revisedTextZh: string;
  keyChanges: Array<{
    before: string;
    after: string;
    explanation: string;
  }>;
}

export interface ArticleStudyResult {
  structure: {
    paragraphs: Array<{
      index: number;
      mainIdea: string;
      role: string;
      relationToPrevious: string;
    }>;
  };
  syntax: {
    highlights: Array<{
      sentence: string;
      analysis: string;
    }>;
  };
  difficultSentences: Array<{
    original: string;
    breakdown: string;
    simplified: string;
    rewrite: string;
  }>;
  keyVocabulary: Array<{
    word: string;
    meaning: string;
    usage: string;
  }>;
  questions?: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    location: string;
  }>;
}

// AI 请求超时时间（2 分钟）
const AI_TIMEOUT_MS = 120000;

export const aiApi = {
  define: (term: string) =>
    request<DefinitionResult>('/api/ai/define', {
      method: 'POST',
      body: JSON.stringify({ term }),
      timeoutMs: AI_TIMEOUT_MS,
    }),

  extract: (imageBase64: string) =>
    request<ExtractResult>('/api/ai/extract', {
      method: 'POST',
      body: JSON.stringify({ imageBase64 }),
      timeoutMs: AI_TIMEOUT_MS,
    }),

  practice: (wordIds: string[], questionCount?: number, allowedTypes?: QuestionType[]) =>
    request<PracticeResult>('/api/ai/practice', {
      method: 'POST',
      body: JSON.stringify({ wordIds, questionCount, allowedTypes }),
      timeoutMs: AI_TIMEOUT_MS,
    }),

  story: (wordIds: string[]) =>
    request<StoryResult>('/api/ai/story', {
      method: 'POST',
      body: JSON.stringify({ wordIds }),
      timeoutMs: AI_TIMEOUT_MS,
    }),

  reviewEssay: (essay: string, title?: string) =>
    request<EssayReviewResult>('/api/ai/review-essay', {
      method: 'POST',
      body: JSON.stringify({ essay, title }),
      timeoutMs: AI_TIMEOUT_MS,
    }),

  studyArticle: (article: string, generateQuestions?: boolean, questionCount?: number) =>
    request<ArticleStudyResult>('/api/ai/study-article', {
      method: 'POST',
      body: JSON.stringify({ article, generateQuestions, questionCount }),
      timeoutMs: AI_TIMEOUT_MS,
    }),

  speakingChat: (params: {
    scenario?: string;
    userTextEn: string;
    history?: Array<{ role: 'user' | 'assistant'; contentEn: string }>;
    targetLevel?: 'A2' | 'B1' | 'B2' | 'C1';
  }) =>
    request<{
      assistantReplyEn: string;
      feedbackZh: string;
      correctedUserEn?: string;
      issues?: Array<{
        type?: string;
        suggestion: string;
        reasonZh?: string;
      }>;
      scoreOverall?: number;
    }>('/api/ai/speaking-chat', {
      method: 'POST',
      body: JSON.stringify(params),
      timeoutMs: AI_TIMEOUT_MS,
    }),
};

// ===== 学习统计 API =====

export interface GamificationState {
  version: number;
  xp: number;
  unlockedBadges: string[];
  streak: {
    current: number;
    longest: number;
    lastActiveDate?: string;
  };
  totals: {
    wordsAdded: number;
    practiceCompleted: number;
    storiesGenerated: number;
    masteredMarked: number;
  };
  daily: Record<string, { xp: number; wordsAdded: number }>;
}

export interface GrowthGoals {
  weeklyXpGoal: number;
  weeklyWordsGoal: number;
}

export interface LearningEvent {
  id?: string;
  type: string;
  at: string;
  count?: number;
  correctCount?: number;
  totalCount?: number;
  wordCount?: number;
  termKey?: string;
}

export const userStatsApi = {
  getLearningStats: () =>
    request<GamificationState>('/api/user-stats/learning', {
      method: 'GET',
    }),

  updateLearningStats: (stats: GamificationState) =>
    request<{ success: boolean }>('/api/user-stats/learning', {
      method: 'POST',
      body: JSON.stringify({ stats }),
    }),

  getGoals: () =>
    request<GrowthGoals>('/api/user-stats/goals', {
      method: 'GET',
    }),

  updateGoals: (goals: GrowthGoals) =>
    request<{ success: boolean }>('/api/user-stats/goals', {
      method: 'POST',
      body: JSON.stringify({ goals }),
    }),

  getReadingStats: (articleKey: string) =>
    request<{ attempts: number; best: number; last: number; total: number; bestAt?: number; lastAt?: number }>(
      `/api/user-stats/reading?articleKey=${encodeURIComponent(articleKey)}`,
      { method: 'GET' }
    ),

  updateReadingStats: (data: { articleKey: string; score: number; total: number }) =>
    request<{ success: boolean }>('/api/user-stats/reading', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSpeakingStats: () =>
    request<{ days: Record<string, { attempts: number; scoreSum: number; best: number; last: number; lastAt?: number }> }>(
      '/api/user-stats/speaking',
      { method: 'GET' }
    ),

  updateSpeakingStats: (data: { dateKey: string; score: number; at: string }) =>
    request<{ success: boolean }>('/api/user-stats/speaking', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getEvents: (limit?: number) =>
    request<{ events: LearningEvent[] }>(`/api/user-stats/events?limit=${limit ?? 120}`, {
      method: 'GET',
    }),

  addEvent: (event: Omit<LearningEvent, 'id'>) =>
    request<{ events: LearningEvent[] }>('/api/user-stats/events', {
      method: 'POST',
      body: JSON.stringify({ event }),
    }),

  clearEvents: () =>
    request<{ success: boolean }>('/api/user-stats/events', {
      method: 'DELETE',
    }),

  recordEvent: (event: Omit<LearningEvent, 'id'>) =>
    request<GamificationState>('/api/user-stats/events/record', {
      method: 'POST',
      body: JSON.stringify({ event }),
    }),

  resetAll: () =>
    request<{ success: boolean }>('/api/user-stats/reset', {
      method: 'POST',
    }),
};
