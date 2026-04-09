'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, User } from './api-client';
import { getToken, setToken, clearToken } from './api-client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 检查登录状态
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (token) {
        // 同步 token 到 cookie（兼容旧版用户：之前只存到 localStorage）
        setToken(token);
        try {
          const response = await authApi.me();
          if (response.success && response.data) {
            setUser(response.data.user);
          } else {
            clearToken();
          }
        } catch {
          clearToken();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // 登录
  const login = useCallback(async (username: string, password: string) => {
    const response = await authApi.login(username, password);

    if (response.success && response.data) {
      setToken(response.data.token);
      setUser(response.data.user);
      return { success: true };
    } else {
      return {
        success: false,
        error: response.error?.message || '登录失败',
      };
    }
  }, []);

  // 注册
  const register = useCallback(async (username: string, password: string) => {
    const response = await authApi.register(username, password);

    if (response.success && response.data) {
      setToken(response.data.token);
      setUser(response.data.user);
      return { success: true };
    } else {
      return {
        success: false,
        error: response.error?.message || '注册失败',
      };
    }
  }, []);

  // 登出
  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    window.location.href = '/login';
  }, []);

  // 刷新用户信息
  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (token) {
      const response = await authApi.me();
      if (response.success && response.data) {
        setUser(response.data.user);
      }
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
