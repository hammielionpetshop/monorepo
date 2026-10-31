'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { THEME_LABELS, THEME_MODES, THEME_STORAGE_KEY, applyThemeMode, readThemeMode, type ThemeMode } from './theme';

const ICONS: Record<ThemeMode, React.ReactNode> = {
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  dark: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  system: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
};

/** Tombol putar tema: Terang → Gelap → Ikuti perangkat. */
export function ThemeToggle({ className }: { className?: string }) {
  // Sebelum terbaca dari perangkat, anggap "Ikuti perangkat" agar render server dan klien sama.
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => setMode(readThemeMode()), []);

  // Mode "Ikuti perangkat" ikut berubah ketika setelan perangkat berubah.
  useEffect(() => {
    if (mode !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyThemeMode('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [mode]);

  function next() {
    const nextMode = THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length];
    try {
      if (nextMode === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    } catch {
      // Penyimpanan diblokir: tema tetap berganti untuk halaman ini saja.
    }
    applyThemeMode(nextMode);
    setMode(nextMode);
  }

  const label = `Tema: ${THEME_LABELS[mode]}. Ketuk untuk mengganti.`;
  return (
    <button
      type="button"
      onClick={next}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-canvas hover:text-ink',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        width={20}
        height={20}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        focusable="false"
      >
        {ICONS[mode]}
      </svg>
    </button>
  );
}
