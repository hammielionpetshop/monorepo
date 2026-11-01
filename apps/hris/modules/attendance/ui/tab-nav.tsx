import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Tab berupa tautan (pola layar Persetujuan); tab aktif dari alamat. */
export function TabNav({ label, tabs, active }: { label: string; tabs: { key: string; label: string; href: string }[]; active: string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1 border-b border-line">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
            active === tab.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-muted hover:text-ink',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
