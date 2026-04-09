'use client';

import { useState, useEffect, useCallback } from 'react';
import { wordsApi, groupsApi, Word, Group, WordFilters } from './api-client';

// 单词列表 Hook
export function useWords(filters: WordFilters = {}) {
  const [words, setWords] = useState<Word[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWords = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await wordsApi.list(filters);
      if (response.success && response.data) {
        setWords(response.data.words);
        setTotal(response.data.total);
      } else {
        setError(response.error?.message || '获取单词失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setIsLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchWords();
  }, [fetchWords]);

  const refresh = useCallback(() => {
    fetchWords();
  }, [fetchWords]);

  return { words, total, isLoading, error, refresh };
}

// 分组列表 Hook
export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await groupsApi.list();
      if (response.success && response.data) {
        setGroups(response.data);
      } else {
        setError(response.error?.message || '获取分组失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const refresh = useCallback(() => {
    fetchGroups();
  }, [fetchGroups]);

  return { groups, isLoading, error, refresh };
}

// 批量操作 Hook
export function useWordMutations() {
  const [isLoading, setIsLoading] = useState(false);

  const createWord = useCallback(async (data: Parameters<typeof wordsApi.create>[0]) => {
    setIsLoading(true);
    try {
      const response = await wordsApi.create(data);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createBatch = useCallback(async (items: Parameters<typeof wordsApi.createBatch>[0]) => {
    setIsLoading(true);
    try {
      const response = await wordsApi.createBatch(items);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateWord = useCallback(async (id: string, data: Parameters<typeof wordsApi.update>[1]) => {
    setIsLoading(true);
    try {
      const response = await wordsApi.update(id, data);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteWord = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const response = await wordsApi.delete(id);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteBatch = useCallback(async (ids: string[]) => {
    setIsLoading(true);
    try {
      const response = await wordsApi.deleteBatch(ids);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    createWord,
    createBatch,
    updateWord,
    deleteWord,
    deleteBatch,
  };
}

// 分组操作 Hook
export function useGroupMutations() {
  const [isLoading, setIsLoading] = useState(false);

  const createGroup = useCallback(async (name: string) => {
    setIsLoading(true);
    try {
      const response = await groupsApi.create(name);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateGroup = useCallback(async (id: string, data: Parameters<typeof groupsApi.update>[1]) => {
    setIsLoading(true);
    try {
      const response = await groupsApi.update(id, data);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteGroup = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const response = await groupsApi.delete(id);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reorderGroups = useCallback(async (groupIds: string[]) => {
    setIsLoading(true);
    try {
      const response = await groupsApi.reorder(groupIds);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    createGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
  };
}
