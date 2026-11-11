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

export type ThemeChoice = 'light' | 'dark' | 'device';
const CHANGED = 'wc-theme';

function readChoice(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'dark' || t === 'light' ? t : 'device';
  } catch {
    return 'device';
  }
}

function subscribeChoice(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

// Light, dark, or "device" (no saved choice, so public/theme.js follows the OS).
export function useThemeChoice(): [ThemeChoice, (choice: ThemeChoice) => void] {
  const choice = useSyncExternalStore(subscribeChoice, readChoice, () => 'device' as ThemeChoice);
  const setChoice = (next: ThemeChoice) => {
    try {
      if (next === 'device') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked: the class still changes for this visit.
    }
    const dark = next === 'device' ? window.matchMedia('(prefers-color-scheme: dark)').matches : next === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    window.dispatchEvent(new Event(CHANGED));
  };
  return [choice, setChoice];
}
