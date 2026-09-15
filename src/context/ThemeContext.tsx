import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  systemPreference: ResolvedTheme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'xval_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        return saved;
      }
    } catch (_) {}
    return 'system';
  });

  const [systemPreference, setSystemPreference] = useState<ResolvedTheme>(() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (_) {
      return 'dark';
    }
  });

  // Listen to OS-level system color-scheme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };

    setSystemPreference(mediaQuery.matches ? 'dark' : 'light');

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if ((mediaQuery as any).addListener) {
      (mediaQuery as any).addListener(handleChange);
      return () => (mediaQuery as any).removeListener(handleChange);
    }
  }, []);

  // Compute resolved theme
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return systemPreference;
    }
    return theme;
  }, [theme, systemPreference]);

  // Apply class and data attribute to documentElement
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(resolvedTheme);
    root.setAttribute('data-theme', resolvedTheme);
    root.style.colorScheme = resolvedTheme;

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (_) {}
  }, [theme, resolvedTheme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, systemPreference }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
