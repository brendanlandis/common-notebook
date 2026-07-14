import { useCallback, useEffect, useRef, useState } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

// Read the persisted *selection*. Absence of the key means "follow the system"
// (the default). We deliberately no longer expire a stored choice on a timer —
// a manual Light/Dark pick is sticky until the user changes it; the only way back
// to automatic is re-selecting System (which removes the key).
//
// Older builds wrote a `{ theme, timestamp }` JSON blob; tolerate that shape so
// existing users keep their last pick instead of being bounced to system on
// upgrade. The persist effect below rewrites it to the new bare-string format.
function getStoredChoice(): ThemeChoice {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return 'system';
  }

  // New format: a bare 'light' | 'dark' string.
  if (raw === 'light' || raw === 'dark') {
    return raw;
  }

  // Legacy format: JSON like { theme: 'light' | 'dark', timestamp: number }.
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.theme === 'light' || parsed?.theme === 'dark') {
      return parsed.theme;
    }
  } catch {
    // Unparseable — fall through to system.
  }

  return 'system';
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.matchMedia(DARK_QUERY).matches;
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(getStoredChoice);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() =>
    systemPrefersDark() ? 'dark' : 'light'
  );

  // The theme actually applied to the page: the explicit choice, or the live OS
  // preference when the choice is "system".
  const resolved: ResolvedTheme = choice === 'system' ? systemTheme : choice;

  // Track the OS preference so "system" follows it live (no reload needed).
  useEffect(() => {
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Apply the resolved theme to the document. We set `data-theme` explicitly even
  // in system mode: daisyUI's `dim --prefersdark` would otherwise cover OS-dark,
  // but app/css/color.css keys its dark-mode variable overrides off
  // html[data-theme="dim"], so the attribute must always mirror the resolved theme.
  useEffect(() => {
    const root = window.document.documentElement;
    if (resolved === 'dark') {
      root.setAttribute('data-theme', 'dim');
      root.classList.add('dark');
    } else {
      root.setAttribute('data-theme', 'retro');
      root.classList.remove('dark');
    }
    root.classList.remove('theme-pending');
  }, [resolved]);

  // Persist the selection: an explicit choice is stored; "system" clears the
  // override so the page falls back to prefers-color-scheme.
  useEffect(() => {
    if (choice === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, choice);
    }
  }, [choice]);

  // Remember the state we cycled *from*, so the loop can tell a mid-cycle step
  // (we arrived here from the other theme) from a fresh start on an explicit theme.
  const prevChoiceRef = useRef<ThemeChoice | null>(null);

  // Advance the single toggle button. Leaving "system" always flips whatever the
  // OS is currently showing, so the first click is visible no matter the OS. From
  // an explicit theme, the first click flips to the other theme and the next
  // returns to system. The one quiet step (the OS-matching theme -> system) only
  // happens on the return leg of a cycle that began at system, never as a fresh
  // first click. Concretely:
  //   system (OS dark)  -> light -> dark  -> system
  //   system (OS light) -> dark  -> light -> system
  //   light / dark      -> opposite theme -> system
  const cycleTheme = useCallback(() => {
    let next: ThemeChoice;
    if (choice === 'system') {
      // Show the theme the OS *isn't* currently showing.
      next = systemTheme === 'dark' ? 'light' : 'dark';
    } else {
      const opposite: ThemeChoice = choice === 'dark' ? 'light' : 'dark';
      // If we just came from the opposite theme, both themes have been shown this
      // pass -> return to system; otherwise flip to the opposite theme first.
      next = prevChoiceRef.current === opposite ? 'system' : opposite;
    }
    prevChoiceRef.current = choice;
    setChoice(next);
  }, [choice, systemTheme]);

  return { choice, resolved, setChoice, cycleTheme };
}
