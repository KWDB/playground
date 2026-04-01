import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';

const isThemeValue = (value: string | null): value is Theme => value === 'light' || value === 'dark';

// 同步读取 localStorage 防止 FOUC（Flash of Unstyled Content）
const resolveInitialTheme = (): Theme => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (isThemeValue(savedTheme)) {
    return savedTheme;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

interface ThemeState {
  theme: Theme;
}

interface ThemeActions {
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState & ThemeActions>()(
  devtools(
    persist(
      (set) => ({
        theme: resolveInitialTheme(),

        setTheme: (theme: Theme) => set({ theme }),
      }),
      {
        name: 'theme-store',
        onRehydrateStorage: () => (state) => {
          // Zustand persist 恢复后同步 DOM，确保与持久化状态一致
          if (state) {
            const root = document.documentElement;
            root.classList.remove('light', 'dark');
            root.classList.add(state.theme);
            root.style.colorScheme = state.theme;
          }
        },
      }
    ),
    { name: 'ThemeStore' }
  )
);

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme, setTheme: storeSetTheme } = useThemeStore();

  const setTheme = useCallback((nextTheme: Theme) => {
    storeSetTheme(nextTheme);
  }, [storeSetTheme]);

  const toggleTheme = useCallback(() => {
    const next = useThemeStore.getState().theme === 'light' ? 'dark' : 'light';
    storeSetTheme(next);
  }, [storeSetTheme]);

  // 同步 DOM class 和 colorScheme
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
    // 同步写入 localStorage 以支持 FOUC 防护的同步读取
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // 跨标签页同步
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      if (isThemeValue(event.newValue)) {
        storeSetTheme(event.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storeSetTheme]);

  const value = useMemo(() => ({
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
  }), [setTheme, theme, toggleTheme]);

  return React.createElement(ThemeContext.Provider, { value }, children);
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}