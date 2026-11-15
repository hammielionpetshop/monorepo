'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import type { BoardSection } from '../server/dashboard';

const TONE = { danger: 'bg-danger-bg', warn: '', ok: '' } as const;

/** Dashboard Logistik (spec LT1 §17.1 butir 7): hanya membaca, muat ulang otomatis tiap 1 menit, tiap baris Buka ke layar pemiliknya. */
export function DashboardScreen({ sections, readAt }: { sections: BoardSection[]; readAt: string }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">Data dibaca jam {readAt} (muat ulang otomatis tiap 1 menit). Angka uang dari laporan awak dan pemeriksaan Finance; tanpa piutang dan laba.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.key} className="space-y-2">
            <h2 className="font-semibold">{section.title} <span className="tabular-nums text-ink-muted">{section.rows.length}</span></h2>
            {!section.rows.length ? <EmptyState title={section.key === 'RUNNING' ? 'Tidak ada yang berjalan' : 'Tidak ada yang perlu perhatian'} /> : (
              <ul className="space-y-2">
                {section.rows.map((row) => (
                  <li key={row.key} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2 text-sm ${row.tone ? TONE[row.tone] : ''}`}>
                    <span>
                      <span className="font-medium">{row.label}</span>{' '}
                      <Badge tone={row.tone === 'danger' ? 'danger' : row.tone === 'warn' ? 'warn' : 'info'}>{row.value}</Badge>
                      {row.detail && <span className="block text-ink-muted">{row.detail}</span>}
                    </span>
                    <Link href={row.href} className="text-sm font-medium underline">Buka</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
