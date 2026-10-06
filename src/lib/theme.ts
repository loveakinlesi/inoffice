import { useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

// A per-device preference, kept apart from attendance data so "Delete all data" leaves it alone.
// index.html reads the same key before first paint to avoid a flash of the wrong theme.
const KEY = 'inoffice.theme';
const THEME_COLOR = { light: '#f6f6fa', dark: '#15141f' };
const media = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

function read(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch { return 'system'; }
}

let preference = read();

function apply() {
  const dark = preference === 'dark' || (preference === 'system' && media.matches);
  const root = document.documentElement;
  // Suppress transitions for one frame so every colour swaps at once.
  root.classList.add('theme-switching');
  root.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
}

media.addEventListener('change', () => { if (preference === 'system') apply(); });
// Keep other tabs in step.
window.addEventListener('storage', e => {
  if (e.key !== KEY) return;
  preference = read();
  apply();
  listeners.forEach(l => l());
});

export function setTheme(next: ThemePreference) {
  preference = next;
  try { next === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, next); } catch { /* Still applies for this visit. */ }
  apply();
  listeners.forEach(l => l());
}

export function useTheme() {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => listeners.delete(listener); },
    () => preference,
  );
}
