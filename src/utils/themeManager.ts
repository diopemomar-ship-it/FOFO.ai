import { AppTheme, ResolvedTheme } from '../types';

export const THEME_STORAGE_KEY = 'fofo_theme';

export type SystemColorScheme = 'light' | 'dark';

export function getSystemColorScheme(): SystemColorScheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }
  try {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // ignore matchMedia errors
  }
  return 'dark';
}

export function getInitialThemePreference(): AppTheme {
  if (typeof window === 'undefined') return 'system';
  try {
    const savedUser = localStorage.getItem('fofo_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      if (
        parsed?.theme === 'system' ||
        parsed?.theme === 'light' ||
        parsed?.theme === 'deep-night' ||
        parsed?.theme === 'neon-contrast'
      ) {
        return parsed.theme;
      }
    }
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (
      savedTheme === 'system' ||
      savedTheme === 'light' ||
      savedTheme === 'deep-night' ||
      savedTheme === 'neon-contrast'
    ) {
      return savedTheme;
    }
  } catch {
    // ignore storage errors
  }
  // Par défaut : suit automatiquement la préférence système claire/sombre au démarrage
  return 'system';
}

export function resolveAppTheme(
  preference: AppTheme,
  systemScheme: SystemColorScheme = getSystemColorScheme()
): ResolvedTheme {
  if (preference === 'system') {
    return systemScheme === 'light' ? 'light' : 'deep-night';
  }
  return preference;
}

export function applyThemeToDocument(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (resolved === 'light') {
    root.classList.remove('dark', 'theme-neon-contrast');
    root.classList.add('light');
    root.style.colorScheme = 'light';
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
    if (resolved === 'neon-contrast') {
      root.classList.add('theme-neon-contrast');
    } else {
      root.classList.remove('theme-neon-contrast');
    }
  }

  root.setAttribute('data-theme', resolved);

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', resolved === 'light' ? '#F4F4F5' : '#000000');
  }
}

export function subscribeToSystemColorScheme(
  onChange: (scheme: SystemColorScheme) => void
): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = (e: MediaQueryListEvent) => {
    onChange(e.matches ? 'dark' : 'light');
  };

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }

  // Fallback navigateurs anciens
  mediaQuery.addListener(listener);
  return () => mediaQuery.removeListener(listener);
}
