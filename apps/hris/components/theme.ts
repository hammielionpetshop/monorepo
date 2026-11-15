/** Pilihan tema disimpan per perangkat (bukan per akun). */
export const THEME_STORAGE_KEY = 'hris-theme';

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

export const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Terang',
  dark: 'Gelap',
  system: 'Ikuti perangkat',
};

/**
 * Dijalankan di <head> sebelum halaman tergambar supaya mode gelap tidak berkedip putih.
 * Harus mandiri (tanpa import) karena disisipkan sebagai teks.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;

export function readThemeMode(): ThemeMode {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function applyThemeMode(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
