'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

// Kunci tanda Baru yang aktif hari ini, dihitung server di kerangka aplikasi (lib/new-features.ts).
const NewFeaturesContext = createContext<ReadonlySet<string>>(new Set());

export function NewFeaturesProvider({ keys, children }: { keys: string[]; children: ReactNode }) {
  return <NewFeaturesContext.Provider value={new Set(keys)}>{children}</NewFeaturesContext.Provider>;
}

export function useNewKeys(): ReadonlySet<string> {
  return useContext(NewFeaturesContext);
}

export function useIsNew(feature: string): boolean {
  return useContext(NewFeaturesContext).has(feature);
}

/** Tanda "Baru" kecil; tidak tampil bila fiturnya tidak (lagi) baru. */
export function NewBadge({ feature, className }: { feature: string; className?: string }) {
  if (!useIsNew(feature)) return null;
  return (
    <span className={cn('inline-flex shrink-0 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-white', className)}>
      Baru
    </span>
  );
}
