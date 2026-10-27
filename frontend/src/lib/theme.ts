'use client';

import { useSyncExternalStore } from 'react';

// Dark mode uses the same switch as public/theme.js: the "dark" class on
// <html>, with the choice saved under localStorage "theme".
const KEY = 'theme';

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

const isDark = () => document.documentElement.classList.contains('dark');

export function useDarkMode(): [boolean, (dark: boolean) => void] {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const setDark = (next: boolean) => {
    try {
      localStorage.setItem(KEY, next ? 'dark' : 'light');
    } catch {
      // Storage blocked: the class still changes for this visit.
    }
    document.documentElement.classList.toggle('dark', next);
  };
  return [dark, setDark];
}
