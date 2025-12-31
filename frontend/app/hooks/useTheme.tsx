import { useEffect, useState } from 'react';

const THEME_EXPIRY_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

function getInitialTheme(): 'light' | 'dark' {
  // On server, return light (it will be corrected by the blocking script)
  if (typeof window === 'undefined') {
    return 'light';
  }

  // On client, read from localStorage synchronously
  const savedThemeData = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia(
    '(prefers-color-scheme: dark)'
  ).matches;

  if (savedThemeData) {
    try {
      const { theme: savedTheme, timestamp } = JSON.parse(savedThemeData);
      const now = Date.now();
      
      // Check if the saved preference has expired
      if (now - timestamp < THEME_EXPIRY_MS) {
        return savedTheme as 'light' | 'dark';
      } else {
        // Preference expired, fall back to system preference
        localStorage.removeItem('theme');
        return systemPrefersDark ? 'dark' : 'light';
      }
    } catch (e) {
      // If parsing fails, fall back to system preference
      localStorage.removeItem('theme');
      return systemPrefersDark ? 'dark' : 'light';
    }
  }
  
  return systemPrefersDark ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  useEffect(() => {
    const root = window.document.documentElement;

    // Set DaisyUI data-theme attribute
    // Theme names must match those defined in app/css/screen.css
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dim');
      root.classList.add('dark');
      root.classList.remove('theme-pending');
    } else {
      root.setAttribute('data-theme', 'retro');
      root.classList.remove('dark');
      root.classList.remove('theme-pending');
    }

    // Save user preference with timestamp
    const themeData = {
      theme,
      timestamp: Date.now()
    };
    localStorage.setItem('theme', JSON.stringify(themeData));
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  return { theme, toggleTheme };
}
