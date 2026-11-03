'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/field';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { BONUS_KIND_LABELS, BONUS_STATUS_LABELS } from '../rules/bonus';
import { rupiah } from '../rules/salary';
import { EntryTable, ReasonDialog } from './bonus-approval-screen';

type Entry = Parameters<typeof EntryTable>[0]['rows'][number];

/** GAJ-L21 Buku Bonus: semua baris bonus satu periode; Finance hanya jumlah per jenis (GAJ-46). */
export function BonusBookScreen(props: {
  period: { start: string; label: string }; periods: { start: string; label: string }[];
  totals: { kind: string; label: string; count: number; amount: number }[];
  rows: Entry[] | null; people: { id: number; name: string }[];
  filters: { kind: string | null; status: string | null; employeeId: number | null }; can: { cancel: boolean }; me: number | null;
}) {
  const { period, periods, totals, rows, people, filters, can } = props;
  const [cancelling, setCancelling] = useState<Entry | null>(null);
  const router = useRouter();
  const toast = useToast();
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3" method="get">
        <Field id="bb-period" label="Periode">
          <Select id="bb-period" name="periode" defaultValue={period.start}>{periods.map((p) => <option key={p.start} value={p.start}>{p.label}</option>)}</Select>
        </Field>
        {rows && (
          <>
            <Field id="bb-kind" label="Jenis">
              <Select id="bb-kind" name="jenis" defaultValue={filters.kind ?? ''}>
                <option value="">Semua</option>{Object.entries(BONUS_KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            <Field id="bb-status" label="Status">
              <Select id="bb-status" name="status" defaultValue={filters.status ?? ''}>
                <option value="">Semua</option>{Object.entries(BONUS_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            <Field id="bb-person" label="Orang">
              <Select id="bb-person" name="orang" defaultValue={filters.employeeId ? String(filters.employeeId) : ''}>
                <option value="">Semua</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
          </>
        )}
        <Button type="submit" variant="secondary">Tampilkan</Button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2">
        {totals.map((t) => (
          <Card key={t.kind}>
            <p className="text-sm text-ink-muted">Bonus {t.label.toLowerCase()} disahkan</p>
            <p className="text-xl font-semibold tabular-nums">{rupiah(t.amount)}</p>
            <p className="text-xs text-ink-muted">{t.count} baris · termasuk koreksi</p>
          </Card>
        ))}
      </div>
      {rows ? (
        <EntryTable rows={rows} showPerson actions={(e) => (can.cancel && e.status === 'APPROVED' && e.employeeId !== props.me
          ? <Button size="sm" variant="ghost" onClick={() => setCancelling(e)}>Batalkan</Button> : null)} />
      ) : (
        <Alert tone="info">Finance melihat jumlah per jenis per periode saja, tanpa nama orang.</Alert>
      )}
      {cancelling && <ReasonDialog
        title={`Batalkan bonus ${cancelling.name} ${rupiah(cancelling.amount)}`}
        confirm="Batalkan"
        onClose={() => setCancelling(null)}
        onSubmit={(reason) => postJson('/api/payroll', { kind: 'bonus_reject', id: cancelling.id, reason })}
        done={() => { toast('Bonus dibatalkan.', 'ok'); setCancelling(null); router.refresh(); }}
      />}
    </div>
  );
}
