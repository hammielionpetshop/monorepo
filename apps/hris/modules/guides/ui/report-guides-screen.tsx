'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Field, Input } from '@/components/ui/field';
import { Card, EmptyState } from '@/components/ui/surface';
import { matchesGuideSearch } from '../rules/report-guides';

type Row = { id: number; caseLabel: string; reportTo: string };

/** KAR-L34 Pedoman Lapor: jenis kasus → lapor ke siapa. Hanya dibaca; tidak mengubah siapa penyetuju (KAR-79). */
export function ReportGuidesScreen({ rows, canEdit }: { rows: Row[]; canEdit: boolean }) {
  const [query, setQuery] = useState('');
  const shown = rows.filter((row) => matchesGuideSearch(row, query));
  return (
    <div className="space-y-4">
      {canEdit && (
        <p className="text-sm text-ink-muted">
          Ubah isinya di <Link href="/settings/report-guides" className="text-brand-700">Pengaturan › Pedoman Lapor</Link>.
        </p>
      )}
      {rows.length === 0 ? (
        <Card><EmptyState title="Pedoman belum diisi." /></Card>
      ) : (
        <>
          <Field id="rg-search" label="Cari">
            <Input id="rg-search" type="search" placeholder="Mis. sakit, kasbon, mobil" value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>
          {shown.length === 0 ? (
            <Card><EmptyState title="Tidak ada yang cocok">Coba kata lain.</EmptyState></Card>
          ) : (
            <Card className="p-0 sm:p-0">
              <ul className="divide-y divide-line">
                {shown.map((row) => (
                  <li key={row.id} className="grid gap-1 p-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-4">
                    <span className="font-medium">{row.caseLabel}</span>
                    <span className="text-sm">{row.reportTo}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
