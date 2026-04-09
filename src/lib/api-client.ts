// API 客户端配置
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
}

// 通用请求函数
async function request<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

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
    const response = await fetch(url, {
      ...config,
      headers,
    });

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
  isMastered: boolean;
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
  isMastered?: boolean;
  page?: number;
  limit?: number;
}

export const wordsApi = {
  list: (filters: WordFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.groupId !== undefined) params.append('groupId', filters.groupId);
    if (filters.isMastered !== undefined) params.append('isMastered', String(filters.isMastered));
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

export const aiApi = {
  define: (term: string) =>
    request<DefinitionResult>('/api/ai/define', {
      method: 'POST',
      body: JSON.stringify({ term }),
    }),

  extract: (imageBase64: string) =>
    request<ExtractResult>('/api/ai/extract', {
      method: 'POST',
      body: JSON.stringify({ imageBase64 }),
    }),

  practice: (wordIds: string[], questionCount?: number, allowedTypes?: QuestionType[]) =>
    request<PracticeResult>('/api/ai/practice', {
      method: 'POST',
      body: JSON.stringify({ wordIds, questionCount, allowedTypes }),
    }),

  story: (wordIds: string[]) =>
    request<StoryResult>('/api/ai/story', {
      method: 'POST',
      body: JSON.stringify({ wordIds }),
    }),

  reviewEssay: (essay: string, title?: string) =>
    request<EssayReviewResult>('/api/ai/review-essay', {
      method: 'POST',
      body: JSON.stringify({ essay, title }),
    }),

  studyArticle: (article: string, generateQuestions?: boolean) =>
    request<ArticleStudyResult>('/api/ai/study-article', {
      method: 'POST',
      body: JSON.stringify({ article, generateQuestions }),
    }),
};
