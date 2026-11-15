'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import type { SettingsScreenData } from '../server/screens';
import { ChangeDialog, HistoryDialog, longDate } from './shared';

type Item = SettingsScreenData['items'][number];

/** BER-L40 Pengaturan: dikelompokkan per modul; nilai sekarang, berlaku sejak, dan nilai berikutnya. */
export function SettingsScreen({ data }: { data: SettingsScreenData }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<{ item: Item; mode: 'change' | 'history' } | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, Item[]>();
    for (const item of data.items) {
      if (q && !`${item.meta.label} ${item.meta.explain}`.toLowerCase().includes(q)) continue;
      const list = map.get(item.meta.moduleLabel) ?? [];
      list.push(item);
      map.set(item.meta.moduleLabel, list);
    }
    return [...map.entries()];
  }, [data.items, query]);

  const affected = `Semua karyawan aktif (${data.activeEmployees} orang)`;

  return (
    <div className="space-y-4">
      <Input placeholder="Cari pengaturan" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Cari pengaturan" />
      {groups.length === 0 && <EmptyState title="Tidak ada pengaturan yang cocok" />}
      {groups.map(([module, items]) => (
        <Card key={module}>
          <h2 className="mb-2 font-semibold">{module}</h2>
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.meta.key} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">
                    {item.meta.label}{' '}
                    {item.meta.affectsMoney && <Badge tone="warn">Menyangkut hitungan</Badge>}
                  </p>
                  <p className="text-sm text-ink-muted">{item.meta.explain}</p>
                  <p className="text-sm">
                    <strong>{item.cell.value}</strong>
                    <span className="text-ink-muted"> · berlaku sejak {longDate(item.cell.since)}</span>
                  </p>
                  {item.cell.upcoming.map((u) => (
                    <p key={u.id} className="text-sm text-ink-muted">Berikutnya: <strong className="text-ink">{u.value}</strong> mulai {longDate(u.effectiveFrom)}</p>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setOpen({ item, mode: 'history' })}>Riwayat</Button>
                  {item.meta.canEdit && <Button size="sm" variant="secondary" onClick={() => setOpen({ item, mode: 'change' })}>Ubah</Button>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {open?.mode === 'change' && (
        <ChangeDialog key={open.item.meta.key} meta={open.item.meta} cell={open.item.cell} targetLabel="semua" affected={affected} onClose={() => setOpen(null)} />
      )}
      {open?.mode === 'history' && (
        <HistoryDialog meta={open.item.meta} cell={data.items.find((i) => i.meta.key === open.item.meta.key)?.cell ?? open.item.cell} targetLabel="Berlaku untuk semua" onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
