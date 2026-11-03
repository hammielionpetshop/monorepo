'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { buttonClass } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/field';
import { Card } from '@/components/ui/surface';
import { bonusTitle } from '../rules/bonus';
import { rupiah } from '../rules/salary';
import { EntryTable } from './bonus-approval-screen';

type Entry = Parameters<typeof EntryTable>[0]['rows'][number];

/** GAJ-L27 Bonus Seseorang (tab Bonus di Gaji Seseorang): baris per jenis dan jumlah yang Disahkan. */
export function BonusTabScreen({ person, period, periods, rows, summary }: {
  person: { id: number; name: string }; period: { start: string; label: string }; periods: { start: string; label: string }[]; rows: Entry[];
  summary: { byKind: { kind: string; label: string; amount: number }[]; income: number; minusCorrections: { id: number; amount: number }[] };
}) {
  const router = useRouter();
  const minus = summary.minusCorrections.reduce((s, c) => s + c.amount, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="bt-period" label="Periode">
          <Select id="bt-period" value={period.start} onChange={(e) => router.push(`/gaji/${person.id}/bonus?periode=${e.target.value}`)}>
            {periods.map((p) => <option key={p.start} value={p.start}>{p.label}</option>)}
          </Select>
        </Field>
        <Link className={buttonClass({ variant: 'ghost' })} href={`/gaji/${person.id}`}>Kembali ke Gaji</Link>
        <Link className={buttonClass({ variant: 'ghost' })} href="/panduan/aturan-potongan">Lihat aturan</Link>
      </div>
      <Card className="space-y-1 text-sm">
        {summary.byKind.map((k) => <p key={k.kind}>{bonusTitle(k.label)} disahkan: <b className="tabular-nums">{rupiah(k.amount)}</b></p>)}
        <p>Jumlah masuk slip: <b className="tabular-nums">{rupiah(summary.income)}</b></p>
        {minus > 0 && <p className="text-ink-muted">Koreksi bonus minus {rupiah(minus)} diambil di tab Potongan bersama Potongan Lain.</p>}
      </Card>
      <EntryTable rows={rows} />
    </div>
  );
}
