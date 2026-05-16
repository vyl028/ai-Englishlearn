// API 客户端配置
// 优先读构建时注入的环境变量，开发模式兜底用当前页面的 hostname（手机访问时自动使用局域网 IP）
function resolveApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    // 用当前页面的 hostname，确保手机访问时指向正确的局域网 IP
    return `http://${window.location.hostname}:4000`;
  }
  return 'http://localhost:4000';
}

const API_BASE_URL = resolveApiBaseUrl();

import { fetchWithTimeout } from '@/lib/fetch-utils';

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

import type { WordEnrichment, ReviewEssayOutput, SpeakingChatOutput, GeneratePracticeOutput, StudyArticleOutput, GenerateStoryOutput, PracticeQuestionType } from '@/lib/types';

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

    // 防御性校验：确保返回的是合法对象（防止拦截器或异常响应导致 undefined/null）
    if (!data || typeof data !== 'object' || !('success' in data)) {
      console.error('[API] Invalid response format:', data);
      return {
        success: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: '服务器返回格式异常，请稍后重试',
        },
      };
    }

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
  enrichment?: WordEnrichment;
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

  practice: (wordIds: string[], questionCount?: number, allowedTypes?: PracticeQuestionType[]) =>
    request<{ questions: GeneratePracticeOutput }>('/api/ai/practice', {
      method: 'POST',
      body: JSON.stringify({ wordIds, questionCount, allowedTypes }),
      timeoutMs: AI_TIMEOUT_MS,
    }),

  story: (wordIds: string[]) =>
    request<GenerateStoryOutput>('/api/ai/story', {
      method: 'POST',
      body: JSON.stringify({ wordIds }),
      timeoutMs: AI_TIMEOUT_MS,
    }),

  reviewEssay: (essay: string, title?: string) =>
    request<ReviewEssayOutput>('/api/ai/review-essay', {
      method: 'POST',
      body: JSON.stringify({ essay, title }),
      timeoutMs: AI_TIMEOUT_MS,
    }),

  studyArticle: (article: string, generateQuestions?: boolean, questionCount?: number) =>
    request<StudyArticleOutput>('/api/ai/study-article', {
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
    request<SpeakingChatOutput>('/api/ai/speaking-chat', {
      method: 'POST',
      body: JSON.stringify(params),
      timeoutMs: AI_TIMEOUT_MS,
    }),

  extractText: (imageBase64: string, mode: 'article' | 'essay') =>
    request<{ text: string }>('/api/ai/extract-text', {
      method: 'POST',
      body: JSON.stringify({ imageBase64, mode }),
      timeoutMs: AI_TIMEOUT_MS,
    }),
};

// ===== AI 配置 API =====

export interface AiConfig {
  provider: string;
  model: string;
  visionModel: string;
  baseUrl: string;
  apiKey: string;
}

export const aiConfigApi = {
  get: () =>
    request<{ effective: AiConfig; userConfig: AiConfig | null }>('/api/ai/config', {
      method: 'GET',
    }),

  update: (data: Partial<AiConfig>) =>
    request<AiConfig>('/api/ai/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  reset: () =>
    request<{ reset: boolean }>('/api/ai/config', {
      method: 'DELETE',
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

// ===== Practice API =====

export interface PracticeRecordListItem {
  id: string;
  questionCount: number;
  correctCount: number;
  totalCount: number;
  isSubmitted: boolean;
  createdAt: string;
  updatedAt: string;
  answerCount: number;
}

export interface PracticeRecordDetail {
  id: string;
  questionsJson: string;
  wordIds: string[];
  questionCount: number;
  correctCount: number;
  totalCount: number;
  isSubmitted: boolean;
  createdAt: string;
  updatedAt: string;
  answers: Array<{
    id: string;
    questionIndex: number;
    questionType: string;
    word: string;
    promptEn: string;
    userAnswer: string | null;
    correctAnswer: string | null;
    isCorrect: boolean;
  }>;
}

export interface SubmitPracticeInput {
  answers: Array<{
    questionIndex: number;
    questionType: string;
    word: string;
    promptEn: string;
    userAnswer: string | null;
    correctAnswer: string | null;
    isCorrect: boolean;
  }>;
  correctCount: number;
  totalCount: number;
  wordResults?: Array<{ wordId: string; isCorrect: boolean }>;
}

export const practiceApi = {
  create: (data: { questionsJson: string; wordIds: string[]; questionCount: number }) =>
    request<{ id: string }>('/api/practice', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  list: (params?: { limit?: number; offset?: number }) =>
    request<{ records: PracticeRecordListItem[] }>(`/api/practice?limit=${params?.limit ?? 50}&offset=${params?.offset ?? 0}`, {
      method: 'GET',
    }),

  get: (id: string) =>
    request<PracticeRecordDetail>(`/api/practice/${id}`, {
      method: 'GET',
    }),

  submit: (id: string, data: SubmitPracticeInput) =>
    request<PracticeRecordDetail>(`/api/practice/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ deleted: boolean }>(`/api/practice/${id}`, {
      method: 'DELETE',
    }),
};

// ===== Word Mastery API =====

export interface WordMasteryStat {
  wordId: string;
  word: string;
  partOfSpeech: string;
  definition: string;
  isMastered: boolean;
  totalAppeared: number;
  totalCorrect: number;
  consecutiveCorrect: number;
  lastAnsweredAt: string | null;
  masteryScore: number;
  isAutoMastered: boolean;
}

export const wordMasteryApi = {
  list: (params?: { minScore?: number; maxScore?: number; onlyAutoMastered?: boolean; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.minScore !== undefined) qs.append('minScore', String(params.minScore));
    if (params?.maxScore !== undefined) qs.append('maxScore', String(params.maxScore));
    if (params?.onlyAutoMastered) qs.append('onlyAutoMastered', 'true');
    if (params?.limit !== undefined) qs.append('limit', String(params.limit));
    if (params?.offset !== undefined) qs.append('offset', String(params.offset));
    return request<{ stats: WordMasteryStat[] }>(`/api/word-mastery?${qs.toString()}`, {
      method: 'GET',
    });
  },

  get: (wordId: string) =>
    request<WordMasteryStat | null>(`/api/word-mastery/${wordId}`, {
      method: 'GET',
    }),

  recalculateAll: () =>
    request<{ recalculated: number }>('/api/word-mastery/recalculate', {
      method: 'POST',
    }),

  recalculateOne: (wordId: string) =>
    request<WordMasteryStat>(`/api/word-mastery/${wordId}/recalculate`, {
      method: 'POST',
    }),

  resetOne: (wordId: string) =>
    request<{ reset: boolean }>(`/api/word-mastery/${wordId}`, {
      method: 'DELETE',
    }),

  resetAll: () =>
    request<{ reset: boolean }>('/api/word-mastery', {
      method: 'DELETE',
    }),
};

// ===== 学习计划 API =====

export interface EvaluationDimension {
  score: number;
  label: string;
  details: Record<string, number | string>;
}

export interface EvaluationReport {
  overallScore: number;
  trend: 'up' | 'down' | 'stable';
  dimensions: {
    vocabulary: EvaluationDimension;
    practice: EvaluationDimension;
    activity: EvaluationDimension;
  };
  weakPoints: string[];
  strengths: string[];
}

export interface RecommendedWord {
  wordId: string;
  word: string;
  partOfSpeech: string;
  definition: string;
  masteryScore: number;
  reason: 'weak' | 'at_risk' | 'consecutive_wrong';
}

export interface PlanTask {
  id: string;
  type: 'review_words' | 'practice' | 'read_article' | 'story' | 'speaking' | 'capture_words';
  title: string;
  description: string;
  targetCount?: number;
  wordIds?: string[];
  questionTypes?: string[];
  estimatedMinutes: number;
}

export interface LearningPlanData {
  id: string;
  dateKey: string;
  planType: 'daily' | 'weekly';
  status: string;
  evaluationSnapshot: {
    overallScore: number;
    vocabularyScore: number;
    practiceScore: number;
    activityScore: number;
  };
  title: string;
  tasks: PlanTask[];
}

export interface RecommendationsData {
  recommendedWords: RecommendedWord[];
  recommendedTypes: string[];
  goalSuggestion: string | null;
}

export const learningPlanApi = {
  getEvaluation: () =>
    request<EvaluationReport>('/api/learning-plan/evaluation', {
      method: 'GET',
    }),

  getTodayPlan: () =>
    request<LearningPlanData>('/api/learning-plan/today', {
      method: 'GET',
    }),

  generatePlan: (planType: 'daily' | 'weekly' = 'daily') =>
    request<LearningPlanData>('/api/learning-plan/generate', {
      method: 'POST',
      body: JSON.stringify({ planType }),
    }),

  updatePlanStatus: (id: string, status: string) =>
    request<LearningPlanData>(`/api/learning-plan/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  getHistory: (limit?: number) =>
    request<{ history: Array<Pick<LearningPlanData, 'id' | 'dateKey' | 'planType' | 'status' | 'title'>> }>(
      `/api/learning-plan/history?limit=${limit ?? 30}`,
      { method: 'GET' }
    ),
};
