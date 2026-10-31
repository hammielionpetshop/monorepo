'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ToastTone = 'ok' | 'danger' | 'info';
type ToastItem = { id: number; tone: ToastTone; message: string };

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {items.map((i) => (
          <div
            key={i.id}
            className={cn(
              'pointer-events-auto max-w-sm rounded-lg px-4 py-2.5 text-sm text-surface shadow-lg',
              i.tone === 'ok' && 'bg-ok-fg', i.tone === 'danger' && 'bg-danger-fg', i.tone === 'info' && 'bg-ink',
            )}
          >
            {i.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const push = useContext(ToastContext);
  if (!push) throw new Error('useToast harus dipakai di dalam ToastProvider.');
  return push;
}
