'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Select } from '@/components/ui/field';
import { Badge } from '@/components/ui/surface';
import { cn } from '@/lib/cn';

export type PositionOption = { id: number; name: string; fullAccess: boolean; active: boolean; holders: number };

/** Pilih jabatan: daftar di panel kiri (layar lebar), dropdown di HP. Pilihan disimpan di `?jabatan=`. */
export function PositionList({ positions, selectedId }: { positions: PositionOption[]; selectedId: number | null }) {
  const router = useRouter();
  return (
    <>
      <div className="lg:hidden">
        <label htmlFor="position" className="mb-1.5 block text-sm font-medium">Jabatan</label>
        <Select
          id="position"
          value={selectedId ?? ''}
          onChange={(e) => router.push(e.target.value ? `?jabatan=${e.target.value}` : '?', { scroll: false })}
        >
          <option value="">Pilih jabatan…</option>
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.fullAccess ? ' (mengikuti Pemilik)' : ''}{p.active ? '' : ' (nonaktif)'}
            </option>
          ))}
        </Select>
      </div>

      <nav aria-label="Daftar jabatan" className="hidden rounded-card border border-line bg-surface p-2 lg:sticky lg:top-4 lg:block">
        <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Jabatan</p>
        <ul className="space-y-0.5">
          {positions.map((p) => {
            const active = p.id === selectedId;
            return (
              <li key={p.id}>
                <Link
                  href={`?jabatan=${p.id}`}
                  scroll={false}
                  aria-current={active ? 'true' : undefined}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
                    active ? 'bg-brand-100 font-medium text-brand-700' : 'hover:bg-canvas',
                    !p.active && !active && 'text-ink-muted',
                  )}
                >
                  <span className="min-w-0 truncate">{p.name}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {p.fullAccess && <Badge tone="info">Penuh</Badge>}
                    {!p.active && <Badge tone="warn">Nonaktif</Badge>}
                    <span className="text-xs tabular-nums text-ink-muted" title={`${p.holders} pemegang`}>{p.holders}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
