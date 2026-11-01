'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Alert, Card, EmptyState } from '@/components/ui/surface';
import { formatLongDate } from '../rules/dates';
import { HoldButton } from './shared';
import { useMutation } from './shared';

type Row = { id: number; name: string; code: string; branchName: string; positionName: string; joinedOn: string; promotionDueOn: string | null };

function monthsSince(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
}

/** KAR-L27 Promosi Training: Setujui (berlaku awal periode gaji berikutnya) atau Tunda. Keputusan final (KAR-23). */
export function PromotionScreen({ rows, today, nextPeriodStart }: { rows: Row[]; today: string; nextPeriodStart: string }) {
  const [approving, setApproving] = useState<Row | null>(null);
  const [deferring, setDeferring] = useState<Row | null>(null);
  const [deferForm, setDeferForm] = useState({ reviewAgainOn: '', reason: '' });
  const [path, setPath] = useState('');
  const { busy, error, setError, send } = useMutation(path);

  if (!rows.length) {
    return <Card><EmptyState title="Tidak ada yang menunggu penilaian">Orang Training masuk ke sini saat genap masa training (lihat Pengaturan) sejak bergabung.</EmptyState></Card>;
  }

  function open(row: Row, mode: 'approve' | 'defer') {
    setError(null);
    setPath(`/api/employees/${row.id}`);
    if (mode === 'approve') setApproving(row);
    else { setDeferForm({ reviewAgainOn: '', reason: '' }); setDeferring(row); }
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <Card key={row.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link href={`/karyawan/${row.id}`} className="font-semibold text-brand-700 hover:underline">{row.name}</Link>
              <p className="text-sm text-ink-muted">{row.code} · {row.positionName} · {row.branchName}</p>
              <p className="text-sm">
                Bergabung {formatLongDate(row.joinedOn)} · {monthsSince(row.joinedOn, today)} bulan bekerja
                {row.promotionDueOn && ` · dinilai sejak ${formatLongDate(row.promotionDueOn)}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => open(row, 'defer')}>Tunda</Button>
              <Button onClick={() => open(row, 'approve')}>Setujui</Button>
            </div>
          </div>
        </Card>
      ))}

      <Dialog open={!!approving} onClose={() => setApproving(null)} title="Setujui promosi">
        {approving && (
          <div className="space-y-3">
            <p>
              Status {approving.name} menjadi <strong>Karyawan</strong> dan gajinya menjadi Gaji Standar mulai{' '}
              <strong>{formatLongDate(nextPeriodStart)}</strong>.
            </p>
            <p className="text-ink-muted">Keputusan ini tidak bisa diubah.</p>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setApproving(null)} disabled={busy}>Kembali</Button>
              <HoldButton loading={busy} onClick={async () => {
                if (await send({ kind: 'promotion', decision: 'APPROVE' }, `${approving.name} menjadi Karyawan mulai ${formatLongDate(nextPeriodStart)}.`)) setApproving(null);
              }}>Setujui</HoldButton>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={!!deferring} onClose={() => setDeferring(null)} title="Tunda promosi">
        {deferring && (
          <div className="space-y-3">
            <Field id="pr-date" label="Nilai lagi pada">
              <Input id="pr-date" type="date" min={today} value={deferForm.reviewAgainOn} onChange={(e) => setDeferForm({ ...deferForm, reviewAgainOn: e.target.value })} />
            </Field>
            <Field id="pr-reason" label="Alasan">
              <Textarea id="pr-reason" value={deferForm.reason} onChange={(e) => setDeferForm({ ...deferForm, reason: e.target.value })} />
            </Field>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeferring(null)} disabled={busy}>Kembali</Button>
              <Button loading={busy} onClick={async () => {
                if (await send({ kind: 'promotion', decision: 'DEFER', ...deferForm },
                  `Penilaian ${deferring.name} ditunda sampai ${deferForm.reviewAgainOn ? formatLongDate(deferForm.reviewAgainOn) : '—'}.`)) setDeferring(null);
              }}>Tunda</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
